// ---------------------------------------------------------------------------
// OpenAI Ads Conversions API (envio server-side).
//
// Par do pixel oaiq, pelo mesmo motivo do Meta CAPI: bloqueador, iOS e aba
// fechada cedo derrubam uma fatia dos eventos de navegador, e a plataforma
// otimiza com um retrato incompleto de quem converte.
//
// A deduplicação é por `id`: aqui ele é o MESMO event_id gerado no pixel
// (src/lib/tracking.ts) e devolvido no payload do lead. Com ele a OpenAI
// entende que navegador e servidor descrevem a mesma conversão e conta uma vez
// só. Sem ele, a conversão dobra.
//
// Especificação oficial: https://developers.openai.com/ads/conversions-api
//   - Campos de usuário no CAPI são LISTAS no plural (máx. 3 itens únicos):
//     `phone_numbers_sha256`, `emails_sha256`, `external_ids_sha256`,
//     `first_names_sha256`, `last_names_sha256`, `cities`, `regions`,
//     `postal_codes`, `countries`.
//   - `obref` vai em `events[].user.obref` (string crua do cookie `__obref`).
//   - `oppref` vai em `events[].oppref` (string crua da URL ou cookie `__oppref`).
//   - `amount` é inteiro na menor unidade da moeda ISO 4217 (centavos no BRL).
//   - `contents` só é aceito quando `data.type` é `contents`, `plan_enrollment`
//     ou `custom` (nunca em `customer_action`).
//
// Configuração: OPENAI_ADS_API_KEY e OPENAI_ADS_PIXEL_ID no ambiente do servidor.
// Sem chave, o envio é ignorado em silêncio — o funil nunca quebra por mensuração.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { paraE164 } from './telefone';

// Sem default embutido: um id errado manda conversao para a conta de outro.
const PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID || '';
const API_KEY = process.env.OPENAI_ADS_API_KEY || '';
const ENDPOINT = 'https://bzr.openai.com/v1/events';

/** Hex minúsculo de 64 caracteres sem alterar a caixa de entrada (usado após normalização específica). */
function sha256Bruto(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

/** E-mail: trim + minúsculas antes do SHA-256. */
export function hashEmailOpenAi(email?: string | null): string | null {
  const limpo = (email || '').trim().toLowerCase();
  if (!limpo || !limpo.includes('@')) return null;
  return sha256Bruto(limpo);
}

/**
 * Telefone: somente dígitos com código do país (55), entre 8 e 15 dígitos,
 * sem `+`, sem zeros à esquerda e sem pontuação, antes do SHA-256.
 */
export function hashTelefoneOpenAi(telefone?: string | null): string | null {
  const e164 = paraE164(telefone || '');
  if (!/^\d{8,15}$/.test(e164)) return null;
  return sha256Bruto(e164);
}

/**
 * External ID: a especificação da OpenAI exige trim apenas nas pontas,
 * PRESERVANDO maiúsculas/minúsculas e demais caracteres antes do SHA-256.
 */
export function hashExternalIdOpenAi(id?: string | null): string | null {
  const limpo = (id || '').trim();
  if (!limpo) return null;
  return sha256Bruto(limpo);
}

/**
 * Nome e sobrenome: minúsculas, removendo todos os espaços e pontuação ASCII,
 * mas PRESERVANDO caracteres não-ASCII (acentos como é, ã, ç) antes do SHA-256.
 * Ex.: "José" -> "josé", "Mary Jane" -> "maryjane", "O'Connor" -> "oconnor".
 */
export function hashNomeOpenAi(nome?: string | null): string | null {
  const limpo = (nome || '')
    .toLowerCase()
    .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+/g, '');
  if (!limpo) return null;
  return sha256Bruto(limpo);
}

