// ===========================================================================
// SERVIÇO DO MÓDULO INDEPENDENTE DE OFERTAS (/ofertas) — MANOS VEÍCULOS
// ===========================================================================

import { supabase } from '../lib/supabase';
import { getAttribution, initAttribution } from '../lib/attribution';

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

  // Flag retornada quando acessado diretamente em rascunho/pausado por visitante comum
  indisponivel_publico?: boolean;
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

export const VENDEDOR_PADRAO_OFERTAS = {
  nome: 'Alexandre',
  whatsapp: '5547988467855',
  localizacao: 'Itapema/SC',
};

const LOCAL_STORAGE_VEICULOS_KEY = 'manos_ofertas_veiculos_v1';
const LOCAL_STORAGE_METRICAS_KEY = 'manos_ofertas_metricas_v1';
const LOCAL_STORAGE_CONFIG_KEY = 'manos_ofertas_config_v1';
const ADMIN_SESSION_KEY = 'manos_ofertas_admin_key_v1';

// ---------------------------------------------------------------------------
// Seeds Iniciais (Garantem que os exemplos da especificação funcionem sempre)
// ---------------------------------------------------------------------------

export const SEED_VEICULOS_OFERTAS: VeiculoOferta[] = [
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
// Funções Utilitárias de Formatação, Slug e WhatsApp
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

export function formatarMoedaBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export function formatarQuilometragem(km: number | null | undefined): string {
  if (km === null || km === undefined || Number.isNaN(Number(km))) return '';
  return `${Number(km).toLocaleString('pt-BR')} km`;
}

export function formatarAnoVeiculo(
  anoFabricacao: number | null | undefined,
  anoModelo: number | null | undefined,
): string {
  if (anoFabricacao && anoModelo && anoFabricacao !== anoModelo) {
    return `${anoFabricacao}/${anoModelo}`;
  }
  if (anoModelo) return String(anoModelo);
  if (anoFabricacao) return String(anoFabricacao);
  return '';
}

export function obterTituloVeiculo(v: Partial<VeiculoOferta>): string {
  if (v.titulo_personalizado && v.titulo_personalizado.trim()) {
    return v.titulo_personalizado.trim();
  }
  const ano = v.ano_modelo || v.ano_fabricacao || '';
  return [v.marca, v.modelo, v.versao, ano].filter(Boolean).join(' ').trim();
}

export function obterNomeCurtoWhatsApp(v: Partial<VeiculoOferta>): string {
  const ano = v.ano_modelo || v.ano_fabricacao || '';
  const curto = [v.marca, v.modelo, ano].filter(Boolean).join(' ').trim();
  return curto || v.titulo_personalizado || 'veículo anunciado';
}

/**
 * Gera a mensagem personalizada oficial para o WhatsApp conforme a especificação:
 * "Olá, Alexandre! Vi o anúncio do Volkswagen Polo 2022 no site da Manos Veículos e gostaria de mais informações. Ele ainda está disponível?"
 */
export function gerarMensagemWhatsAppOferta(v: Partial<VeiculoOferta>): string {
  const vendedor = (v.vendedor_nome || VENDEDOR_PADRAO_OFERTAS.nome).trim();
  const veiculoNome = obterNomeCurtoWhatsApp(v);
  return `Olá, ${vendedor}! Vi o anúncio do ${veiculoNome} no site da Manos Veículos e gostaria de mais informações. Ele ainda está disponível?`;
}

/**
 * Gera o link oficial wa.me direcionando para o Alexandre (5547988467855)
 * ou vendedor configurado no anúncio.
 */
export function gerarLinkWhatsAppOferta(v: Partial<VeiculoOferta>): string {
  const numero =
    (v.vendedor_whatsapp || VENDEDOR_PADRAO_OFERTAS.whatsapp).replace(/\D/g, '') ||
    VENDEDOR_PADRAO_OFERTAS.whatsapp;
  const mensagem = gerarMensagemWhatsAppOferta(v);
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// ---------------------------------------------------------------------------
// Gestão da Sessão Administrativa
// ---------------------------------------------------------------------------

export function getSavedAdminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function saveAdminKey(key: string): void {
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, key);
  } catch {
    /* noop */
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* noop */
  }
}

