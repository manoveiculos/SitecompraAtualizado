// ---------------------------------------------------------------------------
// Registro analítico de leads (tabela `lead_scores` no Supabase).
//
// Serve uma pergunta só: QUAL ANÚNCIO TRAZ LEAD BOM. Sem isso, dá para saber o
// custo por lead mas não o custo por lead que presta — que é o número que
// decide onde colocar verba.
//
// SEM DADO PESSOAL, de propósito. Nome, telefone e placa ficam no n8n/CRM, que
// tem controle de acesso. Aqui a chave usada é a publishable do Supabase (a
// mesma do radar, que vai no bundle do servidor), então a tabela guarda apenas
// o que pode ser lido sem expor ninguém: tipo, nota, faixa, origem e cidade.
//
// SQL da tabela: supabase/lead_scores.sql (rodar uma vez no SQL Editor).
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://jkblxdxnbmciicakusnl.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb';

export interface LinhaLeadScore {
  lead_id: string;
  stage: string;
  lead_type: string;
  score: number;
  faixa: string;
  descartado: boolean;
  fora_do_raio: boolean;
  canal: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  cidade: string | null;
}

/**
 * Upsert fire-and-forget: nunca bloqueia nem derruba a entrega do lead.
 *
 * Upsert em (lead_id, stage) porque a mesma etapa pode ser enviada duas vezes —
 * a pessoa corrige os dados e reenvia, ou o envio final falha e ela tenta de
 * novo. Sem isso, o painel contaria a mesma pessoa mais de uma vez e inflaria o
 * desempenho da campanha que a trouxe.
 */
export function registrarScore(linha: LinhaLeadScore): void {
  fetch(`${SUPABASE_URL}/rest/v1/lead_scores?on_conflict=lead_id,stage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify(linha),
  })
    .then((r) => {
      if (!r.ok) console.warn(`lead_scores insert non-ok (${r.status}) — confira a tabela/RLS`);
    })
    .catch((err) => console.error('lead_scores log falhou:', err?.message || err));
}

/** Leitura para o painel /leads-manos. */
export async function lerScores(limite = 500): Promise<LinhaLeadScore[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/lead_scores?select=*&order=created_at.desc&limit=${limite}`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!res.ok) return [];
    return (await res.json()) as LinhaLeadScore[];
  } catch (err) {
    console.error('lead_scores leitura falhou:', err);
    return [];
  }
}
