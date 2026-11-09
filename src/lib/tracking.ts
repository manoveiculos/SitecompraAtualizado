// Camada única de eventos de conversão.
//
// Antes disso o site carregava GTM e GA4 no index.html mas nunca empurrava nada
// para o dataLayer — o Google Ads não tinha uma única conversão para otimizar, e
// o /vendasrapidas não reportava nada para plataforma nenhuma.
//
// Todo evento sai por três canais:
//   - dataLayer  -> GTM, que dispara a conversão do Google Ads e o evento do GA4
//   - fbq        -> pixel da Meta
//   - oaiq       -> pixel do OpenAI Ads (anúncios dentro do ChatGPT)
//
// Cada evento carrega um `event_id` estável. O pixel e o Conversions API
// (server-side) precisam do MESMO id para a Meta e a OpenAI deduplicarem em vez
// de contar duas vezes — por isso o id é gerado aqui e devolvido para quem chamar.

import { getAttribution, getChannel } from './attribution';
import { idDoVisitante, telefoneParaMeta } from './visitante';

type Json = Record<string, unknown>;

export type LeadTipo = 'Compra' | 'Venda' | 'Financiamento' | 'Consignacao' | 'Consultor';

export function gerarEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Converte Reais (BRL) para a menor unidade da moeda ISO 4217 (centavos),
 * conforme exigido pela especificação oficial da OpenAI Ads (`amount` inteiro).
 * Ex.: R$ 89.900,00 -> 8990000.
 */
export function paraCentavos(valorReais?: number | null): number | undefined {
  if (valorReais === undefined || valorReais === null || !Number.isFinite(valorReais)) {
    return undefined;
  }
  if (valorReais <= 0) return undefined;
  return Math.round(valorReais * 100);
}

/** Calcula SHA-256 hex minúsculo de 64 caracteres usando Web Crypto API. */
async function sha256Hex(valor: string): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const bytes = new TextEncoder().encode(valor);
    const buffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/** Normaliza nome para o formato exigido pela OpenAI (minúsculas, sem espaço/pontuação ASCII, mantendo acentos). */
function normalizarNomeOpenAi(nome?: string | null): string {
  return (nome || '')
    .toLowerCase()
    .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]+/g, '');
}

function pushDataLayer(event: string, payload: Json): void {
  try {
    const w = window as unknown as { dataLayer?: Json[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event, ...payload });
  } catch (err) {
    console.error('[tracking] dataLayer error:', err);
  }
}

function fbqTrack(kind: 'track' | 'trackCustom', name: string, payload: Json, id?: string): void {
  try {
    const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
    if (!fbq) return;
    if (id) fbq(kind, name, payload, { eventID: id });
    else fbq(kind, name, payload);
  } catch (err) {
    console.error('[tracking] fbq error:', err);
  }
}

/**
 * Pixel do OpenAI Ads.
 *
 * A assinatura é `oaiq("measure", nome, dados, opcoes)` — e a separação importa:
 * `type`, `amount` e `currency` vão nos DADOS; `event_id` e `custom_event_name`
 * vão nas OPÇÕES. Trocar os dois de lugar não dá erro, o evento só chega sem o
 * id de deduplicação.
 */
export function oaiqMeasure(evento: string, dados: Json, opcoes?: Json): void {
  try {
    const oaiq = (window as unknown as { oaiq?: (...args: unknown[]) => void }).oaiq;
    if (!oaiq) return;
    if (opcoes) oaiq('measure', evento, dados, opcoes);
    else oaiq('measure', evento, dados);
  } catch (err) {
    console.error('[tracking] oaiq error:', err);
  }
}

/**
 * Atualiza o consentimento de marketing nos pixels (LGPD).
 * Na OpenAI Ads (`oaiq("consent", false)`), revogar remove os cookies `__oppref`
 * e `__obref` e suspende o envio de eventos até que seja concedido novamente.
 */
