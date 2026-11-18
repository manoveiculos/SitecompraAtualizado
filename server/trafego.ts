// ===========================================================================
// MÓDULO DE INTELIGÊNCIA DE TRÁFEGO, COMPORTAMENTO E ROI DE ANÚNCIOS
// ===========================================================================
//
// Permite ao administrador acompanhar em tempo real:
// 1. Quantos visitantes entram por cada origem:
//    - Google Ads (gclid, gbraid, wbraid, utm_source=google pago)
//    - Facebook / Instagram Ads (fbclid, utm_source=facebook/instagram/meta pago)
//    - OpenAI Ads / ChatGPT Ads (oppref, __oppref, utm_source=openai/chatgpt pago)
//    - Visitas Orgânicas & Diretas (Busca orgânica, acesso direto, IA orgânica, etc.)
// 2. O que cada visitante faz dentro do site: carros vistos (com TEMPO ATIVO em
//    cada um), fotos, simulações, consultas de placa, WhatsApp e leads.
// 3. De onde é (cidade/UF), em que aparelho está e, quando se identifica, quem é
//    no Manos CRM.
// 4. Se a verba gasta em cada plataforma está trazendo o resultado esperado.
//
// Armazenamento: cache quente em memória + data/trafego-store.json (debounce) e,
// quando SUPABASE_SERVICE_ROLE_KEY existe, espelho durável em trafego_eventos
// (ver supabase/trafego_inteligencia.sql).
// ===========================================================================

import type { Express, Request, Response } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { lerScores } from './leadStats';
import { parseUserAgent, resolverGeo } from './trafegoGeo';
import { contextoMeta, metaAdsConfigurado, type PedidoMeta } from './trafegoMeta';
import {
  buscarLeadPorTelefone,
  crmAtivo,
  espelharEventos,
  espelharVisitante,
  gravarResumoNoLead,
  montarResumo,
  normalizarTelefone,
} from './trafegoCrm';
import {
  ACOES_VALIDAS,
  alvoDemografiaMeta,
  faixaEtariaDeIdade,
  type EventoJornadaVisitante,
  type OrigemTrafegoMacro,
  type TipoAcaoVisitante,
  type VisitanteIdentificado,
} from '../src/lib/trafegoInteligencia';

export type { EventoJornadaVisitante, OrigemTrafegoMacro, TipoAcaoVisitante };

export interface VerbaCanaisConfig {
  periodo_referencia: string;
  verba_google_ads: number;
  verba_facebook_ads: number;
  verba_openai_ads: number;
  meta_cpl_desejado: number; // Custo máximo desejado por Lead/WhatsApp (ex: R$ 35)
  ticket_medio_lucro: number; // Margem/comissão média por venda para estimativa de ROAS
  vendas_google_ads: number;
  vendas_facebook_ads: number;
  vendas_openai_ads: number;
  vendas_organico: number;
  updated_at: string;
}

