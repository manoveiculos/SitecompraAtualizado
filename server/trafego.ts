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
// 2. O que cada visitante está fazendo dentro do site (páginas visitadas,
//    carros visualizados, simulações, consultas de placa, cliques em WhatsApp
//    e envios de lead).
// 3. Se a verba gasta em cada plataforma está trazendo o resultado esperado
//    (CPC real, Custo por Lead/WhatsApp, taxa de conversão e diagnóstico).
// ===========================================================================

import type { Express, Request, Response } from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { lerScores } from './leadStats';

export type OrigemTrafegoMacro = 'google_ads' | 'facebook_ads' | 'openai_ads' | 'organico';

export type TipoAcaoVisitante =
  | 'page_view'
  | 'view_vehicle'
  | 'select_vehicle'
  | 'plate_lookup'
  | 'simulacao'
  | 'consultor_ia'
  | 'lead_parcial'
  | 'lead_completo'
  | 'whatsapp_click'
  | 'phone_click';

export interface EventoJornadaVisitante {
  id: string;
  timestamp: string;
  visitor_id: string;
  session_id: string;
  origem_macro: OrigemTrafegoMacro;
  sub_origem: string; // ex: "Google Ads (gclid)", "Meta Ads (Instagram)", "ChatGPT Ads (oppref)", "Google Orgânico", "Direto"
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  oppref: string | null;
  referrer: string | null;
  acao: TipoAcaoVisitante;
  pagina: string;
  veiculo_id: string | null;
  veiculo_nome: string | null;
  valor_veiculo: number | null;
  detalhe: string | null;
  dispositivo: 'Mobile' | 'Desktop';
}

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
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TRAFEGO_FILE = path.join(DATA_DIR, 'trafego-store.json');
const OFERTAS_FILE = path.join(DATA_DIR, 'ofertas-store.json');
const MAX_EVENTOS = 5000;

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

function readTrafegoStore(): TrafegoStoreData {
  try {
    if (existsSync(TRAFEGO_FILE)) {
      const raw = readFileSync(TRAFEGO_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        eventos: Array.isArray(parsed.eventos) ? parsed.eventos : [],
        verba: { ...DEFAULT_VERBA, ...(parsed.verba || {}) },
      };
    }
  } catch (err) {
    console.warn('[trafego] falha ao ler store:', err);
  }
  return {
    eventos: [],
    verba: { ...DEFAULT_VERBA },
  };
}

function writeTrafegoStore(store: TrafegoStoreData): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(TRAFEGO_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[trafego] falha ao gravar store:', err);
  }
}

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

function detectarDispositivo(ua: string): 'Mobile' | 'Desktop' {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua || '') ? 'Mobile' : 'Desktop';
}

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
          veiculo_id: m.veiculo_id ? String(m.veiculo_id) : null,
          veiculo_nome: m.veiculo_nome ? String(m.veiculo_nome) : null,
          valor_veiculo: m.valor_veiculo ? Number(m.valor_veiculo) : null,
          detalhe: m.veiculo_nome ? `Oferta: ${m.veiculo_nome}` : null,
          dispositivo: detectarDispositivo(m.user_agent || ''),
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

export function registrarEventoTrafegoInterno(evento: EventoJornadaVisitante): void {
  const store = readTrafegoStore();
  // Evita duplicar o mesmo ID
  if (store.eventos.some((e) => e.id === evento.id)) return;
  store.eventos.unshift(evento);
  if (store.eventos.length > MAX_EVENTOS) {
    store.eventos = store.eventos.slice(0, MAX_EVENTOS);
  }
  writeTrafegoStore(store);
}