/** Separa um nome completo em primeiro e último nome já hasheados segundo a spec. */
export function extrairNomesHasheados(
  nomeCompleto?: string | null,
  primeiroNome?: string | null,
  ultimoNome?: string | null,
): { firstNameHash: string | null; lastNameHash: string | null } {
  if (primeiroNome || ultimoNome) {
    return {
      firstNameHash: hashNomeOpenAi(primeiroNome),
      lastNameHash: hashNomeOpenAi(ultimoNome),
    };
  }
  const partes = (nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { firstNameHash: null, lastNameHash: null };
  const primeiro = partes[0];
  const ultimo = partes.length > 1 ? partes[partes.length - 1] : null;
  return {
    firstNameHash: hashNomeOpenAi(primeiro),
    lastNameHash: hashNomeOpenAi(ultimo),
  };
}

/** Garante no máximo 3 valores únicos não vazios por lista (limite rígido da API; >3 gera HTTP 400). */
function listaUnica(valores: Array<string | null | undefined>, max = 3): string[] {
  const unicos: string[] = [];
  for (const v of valores) {
    const limpo = (v || '').trim();
    if (limpo && !unicos.includes(limpo)) {
      unicos.push(limpo);
      if (unicos.length >= max) break;
    }
  }
  return unicos;
}

/**
 * Converte valor em Reais (BRL) para a menor unidade da moeda ISO 4217 (centavos).
 * Ex.: R$ 89.900,00 -> 8990000.
 */
export function paraCentavos(valorReais?: number | null): number | undefined {
  if (valorReais === undefined || valorReais === null || !Number.isFinite(valorReais)) {
    return undefined;
  }
  if (valorReais <= 0) return undefined;
  return Math.round(valorReais * 100);
}

/**
 * `source_url` aceita só origem + caminho — query e fragmento são recusados.
 * Normalizar aqui evita mandar a URL com utm_* e o evento ser rejeitado.
 */
function urlLimpa(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return 'https://manosveiculoscompra.com/';
  }
}

/** Itens do evento, quando ele descreve conteúdo (veículo visto/escolhido). */
export interface ItemOpenAiAds {
  id: string;
  group_id?: string;
  name?: string;
  content_type?: string;
  quantity?: number;
  /** Valor unitário em Reais (será convertido para centavos no envio). */
  amount?: number;
  currency?: string;
  variant_dict?: Record<string, string>;
}

export type NomeEventoOpenAiAds =
  | 'lead_created'
  | 'order_created'
  | 'appointment_scheduled'
  | 'contents_viewed'
  | 'items_added'
  | 'checkout_started'
  | 'page_viewed'
  | 'registration_completed'
  | 'custom';

export type ActionSourceOpenAiAds =
  | 'web'
  | 'app'
  | 'email'
  | 'phone_call'
  | 'chat'
  | 'physical_store'
  | 'system_generated'
  | 'offline'
  | 'other';

export interface EventoOpenAiAds {
  /** Evento padrão da OpenAI; 'custom' exige `customEventName`. */
  eventName: NomeEventoOpenAiAds;
  /** Mesmo id do pixel — é o que deduplica navegador e servidor. */
  eventId: string;
  customEventName?: string;
  actionSource?: ActionSourceOpenAiAds;
  timestampMs?: number;
  /** Nome completo do cliente (dividido automaticamente em primeiro e último nome). */
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Cookie anônimo `manos_vid` ou ID do lead no CRM. */
  externalId?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  clientIp?: string;
  userAgent?: string;
  /** Cookie `__obref` gravado pelo pixel `oaiq` (enviado cru em `user.obref`). */
  obref?: string | null;
  /** Identificador de clique do anúncio (`?oppref=` ou cookie `__oppref`). Repassado cru em `events[].oppref`. */
  oppref?: string | null;
  /** Valor em Reais (ex.: 89900 para R$ 89.900,00). Convertido internamente para centavos. */
  value?: number | null;
  currency?: string;
  sourceUrl?: string;
  contents?: ItemOpenAiAds[];
}

// Cada evento padrão exige a forma de `data` correspondente — mandar a errada
// faz o evento ser recusado com HTTP 400.
const FORMA_DE_DADOS: Record<NomeEventoOpenAiAds, 'customer_action' | 'contents' | 'custom'> = {
  lead_created: 'customer_action',
  appointment_scheduled: 'customer_action',
  registration_completed: 'customer_action',
  order_created: 'contents',
  contents_viewed: 'contents',
  items_added: 'contents',
  checkout_started: 'contents',
  page_viewed: 'contents',
  custom: 'custom',
};

/** Precisa dos dois: chave sem pixel (ou o contrario) nao envia nada. */
export function openAiAdsConfigurado(): boolean {
  return Boolean(API_KEY && PIXEL_ID);
}

/**
 * Envia o evento. Nunca lança: falha de mensuração não pode derrubar a entrega
 * do lead ao consultor.
 */