export function atualizarConsentimentoMarketing(permitido: boolean): void {
  try {
    const w = window as unknown as {
      oaiq?: (...args: unknown[]) => void;
      fbq?: (...args: unknown[]) => void;
    };
    if (w.oaiq) w.oaiq('consent', Boolean(permitido));
    if (w.fbq) w.fbq('consent', permitido ? 'grant' : 'revoke');
  } catch (err) {
    console.error('[tracking] consent error:', err);
  }
}

/**
 * Espelha um evento no servidor, para ele reenviar pela Conversions API.
 *
 * `sendBeacon` de propósito: clique de WhatsApp navega para fora do site, e um
 * fetch normal seria cancelado no meio pela troca de página. O beacon é
 * entregue pelo navegador depois, mesmo com a aba já fechada.
 *
 * O mesmo `event_id` vai para o pixel e para cá — é o que impede a conversão de
 * contar duas vezes.
 */
function espelharNoServidor(evento: string, id: string, extras: Json = {}): void {
  try {
    const corpo = JSON.stringify({
      evento,
      event_id: id,
      external_id: idDoVisitante(),
      atribuicao: getAttribution(),
      ...extras,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/ads/conversao', new Blob([corpo], { type: 'application/json' }));
      return;
    }
    void fetch('/api/ads/conversao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    });
  } catch (err) {
    console.error('[tracking] beacon error:', err);
  }
}

const SESSION_ID_KEY = 'manos_session_id_v1';

export function obterSessionId(): string {
  try {
    const existente = sessionStorage.getItem(SESSION_ID_KEY);
    if (existente) return existente;
    const novo = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_ID_KEY, novo);
    return novo;
  } catch {
    return `s_${Date.now().toString(36)}`;
  }
}

/**
 * Registra cada passo da jornada do visitante no painel administrativo de
 * Tráfego & ROI (`/api/trafego/evento`), permitindo acompanhar de qual anúncio
 * veio (Google Ads, Facebook Ads, OpenAI Ads ou Orgânico) e o que fez no site.
 */
export function registrarAcaoJornada(
  acao:
    | 'page_view'
    | 'view_vehicle'
    | 'select_vehicle'
    | 'plate_lookup'
    | 'simulacao'
    | 'consultor_ia'
    | 'lead_parcial'
    | 'lead_completo'
    | 'whatsapp_click'
    | 'phone_click',
  dados: {
    event_id?: string;
    pagina?: string;
    veiculo_id?: string | null;
    veiculo_nome?: string | null;
    valor_veiculo?: number | null;
    detalhe?: string | null;
  } = {},
): void {
  try {
    if (typeof window === 'undefined') return;
    const path = dados.pagina || window.location.pathname;
    // Não polui o relatório de clientes com a própria navegação do admin no painel
    if (path.includes('admin') || path.includes('leads-manos') || path.includes('radar-manos')) {
      return;
    }

    const corpo = JSON.stringify({
      event_id: dados.event_id || gerarEventId(),
      visitor_id: idDoVisitante(),
      session_id: obterSessionId(),
      acao,
      pagina: path,
      veiculo_id: dados.veiculo_id ?? null,
      veiculo_nome: dados.veiculo_nome ?? null,
      valor_veiculo: dados.valor_veiculo ?? null,
      detalhe: dados.detalhe ?? null,
      atribuicao: getAttribution(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/trafego/evento', new Blob([corpo], { type: 'application/json' }));
      return;
    }
    void fetch('/api/trafego/evento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencioso */
  }
}

let ultimaPaginaJornada: { path: string; ts: number } | null = null;

export function registrarPageViewJornada(pathname?: string): void {
  if (typeof window === 'undefined') return;
  const path = pathname || window.location.pathname || '/';
  const agora = Date.now();
  if (ultimaPaginaJornada && ultimaPaginaJornada.path === path && agora - ultimaPaginaJornada.ts < 1500) {
    return;
  }
  ultimaPaginaJornada = { path, ts: agora };
  registrarAcaoJornada('page_view', {
    pagina: path,
    detalhe: `Acessou ${path === '/' ? 'Página Inicial' : path}`,
  });
}

/**
 * Advanced matching: passa aos pixels da Meta (`fbq`) e da OpenAI (`oaiq`) o que
 * a pessoa já informou.
 *
 * Reinicializar o pixel com esses dados é a forma documentada de atualizá-los —
 * eles passam a acompanhar todo evento seguinte. Para o `oaiq("init", { pixelId, user })`,
 * a especificação do Measurement Pixel usa chaves no SINGULAR já em SHA-256:
 * `email_sha256`, `phone_number_sha256`, `external_id_sha256`,
 * `first_name_sha256`, `last_name_sha256`, `country`, `region`, `city`.
 */
export function identificarVisitante(dados: {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
}): void {
  try {
    const w = window as unknown as {
      fbq?: (...args: unknown[]) => void;
      oaiq?: (...args: unknown[]) => void;
      __manosPixelId?: string;
      __manosOpenAiPixelId?: string;
    };

    const vid = idDoVisitante();
    const telefone = telefoneParaMeta(dados.telefone ?? '');
    const emailLimpo = dados.email ? dados.email.trim().toLowerCase() : '';
    const partesNome = (dados.nome || '').trim().split(/\s+/).filter(Boolean);
    const primeiroNome = partesNome[0] || '';
    const ultimoNome = partesNome.length > 1 ? partesNome[partesNome.length - 1] : '';

    // 1. Meta Pixel Advanced Matching
    if (w.fbq && w.__manosPixelId) {
      const avancadoMeta: Record<string, string> = { external_id: vid };
      if (telefone) avancadoMeta.ph = telefone;
      if (emailLimpo) avancadoMeta.em = emailLimpo;
      if (primeiroNome) avancadoMeta.fn = primeiroNome.toLowerCase();
      if (ultimoNome) avancadoMeta.ln = ultimoNome.toLowerCase();
      if (dados.cidade) avancadoMeta.ct = dados.cidade.trim().toLowerCase();
      w.fbq('init', w.__manosPixelId, avancadoMeta);
    }

    // 2. OpenAI Ads Measurement Pixel Advanced Matching (`oaiq("init", { pixelId, user })`)
    if (w.oaiq && w.__manosOpenAiPixelId) {
      const openAiPixelId = w.__manosOpenAiPixelId;
      void (async () => {
        const userOpenAi: Record<string, string> = {
          country: 'BR',
          region: 'SC',
        };
        if (dados.cidade?.trim()) userOpenAi.city = dados.cidade.trim();

        const [extHash, phoneHash, emailHash, fnHash, lnHash] = await Promise.all([
          vid ? sha256Hex(vid.trim()) : Promise.resolve(null),
          telefone && /^\d{8,15}$/.test(telefone) ? sha256Hex(telefone) : Promise.resolve(null),
          emailLimpo && emailLimpo.includes('@') ? sha256Hex(emailLimpo) : Promise.resolve(null),
          primeiroNome ? sha256Hex(normalizarNomeOpenAi(primeiroNome)) : Promise.resolve(null),
          ultimoNome ? sha256Hex(normalizarNomeOpenAi(ultimoNome)) : Promise.resolve(null),
        ]);

        if (extHash) userOpenAi.external_id_sha256 = extHash;
        if (phoneHash) userOpenAi.phone_number_sha256 = phoneHash;
        if (emailHash) userOpenAi.email_sha256 = emailHash;
        if (fnHash) userOpenAi.first_name_sha256 = fnHash;
        if (lnHash) userOpenAi.last_name_sha256 = lnHash;

        w.oaiq?.('init', {
          pixelId: openAiPixelId,
          debug: false,
          user: userOpenAi,
        });
      })();
    }
  } catch (err) {
    console.error('[tracking] advanced matching error:', err);
  }
}

// Enriquecimento inicial automático: assim que o bundle carrega, injeta o
// `external_id_sha256` (`manos_vid`) no pixel `oaiq` para que mesmo eventos
// anônimos (`contents_viewed`, `items_added`) carreguem o vínculo com o CAPI.
if (typeof window !== 'undefined') {
  try {
    identificarVisitante({});
  } catch {
    /* silencioso */
  }
}

/** Contexto de origem anexado a todo evento, para segmentar campanha no GA4/GTM. */
function baseContext(): Json {
  return { canal: getChannel() };
}

// Guarda contra disparo duplicado em janelas curtas (ex.: App.tsx + VeiculoDetailPage.tsx
// ou botão + wrapper disparando o mesmo clique).
let ultimoVeiculoVisto: { id: string; ts: number } | null = null;
let ultimoContato: { chave: string; ts: number; id: string } | null = null;

// ---------------------------------------------------------------------------
// Funil
// ---------------------------------------------------------------------------

/** Escolha inicial do visitante (Comprar / Vender / Financiar). */
export function trackFunnelStart(tipo: LeadTipo): void {
  pushDataLayer('funnel_start', { lead_tipo: tipo, ...baseContext() });
  fbqTrack('trackCustom', 'FunnelStart', { lead_tipo: tipo });
}

/**
 * Avanço de etapa. Evento customizado de propósito: a versão anterior disparava
 * `PageView` a cada passo "para manter a atividade alta", o que inflava o volume
 * de PageView em ~9x sem mexer no Lead e ensinava a Meta com um sinal falso.
 */
export function trackFunnelStep(tipo: LeadTipo | null, step: number): void {
  pushDataLayer('funnel_step', { lead_tipo: tipo ?? 'Indefinido', funnel_step: step, ...baseContext() });
  fbqTrack('trackCustom', 'FunnelStep', { lead_tipo: tipo ?? 'Indefinido', step });
}

/** Visitante abriu um veículo específico (deep link ou página de detalhe /estoque/:slug). */
export function trackViewVehicle(v: { id: string; description: string; price: number }): void {
  const agora = Date.now();
  const idStr = String(v.id || '');
  if (ultimoVeiculoVisto && ultimoVeiculoVisto.id === idStr && agora - ultimoVeiculoVisto.ts < 2000) {
    return;
  }
  ultimoVeiculoVisto = { id: idStr, ts: agora };

  const id = gerarEventId();
  const centavos = paraCentavos(v.price);

  pushDataLayer('view_vehicle', {
    event_id: id,
    item_id: idStr,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack(
    'track',
    'ViewContent',
    {
      content_ids: [idStr],
      content_type: 'product',
      content_name: v.description,
      value: v.price,
      currency: 'BRL',
    },
    id,
  );
  oaiqMeasure(
    'contents_viewed',
    {
      type: 'contents',
      ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
      contents: [
        {
          id: idStr,
          name: v.description,
          content_type: 'product',
          quantity: 1,
          ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
        },
      ],
    },
    { event_id: id },
  );
  registrarAcaoJornada('view_vehicle', {
    event_id: `jv_${id}`,
    veiculo_id: idStr,
    veiculo_nome: v.description,
    valor_veiculo: v.price,
    detalhe: `Visualizou veículo: ${v.description}`,
  });
}

/** Visitante selecionou um veículo dentro do funil. */
export function trackSelectVehicle(v: { id: string; description: string; price: number }): void {
  const id = gerarEventId();
  const idStr = String(v.id || '');
  const centavos = paraCentavos(v.price);

  pushDataLayer('select_vehicle', {
    event_id: id,
    item_id: idStr,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack(
    'track',
    'AddToCart',
    {
      content_ids: [idStr],
      content_type: 'product',
      content_name: v.description,
      value: v.price,
      currency: 'BRL',
    },
    id,
  );
  oaiqMeasure(
    'items_added',
    {
      type: 'contents',
      ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
      contents: [
        {
          id: idStr,
          name: v.description,
          content_type: 'product',
          quantity: 1,
          ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
        },
      ],
    },
    { event_id: id },
  );
  registrarAcaoJornada('select_vehicle', {
    event_id: `js_${id}`,
    veiculo_id: idStr,
    veiculo_nome: v.description,
    valor_veiculo: v.price,
    detalhe: `Selecionou veículo: ${v.description}`,
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

interface LeadEventArgs {
  tipo: LeadTipo;
  /** Valor do veículo em Reais quando houver — vira o valor da conversão. */
  valor?: number | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  /**
   * Quando `true`, espelha o `lead_created` no servidor via `/api/ads/conversao`
   * (usado em páginas que enviam o formulário direto ao webhook do n8n no navegador,
   * como `/vender-meu-carro`, `/financiamento` e `ConsultorPanel`).
   */
  espelharCapi?: boolean;
  nome?: string | null;
  telefone?: string | null;
  cidade?: string | null;
}

/**
 * Contato capturado no início do funil. É a conversão que realmente existe hoje
 * em volume — vale como conversão secundária no Google Ads, nunca como a
 * principal, para o lance não otimizar por quem só deixa telefone.
 */
export function trackLeadParcial(args: LeadEventArgs): string {
  const id = gerarEventId();
  const centavos = paraCentavos(args.valor);

  pushDataLayer('lead_parcial', {
    event_id: id,
    lead_tipo: args.tipo,
    value: args.valor ?? 0,
    currency: 'BRL',
    ...getAttribution(),
  });
  fbqTrack(
    'trackCustom',
    'LeadParcial',
    { lead_tipo: args.tipo, value: args.valor ?? 0, currency: 'BRL' },
    id,
  );
  // Evento customizado, não `lead_created`: o contato parcial não é o mesmo
  // acontecimento que o lead qualificado.
  oaiqMeasure(
    'custom',
    {
      type: 'custom',
      ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
    },
    { event_id: id, custom_event_name: 'lead_parcial' },
  );
  registrarAcaoJornada('lead_parcial', {
    event_id: `jlp_${id}`,
    veiculo_id: args.vehicleId ?? null,
    veiculo_nome: args.vehicleName ?? null,
    valor_veiculo: args.valor ?? null,
    detalhe: `Deixou contato inicial (${args.tipo})`,
  });
  return id;
}

/** Lead completo e qualificado — a conversão principal das campanhas. */
export function trackLead(args: LeadEventArgs): string {
  const id = gerarEventId();
  const centavos = paraCentavos(args.valor);

  pushDataLayer('lead', {
    event_id: id,
    lead_tipo: args.tipo,
    item_id: args.vehicleId ?? null,
    item_name: args.vehicleName ?? null,
    value: args.valor ?? 0,
    currency: 'BRL',
    ...getAttribution(),
  });
  fbqTrack(
    'track',
    'Lead',
    {
      content_name: args.tipo,
      content_category: args.tipo,
      content_ids: args.vehicleId ? [args.vehicleId] : [],
      content_type: 'product',
      value: args.valor ?? 0,
      currency: 'BRL',
    },
    id,
  );
  // `lead_created` é o evento padrão para envio de lead (`type: 'customer_action'`).
  // Nota da spec: `contents` não é permitido em `customer_action`.
  oaiqMeasure(
    'lead_created',
    {
      type: 'customer_action',
      ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
    },
    { event_id: id },
  );

  if (args.espelharCapi) {
    espelharNoServidor('lead_created', id, {
      lead_tipo: args.tipo,
      name: args.nome ?? undefined,
      phone: args.telefone ?? undefined,
      city: args.cidade ?? undefined,
      value: args.valor ?? undefined,
      vehicle_id: args.vehicleId ? String(args.vehicleId) : undefined,
      vehicle_name: args.vehicleName ?? undefined,
      source_url: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
    });
  }

  registrarAcaoJornada('lead_completo', {
    event_id: `jl_${id}`,
    veiculo_id: args.vehicleId ?? null,
    veiculo_nome: args.vehicleName ?? null,
    valor_veiculo: args.valor ?? null,
    detalhe: `Concluiu Lead (${args.tipo})${args.vehicleName ? ` • ${args.vehicleName}` : ''}`,
  });

  return id;
}

/** Consulta de placa concluída — sinal forte de intenção real. */
export function trackPlacaConsultada(ok: boolean): void {
  pushDataLayer('placa_consultada', { sucesso: ok, ...baseContext() });
  fbqTrack('trackCustom', 'PlacaConsultada', { sucesso: ok });
  registrarAcaoJornada('plate_lookup', {
    detalhe: ok ? 'Consultou placa do próprio carro (encontrada)' : 'Tentou consultar placa manualmente',
  });
}

export interface ContatoExtras {
  vehicleId?: string | null;
  vehicleName?: string | null;
  valor?: number | null;
}

/**
 * Clique em WhatsApp ou telefone.
 *
 * Para uma revenda isto é conversão de verdade, não sinal secundário: boa parte
 * do negócio começa e termina no WhatsApp, sem passar pelo formulário. Por isso
 * vai também para o servidor — é o clique com maior chance de ser perdido por
 * bloqueador, e é justamente o que a Conversions API recupera.
 */
export function trackContato(
  canal: 'whatsapp' | 'telefone',
  contexto: string,
  extras?: ContatoExtras,
): string {
  const agora = Date.now();
  const chave = `${canal}:${contexto}`;
  if (ultimoContato && ultimoContato.chave === chave && agora - ultimoContato.ts < 800) {
    return ultimoContato.id;
  }

  const id = gerarEventId();
  ultimoContato = { chave, ts: agora, id };

  const centavos = paraCentavos(extras?.valor);
  const contents = extras?.vehicleId
    ? [
        {
          id: String(extras.vehicleId),
          ...(extras.vehicleName ? { name: extras.vehicleName } : {}),
          content_type: 'product',
          quantity: 1,
          ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
        },
      ]
    : undefined;

  pushDataLayer('contato_direto', {
    event_id: id,
    canal_contato: canal,
    contexto,
    ...(extras?.vehicleId ? { item_id: String(extras.vehicleId) } : {}),
    ...(extras?.valor ? { value: extras.valor, currency: 'BRL' } : {}),
    ...baseContext(),
  });
  fbqTrack(
    'track',
    'Contact',
    {
      content_name: contexto,
      source: canal,
      ...(extras?.vehicleId ? { content_ids: [String(extras.vehicleId)], content_type: 'product' } : {}),
      ...(extras?.valor ? { value: extras.valor, currency: 'BRL' } : {}),
    },
    id,
  );
  // No pixel o nome do evento custom vai nas OPÇÕES (4º argumento).
  oaiqMeasure(
    'custom',
    {
      type: 'custom',
      ...(centavos !== undefined ? { amount: centavos, currency: 'BRL' } : {}),
      ...(contents ? { contents } : {}),
    },
    { event_id: id, custom_event_name: canal },
  );
  espelharNoServidor(canal, id, {
    contexto,
    ...(extras?.vehicleId ? { vehicle_id: String(extras.vehicleId) } : {}),
    ...(extras?.vehicleName ? { vehicle_name: extras.vehicleName } : {}),
    ...(extras?.valor ? { value: extras.valor } : {}),
  });
  registrarAcaoJornada(canal === 'whatsapp' ? 'whatsapp_click' : 'phone_click', {
    event_id: `jc_${id}`,
    veiculo_id: extras?.vehicleId ? String(extras.vehicleId) : null,
    veiculo_nome: extras?.vehicleName ?? null,
    valor_veiculo: extras?.valor ?? null,
    detalhe: `${canal === 'whatsapp' ? 'Clicou no WhatsApp' : 'Clicou em Telefone'} (${contexto})`,
  });
  return id;
}
