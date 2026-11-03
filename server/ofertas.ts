// ===========================================================================
// MÓDULO INDEPENDENTE DE OFERTAS (/ofertas) — BACKEND EXPRESS + SSR SEO/OG
// ===========================================================================
//
// Responsabilidades:
// 1. Endpoints REST isolados em /api/ofertas/* para CRUD, métricas e config.
// 2. Validação e proteção de endpoints administrativos (x-ofertas-admin-key).
// 3. Persistência resiliente em dupla camada (Supabase + JSON local no servidor).
// 4. Injeção server-side de Title, Meta Description, Canonical, Open Graph
//    (WhatsApp / Facebook / Instagram) e JSON-LD (Schema.org Car + Offer)
//    para /ofertas e /ofertas/:slug.
// 5. Registro de eventos (PageView, ViewContent, Contact, WhatsAppClick) com
//    preservação de UTMs e espelhamento deduplicado na Meta Conversions API.
// ===========================================================================

import type { Express, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { createHash, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { SITE_URL, DEALER, getVehicles, type FeedVehicle } from './catalog';
import { enviarEventoCapi } from './meta';

export interface CrmVeiculoExportavel {
  crm_id: string;
  origem: 'crm_estoque' | 'supabase_crm';
  placa: string;
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  titulo_personalizado: string;
  slug_sugerido: string;
  preco_venda: number;
  quilometragem: number | null;
  cambio: string;
  motorizacao: string;
  combustivel: string;
  cor: string;
  portas: number | null;
  observacoes_comerciais: string;
  diferenciais: string[];
  foto_principal: string;
  fotos: string[];
  ja_exportado: boolean;
  oferta_existente_slug?: string | null;
  oferta_existente_id?: number | string | null;
  oferta_existente_status?: OfertaStatus | null;
}

export type OfertaStatus = 'rascunho' | 'publicado' | 'vendido' | 'pausado';

export interface VeiculoOferta {
  id: number | string;
  created_at: string;
  updated_at: string;

  // Identificação
  marca: string;
  modelo: string;
  versao: string;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  titulo_personalizado: string;
  slug: string;

  // Informações comerciais
  preco_venda: number;
  quilometragem: number | null;
  cambio: string;
  motorizacao: string;
  combustivel: string;
  cor: string;
  portas: number | null;
  observacoes_comerciais: string;
  diferenciais: string[];

  // Fotos
  foto_principal: string;
  fotos: string[];

  // Localização
  localizacao: string;

  // Vendedor
  vendedor_nome: string;
  vendedor_whatsapp: string;

  // Publicação
  status: OfertaStatus;
}

export interface OfertaMetrica {
  id: number | string;
  created_at: string;
  event_id: string;
  evento: 'PageView' | 'ViewContent' | 'Contact' | 'WhatsAppClick';
  veiculo_id?: string | null;
  veiculo_slug?: string | null;
  veiculo_nome?: string | null;
  valor_veiculo?: number | null;
  page_url?: string | null;
  canal?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
}

export interface OfertasTrackingConfig {
  meta_pixel_id: string;
  ga4_measurement_id: string;
  vendedor_padrao_nome: string;
  vendedor_padrao_whatsapp: string;
  consentimento_lgpd_obrigatorio: boolean;
}

// ---------------------------------------------------------------------------
// Constantes e Configuração Inicial
// ---------------------------------------------------------------------------

export const ALEXANDRE_PADRAO = {
  nome: 'Alexandre',
  whatsapp: '5547988467855',
  localizacao: 'Itapema/SC',
};

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://jkblxdxnbmciicakusnl.supabase.co';

function pickValidSupabaseKey(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    if (c && /^(eyJ|sb_)[A-Za-z0-9._-]+$/.test(c.trim())) {
      return c.trim();
    }
  }
  return 'sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb';
}

const SUPABASE_KEY = pickValidSupabaseKey(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

const supabaseServer = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Seed inicial com os 3 veículos da especificação (/ofertas/volkswagen-polo-2022,
// /ofertas/chevrolet-onix-2021, /ofertas/hyundai-creta-2023)
export const SEED_OFERTAS: VeiculoOferta[] = [
  {
    id: 101,
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    marca: 'Volkswagen',
    modelo: 'Polo',
    versao: '1.0 200 TSI Comfortline Automático',
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    titulo_personalizado: 'Volkswagen Polo Comfortline 200 TSI 2022',
    slug: 'volkswagen-polo-2022',
    preco_venda: 89900,
    quilometragem: 42000,
    cambio: 'Automático',
    motorizacao: '1.0 200 TSI Turbo',
    combustivel: 'Flex',
    cor: 'Branca',
    portas: 4,
    observacoes_comerciais:
      'Veículo em excelente estado de conservação, disponível para visitação imediata em Itapema/SC. Possui chave presencial (Kessy) com partida por botão, central multimídia VW Play, volante multifuncional com paddle shifts, ar-condicionado digital e sensores de estacionamento.',
    diferenciais: [
      'Chave presencial com partida por botão (Start/Stop)',
      'Central multimídia VW Play com Apple CarPlay e Android Auto',
      'Câmbio automático de 6 marchas com trocas no volante',
      'Sensores de estacionamento dianteiro e traseiro',
      'Rodas de liga leve aro 16 originais',
      'Documentação em dia para transferência imediata',
    ],
    foto_principal:
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1400&q=85',
    fotos: [
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1400&q=85',
    ],
    localizacao: 'Itapema/SC',
    vendedor_nome: 'Alexandre',
    vendedor_whatsapp: '5547988467855',
    status: 'publicado',
  },
  {
    id: 102,
    created_at: '2026-11-01T11:00:00.000Z',
    updated_at: '2026-11-01T11:00:00.000Z',
    marca: 'Chevrolet',
    modelo: 'Onix',
    versao: '1.0 Turbo LTZ Automático',
    ano_fabricacao: 2021,
    ano_modelo: 2021,
    titulo_personalizado: 'Chevrolet Onix LTZ 1.0 Turbo 2021',
    slug: 'chevrolet-onix-2021',
    preco_venda: 78900,
    quilometragem: 54000,
    cambio: 'Automático',
    motorizacao: '1.0 Turbo',
    combustivel: 'Flex',
    cor: 'Prata',
    portas: 4,
    observacoes_comerciais:
      'Chevrolet Onix LTZ 1.0 Turbo Automático disponível em Itapema/SC. Versão completa com 6 airbags de série, carregador de celular por indução, central multimídia MyLink de 8 polegadas, câmera de ré de alta definição e chave presencial.',
    diferenciais: [
      '6 Airbags de série + Controle de Estabilidade e Tração',
      'Central Multimídia MyLink 8" com espelhamento sem fio',
      'Carregador de smartphone por indução (Wireless Charger)',
      'Câmera de ré e sensor de estacionamento traseiro',
      'Chave presencial com abertura de portas por aproximação',
      'Assistente de partida em rampa (Hill Start Assist)',
    ],
    foto_principal:
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=85',
    fotos: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1400&q=85',
    ],
    localizacao: 'Itapema/SC',
    vendedor_nome: 'Alexandre',
    vendedor_whatsapp: '5547988467855',
    status: 'publicado',
  },
  {
    id: 103,
    created_at: '2026-11-01T12:00:00.000Z',
    updated_at: '2026-11-01T12:00:00.000Z',
    marca: 'Hyundai',
    modelo: 'Creta',
    versao: '1.0 TGDI Platinum Automático',
    ano_fabricacao: 2023,
    ano_modelo: 2023,
    titulo_personalizado: 'Hyundai Creta Platinum 1.0 Turbo 2023',
    slug: 'hyundai-creta-2023',
    preco_venda: 134900,
    quilometragem: 28500,
    cambio: 'Automático',
    motorizacao: '1.0 TGDI Turbo',
    combustivel: 'Flex',
    cor: 'Cinza',
    portas: 4,
    observacoes_comerciais:
      'SUV Hyundai Creta Platinum 2023 disponível em Itapema/SC. Baixa quilometragem, equipado com teto solar panorâmico, bancos em couro com ventilação para o motorista, sistema de câmeras 360º, painel digital colorido de 7 polegadas e freio de estacionamento eletrônico com Auto Hold.',
    diferenciais: [
      'Teto solar panorâmico com abertura elétrica',
      'Câmera 360º e monitoramento de ponto cego no painel digital',
      'Banco do motorista com ventilação (climatizado)',
      'Central multimídia de 10,25" com navegação GPS integrada',
      'Freio de estacionamento eletrônico com função Auto Hold',
      'Seleção de modos de condução (Eco, Normal, Sport)',
    ],
    foto_principal:
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=85',
    fotos: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1400&q=85',
      'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1400&q=85',
    ],
    localizacao: 'Itapema/SC',
    vendedor_nome: 'Alexandre',
    vendedor_whatsapp: '5547988467855',
    status: 'publicado',
  },
];

// ---------------------------------------------------------------------------
// Armazenamento Local de Redundância no Servidor (data/ofertas_store.json)
// ---------------------------------------------------------------------------

interface ServerStoreData {
  veiculos: VeiculoOferta[];
  deletedIds: string[];
  deletedSlugs: string[];
  metricas: OfertaMetrica[];
  config: OfertasTrackingConfig;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'ofertas_store.json');

const DEFAULT_CONFIG: OfertasTrackingConfig = {
  // Não inserir IDs fictícios: só preenche se configurado em variável de ambiente
  // ou cadastrado posteriormente pelo administrador.
  meta_pixel_id: process.env.OFERTAS_META_PIXEL_ID || '',
  ga4_measurement_id: process.env.OFERTAS_GA4_ID || '',
  vendedor_padrao_nome: ALEXANDRE_PADRAO.nome,
  vendedor_padrao_whatsapp: ALEXANDRE_PADRAO.whatsapp,
  consentimento_lgpd_obrigatorio: false,
};

function readServerStore(): ServerStoreData {
  try {
    if (existsSync(STORE_FILE)) {
      const raw = readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ServerStoreData>;
      return {
        veiculos: Array.isArray(parsed.veiculos) ? parsed.veiculos : [...SEED_OFERTAS],
        deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
        deletedSlugs: Array.isArray(parsed.deletedSlugs) ? parsed.deletedSlugs : [],
        metricas: Array.isArray(parsed.metricas) ? parsed.metricas : [],
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
      };
    }
  } catch (err) {
    console.warn('[ofertas] falha ao ler store local:', err);
  }
  return {
    veiculos: [...SEED_OFERTAS],
    deletedIds: [],
    deletedSlugs: [],
    metricas: [],
    config: { ...DEFAULT_CONFIG },
  };
}

function writeServerStore(store: ServerStoreData): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('[ofertas] falha ao gravar store local:', err);
  }
}

