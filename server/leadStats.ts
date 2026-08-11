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
// SQL da tabela (rodar uma vez no SQL Editor do Supabase):
//
//   create table if not exists lead_scores (
//     id            bigserial primary key,
//     created_at    timestamptz not null default now(),
//     lead_id       text not null,
//     stage         text not null,
//     lead_type     text not null,
//     score         int  not null,
//     faixa         text not null,
//     descartado    boolean not null default false,
//     fora_do_raio  boolean not null default false,
//     canal         text,
//     utm_source    text,
//     utm_campaign  text,
//     utm_content   text,
//     cidade        text
//   );
//   alter table lead_scores enable row level security;
//   create policy "insert anon" on lead_scores for insert to anon with check (true);
//   create policy "select anon" on lead_scores for select to anon using (true);
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

/** Insert fire-and-forget: nunca bloqueia nem derruba a entrega do lead. */
export function registrarScore(linha: LinhaLeadScore): void {
  fetch(`${SUPABASE_URL}/rest/v1/lead_scores`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=minimal',
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