export async function autenticarAdminOfertas(password: string): Promise<{ ok: boolean; error?: string }> {
  const fallbackPassword =
    (import.meta as any).env?.VITE_OFERTAS_ADMIN_PASSWORD ||
    (import.meta as any).env?.VITE_REPASSE_ADMIN_PASSWORD ||
    (import.meta as any).env?.VITE_ADMIN_PASSWORD ||
    'manos2026';

  try {
    const res = await fetch('/api/ofertas/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      saveAdminKey(password);
      return { ok: true };
    }
  } catch {
    /* fallback client check se offline */
  }

  if (password && password === fallbackPassword) {
    saveAdminKey(password);
    return { ok: true };
  }

  return { ok: false, error: 'Senha administrativa incorreta.' };
}

// ---------------------------------------------------------------------------
// Normalização e Cache Local
// ---------------------------------------------------------------------------

function normalizeOferta(raw: any): VeiculoOferta {
  const fotos: string[] = Array.isArray(raw.fotos)
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

  const diferenciais: string[] = Array.isArray(raw.diferenciais)
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
    (typeof raw.foto_principal === 'string' && raw.foto_principal.trim()) || fotos[0] || '';
  const fotosOrdenadas = fotoPrincipal
    ? [fotoPrincipal, ...fotos.filter((f) => f !== fotoPrincipal)]
    : fotos;

  const anoFab = raw.ano_fabricacao ? Number(raw.ano_fabricacao) : null;
  const anoMod = raw.ano_modelo ? Number(raw.ano_modelo) : anoFab;

  return {
    id: raw.id ?? `oferta_${Date.now()}`,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || new Date().toISOString(),
    marca: String(raw.marca || '').trim(),
    modelo: String(raw.modelo || '').trim(),
    versao: String(raw.versao || '').trim(),
    ano_fabricacao: Number.isFinite(anoFab) ? anoFab : null,
    ano_modelo: Number.isFinite(anoMod) ? anoMod : null,
    titulo_personalizado: String(raw.titulo_personalizado || '').trim(),
    slug: gerarSlugOferta(
      raw.slug || `${raw.marca || ''}-${raw.modelo || ''}-${anoMod || anoFab || ''}`,
    ),
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
    diferenciais,
    foto_principal: fotoPrincipal,
    fotos: fotosOrdenadas,
    localizacao:
      String(raw.localizacao || VENDEDOR_PADRAO_OFERTAS.localizacao).trim() ||
      VENDEDOR_PADRAO_OFERTAS.localizacao,
    vendedor_nome:
      String(raw.vendedor_nome || VENDEDOR_PADRAO_OFERTAS.nome).trim() ||
      VENDEDOR_PADRAO_OFERTAS.nome,
    vendedor_whatsapp:
      String(raw.vendedor_whatsapp || VENDEDOR_PADRAO_OFERTAS.whatsapp).replace(/\D/g, '') ||
      VENDEDOR_PADRAO_OFERTAS.whatsapp,
    status: (['rascunho', 'publicado', 'vendido', 'pausado'].includes(raw.status)
      ? raw.status
      : 'rascunho') as OfertaStatus,
    indisponivel_publico: Boolean(raw.indisponivel_publico),
  };
}

function getLocalVeiculosCache(): VeiculoOferta[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VEICULOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeOferta) : [];
  } catch {
    return [];
  }
}

function saveLocalVeiculosCache(lista: VeiculoOferta[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_VEICULOS_KEY, JSON.stringify(lista));
  } catch {
    /* storage cheio ou modo privado */
  }
}

// ---------------------------------------------------------------------------
// Operações de Leitura e Escrita de Anúncios
// ---------------------------------------------------------------------------

export async function fetchOfertasPublicadas(): Promise<VeiculoOferta[]> {
  try {
    const res = await fetch('/api/ofertas');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.veiculos)) {
        return json.veiculos.map(normalizeOferta);
      }
    }
  } catch {
    /* fallback Supabase / local */
  }

  try {
    const { data, error } = await supabase
      .from('veiculos_ofertas')
      .select('*')
      .eq('status', 'publicado')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map(normalizeOferta);
    }
  } catch {
    /* fallback local */
  }

  const local = getLocalVeiculosCache();
  if (local.length > 0) {
    return local.filter((v) => v.status === 'publicado');
  }
  return SEED_VEICULOS_OFERTAS.filter((v) => v.status === 'publicado');
}