export function mountTrafegoRoutes(app: Express): void {
  // 1. Endpoint público leve para receber telemetria de jornada do visitante
  app.post('/api/trafego/evento', (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const ua = String(req.headers['user-agent'] || '');

      // Ignora robôs/crawlers conhecidos para não inflar contagem de visitantes humanos
      if (/bot|crawler|spider|gptbot|claudebot|perplexitybot|facebookexternalhit|whatsapp/i.test(ua)) {
        return res.status(204).end();
      }

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
      const canal = body.canal || atribuicao.canal || firstTouch.canal || null;
      const referrer = body.referrer || atribuicao.referrer || String(req.headers.referer || '') || null;

      const classif = classificarOrigemMacro({
        canal,
        utm_source,
        utm_medium,
        utm_campaign,
        gclid,
        gbraid,
        wbraid,
        fbclid,
        oppref,
        referrer,
      });

      const acaoValida: TipoAcaoVisitante = [
        'page_view',
        'view_vehicle',
        'select_vehicle',
        'plate_lookup',
        'simulacao',
        'consultor_ia',
        'lead_parcial',
        'lead_completo',
        'whatsapp_click',
        'phone_click',
      ].includes(body.acao)
        ? body.acao
        : 'page_view';

      const idEvento =
        String(body.event_id || '').trim() ||
        `trf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const registro: EventoJornadaVisitante = {
        id: idEvento,
        timestamp: new Date().toISOString(),
        visitor_id: String(body.visitor_id || body.external_id || 'anon').slice(0, 80),
        session_id: String(body.session_id || body.visitor_id || 'sess').slice(0, 80),
        origem_macro: classif.macro,
        sub_origem: classif.subOrigem,
        utm_source: utm_source ? String(utm_source).slice(0, 120) : null,
        utm_medium: utm_medium ? String(utm_medium).slice(0, 120) : null,
        utm_campaign: utm_campaign ? String(utm_campaign).slice(0, 160) : null,
        utm_content: utm_content ? String(utm_content).slice(0, 160) : null,
        utm_term: utm_term ? String(utm_term).slice(0, 160) : null,
        gclid: gclid ? String(gclid).slice(0, 200) : null,
        fbclid: fbclid ? String(fbclid).slice(0, 200) : null,
        oppref: oppref ? String(oppref).slice(0, 200) : null,
        referrer: referrer ? String(referrer).slice(0, 300) : null,
        acao: acaoValida,
        pagina: String(body.pagina || '/').slice(0, 240),
        veiculo_id: body.veiculo_id ? String(body.veiculo_id).slice(0, 80) : null,
        veiculo_nome: body.veiculo_nome ? String(body.veiculo_nome).slice(0, 160) : null,
        valor_veiculo: body.valor_veiculo ? Number(body.valor_veiculo) || null : null,
        detalhe: body.detalhe ? String(body.detalhe).slice(0, 240) : null,
        dispositivo: detectarDispositivo(ua),
      };

      registrarEventoTrafegoInterno(registro);
      return res.status(204).end();
    } catch (err) {
      console.error('[trafego] erro ao registrar evento:', err);
      return res.status(204).end();
    }
  });

  // 2. Endpoint administrativo para consultar o relatório completo de Tráfego, Comportamento e ROI
  app.get('/api/trafego/resumo', async (req: Request, res: Response) => {
    if (!verificarSenhaAdmin(req)) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }

    try {
      const store = readTrafegoStore();
      const todosEventos = mesclarEventosExistentes(store.eventos);

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
          });
        }
      }

      todosEventos.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return res
        .set('Cache-Control', 'no-store')
        .json({
          ok: true,
          verba: store.verba,
          eventos: todosEventos.slice(0, 3000),
        });
    } catch (err) {
      console.error('[trafego] erro em GET /api/trafego/resumo:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar dados de tráfego.' });
    }
  });

  // 3. Endpoint administrativo para salvar a verba investida e metas de ROI
  app.post('/api/trafego/verba', (req: Request, res: Response) => {
    if (!verificarSenhaAdmin(req)) {
      return res.status(401).json({ ok: false, error: 'Não autorizado.' });
    }

    try {
      const store = readTrafegoStore();
      const b = req.body ?? {};
      store.verba = {
        periodo_referencia: String(b.periodo_referencia || store.verba.periodo_referencia || 'Mês Atual').slice(0, 60),
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
      writeTrafegoStore(store);
      return res.json({ ok: true, verba: store.verba });
    } catch (err) {
      console.error('[trafego] erro em POST /api/trafego/verba:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao salvar verba.' });
    }
  });
}
