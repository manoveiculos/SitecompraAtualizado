// Ponte entre a telemetria do site e o Manos CRM (Supabase).
//
// Tudo aqui exige SUPABASE_SERVICE_ROLE_KEY: leads_manos_crm tem RLS e dado
// pessoal. Sem a chave, `crmAtivo()` é false e o painel segue funcionando só
// com os dados do site (visitante continua "anônimo" no card).
//
// Fluxo de deanonymization:
//   1. O visitante informa nome+telefone (funil, financiamento, venda) e o
//      front chama POST /api/trafego/identificar com o `visitor_id` (cookie).
//   2. O n8n cria o lead em leads_manos_crm (assíncrono). Procuramos o lead pelo
//      telefone; quando existe, gravamos `visitor_id` + `trafego_resumo` nele e
//      uma nota legível no histórico do lead (interactions_manos_crm).
//   3. O painel lê o status do funil direto do lead.
//
// Cliques de WhatsApp de visitante que NÃO se identificou continuam anônimos:
// o wa.me não devolve o número. Para amarrar esses, o caminho é pôr um código
// curto na mensagem pré-preenchida e casá-lo no CRM quando a conversa chegar.

import {
  agruparCarrosVistos,
  calcularTemperatura,
  formatarDuracao,
  tempoTotalSessaoSeg,
  TEMPERATURA_LABEL,
  type EventoJornadaVisitante,
  type VisitanteIdentificado,
} from '../src/lib/trafegoInteligencia';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://jkblxdxnbmciicakusnl.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function crmAtivo(): boolean {
  return Boolean(SERVICE_KEY);
}