// ---------------------------------------------------------------------------
// Helpers de Normalização e Validação
// ---------------------------------------------------------------------------

export function gerarSlugOferta(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
}

export function nomeExibicaoVeiculo(v: Partial<VeiculoOferta>): string {
  if (v.titulo_personalizado && v.titulo_personalizado.trim()) {
    return v.titulo_personalizado.trim();
  }
  const ano = v.ano_modelo || v.ano_fabricacao || '';
  return [v.marca, v.modelo, v.versao, ano].filter(Boolean).join(' ').trim();
}

export function nomeCurtoParaWhatsApp(v: Partial<VeiculoOferta>): string {
  const ano = v.ano_modelo || v.ano_fabricacao || '';
  const base = [v.marca, v.modelo, ano].filter(Boolean).join(' ').trim();
  return base || v.titulo_personalizado || 'veículo anunciado';
}

export function normalizeVeiculoRow(raw: any): VeiculoOferta {
  const fotosArray: string[] = Array.isArray(raw.fotos)
    ? raw.fotos.filter((f: unknown) => typeof f === 'string' && f.trim())
    : typeof raw.fotos === 'string'
      ? (() => {
          try {
            const p = JSON.parse(raw.fotos);
            return Array.isArray(p) ? p.filter(Boolean) : [];
          } catch {
            return [];
          }
        })()
      : [];

  const diferenciaisArray: string[] = Array.isArray(raw.diferenciais)
    ? raw.diferenciais.filter((d: unknown) => typeof d === 'string' && d.trim())
    : typeof raw.diferenciais === 'string'
      ? (() => {
          try {
            const p = JSON.parse(raw.diferenciais);
            return Array.isArray(p) ? p.filter(Boolean) : [];
          } catch {
            return raw.diferenciais
              .split('\n')
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        })()
      : [];

  const fotoPrincipal =
    (typeof raw.foto_principal === 'string' && raw.foto_principal.trim()) ||
    fotosArray[0] ||
    '';

  const fotosOrdenadas = fotoPrincipal
    ? [fotoPrincipal, ...fotosArray.filter((f) => f !== fotoPrincipal)]
    : fotosArray;

  const statusValido: OfertaStatus = ['rascunho', 'publicado', 'vendido', 'pausado'].includes(
    raw.status,
  )
    ? raw.status
    : 'rascunho';

  const marca = String(raw.marca || '').trim();
  const modelo = String(raw.modelo || '').trim();
  const anoFab = raw.ano_fabricacao ? Number(raw.ano_fabricacao) : null;
  const anoMod = raw.ano_modelo ? Number(raw.ano_modelo) : anoFab;

  const slugBase =
    String(raw.slug || '').trim() ||
    gerarSlugOferta(`${marca}-${modelo}-${anoMod || anoFab || Date.now()}`);

  return {
    id: raw.id ?? `oferta_${Date.now()}`,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
    marca,
    modelo,
    versao: String(raw.versao || '').trim(),
    ano_fabricacao: Number.isFinite(anoFab) ? anoFab : null,
    ano_modelo: Number.isFinite(anoMod) ? anoMod : null,
    titulo_personalizado: String(raw.titulo_personalizado || '').trim(),
    slug: gerarSlugOferta(slugBase),
    preco_venda: Number(raw.preco_venda) || 0,
    quilometragem:
      raw.quilometragem !== null && raw.quilometragem !== undefined && raw.quilometragem !== ''
        ? Number(raw.quilometragem)
        : null,
    cambio: String(raw.cambio || '').trim(),
    motorizacao: String(raw.motorizacao || '').trim(),
    combustivel: String(raw.combustivel || '').trim(),
    cor: String(raw.cor || '').trim(),
    portas:
      raw.portas !== null && raw.portas !== undefined && raw.portas !== ''
        ? Number(raw.portas)
        : null,
    observacoes_comerciais: String(raw.observacoes_comerciais || '').trim(),
    diferenciais: diferenciaisArray,
    foto_principal: fotoPrincipal,
    fotos: fotosOrdenadas,
    localizacao: String(raw.localizacao || ALEXANDRE_PADRAO.localizacao).trim() || ALEXANDRE_PADRAO.localizacao,
    vendedor_nome: String(raw.vendedor_nome || ALEXANDRE_PADRAO.nome).trim() || ALEXANDRE_PADRAO.nome,
    vendedor_whatsapp:
      String(raw.vendedor_whatsapp || ALEXANDRE_PADRAO.whatsapp).replace(/\D/g, '') ||
      ALEXANDRE_PADRAO.whatsapp,
    status: statusValido,
  };
}

// ---------------------------------------------------------------------------
// Acesso Unificado a Dados (Supabase + Store do Servidor)
// ---------------------------------------------------------------------------

export async function listarVeiculosOfertas(incluirNaoPublicados = false): Promise<VeiculoOferta[]> {
  const store = readServerStore();
  const deletedIdSet = new Set(store.deletedIds.map(String));
  const deletedSlugSet = new Set(store.deletedSlugs.map(String));

  let supabaseRows: VeiculoOferta[] = [];
  try {
    const { data, error } = await supabaseServer
      .from('veiculos_ofertas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      supabaseRows = data.map(normalizeVeiculoRow);
    }
  } catch {
    // Fallback silencioso para o store local do servidor
  }

  const porSlug = new Map<string, VeiculoOferta>();

  // Primeiro carrega do store do servidor (inclui seeds iniciais)
  for (const item of store.veiculos) {
    const norm = normalizeVeiculoRow(item);
    if (!deletedIdSet.has(String(norm.id)) && !deletedSlugSet.has(norm.slug)) {
      porSlug.set(norm.slug, norm);
    }
  }

  // Sobrescreve/mescla com registros mais recentes do Supabase
  for (const item of supabaseRows) {
    if (deletedIdSet.has(String(item.id)) || deletedSlugSet.has(item.slug)) continue;
    const existente = porSlug.get(item.slug);
    if (!existente || new Date(item.updated_at).getTime() >= new Date(existente.updated_at).getTime()) {
      porSlug.set(item.slug, item);
    }
  }

  const lista = Array.from(porSlug.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  if (incluirNaoPublicados) {
    return lista;
  }
  return lista.filter((v) => v.status === 'publicado');
}

export async function buscarOfertaPorSlug(slug: string): Promise<VeiculoOferta | null> {
  const limpo = gerarSlugOferta(slug);
  if (!limpo) return null;
  const todos = await listarVeiculosOfertas(true);
  return todos.find((v) => v.slug === limpo) || null;
}

export async function getPublishedOfertasSlugs(): Promise<string[]> {
  const publicados = await listarVeiculosOfertas(false);
  return publicados.map((v) => v.slug);
}

// ---------------------------------------------------------------------------
// Integração Direta com Estoque do CRM / Altimus para Exportação 1-Clique
// ---------------------------------------------------------------------------

const MARCAS_FORMATADAS: Record<string, string> = {
  VOLKSWAGEN: 'Volkswagen',
  VW: 'Volkswagen',
  CHEVROLET: 'Chevrolet',
  GM: 'Chevrolet',
  HYUNDAI: 'Hyundai',
  FIAT: 'Fiat',
  TOYOTA: 'Toyota',
  HONDA: 'Honda',
  JEEP: 'Jeep',
  RENAULT: 'Renault',
  NISSAN: 'Nissan',
  FORD: 'Ford',
  PEUGEOT: 'Peugeot',
  CITROEN: 'Citroën',
  CITROËN: 'Citroën',
  MITSUBISHI: 'Mitsubishi',
  BMW: 'BMW',
  MERCEDES: 'Mercedes-Benz',
  'MERCEDES-BENZ': 'Mercedes-Benz',
  AUDI: 'Audi',
  PORSCHE: 'Porsche',
  VOLVO: 'Volvo',
  KIA: 'Kia',
  BYD: 'BYD',
  GWM: 'GWM',
  HAVAL: 'GWM Haval',
  CAOA: 'CAOA Chery',
  CHERY: 'CAOA Chery',
  RAM: 'RAM',
  LAND: 'Land Rover',
  YAMAHA: 'Yamaha',
};

function formatarCapitalizacao(texto: string): string {
  if (!texto) return '';
  const siglas = new Set([
    'TSI', 'TFSI', 'TDI', 'CVT', 'AT', 'MT', 'LT', 'LTZ', 'LS', 'RS', 'GT',
    'GTI', 'GTS', 'GLI', 'EX', 'EXL', 'LX', 'LXL', 'DX', 'WRX', 'STI', 'AMG',
    'BMW', 'BYD', 'GWM', 'RAM', 'SW4', 'HR-V', 'WR-V', 'CR-V', 'HB20', 'HB20S',
    'IX35', '4X4', '4X2', 'AWD', 'FWD', '16V', '8V', '20V', 'V6', 'V8', 'T200',
    'T270', 'TD350', 'TD380', 'XEI', 'GLI', 'XRE', 'CG', 'PCX', 'NMAX', 'SUV',
  ]);
  return texto
    .trim()
    .split(/\s+/)
    .map((palavra) => {
      const upper = palavra.toUpperCase();
      if (siglas.has(upper)) return upper;
      if (/^\d+(\.\d+)?[A-Z]*$/i.test(palavra)) return upper;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    })
    .join(' ');
}

function extrairAnos(anoStr: string): { anoFab: number | null; anoMod: number | null } {
  const matches = String(anoStr || '').match(/\b(19\d{2}|20\d{2})\b/g);
  if (!matches || matches.length === 0) {
    return { anoFab: null, anoMod: null };
  }
  if (matches.length >= 2) {
    return { anoFab: Number(matches[0]), anoMod: Number(matches[1]) };
  }
  const unico = Number(matches[0]);
  return { anoFab: unico, anoMod: unico };
}

function extrairMotorizacao(texto: string): string {
  const m = String(texto || '').match(
    /\b(\d\.\d(?:\s*(?:200\s*TSI|250\s*TSI|350\s*TSI|TSI|TFSI|TDI|T200|T270|TD350|TD380|Turbo|16V|8V|V6|V8|Hybrid|Híbrido))?)\b/i,
  );
  if (m) return formatarCapitalizacao(m[1]);
  if (/\bel[eé]tric/i.test(texto)) return 'Elétrico';
  if (/\bh[ií]brid/i.test(texto)) return 'Híbrido';
  return '';
}

export function converterFeedParaOferta(
  v: FeedVehicle,
  ofertasExistentes: VeiculoOferta[],
): CrmVeiculoExportavel {
  const tokens = (v.title || '').trim().split(/\s+/).filter(Boolean);
  const rawBrand = (tokens[0] || v.brand || 'Manos').toUpperCase();
  const marca = MARCAS_FORMATADAS[rawBrand] || formatarCapitalizacao(rawBrand);

  // Detecta modelos compostos comuns (ex: Corolla Cross, Hilux SW4, Grand Siena, Serie 3, Haval H6)
  let restoTokens = tokens.slice(1);
  if (rawBrand === 'LAND' && restoTokens[0]?.toUpperCase() === 'ROVER') {
    restoTokens = restoTokens.slice(1);
  } else if (rawBrand === 'CAOA' && restoTokens[0]?.toUpperCase() === 'CHERY') {
    restoTokens = restoTokens.slice(1);
  }

  let modeloTokensCount = 1;
  const t0 = (restoTokens[0] || '').toUpperCase();
  const t1 = (restoTokens[1] || '').toUpperCase();
  if (
    (t0 === 'COROLLA' && t1 === 'CROSS') ||
    (t0 === 'HILUX' && t1 === 'SW4') ||
    (t0 === 'GRAND' && t1 === 'SIENA') ||
    (t0 === 'SERIE' || t0 === 'SÉRIE' || t0 === 'CLASSE') ||
    (t0 === 'HAVAL' && t1.startsWith('H')) ||
    (t0 === 'TIGGO' && /^\d/.test(t1)) ||
    (t0 === 'SONG' && t1 === 'PLUS') ||
    (t0 === 'PAJERO' && (t1 === 'SPORT' || t1 === 'FULL' || t1 === 'DAKAR' || t1 === 'TR4')) ||
    (t0 === 'RANGE' && t1 === 'ROVER')
  ) {
    modeloTokensCount = 2;
  }

  const modelo = formatarCapitalizacao(restoTokens.slice(0, modeloTokensCount).join(' ')) || 'Veículo';
  const versao = formatarCapitalizacao(restoTokens.slice(modeloTokensCount).join(' '));
  const { anoFab, anoMod } = extrairAnos(v.year);
  const motorizacao = extrairMotorizacao(v.title);
  const cambio = v.transmission || 'Automático';
  const combustivel = formatarCapitalizacao(v.fuel || 'Flex') || 'Flex';
  const cor = formatarCapitalizacao(v.color || '');
  const portas = v.tipo === '4' ? null : 4;

  const tituloPersonalizado = [marca, modelo, versao, anoMod || anoFab]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const slugBase = gerarSlugOferta(`${marca}-${modelo}-${anoMod || anoFab || v.id}`);

  // Verifica se já foi exportado para /ofertas (por slug base, título ou foto principal)
  const foto0 = v.images[0] || '';
  const matchOferta = ofertasExistentes.find(
    (of) =>
      of.slug === slugBase ||
      (foto0 && of.foto_principal === foto0) ||
      (of.marca.toLowerCase() === marca.toLowerCase() &&
        of.modelo.toLowerCase() === modelo.toLowerCase() &&
        of.preco_venda === v.price &&
        of.quilometragem === v.kmNumber),
  );

  const diferenciais = Array.isArray(v.options)
    ? v.options.map((op) => op.trim()).filter(Boolean)
    : [];

  const resumoAtributos = [
    anoMod ? `Ano ${anoFab && anoFab !== anoMod ? `${anoFab}/${anoMod}` : anoMod}` : '',
    v.kmNumber != null ? `${v.kmNumber.toLocaleString('pt-BR')} km` : '',
    cambio ? `Câmbio ${cambio}` : '',
    combustivel || '',
    cor ? `Cor ${cor}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const observacoes = [
    `${tituloPersonalizado} disponível em Itapema/SC na Manos Veículos.`,
    resumoAtributos ? `Especificações: ${resumoAtributos}.` : '',
    diferenciais.length > 0
      ? `Principais equipamentos registrados no CRM: ${diferenciais.slice(0, 6).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    crm_id: String(v.id),
    origem: 'crm_estoque',
    placa: v.placa || '',
    marca,
    modelo,
    versao,
    ano_fabricacao: anoFab,
    ano_modelo: anoMod,
    titulo_personalizado: tituloPersonalizado,
    slug_sugerido: slugBase,
    preco_venda: Number(v.price) || 0,
    quilometragem: Number.isFinite(v.kmNumber) ? v.kmNumber : null,
    cambio,
    motorizacao,
    combustivel,
    cor,
    portas,
    observacoes_comerciais: observacoes,
    diferenciais,
    foto_principal: foto0,
    fotos: v.images || [],
    ja_exportado: Boolean(matchOferta),
    oferta_existente_slug: matchOferta?.slug || null,
    oferta_existente_id: matchOferta?.id || null,
    oferta_existente_status: matchOferta?.status || null,
  };
}

export async function listarVeiculosDoCrmParaExportar(): Promise<CrmVeiculoExportavel[]> {
  const [feedVehicles, ofertasExistentes] = await Promise.all([
    getVehicles().catch(() => [] as FeedVehicle[]),
    listarVeiculosOfertas(true).catch(() => [] as VeiculoOferta[]),
  ]);

  const lista = feedVehicles.map((v) => converterFeedParaOferta(v, ofertasExistentes));

  // Também consulta tabela `inventory` do Supabase CRM (caso existam veículos exclusivos lá)
  try {
    const { data: crmRows } = await supabaseServer
      .from('inventory')
      .select('*')
      .limit(200);

    if (Array.isArray(crmRows) && crmRows.length > 0) {
      const placasExistentes = new Set(lista.map((i) => i.placa.toUpperCase()).filter(Boolean));
      for (const row of crmRows) {
        const placa = String(row.plate || row.placa || '').toUpperCase().trim();
        if (placa && placasExistentes.has(placa)) continue;

        const marca = formatarCapitalizacao(String(row.brand || row.marca || ''));
        const modelo = formatarCapitalizacao(String(row.model || row.modelo || ''));
        if (!marca || !modelo) continue;

        const versao = formatarCapitalizacao(String(row.version || row.versao || ''));
        const { anoFab, anoMod } = extrairAnos(String(row.year || row.ano || ''));
        const preco = Number(row.price || row.preco || row.valor || 0);
        const km = row.km != null ? Number(row.km) : null;
        const fotos: string[] = Array.isArray(row.images || row.fotos)
          ? (row.images || row.fotos)
          : row.image_url || row.foto_principal
            ? [String(row.image_url || row.foto_principal)]
            : [];
        const slugBase = gerarSlugOferta(`${marca}-${modelo}-${anoMod || anoFab || row.id}`);
        const matchOferta = ofertasExistentes.find((o) => o.slug === slugBase);

        lista.push({
          crm_id: `sup_${row.id}`,
          origem: 'supabase_crm',
          placa,
          marca,
          modelo,
          versao,
          ano_fabricacao: anoFab,
          ano_modelo: anoMod,
          titulo_personalizado: [marca, modelo, versao, anoMod].filter(Boolean).join(' '),
          slug_sugerido: slugBase,
          preco_venda: preco,
          quilometragem: km,
          cambio: String(row.transmission || row.cambio || 'Automático'),
          motorizacao: extrairMotorizacao(versao),
          combustivel: String(row.fuel || row.combustivel || 'Flex'),
          cor: formatarCapitalizacao(String(row.color || row.cor || '')),
          portas: 4,
          observacoes_comerciais: String(
            row.description || row.observacoes || `${marca} ${modelo} disponível em Itapema/SC na Manos Veículos.`,
          ),
          diferenciais: Array.isArray(row.features || row.opcionais) ? (row.features || row.opcionais) : [],
          foto_principal: fotos[0] || '',
          fotos,
          ja_exportado: Boolean(matchOferta),
          oferta_existente_slug: matchOferta?.slug || null,
          oferta_existente_id: matchOferta?.id || null,
          oferta_existente_status: matchOferta?.status || null,
        });
      }
    }
  } catch {
    /* tabela inventory opcional */
  }

  return lista;
}

// ---------------------------------------------------------------------------
// Segurança Administrativa
// ---------------------------------------------------------------------------

function getAdminExpectedPassword(): string {
  return (
    process.env.OFERTAS_ADMIN_PASSWORD ||
    process.env.VITE_OFERTAS_ADMIN_PASSWORD ||
    process.env.VITE_REPASSE_ADMIN_PASSWORD ||
    process.env.VITE_ADMIN_PASSWORD ||
    process.env.PANEL_PASSWORD ||
    'manos2026'
  );
}

function senhaValida(fornecida: string): boolean {
  const esperada = getAdminExpectedPassword();
  if (!fornecida || !esperada) return false;
  const ba = Buffer.from(fornecida.trim(), 'utf8');
  const bb = Buffer.from(esperada.trim(), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Proteção contra força bruta em rotas administrativas (/api/ofertas/auth)
const adminAuthRateMap = new Map<string, { count: number; resetAt: number }>();
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 min
const ADMIN_AUTH_MAX_FAILS = 10;

function checkAdminRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = adminAuthRateMap.get(ip);
  if (!entry || now > entry.resetAt) return true;
  return entry.count < ADMIN_AUTH_MAX_FAILS;
}

function recordAdminAuthFail(ip: string): void {
  const now = Date.now();
  const entry = adminAuthRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    adminAuthRateMap.set(ip, { count: 1, resetAt: now + ADMIN_AUTH_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearAdminAuthFail(ip: string): void {
  adminAuthRateMap.delete(ip);
}

function exigirAdminOfertas(req: Request, res: Response, next: NextFunction): void {
  const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
  if (!checkAdminRateLimit(ip)) {
    res.status(429).json({
      ok: false,
      error: 'Muitas tentativas inválidas. Aguarde 15 minutos antes de tentar novamente.',
    });
    return;
  }
  const chave = String(req.headers['x-ofertas-admin-key'] || '');
  if (!senhaValida(chave)) {
    recordAdminAuthFail(ip);
    res.status(401).json({ ok: false, error: 'Não autorizado. Verifique a senha administrativa.' });
    return;
  }
  clearAdminAuthFail(ip);
  next();
}

// ---------------------------------------------------------------------------
// Injeção de SEO, Open Graph e JSON-LD no HTML (SSR para Crawlers e Links Diretos)
// ---------------------------------------------------------------------------

function escHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBRL(val: number): string {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export function buildOfertaJsonLd(v: VeiculoOferta): Record<string, unknown> {
  const canonicalUrl = `${SITE_URL}/ofertas/${v.slug}`;
  const nome = nomeExibicaoVeiculo(v);
  const ano = v.ano_modelo || v.ano_fabricacao;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: nome,
    brand: {
      '@type': 'Brand',
      name: v.marca,
    },
    model: v.modelo,
    itemCondition: 'https://schema.org/UsedCondition',
    url: canonicalUrl,
  };

  if (v.versao) schema.vehicleConfiguration = v.versao;
  if (ano) schema.vehicleModelDate = String(ano);
  if (v.ano_fabricacao) schema.productionDate = String(v.ano_fabricacao);
  if (v.quilometragem !== null && v.quilometragem >= 0) {
    schema.mileageFromOdometer = {
      '@type': 'QuantitativeValue',
      value: v.quilometragem,
      unitCode: 'KMT',
    };
  }
  if (v.cambio) schema.vehicleTransmission = v.cambio;
  if (v.combustivel) schema.fuelType = v.combustivel;
  if (v.cor) schema.color = v.cor;
  if (v.portas) schema.numberOfDoors = v.portas;
  if (v.motorizacao) {
    schema.vehicleEngine = {
      '@type': 'EngineSpecification',
      name: v.motorizacao,
    };
  }
  if (v.fotos.length > 0) {
    schema.image = v.fotos;
  }
  if (v.observacoes_comerciais) {
    schema.description = v.observacoes_comerciais;
  }

  schema.offers = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'BRL',
    price: v.preco_venda,
    availability:
      v.status === 'publicado'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/SoldOut',
    itemCondition: 'https://schema.org/UsedCondition',
    availableAtOrFrom: {
      '@type': 'Place',
      name: `Manos Veículos — ${v.localizacao}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Itapema',
        addressRegion: 'SC',
        addressCountry: 'BR',
      },
    },
    seller: {
      '@type': 'AutoDealer',
      name: DEALER.name,
      url: SITE_URL,
      logo: DEALER.logo,
      telephone: `+${v.vendedor_whatsapp || ALEXANDRE_PADRAO.whatsapp}`,
    },
  };

  return schema;
}

export function buildOfertaMetaTags(v: VeiculoOferta | null, isIndex = false): {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogImage: string;
  jsonLd: string;
  preloadImage?: string;
} {
  if (isIndex || !v) {
    const canonical = `${SITE_URL}/ofertas`;
    const title = 'Ofertas Exclusivas em Itapema/SC | Manos Veículos';
    const description =
      'Confira veículos selecionados da Manos Veículos disponíveis em Itapema/SC. Atendimento imediato pelo WhatsApp com Alexandre.';
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
    };
    return {
      title,
      description,
      canonical,
      robots: 'index,follow,max-image-preview:large',
      ogImage: DEALER.logo,
      jsonLd: JSON.stringify(schema).replace(/</g, '\\u003c'),
    };
  }

  const nome = nomeExibicaoVeiculo(v);
  const precoFmt = formatBRL(v.preco_venda);
  const anoTexto =
    v.ano_fabricacao && v.ano_modelo && v.ano_fabricacao !== v.ano_modelo
      ? `${v.ano_fabricacao}/${v.ano_modelo}`
      : String(v.ano_modelo || v.ano_fabricacao || '');

  const attrs = [
    anoTexto ? `Ano ${anoTexto}` : '',
    v.quilometragem !== null ? `${v.quilometragem.toLocaleString('pt-BR')} km` : '',
    v.cambio || '',
    v.motorizacao || '',
  ].filter(Boolean);

  const canonical = `${SITE_URL}/ofertas/${v.slug}`;
  const isPublicado = v.status === 'publicado';
  const statusPrefix = v.status === 'vendido' ? '[VENDIDO] ' : '';

  const title = `${statusPrefix}${nome} — ${precoFmt} em ${v.localizacao} | Manos Veículos`;
  const description = isPublicado
    ? `${nome} por ${precoFmt} disponível em ${v.localizacao}. ${attrs.join(' • ')}. Fale agora com ${v.vendedor_nome} pelo WhatsApp na Manos Veículos.`
    : `Este veículo (${nome}) não está mais disponível para venda. Confira outras ofertas da Manos Veículos em ${v.localizacao}.`;

  const ogImage = v.foto_principal || v.fotos[0] || DEALER.logo;

  return {
    title,
    description,
    canonical,
    robots: isPublicado ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    ogImage,
    preloadImage: isPublicado && ogImage.startsWith('http') ? ogImage : undefined,
    jsonLd: JSON.stringify(buildOfertaJsonLd(v)).replace(/</g, '\\u003c'),
  };
}

function injectMetaIntoHtml(baseHtml: string, meta: ReturnType<typeof buildOfertaMetaTags>): string {
  const tags = [
    `<title>${escHtml(meta.title)}</title>`,
    `<meta name="description" content="${escHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escHtml(meta.canonical)}" />`,
    `<meta name="robots" content="${escHtml(meta.robots)}" />`,
    `<meta name="theme-color" content="#0A0A0B" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="Manos Veículos" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:title" content="${escHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escHtml(meta.canonical)}" />`,
    `<meta property="og:image" content="${escHtml(meta.ogImage)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escHtml(meta.ogImage)}" />`,
    meta.preloadImage
      ? `<link rel="preload" as="image" href="${escHtml(meta.preloadImage)}" fetchpriority="high" />`
      : '',
    `<script type="application/ld+json">${meta.jsonLd}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');

  // Substitui <title>...</title> e <meta name="theme-color" ...> do index.html
  let html = baseHtml
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="theme-color"[^>]*>/i, '');

  return html.replace('</head>', `    ${tags}\n  </head>`);
}

// ---------------------------------------------------------------------------
// Deduplicação de Eventos em Memória
// ---------------------------------------------------------------------------

const processedEventIds = new Set<string>();
const MAX_PROCESSED_IDS = 5000;

function registerEventIdOnce(eventId: string): boolean {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return false;
  if (processedEventIds.size >= MAX_PROCESSED_IDS) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  processedEventIds.add(eventId);
  return true;
}

function isLocalhostReq(req: Request): boolean {
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local')
  );
}

function lerCookieSimples(req: Request, nome: string): string | undefined {
  const cru = req.headers.cookie;
  if (!cru) return undefined;
  for (const parte of cru.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim()) || undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Registro das Rotas no App Express
// ---------------------------------------------------------------------------

export function mountOfertasRoutes(app: Express): void {
  // 1. Verificar credencial administrativa (com rate limiting por IP)
  app.post('/api/ofertas/auth', (req, res) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    if (!checkAdminRateLimit(ip)) {
      return res.status(429).json({
        ok: false,
        error: 'Muitas tentativas inválidas. Aguarde 15 minutos antes de tentar novamente.',
      });
    }
    const password = String(req.body?.password || req.headers['x-ofertas-admin-key'] || '');
    if (senhaValida(password)) {
      clearAdminAuthFail(ip);
      return res.json({ ok: true });
    }
    recordAdminAuthFail(ip);
    return res.status(401).json({ ok: false, error: 'Senha administrativa incorreta.' });
  });

  // 2. Obter configurações públicas de rastreamento do módulo
  app.get('/api/ofertas/config', async (_req, res) => {
    const store = readServerStore();
    try {
      const { data } = await supabaseServer.from('ofertas_config').select('*');
      if (Array.isArray(data) && data.length > 0) {
        const cfg = { ...store.config };
        for (const row of data) {
          if (row.chave === 'meta_pixel_id') cfg.meta_pixel_id = row.valor;
          if (row.chave === 'ga4_measurement_id') cfg.ga4_measurement_id = row.valor;
          if (row.chave === 'vendedor_padrao_nome' && row.valor) cfg.vendedor_padrao_nome = row.valor;
          if (row.chave === 'vendedor_padrao_whatsapp' && row.valor) cfg.vendedor_padrao_whatsapp = row.valor;
          if (row.chave === 'consentimento_lgpd_obrigatorio') {
            cfg.consentimento_lgpd_obrigatorio = row.valor === 'true';
          }
        }
        return res.json({ ok: true, config: cfg });
      }
    } catch {
      /* fallback store local */
    }
    return res.json({ ok: true, config: store.config });
  });

  // 3. Salvar configurações de rastreamento (Admin)
  app.post('/api/ofertas/config', exigirAdminOfertas, async (req, res) => {
    const body = req.body ?? {};
    const store = readServerStore();

    const novaConfig: OfertasTrackingConfig = {
      meta_pixel_id: String(body.meta_pixel_id ?? store.config.meta_pixel_id).trim(),
      ga4_measurement_id: String(body.ga4_measurement_id ?? store.config.ga4_measurement_id).trim(),
      vendedor_padrao_nome:
        String(body.vendedor_padrao_nome || ALEXANDRE_PADRAO.nome).trim() || ALEXANDRE_PADRAO.nome,
      vendedor_padrao_whatsapp:
        String(body.vendedor_padrao_whatsapp || ALEXANDRE_PADRAO.whatsapp).replace(/\D/g, '') ||
        ALEXANDRE_PADRAO.whatsapp,
      consentimento_lgpd_obrigatorio: Boolean(body.consentimento_lgpd_obrigatorio),
    };

    store.config = novaConfig;
    writeServerStore(store);

    try {
      await supabaseServer.from('ofertas_config').upsert([
        { chave: 'meta_pixel_id', valor: novaConfig.meta_pixel_id, updated_at: new Date().toISOString() },
        { chave: 'ga4_measurement_id', valor: novaConfig.ga4_measurement_id, updated_at: new Date().toISOString() },
        { chave: 'vendedor_padrao_nome', valor: novaConfig.vendedor_padrao_nome, updated_at: new Date().toISOString() },
        { chave: 'vendedor_padrao_whatsapp', valor: novaConfig.vendedor_padrao_whatsapp, updated_at: new Date().toISOString() },
        {
          chave: 'consentimento_lgpd_obrigatorio',
          valor: String(novaConfig.consentimento_lgpd_obrigatorio),
          updated_at: new Date().toISOString(),
        },
      ]);
    } catch {
      /* persiste no store local */
    }

    res.json({ ok: true, config: novaConfig });
  });

  // 3.1. Listar estoque do CRM / Altimus pronto para exportação 1-clique em /ofertas (Admin)
  app.get('/api/ofertas/crm-estoque', exigirAdminOfertas, async (_req, res) => {
    try {
      const crmVeiculos = await listarVeiculosDoCrmParaExportar();
      return res.set('Cache-Control', 'no-store').json({
        ok: true,
        total: crmVeiculos.length,
        veiculos: crmVeiculos,
      });
    } catch (err) {
      console.error('[ofertas] erro em GET /api/ofertas/crm-estoque:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar estoque do CRM.' });
    }
  });

  // 3.2. Exportar veículo direto do CRM para /ofertas (1-clique ou via webhook do CRM)
  app.post('/api/ofertas/exportar-crm', exigirAdminOfertas, async (req, res) => {
    try {
      const body = req.body ?? {};
      const crmId = String(body.crm_id || '').trim();
      const placa = String(body.placa || '').toUpperCase().trim();
      const statusPublicacao: OfertaStatus = ['rascunho', 'publicado', 'vendido', 'pausado'].includes(
        body.status,
      )
        ? body.status
        : 'publicado';

      const crmLista = await listarVeiculosDoCrmParaExportar();
      const candidato = crmLista.find(
        (c) =>
          (crmId && c.crm_id === crmId) ||
          (placa && c.placa.toUpperCase() === placa),
      );

      const dadosBase = candidato
        ? {
            marca: candidato.marca,
            modelo: candidato.modelo,
            versao: candidato.versao,
            ano_fabricacao: candidato.ano_fabricacao,
            ano_modelo: candidato.ano_modelo,
            titulo_personalizado: candidato.titulo_personalizado,
            slug: candidato.slug_sugerido,
            preco_venda: candidato.preco_venda,
            quilometragem: candidato.quilometragem,
            cambio: candidato.cambio,
            motorizacao: candidato.motorizacao,
            combustivel: candidato.combustivel,
            cor: candidato.cor,
            portas: candidato.portas,
            observacoes_comerciais: candidato.observacoes_comerciais,
            diferenciais: candidato.diferenciais,
            foto_principal: candidato.foto_principal,
            fotos: candidato.fotos,
          }
        : body;

      const marca = String(dadosBase.marca || '').trim();
      const modelo = String(dadosBase.modelo || '').trim();
      const precoVenda = Number(dadosBase.preco_venda) || 0;

      if (!marca || !modelo || precoVenda <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'Veículo do CRM sem Marca, Modelo ou Preço válido para exportação.',
        });
      }

      const existentes = await listarVeiculosOfertas(true);
      const anoRef = dadosBase.ano_modelo || dadosBase.ano_fabricacao || new Date().getFullYear();
      let slugDesejado = gerarSlugOferta(dadosBase.slug || `${marca}-${modelo}-${anoRef}`);
      if (!slugDesejado) slugDesejado = `veiculo-${Date.now()}`;

      // Se já existir oferta para este mesmo veículo (por oferta_existente_slug), atualiza;
      // caso contrário garante slug único.
      let slugFinal = slugDesejado;
      if (!candidato?.ja_exportado) {
        let sufixo = 2;
        while (existentes.some((v) => v.slug === slugFinal)) {
          slugFinal = `${slugDesejado}-${sufixo}`;
          sufixo++;
        }
      } else if (candidato.oferta_existente_slug) {
        slugFinal = candidato.oferta_existente_slug;
      }

      const agora = new Date().toISOString();
      const exportado = normalizeVeiculoRow({
        ...dadosBase,
        id: candidato?.oferta_existente_id || Date.now(),
        slug: slugFinal,
        localizacao: body.localizacao || ALEXANDRE_PADRAO.localizacao,
        vendedor_nome: body.vendedor_nome || ALEXANDRE_PADRAO.nome,
        vendedor_whatsapp: body.vendedor_whatsapp || ALEXANDRE_PADRAO.whatsapp,
        status: statusPublicacao,
        created_at: agora,
        updated_at: agora,
      });

      const store = readServerStore();
      store.deletedSlugs = store.deletedSlugs.filter((s) => s !== exportado.slug);
      const idxExistente = store.veiculos.findIndex((v) => v.slug === exportado.slug);
      if (idxExistente !== -1) {
        store.veiculos[idxExistente] = exportado;
      } else {
        store.veiculos.unshift(exportado);
      }
      writeServerStore(store);

      try {
        await supabaseServer.from('veiculos_ofertas').upsert(
          [
            {
              marca: exportado.marca,
              modelo: exportado.modelo,
              versao: exportado.versao,
              ano_fabricacao: exportado.ano_fabricacao,
              ano_modelo: exportado.ano_modelo,
              titulo_personalizado: exportado.titulo_personalizado,
              slug: exportado.slug,
              preco_venda: exportado.preco_venda,
              quilometragem: exportado.quilometragem,
              cambio: exportado.cambio,
              motorizacao: exportado.motorizacao,
              combustivel: exportado.combustivel,
              cor: exportado.cor,
              portas: exportado.portas,
              observacoes_comerciais: exportado.observacoes_comerciais,
              diferenciais: exportado.diferenciais,
              foto_principal: exportado.foto_principal,
              fotos: exportado.fotos,
              localizacao: exportado.localizacao,
              vendedor_nome: exportado.vendedor_nome,
              vendedor_whatsapp: exportado.vendedor_whatsapp,
              status: exportado.status,
              updated_at: exportado.updated_at,
            },
          ],
          { onConflict: 'slug' },
        );
      } catch {
        /* já persistido no store local */
      }

      return res.status(201).json({
        ok: true,
        veiculo: exportado,
        url: `${SITE_URL}/ofertas/${exportado.slug}`,
      });
    } catch (err) {
      console.error('[ofertas] erro ao exportar veículo do CRM:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao exportar veículo do CRM.' });
    }
  });

  // 4. Listar veículos (público retorna apenas publicados; ?all=1 com header admin retorna todos)
  app.get('/api/ofertas', async (req, res) => {
    try {
      const querTodos = req.query.all === '1' || req.query.admin === '1';
      const chaveAdmin = String(req.headers['x-ofertas-admin-key'] || '');
      const autorizadoTodos = querTodos && senhaValida(chaveAdmin);

      const veiculos = await listarVeiculosOfertas(autorizadoTodos);
      res.set('Cache-Control', 'no-store').json({ ok: true, veiculos });
    } catch (err) {
      console.error('[ofertas] erro em GET /api/ofertas:', err);
      res.status(500).json({ ok: false, error: 'Erro ao carregar veículos de ofertas' });
    }
  });

  // 5. Buscar veículo individual por slug (acessível diretamente sem login)
  app.get('/api/ofertas/veiculo/:slug', async (req, res) => {
    try {
      const veiculo = await buscarOfertaPorSlug(req.params.slug);
      if (!veiculo) {
        return res.status(404).json({ ok: false, error: 'Veículo não encontrado' });
      }

      const chaveAdmin = String(req.headers['x-ofertas-admin-key'] || '');
      const isAdmin = senhaValida(chaveAdmin) || req.query.preview === '1';

      // Rascunho e Pausado não são exibidos comercialmente para visitantes comuns,
      // mas retornam status explícito para a página exibir aviso adequado.
      if ((veiculo.status === 'rascunho' || veiculo.status === 'pausado') && !isAdmin) {
        return res.status(200).json({
          ok: true,
          veiculo: {
            ...veiculo,
            indisponivel_publico: true,
          },
        });
      }

      return res.set('Cache-Control', 'no-store').json({ ok: true, veiculo });
    } catch (err) {
      console.error('[ofertas] erro ao buscar slug:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao buscar veículo' });
    }
  });

  // 6. Criar novo anúncio (Admin)
  app.post('/api/ofertas', exigirAdminOfertas, async (req, res) => {
    try {
      const body = req.body ?? {};
      const marca = String(body.marca || '').trim();
      const modelo = String(body.modelo || '').trim();
      const precoVenda = Number(body.preco_venda) || 0;

      if (!marca || !modelo) {
        return res.status(400).json({ ok: false, error: 'Marca e Modelo são obrigatórios.' });
      }
      if (precoVenda <= 0) {
        return res.status(400).json({ ok: false, error: 'Informe um preço de venda válido.' });
      }

      const existentes = await listarVeiculosOfertas(true);
      const anoRef = body.ano_modelo || body.ano_fabricacao || new Date().getFullYear();
      let slugDesejado = gerarSlugOferta(body.slug || `${marca}-${modelo}-${anoRef}`);
      if (!slugDesejado) {
        slugDesejado = `veiculo-${Date.now()}`;
      }

      // Garante unicidade do slug
      let slugFinal = slugDesejado;
      let sufixo = 2;
      while (existentes.some((v) => v.slug === slugFinal)) {
        slugFinal = `${slugDesejado}-${sufixo}`;
        sufixo++;
      }

      const agora = new Date().toISOString();
      const novo = normalizeVeiculoRow({
        ...body,
        id: Date.now(),
        slug: slugFinal,
        created_at: agora,
        updated_at: agora,
      });

      // Salva no store local do servidor
      const store = readServerStore();
      store.deletedSlugs = store.deletedSlugs.filter((s) => s !== novo.slug);
      store.veiculos.unshift(novo);
      writeServerStore(store);

      // Tenta inserir no Supabase
      try {
        const { data, error } = await supabaseServer
          .from('veiculos_ofertas')
          .insert([
            {
              marca: novo.marca,
              modelo: novo.modelo,
              versao: novo.versao,
              ano_fabricacao: novo.ano_fabricacao,
              ano_modelo: novo.ano_modelo,
              titulo_personalizado: novo.titulo_personalizado,
              slug: novo.slug,
              preco_venda: novo.preco_venda,
              quilometragem: novo.quilometragem,
              cambio: novo.cambio,
              motorizacao: novo.motorizacao,
              combustivel: novo.combustivel,
              cor: novo.cor,
              portas: novo.portas,
              observacoes_comerciais: novo.observacoes_comerciais,
              diferenciais: novo.diferenciais,
              foto_principal: novo.foto_principal,
              fotos: novo.fotos,
              localizacao: novo.localizacao,
              vendedor_nome: novo.vendedor_nome,
              vendedor_whatsapp: novo.vendedor_whatsapp,
              status: novo.status,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          const sincronizado = normalizeVeiculoRow(data);
          const idx = store.veiculos.findIndex((v) => v.slug === novo.slug);
          if (idx !== -1) {
            store.veiculos[idx] = sincronizado;
            writeServerStore(store);
          }
          return res.status(201).json({ ok: true, veiculo: sincronizado });
        }
      } catch (dbErr) {
        console.warn('[ofertas] Supabase insert fallback local:', dbErr);
      }

      return res.status(201).json({ ok: true, veiculo: novo });
    } catch (err) {
      console.error('[ofertas] erro ao criar anúncio:', err);
      return res.status(500).json({ ok: false, error: 'Erro interno ao criar anúncio.' });
    }
  });

  // 7. Atualizar anúncio existente (Admin)
  app.put('/api/ofertas/:id', exigirAdminOfertas, async (req, res) => {
    try {
      const targetId = String(req.params.id);
      const body = req.body ?? {};
      const todos = await listarVeiculosOfertas(true);
      const atual = todos.find((v) => String(v.id) === targetId || v.slug === targetId);

      if (!atual) {
        return res.status(404).json({ ok: false, error: 'Anúncio não encontrado.' });
      }

      let novoSlug = body.slug ? gerarSlugOferta(body.slug) : atual.slug;
      if (!novoSlug) novoSlug = atual.slug;

      // Verifica se outro veículo já usa esse slug
      const conflitoSlug = todos.find(
        (v) => v.slug === novoSlug && String(v.id) !== String(atual.id),
      );
      if (conflitoSlug) {
        return res.status(400).json({
          ok: false,
          error: `A URL /ofertas/${novoSlug} já está em uso por outro veículo.`,
        });
      }

      const atualizado = normalizeVeiculoRow({
        ...atual,
        ...body,
        id: atual.id,
        slug: novoSlug,
        created_at: atual.created_at,
        updated_at: new Date().toISOString(),
      });

      const store = readServerStore();
      const idx = store.veiculos.findIndex(
        (v) => String(v.id) === String(atual.id) || v.slug === atual.slug,
      );
      if (idx !== -1) {
        store.veiculos[idx] = atualizado;
      } else {
        store.veiculos.unshift(atualizado);
      }
      writeServerStore(store);

      try {
        await supabaseServer
          .from('veiculos_ofertas')
          .update({
            marca: atualizado.marca,
            modelo: atualizado.modelo,
            versao: atualizado.versao,
            ano_fabricacao: atualizado.ano_fabricacao,
            ano_modelo: atualizado.ano_modelo,
            titulo_personalizado: atualizado.titulo_personalizado,
            slug: atualizado.slug,
            preco_venda: atualizado.preco_venda,
            quilometragem: atualizado.quilometragem,
            cambio: atualizado.cambio,
            motorizacao: atualizado.motorizacao,
            combustivel: atualizado.combustivel,
            cor: atualizado.cor,
            portas: atualizado.portas,
            observacoes_comerciais: atualizado.observacoes_comerciais,
            diferenciais: atualizado.diferenciais,
            foto_principal: atualizado.foto_principal,
            fotos: atualizado.fotos,
            localizacao: atualizado.localizacao,
            vendedor_nome: atualizado.vendedor_nome,
            vendedor_whatsapp: atualizado.vendedor_whatsapp,
            status: atualizado.status,
            updated_at: atualizado.updated_at,
          })
          .or(`id.eq.${Number.isFinite(Number(atual.id)) ? Number(atual.id) : -1},slug.eq.${atual.slug}`);
      } catch (dbErr) {
        console.warn('[ofertas] Supabase update fallback local:', dbErr);
      }

      return res.json({ ok: true, veiculo: atualizado });
    } catch (err) {
      console.error('[ofertas] erro ao atualizar anúncio:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao atualizar anúncio.' });
    }
  });

  // 8. Excluir anúncio (Admin) — preserva o histórico de métricas!
  app.delete('/api/ofertas/:id', exigirAdminOfertas, async (req, res) => {
    try {
      const targetId = String(req.params.id);
      const todos = await listarVeiculosOfertas(true);
      const alvo = todos.find((v) => String(v.id) === targetId || v.slug === targetId);

      const store = readServerStore();
      store.veiculos = store.veiculos.filter(
        (v) => String(v.id) !== targetId && v.slug !== targetId,
      );
      store.deletedIds.push(targetId);
      if (alvo) {
        store.deletedIds.push(String(alvo.id));
        store.deletedSlugs.push(alvo.slug);
      }
      writeServerStore(store);

      try {
        if (alvo) {
          await supabaseServer.from('veiculos_ofertas').delete().eq('slug', alvo.slug);
        }
        if (Number.isFinite(Number(targetId))) {
          await supabaseServer.from('veiculos_ofertas').delete().eq('id', Number(targetId));
        }
      } catch {
        /* removido no store local */
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('[ofertas] erro ao excluir anúncio:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao excluir anúncio.' });
    }
  });

  // 9. Registrar evento de rastreamento e métricas (PageView, ViewContent, Contact, WhatsAppClick)
  // IMPORTANTE: Nunca dispara Purchase em cliques de WhatsApp e deduplica por event_id.
  app.post('/api/ofertas/evento', async (req, res) => {
    try {
      const body = req.body ?? {};
      const evento = String(body.evento || '') as OfertaMetrica['evento'];
      const eventId = String(body.event_id || '').trim();

      const EVENTOS_PERMITIDOS = new Set(['PageView', 'ViewContent', 'Contact', 'WhatsAppClick']);
      if (!EVENTOS_PERMITIDOS.has(evento) || !eventId) {
        return res.status(400).json({ ok: false, error: 'Evento ou event_id inválido' });
      }

      // Evita duplicidade de eventos
      if (!registerEventIdOnce(eventId)) {
        return res.status(204).end();
      }

      const atribuicao = (body.atribuicao ?? {}) as Record<string, string | undefined>;
      const metrica: OfertaMetrica = {
        id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        event_id: eventId,
        evento,
        veiculo_id: body.veiculo_id ? String(body.veiculo_id) : null,
        veiculo_slug: body.veiculo_slug ? String(body.veiculo_slug) : null,
        veiculo_nome: body.veiculo_nome ? String(body.veiculo_nome) : null,
        valor_veiculo: body.valor_veiculo ? Number(body.valor_veiculo) : null,
        page_url: body.page_url ? String(body.page_url).slice(0, 500) : null,
        canal: atribuicao.canal || body.canal || 'direto',
        utm_source: atribuicao.utm_source || body.utm_source || null,
        utm_medium: atribuicao.utm_medium || body.utm_medium || null,
        utm_campaign: atribuicao.utm_campaign || body.utm_campaign || null,
        utm_content: atribuicao.utm_content || body.utm_content || null,
        utm_term: atribuicao.utm_term || body.utm_term || null,
        fbclid: atribuicao.fbclid || body.fbclid || null,
        gclid: atribuicao.gclid || body.gclid || null,
        referrer: atribuicao.referrer || body.referrer || null,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      };

      // Salva no store local do servidor (mantém os últimos 2000 registros)
      const store = readServerStore();
      store.metricas.unshift(metrica);
      if (store.metricas.length > 2000) {
        store.metricas = store.metricas.slice(0, 2000);
      }
      writeServerStore(store);

      // Persiste de forma assíncrona no Supabase
      void (async () => {
        try {
          await supabaseServer.from('ofertas_metricas').insert([
            {
              event_id: metrica.event_id,
              evento: metrica.evento,
              veiculo_id: metrica.veiculo_id,
              veiculo_slug: metrica.veiculo_slug,
              veiculo_nome: metrica.veiculo_nome,
              valor_veiculo: metrica.valor_veiculo,
              page_url: metrica.page_url,
              canal: metrica.canal,
              utm_source: metrica.utm_source,
              utm_medium: metrica.utm_medium,
              utm_campaign: metrica.utm_campaign,
              utm_content: metrica.utm_content,
              utm_term: metrica.utm_term,
              fbclid: metrica.fbclid,
              gclid: metrica.gclid,
              referrer: metrica.referrer,
              user_agent: metrica.user_agent,
            },
          ]);
        } catch {
          /* já salvo no store local */
        }
      })();

      // Espelhamento para Meta Conversions API (apenas ViewContent e Contact, NUNCA Purchase)
      if (!isLocalhostReq(req) && (evento === 'ViewContent' || evento === 'Contact')) {
        const fbp = lerCookieSimples(req, '_fbp');
        let fbc = lerCookieSimples(req, '_fbc');
        if (!fbc && metrica.fbclid) {
          fbc = `fb.1.${Date.now()}.${metrica.fbclid}`;
        }
        const externalId = lerCookieSimples(req, 'manos_vid');

        void enviarEventoCapi({
          eventName: evento,
          eventId,
          clientIp: req.ip,
          userAgent: String(req.headers['user-agent'] || ''),
          fbp,
          fbc,
          externalId,
          value: metrica.valor_veiculo || 0,
          currency: 'BRL',
          contentIds: metrica.veiculo_id ? [metrica.veiculo_id] : undefined,
          contentName: metrica.veiculo_nome || undefined,
          sourceUrl: metrica.page_url || `${SITE_URL}/ofertas/${metrica.veiculo_slug || ''}`,
        });
      }

      return res.status(204).end();
    } catch (err) {
      console.error('[ofertas] erro em POST /api/ofertas/evento:', err);
      return res.status(204).end();
    }
  });

  // 10. Consultar métricas no painel administrativo (Admin)
  app.get('/api/ofertas/metricas', exigirAdminOfertas, async (_req, res) => {
    try {
      const store = readServerStore();
      let metricas = [...store.metricas];

      try {
        const { data, error } = await supabaseServer
          .from('ofertas_metricas')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1000);

        if (!error && Array.isArray(data) && data.length > 0) {
          const porEventId = new Map<string, OfertaMetrica>();
          for (const m of store.metricas) porEventId.set(m.event_id, m);
          for (const m of data) porEventId.set(m.event_id, m as OfertaMetrica);
          metricas = Array.from(porEventId.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        }
      } catch {
        /* usa store local */
      }

      return res.set('Cache-Control', 'no-store').json({ ok: true, metricas });
    } catch (err) {
      console.error('[ofertas] erro ao ler métricas:', err);
      return res.status(500).json({ ok: false, error: 'Erro ao carregar métricas.' });
    }
  });

  // 11. Rotas /ofertas e /ofertas/:slug com injeção SSR de SEO / Open Graph / JSON-LD
  // Quando compartilhado no WhatsApp, Facebook, Instagram ou acessado diretamente,
  // entrega o HTML já com <title>, og:image (foto principal), og:title, og:description e JSON-LD!
  const handleOfertaHtmlRoute = async (req: Request, res: Response, next: NextFunction) => {
    const slug = req.params.slug;
    const isIndex = !slug;

    try {
      const veiculo = slug ? await buscarOfertaPorSlug(slug) : null;
      const meta = buildOfertaMetaTags(veiculo, isIndex);

      const templatePath =
        process.env.NODE_ENV === 'production'
          ? path.join(process.cwd(), 'dist', 'index.html')
          : path.join(process.cwd(), 'index.html');

      if (!existsSync(templatePath)) {
        return next();
      }

      const ua = String(req.headers['user-agent'] || '').toLowerCase();
      const isBotOrCrawler =
        /whatsapp|facebookexternalhit|facebot|instagram|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|googlebot|bingbot|perplexity|gptbot|claudebot/i.test(
          ua,
        ) || req.query.ssr_meta === '1';

      // Em produção sempre injeta as meta tags no dist/index.html.
      // Em dev (Vite middleware), injeta quando é crawler/bot ou ?ssr_meta=1, e para
      // navegação normal deixa o Vite transformar o /src/main.tsx normalmente.
      if (process.env.NODE_ENV !== 'production' && !isBotOrCrawler) {
        return next();
      }

      const rawHtml = readFileSync(templatePath, 'utf8');
      const enrichedHtml = injectMetaIntoHtml(rawHtml, meta);

      const statusCode = slug && !veiculo ? 404 : 200;
      res
        .status(statusCode)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'no-cache')
        .send(enrichedHtml);
    } catch (err) {
      console.error('[ofertas] falha ao injetar SSR meta:', err);
      next();
    }
  };

  app.get('/ofertas', handleOfertaHtmlRoute);
  app.get('/ofertas/:slug', (req, res, next) => {
    if (req.params.slug === 'admin') return next();
    return handleOfertaHtmlRoute(req, res, next);
  });
}
