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
// Configuração: OPENAI_ADS_API_KEY no ambiente do servidor (Ads Manager ->
// Conversões -> Criar chave de conversão). Sem chave, o envio é ignorado em
// silêncio — o funil nunca quebra por causa de mensuração.
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';
import { paraE164 } from './telefone';

const PIXEL_ID = process.env.OPENAI_ADS_PIXEL_ID || 'QhX8YkwW1KcmEMR9JPQD8Q';
const API_KEY = process.env.OPENAI_ADS_API_KEY || '';
const ENDPOINT = 'https://bzr.openai.com/v1/events';

/** A especificação pede hex minúsculo de 64 caracteres. */
function sha256(valor: string): string {
  return createHash('sha256').update(valor.trim().toLowerCase()).digest('hex');
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

export interface EventoOpenAiAds {
  /** Evento padrão da OpenAI; 'custom' exige `customEventName`. */
  eventName: 'lead_created' | 'custom';
  /** Mesmo id do pixel — é o que deduplica navegador e servidor. */
  eventId: string;
  customEventName?: string;
  phone?: string;
  city?: string;
  clientIp?: string;
  userAgent?: string;
  /** Identificador de clique do anúncio. Repassado cru, como manda a spec. */
  oppref?: string | null;
  value?: number;
  currency?: string;
  sourceUrl?: string;
}

export function openAiAdsConfigurado(): boolean {
  return Boolean(API_KEY);
}

/**
 * Envia o evento. Nunca lança: falha de mensuração não pode derrubar a entrega
 * do lead ao consultor.
 */
export async function enviarEventoOpenAiAds(evento: EventoOpenAiAds): Promise<boolean> {
  if (!API_KEY) return false;

  try {
    const user: Record<string, unknown> = {};

    // A API tem campo para e-mail e para id externo, mas NÃO para telefone — e
    // o funil captura telefone, não e-mail. O telefone normalizado em E.164 é o
    // identificador estável que a loja tem da pessoa, então entra como
    // external_id, com hash. Nada em claro sai daqui.
    const telefone = paraE164(evento.phone || '');
    if (telefone) user.external_id_sha256 = sha256(telefone);

    // Ao contrário da Meta, cidade e país vão em texto puro nesta API.
    if (evento.city) user.city = evento.city;
    user.country = 'BR';
    if (evento.clientIp) user.ip_address = evento.clientIp;
    if (evento.userAgent) user.user_agent = evento.userAgent;

    const data: Record<string, unknown> = {
      type: evento.eventName === 'custom' ? 'custom' : 'customer_action',
      amount: Math.round(evento.value ?? 0),
      currency: evento.currency || 'BRL',
    };
    if (evento.eventName === 'custom' && evento.customEventName) {
      data.custom_event_name = evento.customEventName;
    }

    const item: Record<string, unknown> = {
      id: evento.eventId,
      type: evento.eventName,
      timestamp_ms: Date.now(),
      source_url: urlLimpa(evento.sourceUrl || 'https://manosveiculoscompra.com/'),
      action_source: 'web',
      data,
      user,
    };
    if (evento.oppref) item.oppref = evento.oppref;

    const res = await fetch(`${ENDPOINT}?pid=${encodeURIComponent(PIXEL_ID)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      // validate_only fica false: com true a OpenAI valida e descarta o evento.
      body: JSON.stringify({ validate_only: false, events: [item] }),
    });

    if (!res.ok) {
      const detalhe = await res.text().catch(() => '');
      console.warn(`OpenAI Ads CAPI respondeu ${res.status}: ${detalhe.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('OpenAI Ads CAPI falhou:', err);
    return false;
  }
}