export async function fetchTodasOfertasAdmin(): Promise<VeiculoOferta[]> {
  const adminKey = getSavedAdminKey();
  try {
    const res = await fetch('/api/ofertas?all=1', {
      headers: { 'x-ofertas-admin-key': adminKey },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.veiculos)) {
        const norm = json.veiculos.map(normalizeOferta);
        saveLocalVeiculosCache(norm);
        return norm;
      }
    }
  } catch {
    /* fallback Supabase / local */
  }

  try {
    const { data, error } = await supabase
      .from('veiculos_ofertas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const norm = data.map(normalizeOferta);
      saveLocalVeiculosCache(norm);
      return norm;
    }
  } catch {
    /* fallback local */
  }

  const local = getLocalVeiculosCache();
  return local.length > 0 ? local : [...SEED_VEICULOS_OFERTAS];
}

export async function fetchOfertaPorSlug(
  slug: string,
  preview = false,
): Promise<VeiculoOferta | null> {
  const slugLimpo = gerarSlugOferta(slug);
  if (!slugLimpo) return null;

  const adminKey = getSavedAdminKey();
  try {
    const query = preview ? '?preview=1' : '';
    const res = await fetch(`/api/ofertas/veiculo/${encodeURIComponent(slugLimpo)}${query}`, {
      headers: adminKey ? { 'x-ofertas-admin-key': adminKey } : undefined,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.veiculo) {
        return normalizeOferta(json.veiculo);
      }
    } else if (res.status === 404) {
      // Verifica se existe apenas no cache local antes de desistir
      const localFound = getLocalVeiculosCache().find((v) => v.slug === slugLimpo);
      return localFound || null;
    }
  } catch {
    /* fallback Supabase / local */
  }

  try {
    const { data, error } = await supabase
      .from('veiculos_ofertas')
      .select('*')
      .eq('slug', slugLimpo)
      .maybeSingle();

    if (!error && data) {
      return normalizeOferta(data);
    }
  } catch {
    /* fallback local */
  }

  const local = getLocalVeiculosCache();
  return (
    local.find((v) => v.slug === slugLimpo) ||
    SEED_VEICULOS_OFERTAS.find((v) => v.slug === slugLimpo) ||
    null
  );
}

export async function criarOfertaVeiculo(
  payload: Omit<VeiculoOferta, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ ok: boolean; veiculo?: VeiculoOferta; error?: string }> {
  const adminKey = getSavedAdminKey();
  try {
    const res = await fetch('/api/ofertas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ofertas-admin-key': adminKey,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.veiculo) {
      const criado = normalizeOferta(json.veiculo);
      const cache = getLocalVeiculosCache().filter((v) => v.slug !== criado.slug);
      saveLocalVeiculosCache([criado, ...cache]);
      return { ok: true, veiculo: criado };
    }
    return { ok: false, error: json.error || 'Erro ao criar anúncio.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha de conexão com o servidor.' };
  }
}

export async function atualizarOfertaVeiculo(
  id: number | string,
  payload: Partial<VeiculoOferta>,
): Promise<{ ok: boolean; veiculo?: VeiculoOferta; error?: string }> {
  const adminKey = getSavedAdminKey();
  try {
    const res = await fetch(`/api/ofertas/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-ofertas-admin-key': adminKey,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.veiculo) {
      const atualizado = normalizeOferta(json.veiculo);
      const cache = getLocalVeiculosCache();
      const idx = cache.findIndex((v) => String(v.id) === String(id));
      if (idx !== -1) {
        cache[idx] = atualizado;
        saveLocalVeiculosCache(cache);
      }
      return { ok: true, veiculo: atualizado };
    }
    return { ok: false, error: json.error || 'Erro ao atualizar anúncio.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha de conexão com o servidor.' };
  }
}

export async function excluirOfertaVeiculo(
  id: number | string,
): Promise<{ ok: boolean; error?: string }> {
  const adminKey = getSavedAdminKey();
  try {
    const res = await fetch(`/api/ofertas/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: { 'x-ofertas-admin-key': adminKey },
    });
    if (res.ok) {
      const cache = getLocalVeiculosCache().filter((v) => String(v.id) !== String(id));
      saveLocalVeiculosCache(cache);
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || 'Erro ao excluir anúncio.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Falha ao excluir anúncio.' };
  }
}

// ---------------------------------------------------------------------------
// Compressão e Otimização Automática de Imagens (WebP) + Upload Seguro
// ---------------------------------------------------------------------------

