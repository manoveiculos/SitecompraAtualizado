// Tipos e regras compartilhados entre o servidor (server/trafego*.ts) e o
// painel /admin/trafego. Fica em src/lib para o esbuild do servidor e o Vite
// do front enxergarem exatamente a mesma definição.

export type OrigemTrafegoMacro = 'google_ads' | 'facebook_ads' | 'openai_ads' | 'organico';

export type TipoAcaoVisitante =
  | 'page_view'
  | 'view_vehicle'
  | 'select_vehicle'
  | 'filter_stock'
  | 'plate_lookup'
  | 'simulacao'
  | 'consultor_ia'
  | 'lead_parcial'
  | 'lead_completo'
  | 'whatsapp_click'
  | 'phone_click';

export const ACOES_VALIDAS: TipoAcaoVisitante[] = [
  'page_view',
  'view_vehicle',
  'select_vehicle',
  'filter_stock',
  'plate_lookup',
  'simulacao',
  'consultor_ia',
  'lead_parcial',
  'lead_completo',
  'whatsapp_click',
  'phone_click',
];

export interface EventoJornadaVisitante {
  id: string;
  timestamp: string;
  /** Última atualização (o dwell time reaproveita o mesmo evento). */
  atualizado_em?: string | null;
  visitor_id: string;
  session_id: string;
  origem_macro: OrigemTrafegoMacro;
  sub_origem: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id?: string | null;
  gclid: string | null;
  fbclid: string | null;
  oppref: string | null;
  referrer: string | null;
  /** IDs Meta/Google resolvidos a partir dos parâmetros da URL. */
  campanha_id?: string | null;
  conjunto_id?: string | null;
  anuncio_id?: string | null;
  acao: TipoAcaoVisitante;
  pagina: string;
  veiculo_id: string | null;
  veiculo_nome: string | null;
  valor_veiculo: number | null;
  detalhe: string | null;
  dispositivo: 'Mobile' | 'Desktop';
  /** "iPhone (iOS)", "Samsung (Android)", "Desktop Windows"... */
  dispositivo_detalhe?: string | null;
  navegador?: string | null;
  cidade?: string | null;
  uf?: string | null;
  pais?: string | null;
  /** Tempo ativo (aba visível + interação) no veículo, em segundos. */
  tempo_segundos?: number | null;
  fotos_vistas?: number | null;
  abriu_galeria?: boolean | null;
  scroll_max?: number | null;
  interacoes?: Record<string, number> | null;
}

export interface VisitanteIdentificado {
  visitor_id: string;
  nome: string | null;
  telefone: string | null;
  idade: number | null;
  faixa_etaria: string | null;
  identificado_em: string | null;
  crm_lead_id: string | null;
  crm_status: string | null;
  crm_sincronizado_em: string | null;
}

export interface DemografiaAnuncio {
  /** Faixa com mais cliques/impressões, ex.: "25-34". */
  predominante: string | null;
  genero_predominante: 'feminino' | 'masculino' | null;
  /** Fração 0..1 por faixa. */
  distribuicao: Record<string, number>;
}

export interface ContextoCampanhaMeta {
  nome: string | null;
  demografia?: DemografiaAnuncio | null;
}

/**
 * Qual objeto da Meta usar para o breakdown etário: o mais específico que a
 * sessão trouxe (conjunto > anúncio > campanha).
 */