async function rest(
  caminho: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<any> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: init.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const texto = await r.text();
  return texto ? JSON.parse(texto) : null;
}

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/** Só dígitos, com DDI 55 quando vier com DDD (10/11 dígitos). */
export function normalizarTelefone(valor: unknown): string | null {
  const d = String(valor ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

/** O CRM guarda ora com 55, ora sem (ver formatos em leads_manos_crm). */
function variantesTelefone(tel55: string): string[] {
  const sem = tel55.replace(/^55/, '');
  return Array.from(new Set([tel55, sem]));
}

// ---------------------------------------------------------------------------
// Espelho no Supabase (best-effort, nunca derruba a ingestão)
// ---------------------------------------------------------------------------

function linhaEvento(e: EventoJornadaVisitante) {
  return {
    id: e.id,
    created_at: e.timestamp,
    updated_at: e.atualizado_em || e.timestamp,
    visitor_id: e.visitor_id,
    session_id: e.session_id,
    origem_macro: e.origem_macro,
    sub_origem: e.sub_origem,
    utm_source: e.utm_source,
    utm_medium: e.utm_medium,
    utm_campaign: e.utm_campaign,
    utm_content: e.utm_content,
    utm_term: e.utm_term,
    utm_id: e.utm_id ?? null,
    gclid: e.gclid,
    fbclid: e.fbclid,
    oppref: e.oppref,
    referrer: e.referrer,
    campanha_id: e.campanha_id ?? null,
    conjunto_id: e.conjunto_id ?? null,
    anuncio_id: e.anuncio_id ?? null,
    acao: e.acao,
    pagina: e.pagina,
    veiculo_id: e.veiculo_id,
    veiculo_nome: e.veiculo_nome,
    valor_veiculo: e.valor_veiculo,
    detalhe: e.detalhe,
    dispositivo: e.dispositivo,
    dispositivo_detalhe: e.dispositivo_detalhe ?? null,
    navegador: e.navegador ?? null,
    cidade: e.cidade ?? null,
    uf: e.uf ?? null,
    pais: e.pais ?? null,
    tempo_segundos: Math.round(Number(e.tempo_segundos) || 0),
    fotos_vistas: Math.round(Number(e.fotos_vistas) || 0),
    abriu_galeria: Boolean(e.abriu_galeria),
    scroll_max: Math.round(Number(e.scroll_max) || 0),
    interacoes: e.interacoes ?? {},
  };
}

export async function espelharEventos(eventos: EventoJornadaVisitante[]): Promise<void> {
  if (!crmAtivo() || eventos.length === 0) return;
  try {
    for (let i = 0; i < eventos.length; i += 200) {
      await rest('trafego_eventos?on_conflict=id', {
        method: 'POST',
        body: eventos.slice(i, i + 200).map(linhaEvento),
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
    }
  } catch (err) {
    console.warn('[trafego-crm] espelho de eventos falhou (a migration foi aplicada?):', (err as Error).message);
  }
}

export async function espelharVisitante(v: VisitanteIdentificado, cidade?: string | null, uf?: string | null): Promise<void> {
  if (!crmAtivo()) return;
  try {
    await rest('trafego_visitantes?on_conflict=visitor_id', {
      method: 'POST',
      body: {
        visitor_id: v.visitor_id,
        last_seen: new Date().toISOString(),
        nome: v.nome,
        telefone: v.telefone,
        idade: v.idade,
        faixa_etaria: v.faixa_etaria,
        identificado_em: v.identificado_em,
        crm_lead_id: v.crm_lead_id,
        crm_status: v.crm_status,
        crm_sincronizado_em: v.crm_sincronizado_em,
        cidade: cidade ?? null,
        uf: uf ?? null,
      },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  } catch (err) {
    console.warn('[trafego-crm] espelho de visitante falhou:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Resumo enriquecido para o CRM
// ---------------------------------------------------------------------------

export interface ResumoComportamento {
  gerado_em: string;
  origem: {
    canal: string;
    sub_origem: string;
    campanha_id: string | null;
    campanha_nome: string | null;
    utm: Record<string, string | null>;
  };
  local: { cidade: string | null; uf: string | null };
  aparelho: string | null;
  tempo_total_site: string;
  temperatura: string;
  score_engajamento: number;
  carros_vistos: Array<{ nome: string; tempo: string; tempo_segundos: number; fotos_vistas: number; visitas: number }>;
  carro_maior_interesse: string | null;
  acoes: string[];
}

export function montarResumo(
  passos: EventoJornadaVisitante[],
  campanhaNome: string | null,
): ResumoComportamento {
  const ordenados = [...passos].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const primeiro = ordenados[0];
  const comGeo = [...ordenados].reverse().find((p) => p.cidade) || primeiro;
  const comUa = [...ordenados].reverse().find((p) => p.dispositivo_detalhe) || primeiro;
  const pago = ordenados.find((p) => p.origem_macro !== 'organico') || primeiro;

  const carros = agruparCarrosVistos(ordenados);
  const temp = calcularTemperatura(ordenados);

  const acoes: string[] = [];
  const nFotos = Math.max(0, ...ordenados.map((p) => Number(p.fotos_vistas) || 0));
  if (ordenados.some((p) => p.abriu_galeria)) acoes.push(`Abriu galeria de fotos (${nFotos} fotos vistas)`);
  if (ordenados.some((p) => p.acao === 'filter_stock')) acoes.push('Filtrou o estoque');
  if (ordenados.some((p) => p.acao === 'simulacao')) acoes.push('Simulou financiamento');
  if (ordenados.some((p) => p.acao === 'plate_lookup')) acoes.push('Consultou placa do carro de troca');
  if (ordenados.some((p) => p.acao === 'consultor_ia')) acoes.push('Usou o Consultor IA');
  if (ordenados.some((p) => p.acao === 'whatsapp_click')) acoes.push('Clicou no WhatsApp');
  if (ordenados.some((p) => p.acao === 'phone_click')) acoes.push('Clicou para ligar');
  if (ordenados.some((p) => p.acao === 'lead_completo' || p.acao === 'lead_parcial')) acoes.push('Enviou formulário');

  return {
    gerado_em: new Date().toISOString(),
    origem: {
      canal: pago?.sub_origem || 'Direto',
      sub_origem: pago?.sub_origem || 'Direto',
      campanha_id: pago?.campanha_id || pago?.utm_campaign || null,
      campanha_nome: campanhaNome,
      utm: {
        utm_source: pago?.utm_source ?? null,
        utm_medium: pago?.utm_medium ?? null,
        utm_campaign: pago?.utm_campaign ?? null,
        utm_content: pago?.utm_content ?? null,
        utm_term: pago?.utm_term ?? null,
      },
    },
    local: { cidade: comGeo?.cidade ?? null, uf: comGeo?.uf ?? null },
    aparelho: comUa?.dispositivo_detalhe ?? comUa?.dispositivo ?? null,
    tempo_total_site: formatarDuracao(tempoTotalSessaoSeg(ordenados)),
    temperatura: TEMPERATURA_LABEL[temp.nivel],
    score_engajamento: temp.score,
    carros_vistos: carros.map((c) => ({
      nome: c.nome,
      tempo: formatarDuracao(c.tempo_segundos),
      tempo_segundos: c.tempo_segundos,
      fotos_vistas: c.fotos_vistas,
      visitas: c.visitas,
    })),
    carro_maior_interesse: carros[0]?.nome ?? null,
    acoes,
  };
}

/** Texto curto para o consultor ler no histórico do lead. */
export function textoNotaCrm(r: ResumoComportamento): string {
  const linhas = [
    `📊 Comportamento no site (${r.temperatura}, nota ${r.score_engajamento}/100)`,
    `Origem: ${r.origem.sub_origem}${r.origem.campanha_nome ? ` • ${r.origem.campanha_nome}` : r.origem.campanha_id ? ` • campanha ${r.origem.campanha_id}` : ''}`,
    `Local/aparelho: ${[r.local.cidade, r.local.uf].filter(Boolean).join(' - ') || 'n/d'} • ${r.aparelho || 'n/d'}`,
    `Tempo no site: ${r.tempo_total_site}`,
  ];
  if (r.carros_vistos.length) {
    linhas.push('Carros vistos: ' + r.carros_vistos.map((c) => `${c.nome} (${c.tempo})`).join(' | '));
  }
  if (r.carro_maior_interesse) linhas.push(`Maior interesse: ${r.carro_maior_interesse}`);
  if (r.acoes.length) linhas.push(`Ações: ${r.acoes.join(', ')}`);
  return linhas.join('\n');
}

// ---------------------------------------------------------------------------
// Vínculo com o lead do CRM
// ---------------------------------------------------------------------------

export interface LeadCrmEncontrado {
  id: string;
  nome: string | null;
  status: string | null;
}

export async function buscarLeadPorTelefone(tel55: string): Promise<LeadCrmEncontrado | null> {
  if (!crmAtivo()) return null;
  try {
    const lista = variantesTelefone(tel55).join(',');
    const linhas = (await rest(
      `leads_manos_crm?select=id,name,status&phone=in.(${lista})&order=created_at.desc&limit=1`,
    )) as Array<{ id: string; name: string | null; status: string | null }> | null;
    const l = linhas?.[0];
    return l ? { id: l.id, nome: l.name, status: l.status } : null;
  } catch (err) {
    console.warn('[trafego-crm] busca de lead falhou:', (err as Error).message);
    return null;
  }
}

const ultimaNota = new Map<string, number>();
const INTERVALO_NOTA_MS = 30 * 60 * 1000;

/**
 * Grava o resumo no lead (`visitor_id` + `trafego_resumo`) e, no máximo a cada
 * 30 min por lead, uma nota no histórico. Devolve o lead encontrado ou null.
 */
export async function gravarResumoNoLead(
  lead: LeadCrmEncontrado,
  visitorId: string,
  resumo: ResumoComportamento,
): Promise<boolean> {
  if (!crmAtivo()) return false;
  try {
    await rest(`leads_manos_crm?id=eq.${encodeURIComponent(lead.id)}`, {
      method: 'PATCH',
      body: { visitor_id: visitorId, trafego_resumo: resumo },
      prefer: 'return=minimal',
    });

    const agora = Date.now();
    if (agora - (ultimaNota.get(lead.id) || 0) >= INTERVALO_NOTA_MS) {
      ultimaNota.set(lead.id, agora);
      await rest('interactions_manos_crm', {
        method: 'POST',
        body: {
          lead_id: lead.id,
          type: 'note',
          notes: textoNotaCrm(resumo),
          user_name: 'Rastreamento do Site',
        },
        prefer: 'return=minimal',
      });
    }
    return true;
  } catch (err) {
    console.warn('[trafego-crm] gravação no lead falhou (colunas visitor_id/trafego_resumo existem?):', (err as Error).message);
    return false;
  }
}