const FORMATOS_PERMITIDOS = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024; // 15 MB brutos antes da compressão

/**
 * Comprime e redimensiona automaticamente a imagem no navegador para WebP
 * (máximo 1600x1200px, qualidade 0.84) garantindo carregamento ultra-rápido no mobile.
 */
export async function comprimirImagemParaWebP(
  file: File,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.84,
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Não foi possível inicializar o otimizador de imagem.'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/webp', quality);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Falha ao comprimir imagem para WebP.'));
            return;
          }
          resolve({ blob, dataUrl });
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Arquivo de imagem inválido ou corrompido.'));
    };

    img.src = objectUrl;
  });
}

export async function uploadFotoOferta(
  file: File,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!FORMATOS_PERMITIDOS.has(file.type.toLowerCase())) {
    return {
      ok: false,
      error: `Formato não suportado (${file.type || 'desconhecido'}). Envie JPG, PNG, WebP ou AVIF.`,
    };
  }

  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return {
      ok: false,
      error: 'A imagem excede o limite de 15MB. Escolha um arquivo menor.',
    };
  }

  try {
    const { blob, dataUrl } = await comprimirImagemParaWebP(file);
    const fileName = `oferta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
    const filePath = `veiculos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('fotos-ofertas')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });

    if (!uploadError) {
      const { data } = supabase.storage.from('fotos-ofertas').getPublicUrl(filePath);
      if (data?.publicUrl) {
        return { ok: true, url: data.publicUrl };
      }
    }

    // Fallback para o bucket existente fotos-repasse se fotos-ofertas ainda não tiver sido criado
    const { error: fallbackBucketError } = await supabase.storage
      .from('fotos-repasse')
      .upload(`ofertas/${fileName}`, blob, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });

    if (!fallbackBucketError) {
      const { data } = supabase.storage.from('fotos-repasse').getPublicUrl(`ofertas/${fileName}`);
      if (data?.publicUrl) {
        return { ok: true, url: data.publicUrl };
      }
    }

    // Fallback final em WebP DataURL comprimida
    return { ok: true, url: dataUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao otimizar e enviar foto.' };
  }
}

// ---------------------------------------------------------------------------
// Rastreamento, Marketing Digital, UTMs e Consentimento LGPD
// ---------------------------------------------------------------------------

const disparadosNaSessao = new Set<string>();

function gerarEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fallback */
  }
  return `of_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Verifica se o visitante recusou explicitamente cookies de marketing no banner LGPD.
 */
function verificarPermissaoMarketingLGPD(): boolean {
  try {
    const raw = localStorage.getItem('manos_lgpd_consent_v1');
    if (!raw) return true; // Padrão ativo até que haja recusa explícita
    const prefs = JSON.parse(raw);
    if (prefs && prefs.marketing === false) return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Lê e preserva todos os parâmetros UTM da URL atual + atribuição da sessão.
 */
export function obterOrigemAnuncioCompleta(): Record<string, string> {
  initAttribution();
  const attr = getAttribution() as Record<string, unknown>;
  const params = new URLSearchParams(window.location.search);

  const getVal = (key: string): string => {
    const fromUrl = params.get(key);
    if (fromUrl) return fromUrl;
    const fromAttr = attr[key];
    return typeof fromAttr === 'string' ? fromAttr : '';
  };

  return {
    canal: String(attr.canal || getVal('utm_source') || 'direto'),
    utm_source: getVal('utm_source'),
    utm_medium: getVal('utm_medium'),
    utm_campaign: getVal('utm_campaign'),
    utm_content: getVal('utm_content'),
    utm_term: getVal('utm_term'),
    fbclid: getVal('fbclid'),
    gclid: getVal('gclid'),
    referrer: document.referrer || String(attr.referrer || ''),
    page_url: window.location.href,
  };
}

function saveLocalMetrica(m: OfertaMetrica): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_METRICAS_KEY);
    const list: OfertaMetrica[] = raw ? JSON.parse(raw) : [];
    list.unshift(m);
    localStorage.setItem(LOCAL_STORAGE_METRICAS_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    /* noop */
  }
}

/**
 * Inicializa identificadores adicionais de Meta Pixel ou GA4 caso tenham sido
 * configurados especificamente no painel de Ofertas (sem inserir IDs fictícios).
 */
export function inicializarPixelsConfiguradosOfertas(config: OfertasTrackingConfig): void {
  if (!verificarPermissaoMarketingLGPD()) return;
  const w = window as any;

  if (config.meta_pixel_id && /^\d{10,20}$/.test(config.meta_pixel_id.trim())) {
    const pid = config.meta_pixel_id.trim();
    if (w.fbq && w.__manosPixelId !== pid && !w[`__ofertasPixelInited_${pid}`]) {
      try {
        w.fbq('init', pid);
        w[`__ofertasPixelInited_${pid}`] = true;
      } catch {
        /* ignore */
      }
    }
  }

  if (config.ga4_measurement_id && /^G-[A-Z0-9]+$/i.test(config.ga4_measurement_id.trim())) {
    const gid = config.ga4_measurement_id.trim();
    if (w.gtag && !w[`__ofertasGa4Inited_${gid}`]) {
      try {
        w.gtag('config', gid);
        w[`__ofertasGa4Inited_${gid}`] = true;
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Registra e dispara eventos de marketing digital do módulo /ofertas:
 * - PageView: Visualização da página
 * - ViewContent: Visualização de um veículo específico
 * - Contact: Clique no botão de contato
 * - WhatsAppClick: Clique para iniciar conversa pelo WhatsApp
 *
 * REGRAS CUMPRIDAS:
 * - Não dispara Purchase quando houver clique no WhatsApp.
 * - Não duplica eventos.
 * - Envia ID do veículo, nome, URL, origem do tráfego, campanha, data/hora e event_id.
 */
export function rastrearEventoOferta(
  evento: 'PageView' | 'ViewContent' | 'Contact' | 'WhatsAppClick',
  veiculo?: VeiculoOferta | null,
): string {
  // Evita duplicação de PageView e ViewContent na mesma visualização de página
  if (evento === 'PageView' || evento === 'ViewContent') {
    const chaveUnica = `${evento}:${veiculo?.slug || window.location.pathname}`;
    if (disparadosNaSessao.has(chaveUnica)) {
      return '';
    }
    disparadosNaSessao.add(chaveUnica);
  }

  const eid = gerarEventId();
  const origem = obterOrigemAnuncioCompleta();
  const agora = new Date().toISOString();
  const veiculoId = veiculo ? String(veiculo.id) : null;
  const veiculoNome = veiculo ? obterTituloVeiculo(veiculo) : null;
  const veiculoSlug = veiculo ? veiculo.slug : null;
  const valor = veiculo ? Number(veiculo.preco_venda) || 0 : 0;

  const payloadRastreamento = {
    event_id: eid,
    vehicle_id: veiculoId,
    vehicle_name: veiculoNome,
    vehicle_slug: veiculoSlug,
    value: valor,
    currency: 'BRL',
    page_url: origem.page_url,
    traffic_source: origem.utm_source || origem.canal,
    utm_source: origem.utm_source,
    utm_medium: origem.utm_medium,
    utm_campaign: origem.utm_campaign,
    utm_content: origem.utm_content,
    utm_term: origem.utm_term,
    timestamp: agora,
  };

  // Disparo para Pixels client-side (respeitando consentimento de cookies / LGPD)
  if (verificarPermissaoMarketingLGPD()) {
    const w = window as any;

    // 1. Google Analytics 4 / Google Tag Manager dataLayer
    try {
      w.dataLayer = w.dataLayer || [];
      w.dataLayer.push({
        event: `ofertas_${evento.toLowerCase()}`,
        ...payloadRastreamento,
      });

      if (typeof w.gtag === 'function') {
        if (evento === 'ViewContent' && veiculo) {
          w.gtag('event', 'view_item', {
            currency: 'BRL',
            value: valor,
            items: [{ item_id: veiculoId, item_name: veiculoNome, price: valor }],
            ...payloadRastreamento,
          });
        } else if (evento === 'Contact' || evento === 'WhatsAppClick') {
          w.gtag('event', evento === 'Contact' ? 'contact' : 'whatsapp_click', payloadRastreamento);
        }
      }
    } catch {
      /* noop */
    }

    // 2. Meta Pixel (fbq) — Sem disparar Purchase!
    try {
      if (typeof w.fbq === 'function') {
        if (evento === 'PageView') {
          w.fbq('track', 'PageView', {}, { eventID: eid });
        } else if (evento === 'ViewContent' && veiculo) {
          w.fbq(
            'track',
            'ViewContent',
            {
              content_ids: [veiculoId],
              content_name: veiculoNome,
              content_type: 'vehicle',
              value: valor,
              currency: 'BRL',
              utm_source: origem.utm_source || undefined,
              utm_campaign: origem.utm_campaign || undefined,
            },
            { eventID: eid },
          );
        } else if (evento === 'Contact') {
          w.fbq(
            'track',
            'Contact',
            {
              content_ids: veiculoId ? [veiculoId] : undefined,
              content_name: veiculoNome || 'Contato WhatsApp Ofertas',
              content_type: 'vehicle',
              value: valor,
              currency: 'BRL',
            },
            { eventID: eid },
          );
        } else if (evento === 'WhatsAppClick') {
          w.fbq(
            'trackCustom',
            'WhatsAppClick',
            {
              content_ids: veiculoId ? [veiculoId] : undefined,
              content_name: veiculoNome || 'Clique WhatsApp Alexandre',
              vehicle_slug: veiculoSlug,
              value: valor,
              currency: 'BRL',
              utm_source: origem.utm_source || origem.canal,
              utm_campaign: origem.utm_campaign || undefined,
              utm_content: origem.utm_content || undefined,
            },
            { eventID: eid },
          );
        }
      }
    } catch {
      /* noop */
    }
  }

  // 3. Registro de métricas no servidor (/api/ofertas/evento) + espelhamento Meta CAPI
  const metricaRecord: OfertaMetrica = {
    id: eid,
    created_at: agora,
    event_id: eid,
    evento,
    veiculo_id: veiculoId,
    veiculo_slug: veiculoSlug,
    veiculo_nome: veiculoNome,
    valor_veiculo: valor,
    page_url: origem.page_url,
    canal: origem.canal,
    utm_source: origem.utm_source || null,
    utm_medium: origem.utm_medium || null,
    utm_campaign: origem.utm_campaign || null,
    utm_content: origem.utm_content || null,
    utm_term: origem.utm_term || null,
    fbclid: origem.fbclid || null,
    gclid: origem.gclid || null,
    referrer: origem.referrer || null,
  };

  saveLocalMetrica(metricaRecord);

  try {
    const corpo = JSON.stringify({
      ...metricaRecord,
      atribuicao: origem,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/ofertas/evento', new Blob([corpo], { type: 'application/json' }));
    } else {
      void fetch('/api/ofertas/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: corpo,
        keepalive: true,
      });
    }
  } catch {
    /* noop */
  }

  return eid;
}

/**
 * Aciona os eventos Contact + WhatsAppClick no clique de qualquer CTA de WhatsApp da página.
 */
export function registrarCliqueWhatsAppOferta(veiculo: VeiculoOferta): void {
  rastrearEventoOferta('Contact', veiculo);
  rastrearEventoOferta('WhatsAppClick', veiculo);
}

// ---------------------------------------------------------------------------
// Consulta de Métricas e Configurações (Admin)
// ---------------------------------------------------------------------------

export async function fetchMetricasOfertasAdmin(): Promise<OfertaMetrica[]> {
  const adminKey = getSavedAdminKey();
  try {
    const res = await fetch('/api/ofertas/metricas', {
      headers: { 'x-ofertas-admin-key': adminKey },
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.metricas)) {
        return json.metricas;
      }
    }
  } catch {
    /* fallback local */
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_METRICAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchConfigOfertas(): Promise<OfertasTrackingConfig> {
  try {
    const res = await fetch('/api/ofertas/config');
    if (res.ok) {
      const json = await res.json();
      if (json.config) {
        return json.config;
      }
    }
  } catch {
    /* fallback local */
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* noop */
  }

  return {
    meta_pixel_id: '',
    ga4_measurement_id: '',
    vendedor_padrao_nome: VENDEDOR_PADRAO_OFERTAS.nome,
    vendedor_padrao_whatsapp: VENDEDOR_PADRAO_OFERTAS.whatsapp,
    consentimento_lgpd_obrigatorio: false,
  };
}

export async function salvarConfigOfertasAdmin(
  config: OfertasTrackingConfig,
): Promise<{ ok: boolean; error?: string }> {
  const adminKey = getSavedAdminKey();
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* noop */
  }

  try {
    const res = await fetch('/api/ofertas/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ofertas-admin-key': adminKey,
      },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      return { ok: true };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: json.error || 'Erro ao salvar configurações.' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro de conexão.' };
  }
}