export function alvoDemografiaMeta(
  e: Pick<EventoJornadaVisitante, 'campanha_id' | 'conjunto_id' | 'anuncio_id'>,
): string | null {
  return e.conjunto_id || e.anuncio_id || e.campanha_id || null;
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/** 102 -> "1m 42s" · 45 -> "45s" · 3900 -> "1h 05m". */
export function formatarDuracao(segundos: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const resto = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(resto).padStart(2, '0')}s`;
}

export function faixaEtariaDeIdade(idade: number | null | undefined): string | null {
  const i = Number(idade);
  if (!Number.isFinite(i) || i < 18 || i > 100) return null;
  if (i <= 24) return '18-24';
  if (i <= 34) return '25-34';
  if (i <= 44) return '35-44';
  if (i <= 54) return '45-54';
  if (i <= 64) return '55-64';
  return '65+';
}

// ---------------------------------------------------------------------------
// Temperatura do lead (Engagement Score)
// ---------------------------------------------------------------------------

export type NivelTemperatura = 'frio' | 'morno' | 'quente' | 'muito_quente';

export interface Temperatura {
  nivel: NivelTemperatura;
  score: number;
  motivos: string[];
}

export const TEMPERATURA_LABEL: Record<NivelTemperatura, string> = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
  muito_quente: 'Muito Quente',
};

/**
 * Pontua a sessão de um visitante. Pesos escolhidos para que:
 *  - >60s no MESMO carro já empurre para "Quente" junto de qualquer outro sinal;
 *  - clique em WhatsApp/telefone ou lead completo seja sempre "Muito Quente";
 *  - só navegar (home, filtros) nunca passe de "Morno".
 */
export function calcularTemperatura(passos: EventoJornadaVisitante[]): Temperatura {
  const motivos: string[] = [];
  let score = 0;

  const porVeiculo = new Map<string, { views: number; tempo: number; fotos: number }>();
  for (const p of passos) {
    if (p.acao !== 'view_vehicle' && p.acao !== 'select_vehicle') continue;
    const chave = p.veiculo_id || p.veiculo_nome;
    if (!chave) continue;
    const atual = porVeiculo.get(chave) || { views: 0, tempo: 0, fotos: 0 };
    if (p.acao === 'view_vehicle') atual.views += 1;
    atual.tempo += Number(p.tempo_segundos) || 0;
    atual.fotos = Math.max(atual.fotos, Number(p.fotos_vistas) || 0);
    porVeiculo.set(chave, atual);
  }

  const maiorTempo = Math.max(0, ...Array.from(porVeiculo.values()).map((v) => v.tempo));
  if (maiorTempo >= 180) {
    score += 45;
    motivos.push(`${formatarDuracao(maiorTempo)} no mesmo carro`);
  } else if (maiorTempo >= 120) {
    score += 38;
    motivos.push(`${formatarDuracao(maiorTempo)} no mesmo carro`);
  } else if (maiorTempo > 60) {
    score += 30;
    motivos.push(`>60s no mesmo carro`);
  } else if (maiorTempo >= 20) {
    score += 12;
  }

  if (Array.from(porVeiculo.values()).some((v) => v.views >= 2)) {
    score += 20;
    motivos.push('Voltou ao mesmo veículo');
  }
  if (porVeiculo.size >= 3) {
    score += 8;
    motivos.push(`Comparou ${porVeiculo.size} carros`);
  }

  const maxFotos = Math.max(0, ...passos.map((p) => Number(p.fotos_vistas) || 0));
  if (passos.some((p) => p.abriu_galeria)) {
    score += 8;
    motivos.push('Abriu a galeria');
  }
  if (maxFotos >= 5) {
    score += 8;
    motivos.push(`${maxFotos} fotos vistas`);
  }
  if (passos.some((p) => (Number(p.scroll_max) || 0) >= 75)) score += 4;

  if (passos.some((p) => p.acao === 'simulacao')) {
    score += 22;
    motivos.push('Simulou financiamento');
  }
  if (passos.some((p) => p.acao === 'plate_lookup')) score += 8;
  if (passos.some((p) => p.acao === 'consultor_ia')) score += 6;
  if (passos.some((p) => p.acao === 'lead_parcial')) {
    score += 25;
    motivos.push('Deixou contato');
  }

  const converteu = passos.some(
    (p) => p.acao === 'whatsapp_click' || p.acao === 'phone_click' || p.acao === 'lead_completo',
  );
  if (converteu) {
    score += 45;
    motivos.push('Pediu contato (WhatsApp/lead)');
  }

  score = Math.min(100, score);
  let nivel: NivelTemperatura = 'frio';
  if (converteu || score >= 75) nivel = 'muito_quente';
  else if (score >= 45) nivel = 'quente';
  else if (score >= 20) nivel = 'morno';

  return { nivel, score, motivos };
}

// ---------------------------------------------------------------------------
// Agregação por visitante
// ---------------------------------------------------------------------------

export interface CarroVisto {
  chave: string;
  veiculo_id: string | null;
  nome: string;
  valor: number | null;
  visitas: number;
  tempo_segundos: number;
  fotos_vistas: number;
  abriu_galeria: boolean;
}

export function agruparCarrosVistos(passos: EventoJornadaVisitante[]): CarroVisto[] {
  const mapa = new Map<string, CarroVisto>();
  for (const p of passos) {
    if (p.acao !== 'view_vehicle' && p.acao !== 'select_vehicle') continue;
    const nome = (p.veiculo_nome || '').trim();
    const chave = p.veiculo_id || nome;
    if (!chave) continue;
    const item = mapa.get(chave) || {
      chave,
      veiculo_id: p.veiculo_id,
      nome: nome || `Veículo ${p.veiculo_id}`,
      valor: p.valor_veiculo,
      visitas: 0,
      tempo_segundos: 0,
      fotos_vistas: 0,
      abriu_galeria: false,
    };
    if (p.acao === 'view_vehicle') item.visitas += 1;
    item.tempo_segundos += Number(p.tempo_segundos) || 0;
    item.fotos_vistas = Math.max(item.fotos_vistas, Number(p.fotos_vistas) || 0);
    item.abriu_galeria = item.abriu_galeria || Boolean(p.abriu_galeria);
    if (!item.valor && p.valor_veiculo) item.valor = p.valor_veiculo;
    if (nome && item.nome.startsWith('Veículo ')) item.nome = nome;
    mapa.set(chave, item);
  }
  return Array.from(mapa.values()).sort((a, b) => b.tempo_segundos - a.tempo_segundos);
}

/** Tempo total no site: o maior entre a janela da sessão e a soma do tempo ativo nos carros. */
export function tempoTotalSessaoSeg(passos: EventoJornadaVisitante[]): number {
  if (passos.length === 0) return 0;
  const tempos = passos.flatMap((p) => [
    new Date(p.timestamp).getTime(),
    p.atualizado_em ? new Date(p.atualizado_em).getTime() : 0,
  ]);
  const validos = tempos.filter((t) => Number.isFinite(t) && t > 0);
  const janela = validos.length ? (Math.max(...validos) - Math.min(...validos)) / 1000 : 0;
  const somaCarros = passos.reduce((acc, p) => acc + (Number(p.tempo_segundos) || 0), 0);
  return Math.min(6 * 3600, Math.round(Math.max(janela, somaCarros)));
}
