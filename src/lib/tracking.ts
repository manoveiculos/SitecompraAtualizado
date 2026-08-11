// Camada única de eventos de conversão.
//
// Antes disso o site carregava GTM e GA4 no index.html mas nunca empurrava nada
// para o dataLayer — o Google Ads não tinha uma única conversão para otimizar, e
// o /vendasrapidas não reportava nada para plataforma nenhuma.
//
// Todo evento sai por dois canais:
//   - dataLayer  -> GTM, que dispara a conversão do Google Ads e o evento do GA4
//   - fbq        -> pixel da Meta
//
// Cada evento carrega um `event_id` estável. O pixel e o Conversions API
// (server-side) precisam do MESMO id para a Meta deduplicar em vez de contar
// duas vezes — por isso o id é gerado aqui e devolvido para quem chamar.

import { getAttribution, getChannel } from './attribution';

type Json = Record<string, unknown>;

export type LeadTipo = 'Compra' | 'Venda' | 'Financiamento';

function eventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* segue para o fallback */
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

/** Contexto de origem anexado a todo evento, para segmentar campanha no GA4/GTM. */
function baseContext(): Json {
  return { canal: getChannel() };
}

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

/** Visitante abriu um veículo específico (deep link vindo do catálogo /estoque). */
export function trackViewVehicle(v: { id: string; description: string; price: number }): void {
  pushDataLayer('view_vehicle', {
    item_id: v.id,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack('track', 'ViewContent', {
    content_ids: [v.id],
    content_type: 'product',
    content_name: v.description,
    value: v.price,
    currency: 'BRL',
  });
}

/** Visitante selecionou um veículo dentro do funil. */
export function trackSelectVehicle(v: { id: string; description: string; price: number }): void {
  pushDataLayer('select_vehicle', {
    item_id: v.id,
    item_name: v.description,
    value: v.price,
    currency: 'BRL',
    ...baseContext(),
  });
  fbqTrack('track', 'AddToCart', {
    content_ids: [v.id],
    content_type: 'product',
    content_name: v.description,
    value: v.price,
    currency: 'BRL',
  });
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

interface LeadEventArgs {
  tipo: LeadTipo;
  /** Valor do veículo quando houver — vira o valor da conversão no Google/Meta. */
  valor?: number | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
}

/**
 * Contato capturado no início do funil. É a conversão que realmente existe hoje
 * em volume — vale como conversão secundária no Google Ads, nunca como a
 * principal, para o lance não otimizar por quem só deixa telefone.
 */
export function trackLeadParcial(args: LeadEventArgs): string {
  const id = eventId();
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
  return id;
}

/** Lead completo e qualificado — a conversão principal das campanhas. */
export function trackLead(args: LeadEventArgs): string {
  const id = eventId();
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
  return id;
}

/** Consulta de placa concluída no /vendasrapidas — sinal forte de intenção real. */
export function trackPlacaConsultada(ok: boolean): void {
  pushDataLayer('placa_consultada', { sucesso: ok, ...baseContext() });
  fbqTrack('trackCustom', 'PlacaConsultada', { sucesso: ok });
}

/** Clique em WhatsApp ou telefone. */
export function trackContato(canal: 'whatsapp' | 'telefone', contexto: string): void {
  pushDataLayer('contato_direto', { canal_contato: canal, contexto, ...baseContext() });
  fbqTrack('track', 'Contact', { content_name: contexto, source: canal });
}
