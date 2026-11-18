// Meta Marketing API (Graph API): traduz o ID numérico que chega no
// `utm_campaign` / `utm_content` / `utm_term` no NOME real da campanha,
// conjunto ou anúncio, e puxa o breakdown demográfico (idade x gênero).
//
// Config (servidor):
//   META_ADS_ACCESS_TOKEN   token com permissão `ads_read` (o META_CAPI_TOKEN do
//                           Conversions API NÃO serve; META_CATALOG_ACCESS_TOKEN
//                           só funciona se também tiver ads_read).
//   META_GRAPH_VERSION      opcional, ex.: "v23.0". Vazio = versão padrão da Meta.
//
// Sem token nada quebra: os cards continuam mostrando o ID cru.
//
// A faixa etária é do PÚBLICO ALCANÇADO PELO ANÚNCIO (cliques, com fallback para
// impressões, nos últimos 30 dias) — é uma estimativa de perfil, não a idade de
// quem está na tela. A idade real só existe depois que a pessoa informa a data
// de nascimento (simulador) ou é identificada no CRM.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import type { ContextoCampanhaMeta, DemografiaAnuncio } from '../src/lib/trafegoInteligencia';

const TOKEN =
  process.env.META_ADS_ACCESS_TOKEN || process.env.META_MARKETING_TOKEN || process.env.META_CATALOG_ACCESS_TOKEN || '';
const VERSAO = (process.env.META_GRAPH_VERSION || '').replace(/^\/+|\/+$/g, '');
const BASE = `https://graph.facebook.com${VERSAO ? `/${VERSAO}` : ''}`;

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'trafego-meta-cache.json');

const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_ERRO_MS = 30 * 60 * 1000;

interface EntradaCache extends ContextoCampanhaMeta {
  ts: number;
  erro?: boolean;
}

const cache = new Map<string, EntradaCache>();
const emVoo = new Set<string>();
let cacheCarregado = false;

export function metaAdsConfigurado(): boolean {
  return Boolean(TOKEN);
}

function carregarCache(): void {
  if (cacheCarregado) return;
  cacheCarregado = true;
  try {
    if (existsSync(CACHE_FILE)) {
      const bruto = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, EntradaCache>;
      for (const [k, v] of Object.entries(bruto)) cache.set(k, v);
    }
  } catch {
    /* cache corrompido é só descartado */
  }
}

function salvarCache(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)), 'utf8');
  } catch {
    /* silencioso */
  }
}

async function graph(caminho: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${BASE}/${caminho.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Token no header, não na URL: URL costuma ir parar em log.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      signal: controller.signal,
    });
    const j = await r.json();
    if (!r.ok || j?.error) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

/** Soma o breakdown `age,gender` em fração por faixa e acha a faixa/gênero dominantes. */
export function agregarDemografia(linhas: Array<Record<string, any>>): DemografiaAnuncio | null {
  const peso = (l: Record<string, any>) => Number(l.inline_link_clicks) || Number(l.clicks) || 0;
  const usarCliques = linhas.reduce((acc, l) => acc + peso(l), 0) > 0;
  const valor = (l: Record<string, any>) => (usarCliques ? peso(l) : Number(l.impressions) || 0);

  const porFaixa: Record<string, number> = {};
  const porGenero: Record<string, number> = {};
  let total = 0;
  for (const l of linhas) {
    const v = valor(l);
    if (!l.age || v <= 0) continue;
    porFaixa[l.age] = (porFaixa[l.age] || 0) + v;
    if (l.gender === 'female' || l.gender === 'male') porGenero[l.gender] = (porGenero[l.gender] || 0) + v;
    total += v;
  }
  if (total <= 0) return null;

  const distribuicao: Record<string, number> = {};
  for (const [faixa, v] of Object.entries(porFaixa)) distribuicao[faixa] = Number((v / total).toFixed(3));
  const predominante = Object.entries(porFaixa).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const generoTop = Object.entries(porGenero).sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    predominante,
    genero_predominante: generoTop === 'female' ? 'feminino' : generoTop === 'male' ? 'masculino' : null,
    distribuicao,
  };
}

async function resolverUm(id: string, comDemografia: boolean): Promise<EntradaCache> {
  const base = cache.get(id);
  const entrada: EntradaCache = { nome: base?.nome ?? null, demografia: base?.demografia, ts: Date.now() };

  try {
    // /{id}?fields=name funciona igual para campanha, conjunto e anúncio.
    if (!entrada.nome) {
      const obj = await graph(id, { fields: 'name' });
      entrada.nome = obj?.name ? String(obj.name).slice(0, 160) : null;
    }
    if (comDemografia) {
      const ins = await graph(`${id}/insights`, {
        breakdowns: 'age,gender',
        fields: 'impressions,clicks,inline_link_clicks',
        date_preset: 'last_30d',
        limit: '200',
      });
      entrada.demografia = agregarDemografia(Array.isArray(ins?.data) ? ins.data : []);
    }
  } catch (err) {
    entrada.erro = true;
    console.warn(`[trafego-meta] falha ao resolver ${id}:`, (err as Error)?.message);
  }
  return entrada;
}

function expirado(e: EntradaCache | undefined, precisaDemografia: boolean): boolean {
  if (!e) return true;
  const ttl = e.erro ? TTL_ERRO_MS : TTL_OK_MS;
  if (Date.now() - e.ts > ttl) return true;
  return precisaDemografia && e.demografia === undefined && !e.erro;
}

export interface PedidoMeta {
  id: string;
  /** Só pede o breakdown etário do objeto mais específico da sessão (poupa cota da API). */
  demografia: boolean;
}

/**
 * Devolve o que já está em cache e dispara em segundo plano a resolução do
 * resto. Não bloqueia a resposta do painel: o próximo refresh (o painel atualiza
 * sozinho) já traz os nomes.
 */
export function contextoMeta(pedidos: PedidoMeta[]): Record<string, ContextoCampanhaMeta> {
  carregarCache();
  const saida: Record<string, ContextoCampanhaMeta> = {};

  const unicos = new Map<string, boolean>();
  for (const p of pedidos) {
    if (!/^\d{8,20}$/.test(p.id)) continue; // só IDs numéricos da Meta
    unicos.set(p.id, (unicos.get(p.id) ?? false) || p.demografia);
  }

  for (const [id, demografia] of unicos) {
    const hit = cache.get(id);
    if (hit && !hit.erro) saida[id] = { nome: hit.nome, demografia: hit.demografia ?? null };
    if (!TOKEN || emVoo.has(id) || !expirado(hit, demografia)) continue;

    emVoo.add(id);
    void resolverUm(id, demografia)
      .then((e) => {
        cache.set(id, e);
        salvarCache();
      })
      .finally(() => emVoo.delete(id));
  }
  return saida;
}