export async function enviarEventoOpenAiAds(evento: EventoOpenAiAds): Promise<boolean> {
  if (!API_KEY || !PIXEL_ID) return false;

  try {
    const user: Record<string, unknown> = {};

    const telefoneE164 = paraE164(evento.phone || '');
    const phonesHash = listaUnica([hashTelefoneOpenAi(evento.phone)]);
    if (phonesHash.length) user.phone_numbers_sha256 = phonesHash;

    const emailsHash = listaUnica([hashEmailOpenAi(evento.email)]);
    if (emailsHash.length) user.emails_sha256 = emailsHash;

    // `external_ids_sha256` combina o cookie anônimo de 1ª parte (`manos_vid`)
    // com o telefone E.164 quando disponível (máx. 3 itens). Assim a OpenAI
    // consegue cruzar tanto a sessão web quanto uma venda offline vinda do CRM.
    const externalIdsHash = listaUnica([
      hashExternalIdOpenAi(evento.externalId),
      telefoneE164 ? hashExternalIdOpenAi(telefoneE164) : null,
    ]);
    if (externalIdsHash.length) user.external_ids_sha256 = externalIdsHash;

    const { firstNameHash, lastNameHash } = extrairNomesHasheados(
      evento.name,
      evento.firstName,
      evento.lastName,
    );
    const firstNames = listaUnica([firstNameHash]);
    if (firstNames.length) user.first_names_sha256 = firstNames;

    const lastNames = listaUnica([lastNameHash]);
    if (lastNames.length) user.last_names_sha256 = lastNames;

    // Localização geográfica no CAPI da OpenAI vai em texto puro dentro de arrays.
    const cities = listaUnica([evento.city]);
    if (cities.length) user.cities = cities;

    const regions = listaUnica([evento.region || (cities.length ? 'SC' : null)]);
    if (regions.length) user.regions = regions;

    const postalCodes = listaUnica([evento.postalCode]);
    if (postalCodes.length) user.postal_codes = postalCodes;

    user.countries = ['BR'];

    // `obref` (opaque browser reference do cookie `__obref`) vai cru em `user.obref`.
    const obrefLimpo = (evento.obref || '').trim();
    if (obrefLimpo) user.obref = obrefLimpo;

    if (evento.clientIp) user.ip_address = evento.clientIp;
    if (evento.userAgent) user.user_agent = evento.userAgent;

    const formaDados = FORMA_DE_DADOS[evento.eventName];
    const data: Record<string, unknown> = {
      type: formaDados,
    };

    const centavos = paraCentavos(evento.value);
    if (centavos !== undefined) {
      data.amount = centavos;
      data.currency = (evento.currency || 'BRL').toUpperCase();
    } else if (evento.eventName === 'order_created') {
      data.amount = 0;
      data.currency = (evento.currency || 'BRL').toUpperCase();
    }

    // A especificação proíbe `contents` quando `data.type === 'customer_action'`.
    if (formaDados !== 'customer_action' && evento.contents?.length) {
      data.contents = evento.contents.map((c) => {
        const itemContent: Record<string, unknown> = {
          id: String(c.id),
          content_type: c.content_type || 'product',
          quantity: c.quantity ?? 1,
        };
        if (c.group_id) itemContent.group_id = c.group_id;
        if (c.name) itemContent.name = c.name;
        const itemCentavos = paraCentavos(c.amount);
        if (itemCentavos !== undefined) {
          itemContent.amount = itemCentavos;
          itemContent.currency = (c.currency || evento.currency || 'BRL').toUpperCase();
        }
        if (c.variant_dict) itemContent.variant_dict = c.variant_dict;
        return itemContent;
      });
    }

    const item: Record<string, unknown> = {
      id: evento.eventId,
      type: evento.eventName,
      timestamp_ms: evento.timestampMs ?? Date.now(),
      source_url: urlLimpa(evento.sourceUrl || 'https://manosveiculoscompra.com/'),
      action_source: evento.actionSource || 'web',
      data,
      user,
    };

    // No CAPI o `custom_event_name` fica no NÍVEL DO EVENTO, irmão de `type`.
    // (No pixel é diferente: lá ele vai no objeto de opções, o 4º argumento do oaiq.)
    if (evento.eventName === 'custom' && evento.customEventName) {
      item.custom_event_name = evento.customEventName;
    }

    const opprefLimpo = (evento.oppref || '').trim();
    if (opprefLimpo) item.oppref = opprefLimpo;

    // validate_only fica false: com true a OpenAI valida e descarta o evento.
    const corpo = JSON.stringify({ validate_only: false, events: [item] });

    // Uma retentativa, só para falha temporária (5xx, 429 ou rede). Erro 4xx é
    // payload errado: repetir daria o mesmo resultado e só atrasaria a resposta.
    // A janela de 7 dias do timestamp_ms cobre com folga esta espera.
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(PIXEL_ID)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: corpo,
        });

        if (res.ok) return true;

        const temporario = res.status >= 500 || res.status === 429;
        const detalhe = await res.text().catch(() => '');
        console.warn(
          `OpenAI Ads CAPI respondeu ${res.status} (tentativa ${tentativa}): ${detalhe.slice(0, 300)}`,
        );
        if (!temporario || tentativa === 2) return false;
      } catch (err) {
        console.warn(`OpenAI Ads CAPI falhou na rede (tentativa ${tentativa}):`, err);
        if (tentativa === 2) return false;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  } catch (err) {
    console.error('OpenAI Ads CAPI falhou:', err);
    return false;
  }
}