interface TrafegoStoreData {
  eventos: EventoJornadaVisitante[];
  verba: VerbaCanaisConfig;
  visitantes: Record<string, VisitanteIdentificado>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TRAFEGO_FILE = path.join(DATA_DIR, 'trafego-store.json');
const OFERTAS_FILE = path.join(DATA_DIR, 'ofertas-store.json');
const MAX_EVENTOS = 8000;
const FLUSH_MS = 5000;

const DEFAULT_VERBA: VerbaCanaisConfig = {
  periodo_referencia: 'Mês Atual',
  verba_google_ads: 0,
  verba_facebook_ads: 0,
  verba_openai_ads: 0,
  meta_cpl_desejado: 40,
  ticket_medio_lucro: 4500,
  vendas_google_ads: 0,
  vendas_facebook_ads: 0,
  vendas_openai_ads: 0,
  vendas_organico: 0,
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Store em memória (um evento de dwell chega a cada ~20s por visitante ativo;
// reler e regravar o JSON inteiro a cada um não escala).
// ---------------------------------------------------------------------------

let memoria: TrafegoStoreData | null = null;
const indicePorId = new Map<string, EventoJornadaVisitante>();
const sujosParaEspelho = new Set<string>();
let timerFlush: NodeJS.Timeout | null = null;

function carregarDoDisco(): TrafegoStoreData {
  try {
    if (existsSync(TRAFEGO_FILE)) {
      const parsed = JSON.parse(readFileSync(TRAFEGO_FILE, 'utf8'));
      return {
        eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
        verba: { ...DEFAULT_VERBA, ...(parsed.verba || {}) },
        visitantes: parsed.visitantes && typeof parsed.visitantes === 'object' ? parsed.visitantes : {},
      };
    }
  } catch (err) {
    console.warn('[trafego] falha ao ler store:', err);
  }
  return { eventos: [], verba: { ...DEFAULT_VERBA }, visitantes: {} };
}

function store(): TrafegoStoreData {
  if (!memoria) {
    memoria = carregarDoDisco();
    for (const e of memoria.eventos) indicePorId.set(e.id, e);
  }
  return memoria;
}

function gravarNoDisco(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(TRAFEGO_FILE, JSON.stringify(store()), 'utf8');
  } catch (err) {
    console.warn('[trafego] falha ao gravar store:', err);
  }
}

function agendarFlush(): void {
  if (timerFlush) return;
  timerFlush = setTimeout(() => {
    timerFlush = null;
    gravarNoDisco();
    if (sujosParaEspelho.size > 0) {
      const lote = Array.from(sujosParaEspelho)
        .map((id) => indicePorId.get(id))
        .filter((e): e is EventoJornadaVisitante => Boolean(e));
      sujosParaEspelho.clear();
      void espelharEventos(lote);
    }
  }, FLUSH_MS);
  timerFlush.unref?.();
}

/** Insere ou ATUALIZA por id: o dwell time reaproveita o mesmo evento a cada ping. */
export function registrarEventoTrafegoInterno(evento: EventoJornadaVisitante): EventoJornadaVisitante {
  const s = store();
  const existente = indicePorId.get(evento.id);

  if (existente) {
    existente.atualizado_em = new Date().toISOString();
    existente.tempo_segundos = Math.max(Number(existente.tempo_segundos) || 0, Number(evento.tempo_segundos) || 0);
    existente.fotos_vistas = Math.max(Number(existente.fotos_vistas) || 0, Number(evento.fotos_vistas) || 0);
    existente.scroll_max = Math.max(Number(existente.scroll_max) || 0, Number(evento.scroll_max) || 0);
    existente.abriu_galeria = Boolean(existente.abriu_galeria || evento.abriu_galeria);
    const merged: Record<string, number> = { ...(existente.interacoes || {}) };
    for (const [k, v] of Object.entries(evento.interacoes || {})) merged[k] = Math.max(merged[k] || 0, v);
    existente.interacoes = merged;
    if (!existente.veiculo_nome && evento.veiculo_nome) existente.veiculo_nome = evento.veiculo_nome;
    if (!existente.cidade && evento.cidade) {
      existente.cidade = evento.cidade;
      existente.uf = evento.uf ?? existente.uf ?? null;
    }
    sujosParaEspelho.add(existente.id);
    agendarFlush();
    return existente;
  }

  s.eventos.unshift(evento);
  indicePorId.set(evento.id, evento);
  if (s.eventos.length > MAX_EVENTOS) {
    for (const removido of s.eventos.splice(MAX_EVENTOS)) indicePorId.delete(removido.id);
  }
  sujosParaEspelho.add(evento.id);
  agendarFlush();
  return evento;
}

// ---------------------------------------------------------------------------
// Classificação de origem
// ---------------------------------------------------------------------------

/**
 * Classifica com precisão cirúrgica em qual dos 4 grandes grupos o acesso se encaixa:
 * - `google_ads`
 * - `facebook_ads`
 * - `openai_ads`
 * - `organico`
 */
export function classificarOrigemMacro(dados: {
  canal?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  fbclid?: string | null;
  oppref?: string | null;
  referrer?: string | null;
}): { macro: OrigemTrafegoMacro; subOrigem: string } {
  const src = (dados.utm_source || '').toLowerCase().trim();
  const med = (dados.utm_medium || '').toLowerCase().trim();
  const canal = (dados.canal || '').toLowerCase().trim();
  const ref = (dados.referrer || '').toLowerCase().trim();
  const midiaPaga =
    /cpc|ppc|paid|paid_social|pmax|display|ads|sponsored|trafego_pago|campanha|remarketing|catalogo/i.test(
      med,
    ) || Boolean(dados.utm_campaign);

  // 1. OpenAI Ads (ChatGPT Ads)
  if (
    dados.oppref ||
    canal === 'openai_ads' ||
    src === 'openai_ads' ||
    ((src.includes('openai') || src.includes('chatgpt')) && midiaPaga)
  ) {
    return {
      macro: 'openai_ads',
      subOrigem: dados.oppref ? 'OpenAI Ads (Clique oppref)' : `OpenAI Ads (${src || 'campanha'})`,
    };
  }

  // 2. Facebook / Instagram / Meta Ads
  if (
    dados.fbclid ||
    canal === 'meta_ads' ||
    src === 'meta_ads' ||
    src === 'facebook_ads' ||
    src === 'instagram_ads' ||
    src === 'fb' ||
    src === 'ig' ||
    ((src.includes('facebook') || src.includes('instagram') || src.includes('meta')) &&
      (midiaPaga || !med || med !== 'organico'))
  ) {
    const rede = src.includes('ig') || src.includes('instagram') ? 'Instagram Ads' : 'Facebook / Meta Ads';
    return {
      macro: 'facebook_ads',
      subOrigem: dados.fbclid ? `${rede} (fbclid)` : rede,
    };
  }

  // 3. Google Ads
  if (
    dados.gclid ||
    dados.gbraid ||
    dados.wbraid ||
    canal === 'google_ads' ||
    src === 'google_ads' ||
    src === 'adwords' ||
    ((src.includes('google') || src.includes('youtube')) && midiaPaga)
  ) {
    return {
      macro: 'google_ads',
      subOrigem: dados.gclid ? 'Google Ads (gclid)' : 'Google Ads (UTM)',
    };
  }

  // 4. Visitas Orgânicas & Diretas
  if (src.includes('chatgpt') || ref.includes('chatgpt.com') || ref.includes('openai.com') || canal === 'chatgpt') {
    return { macro: 'organico', subOrigem: 'ChatGPT (Orgânico)' };
  }
  if (ref.includes('google.') || canal === 'google_organico' || src === 'google') {
    return { macro: 'organico', subOrigem: 'Google (Busca Orgânica)' };
  }
  if (ref.includes('instagram.com') || canal === 'instagram_organico') {
    return { macro: 'organico', subOrigem: 'Instagram (Perfil / Orgânico)' };
  }
  if (ref.includes('facebook.com') || canal === 'facebook_organico') {
    return { macro: 'organico', subOrigem: 'Facebook (Orgânico)' };
  }
  if (ref.includes('perplexity.ai') || canal === 'perplexity') {
    return { macro: 'organico', subOrigem: 'Perplexity AI (Orgânico)' };
  }
  if (ref.includes('bing.com') || canal === 'bing_organico') {
    return { macro: 'organico', subOrigem: 'Bing (Orgânico)' };
  }
  if (ref.includes('manosveiculos.com.br') || canal === 'site_principal') {
    return { macro: 'organico', subOrigem: 'Site Principal Manos' };
  }
  return { macro: 'organico', subOrigem: 'Acesso Direto / Orgânico' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExpectedAdminPasswords(): string[] {
  const candidates = [
    process.env.OFERTAS_ADMIN_PASSWORD,
    process.env.VITE_OFERTAS_ADMIN_PASSWORD,
    process.env.REPASSE_ADMIN_PASSWORD,
    process.env.VITE_REPASSE_ADMIN_PASSWORD,
    process.env.VITE_ADMIN_PASSWORD,
    process.env.PANEL_PASSWORD,
    'manos2026',
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

function verificarSenhaAdmin(req: Request): boolean {
  const headerKey = String(req.headers['x-ofertas-admin-key'] || '').trim();
  const queryKey = typeof req.query.key === 'string' ? req.query.key.trim() : '';
  const bodyKey = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  const candidate = headerKey || queryKey || bodyKey;
  if (!candidate) return false;
  return getExpectedAdminPasswords().includes(candidate);
}

const texto = (v: unknown, max: number): string | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

const idMeta = (v: unknown): string | null => (/^\d{8,20}$/.test(String(v ?? '')) ? String(v) : null);

function semQuery(pagina: string): string {
  return pagina.split(/[?#]/)[0] || '/';
}

/**
 * Recupera o veículo a partir da URL (/estoque/<slug>-<id>) quando o evento não
 * trouxe o nome. Antes disso o card caía no fallback `pagina` e mostrava
 * "Viu Veículo: /".
 */
export function veiculoDoPath(pagina: string): { id: string | null; nome: string } | null {
  const m = semQuery(pagina).match(/^\/(?:estoque|veiculo|ofertas)\/([^/]+)/);
  if (!m) return null;
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* mantém o slug cru */
  }
  const id = slug.match(/-(\d{5,})$/)?.[1] ?? null;
  const nome = slug
    .replace(/-\d{5,}$/, '')
    .split('-')
    .filter(Boolean)
    .map((p) => (p.length <= 3 && /\d/.test(p) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
  return nome ? { id, nome } : null;
}

/**
 * Também importa eventos já gravados em `ofertas-store.json` (caso não estejam
 * no store de tráfego ainda) para que o painel já nasça povoado com os acessos
 * existentes de `/ofertas` e `/consultor`.
 */
function mesclarEventosExistentes(eventosAtuais: EventoJornadaVisitante[]): EventoJornadaVisitante[] {
  const ids = new Set(eventosAtuais.map((e) => e.id));
  const extras: EventoJornadaVisitante[] = [];

  try {
    if (existsSync(OFERTAS_FILE)) {
      const raw = readFileSync(OFERTAS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      const metricas = Array.isArray(parsed.metricas) ? parsed.metricas : [];
      for (const m of metricas) {
        const eid = String(m.event_id || m.id || '');
        if (!eid || ids.has(eid)) continue;
        ids.add(eid);

        const classif = classificarOrigemMacro({
          canal: m.canal,
          utm_source: m.utm_source,
          utm_medium: m.utm_medium,
          utm_campaign: m.utm_campaign,
          gclid: m.gclid,
          fbclid: m.fbclid,
          oppref: m.oppref,
          referrer: m.referrer,
        });

        let acao: TipoAcaoVisitante = 'page_view';
        if (m.evento === 'ViewContent') acao = 'view_vehicle';
        else if (m.evento === 'WhatsAppClick' || m.evento === 'Contact') acao = 'whatsapp_click';

        let pathname = '/ofertas';
        if (m.page_url) {
          try {
            pathname = new URL(m.page_url).pathname;
          } catch {
            pathname = String(m.page_url);
          }
        } else if (m.veiculo_slug) {
          pathname = `/ofertas/${m.veiculo_slug}`;
        }

        const doPath = !m.veiculo_nome ? veiculoDoPath(pathname) : null;
        const ap = parseUserAgent(String(m.user_agent || ''));

        extras.push({
          id: eid,
          timestamp: m.created_at || new Date().toISOString(),
          visitor_id: `of_${eid.slice(0, 10)}`,
          session_id: `sess_${eid.slice(0, 10)}`,
          origem_macro: classif.macro,
          sub_origem: classif.subOrigem,
          utm_source: m.utm_source || null,
          utm_medium: m.utm_medium || null,
          utm_campaign: m.utm_campaign || null,
          utm_content: m.utm_content || null,
          utm_term: m.utm_term || null,
          gclid: m.gclid || null,
          fbclid: m.fbclid || null,
          oppref: m.oppref || null,
          referrer: m.referrer || null,
          acao,
          pagina: pathname,
          veiculo_id: m.veiculo_id ? String(m.veiculo_id) : doPath?.id ?? null,
          veiculo_nome: m.veiculo_nome ? String(m.veiculo_nome) : doPath?.nome ?? null,
          valor_veiculo: m.valor_veiculo ? Number(m.valor_veiculo) : null,
          detalhe: m.veiculo_nome ? `Oferta: ${m.veiculo_nome}` : null,
          dispositivo: ap.dispositivo,
          dispositivo_detalhe: ap.dispositivo_detalhe,
          navegador: ap.navegador,
        });
      }
    }
  } catch {
    /* silencioso */
  }

  return [...eventosAtuais, ...extras].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Visitantes identificados + sincronização com o CRM
// ---------------------------------------------------------------------------

const geoPorVisitante = new Map<string, { cidade: string | null; uf: string | null; pais: string | null }>();
const timersSync = new Map<string, NodeJS.Timeout>();
const tentativasSync = new Map<string, number>();
const ultimaChecagemCrm = new Map<string, number>();

const ACOES_QUE_DISPARAM_SYNC: TipoAcaoVisitante[] = [
  'whatsapp_click',
  'phone_click',
  'lead_parcial',
  'lead_completo',
  'simulacao',
];

function eventosDoVisitante(visitorId: string): EventoJornadaVisitante[] {
  return store().eventos.filter((e) => e.visitor_id === visitorId);
}

function nomeCampanhaCacheado(passos: EventoJornadaVisitante[]): string | null {
  const id = passos.map((p) => p.campanha_id).find(Boolean);
  if (!id) return null;
  return contextoMeta([{ id, demografia: false }])[id]?.nome ?? null;
}

async function executarSyncCrm(visitorId: string): Promise<void> {
  const v = store().visitantes[visitorId];
  if (!crmAtivo() || !v?.telefone) return;

  const lead = await buscarLeadPorTelefone(v.telefone);
  if (!lead) {
    // O n8n cria o lead de forma assíncrona: tenta de novo em 1 min, até 5 vezes.
    const n = (tentativasSync.get(visitorId) || 0) + 1;
    tentativasSync.set(visitorId, n);
    if (n < 5) agendarSyncCrm(visitorId, 60_000);
    return;
  }
  tentativasSync.delete(visitorId);

  v.crm_lead_id = lead.id;
  v.crm_status = lead.status;
  v.crm_sincronizado_em = new Date().toISOString();
  if (!v.nome && lead.nome) v.nome = lead.nome;

  const passos = eventosDoVisitante(visitorId);
  await gravarResumoNoLead(lead, visitorId, montarResumo(passos, nomeCampanhaCacheado(passos)));

  agendarFlush();
  const geo = geoPorVisitante.get(visitorId);
  void espelharVisitante(v, geo?.cidade, geo?.uf);
}

function agendarSyncCrm(visitorId: string, atrasoMs = 15_000): void {
  if (!crmAtivo()) return;
  const anterior = timersSync.get(visitorId);
  if (anterior) clearTimeout(anterior);
  const t = setTimeout(() => {
    timersSync.delete(visitorId);
    void executarSyncCrm(visitorId).catch((err) => console.warn('[trafego] sync CRM:', err?.message || err));
  }, atrasoMs);
  t.unref?.();
  timersSync.set(visitorId, t);
}

/** Atualiza só o status do funil (leitura) para o painel — sem escrever no CRM. */
function refrescarStatusCrm(visitorId: string): void {
  const v = store().visitantes[visitorId];
  if (!crmAtivo() || !v?.telefone) return;
  const agora = Date.now();
  if (agora - (ultimaChecagemCrm.get(visitorId) || 0) < 60_000) return;
  ultimaChecagemCrm.set(visitorId, agora);
  void buscarLeadPorTelefone(v.telefone).then((lead) => {
    if (!lead) return;
    v.crm_lead_id = lead.id;
    v.crm_status = lead.status;
    v.crm_sincronizado_em = new Date().toISOString();
    if (lead.nome) v.nome = v.nome || lead.nome;
    agendarFlush();
  });
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

async function processarEvento(req: Request): Promise<void> {
  const body = req.body ?? {};
  const ua = String(req.headers['user-agent'] || '');

  const atribuicao = (body.atribuicao ?? {}) as Record<string, any>;
  const firstTouch = (atribuicao.first_touch ?? {}) as Record<string, any>;

  // Usa os sinais da visita atual ou, se não houver na URL atual, do first_touch
  const gclid = body.gclid || atribuicao.gclid || firstTouch.gclid || null;
  const gbraid = body.gbraid || atribuicao.gbraid || null;
  const wbraid = body.wbraid || atribuicao.wbraid || null;
  const fbclid = body.fbclid || atribuicao.fbclid || firstTouch.fbclid || null;
  const oppref = body.oppref || atribuicao.oppref || firstTouch.oppref || null;
  const utm_source = body.utm_source || atribuicao.utm_source || firstTouch.utm_source || null;
  const utm_medium = body.utm_medium || atribuicao.utm_medium || null;
  const utm_campaign = body.utm_campaign || atribuicao.utm_campaign || firstTouch.utm_campaign || null;
  const utm_content = body.utm_content || atribuicao.utm_content || null;
  const utm_term = body.utm_term || atribuicao.utm_term || null;
  const utm_id = body.utm_id || atribuicao.utm_id || null;
  const canal = body.canal || atribuicao.canal || firstTouch.canal || null;
  const referrer = body.referrer || atribuicao.referrer || String(req.headers.referer || '') || null;

  const classif = classificarOrigemMacro({
    canal, utm_source, utm_medium, utm_campaign, gclid, gbraid, wbraid, fbclid, oppref, referrer,
  });

  // IDs da Meta. O gerenciador costuma mandar {{campaign.id}} no utm_campaign;
  // adset/ad vêm em params explícitos ou nos demais UTMs (ambíguo, por isso o
  // resolvedor da Meta aceita qualquer nó).
  const ehMeta = classif.macro === 'facebook_ads';
  const campanha_id = ehMeta ? idMeta(body.campaign_id ?? atribuicao.campaign_id) || idMeta(utm_campaign) : null;
  const conjunto_id = ehMeta ? idMeta(body.adset_id ?? atribuicao.adset_id) || idMeta(utm_term) : null;
  const anuncio_id = ehMeta ? idMeta(body.ad_id ?? atribuicao.ad_id) || idMeta(utm_content) : null;

  const acao: TipoAcaoVisitante = (ACOES_VALIDAS as string[]).includes(body.acao) ? body.acao : 'page_view';

  // Aliases: o script SSR do catálogo (server/catalog.ts) manda vehicle_*,
  // pathname, valor e action_label — e a ingestão antiga só lia os nomes em
  // português, então o nome do carro se perdia.
  let pagina = semQuery(String(body.pagina ?? body.pathname ?? '/').slice(0, 240));
  let veiculo_id = texto(body.veiculo_id ?? body.vehicle_id, 80);
  let veiculo_nome = texto(body.veiculo_nome ?? body.vehicle_name, 160);
  const valorBruto = Number(body.valor_veiculo ?? body.valor);
  const valor_veiculo = Number.isFinite(valorBruto) && valorBruto > 0 ? valorBruto : null;
  const detalhe = texto(body.detalhe ?? body.action_label, 240);

  // A navegação para /estoque/<slug> já vira view_vehicle: o page_view duplicaria o passo.
  if (acao === 'page_view' && /^\/(estoque|veiculo)\/[^/]+/.test(pagina)) return;

  if ((acao === 'view_vehicle' || acao === 'select_vehicle') && (!veiculo_nome || !veiculo_id)) {
    const doPath = veiculoDoPath(pagina);
    if (doPath) {
      veiculo_nome = veiculo_nome || doPath.nome;
      veiculo_id = veiculo_id || doPath.id;
    }
  }

  const visitorId = String(body.visitor_id || body.external_id || 'anon').slice(0, 80);

  // Geo uma vez por visitante (headers do CDN, depois GeoIP).
  let geo = geoPorVisitante.get(visitorId);
  if (!geo || (!geo.cidade && !geo.uf)) {
    geo = await resolverGeo(req);
    if (geoPorVisitante.size > 5000) geoPorVisitante.delete(geoPorVisitante.keys().next().value as string);
    geoPorVisitante.set(visitorId, geo);
  }
  const ap = parseUserAgent(ua);

  const interacoes: Record<string, number> = {};
  if (body.interacoes && typeof body.interacoes === 'object') {
    for (const [k, v] of Object.entries(body.interacoes as Record<string, unknown>).slice(0, 12)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) interacoes[k.slice(0, 24)] = Math.min(9999, Math.round(n));
    }
  }

  const agora = new Date().toISOString();
  const registro: EventoJornadaVisitante = {
    id: texto(body.event_id, 120) || `trf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: agora,
    atualizado_em: agora,
    visitor_id: visitorId,
    session_id: String(body.session_id || body.visitor_id || 'sess').slice(0, 80),
    origem_macro: classif.macro,
    sub_origem: classif.subOrigem,
    utm_source: texto(utm_source, 120),
    utm_medium: texto(utm_medium, 120),
    utm_campaign: texto(utm_campaign, 160),
    utm_content: texto(utm_content, 160),
    utm_term: texto(utm_term, 160),
    utm_id: texto(utm_id, 160),
    gclid: texto(gclid, 200),
    fbclid: texto(fbclid, 200),
    oppref: texto(oppref, 200),
    referrer: texto(referrer, 300),
    campanha_id,
    conjunto_id,
    anuncio_id,
    acao,
    pagina,
    veiculo_id,
    veiculo_nome,
    valor_veiculo,
    detalhe,
    dispositivo: ap.dispositivo,
    dispositivo_detalhe: ap.dispositivo_detalhe,
    navegador: ap.navegador,
    cidade: geo.cidade,
    uf: geo.uf,
    pais: geo.pais,
    tempo_segundos: Math.min(4 * 3600, Math.max(0, Math.round(Number(body.tempo_segundos) || 0))),
    fotos_vistas: Math.min(500, Math.max(0, Math.round(Number(body.fotos_vistas) || 0))),
    abriu_galeria: Boolean(body.abriu_galeria),
    scroll_max: Math.min(100, Math.max(0, Math.round(Number(body.scroll_max) || 0))),
    interacoes,
  };

  registrarEventoTrafegoInterno(registro);

  if (ACOES_QUE_DISPARAM_SYNC.includes(acao) && store().visitantes[visitorId]?.telefone) {
    agendarSyncCrm(visitorId);
  }
}

export function mountTrafegoRoutes(app: Express): void {
  // 1. Endpoint público leve para receber telemetria de jornada do visitante.
  // Responde 204 na hora e processa depois (o GeoIP pode levar até 2,5s).
  app.post('/api/trafego/evento', (req: Request, res: Response) => {
    const ua = String(req.headers['user-agent'] || '');
    res.status(204).end();

    // Ignora robôs/crawlers conhecidos para não inflar contagem de visitantes humanos
    if (/bot|crawler|spider|gptbot|claudebot|perplexitybot|facebookexternalhit|whatsapp/i.test(ua)) return;

    void processarEvento(req).catch((err) => console.error('[trafego] erro ao registrar evento:', err));
  });

  // 2. Identificação do visitante (deanonymization). O front chama quando a
  // pessoa informa nome + telefone. Só a IDADE é guardada, nunca a data de nascimento.
  app.post('/api/trafego/identificar', (req: Request, res: Response) => {
    res.status(204).end();
    try {
      const b = req.body ?? {};
      const visitorId = texto(b.visitor_id, 80);
      if (!visitorId) return;

      const telefone = normalizarTelefone(b.telefone);
      const nome = texto(b.nome, 80);
      if (!telefone && !nome) return;

      const idadeBruta = Math.round(Number(b.idade));
      const idade = idadeBruta >= 18 && idadeBruta <= 100 ? idadeBruta : null;

      const s = store();
      const atual = s.visitantes[visitorId];
      const v: VisitanteIdentificado = {
        visitor_id: visitorId,
        nome: nome || atual?.nome || null,
        telefone: telefone || atual?.telefone || null,
        idade: idade ?? atual?.idade ?? null,
        faixa_etaria: faixaEtariaDeIdade(idade ?? atual?.idade ?? null),
        identificado_em: atual?.identificado_em || new Date().toISOString(),
        crm_lead_id: atual?.crm_lead_id ?? null,
        crm_status: atual?.crm_status ?? null,
        crm_sincronizado_em: atual?.crm_sincronizado_em ?? null,
      };
      s.visitantes[visitorId] = v;
      agendarFlush();

      const geo = geoPorVisitante.get(visitorId);
      void espelharVisitante(v, geo?.cidade, geo?.uf);
      if (v.telefone) {
        tentativasSync.delete(visitorId);
        agendarSyncCrm(visitorId, 8_000);
      }
    } catch (err) {
      console.error('[trafego] erro ao identificar visitante:', err);
    }
  });

  // 3. Endpoint administrativo para consultar o relatório completo de Tráfego, Comportamento e ROI
  app.get('/api/trafego/resumo', async (req: Request, res: Response) => {
    if (!verificarSenhaAdmin(req)) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }

    try {
      const s = store();
      const todosEventos = mesclarEventosExistentes(s.eventos);

      // Também busca os leads qualificados do banco (`lead_scores`) para enriquecer a visão
      const leadScores = await lerScores(500).catch(() => []);
      for (const ls of leadScores) {
        const lid = `ls_${ls.lead_id || ls.created_at}`;
        if (!todosEventos.some((e) => e.id === lid)) {
          const classif = classificarOrigemMacro({
            canal: ls.canal,
            utm_source: ls.utm_source,
            utm_campaign: ls.utm_campaign,
          });
          todosEventos.push({
            id: lid,
            timestamp: ls.created_at,
            visitor_id: ls.lead_id || lid,
            session_id: ls.lead_id || lid,
            origem_macro: classif.macro,
            sub_origem: classif.subOrigem,
            utm_source: ls.utm_source,
            utm_medium: null,
            utm_campaign: ls.utm_campaign,
            utm_content: ls.utm_content,
            utm_term: null,
            gclid: null,
            fbclid: null,
            oppref: null,
            referrer: null,
            acao: ls.stage === 'completo' ? 'lead_completo' : 'lead_parcial',
            pagina: '/funil',
            veiculo_id: null,
            veiculo_nome: null,
            valor_veiculo: null,
            detalhe: `Lead ${ls.lead_type} (${ls.stage}) • Nota ${ls.score} (${ls.faixa})${ls.cidade ? ` • ${ls.cidade}` : ''}`,
            dispositivo: 'Mobile',
            cidade: ls.cidade || null,
          });
        }
      }

      todosEventos.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const eventos = todosEventos.slice(0, 3000);

      // Nome real da campanha + faixa etária do anúncio (cache; resolve em segundo plano).
      const pedidos: PedidoMeta[] = [];
      for (const e of eventos) {
        if (pedidos.length >= 80) break;
        if (e.origem_macro !== 'facebook_ads') continue;
        const alvo = alvoDemografiaMeta(e);
        for (const id of [e.campanha_id, e.conjunto_id, e.anuncio_id]) {
          if (id) pedidos.push({ id, demografia: id === alvo });
        }
      }
      const campanhas = contextoMeta(pedidos);

      // Visitantes identificados: devolve só os que aparecem nos eventos enviados.
      const idsNoPainel = new Set(eventos.map((e) => e.visitor_id));
      const visitantes: Record<string, VisitanteIdentificado> = {};
      for (const [id, v] of Object.entries(s.visitantes)) {
        if (!idsNoPainel.has(id)) continue;
        visitantes[id] = v;
        refrescarStatusCrm(id);
      }

      return res.set('Cache-Control', 'no-store').json({
        ok: true,
        verba: s.verba,
        eventos,
        visitantes,
        campanhas,
        integracoes: { crm: crmAtivo(), meta_ads: metaAdsConfigurado() },
      });
    } catch (err) {
      console.error('[trafego] erro em GET /api/trafego/resumo:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar dados de tráfego.' });
    }
  });

  // 4. Endpoint administrativo para salvar a verba investida e metas de ROI
  app.post('/api/trafego/verba', (req: Request, res: Response) => {
    if (!verificarSenhaAdmin(req)) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }

    try {
      const s = store();
      const b = req.body ?? {};
      s.verba = {
        periodo_referencia: String(b.periodo_referencia || s.verba.periodo_referencia || 'Mês Atual').slice(0, 60),
        verba_google_ads: Math.max(0, Number(b.verba_google_ads) || 0),
        verba_facebook_ads: Math.max(0, Number(b.verba_facebook_ads) || 0),
        verba_openai_ads: Math.max(0, Number(b.verba_openai_ads) || 0),
        meta_cpl_desejado: Math.max(1, Number(b.meta_cpl_desejado) || 40),
        ticket_medio_lucro: Math.max(0, Number(b.ticket_medio_lucro) || 4500),
        vendas_google_ads: Math.max(0, Number(b.vendas_google_ads) || 0),
        vendas_facebook_ads: Math.max(0, Number(b.vendas_facebook_ads) || 0),
        vendas_openai_ads: Math.max(0, Number(b.vendas_openai_ads) || 0),
        vendas_organico: Math.max(0, Number(b.vendas_organico) || 0),
        updated_at: new Date().toISOString(),
      };
      gravarNoDisco();
      return res.json({ ok: true, verba: s.verba });
    } catch (err) {
      console.error('[trafego] erro em POST /api/trafego/verba:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao salvar verba.' });
    }
  });
}
