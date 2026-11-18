-- ---------------------------------------------------------------------------
-- Inteligência de Tráfego v2 — /admin/trafego
--
-- O que esta migration faz (tudo ADITIVO, idempotente, sem apagar nada):
--   1. trafego_eventos      -> espelho durável dos eventos de jornada (o servidor
--                              mantém o cache quente em data/trafego-store.json).
--   2. trafego_visitantes   -> 1 linha por visitor_id (cookie `manos_vid`), com a
--                              identificação (nome/telefone/idade) quando o
--                              visitante vira lead e o vínculo com o Manos CRM.
--   3. trafego_meta_cache   -> nome real de campanha/conjunto/anúncio e o
--                              breakdown etário vindos da Meta Marketing API.
--   4. leads_manos_crm      -> 2 colunas novas: `visitor_id` e `trafego_resumo`
--                              (jsonb com o resumo de comportamento do site).
--
-- SEGURANÇA: as tabelas novas têm RLS ligada e NENHUMA policy. Só a
-- service_role (servidor Express, SUPABASE_SERVICE_ROLE_KEY) lê/escreve.
-- `trafego_visitantes` guarda nome e telefone — nunca abra para `anon`.
--
-- Como rodar: SQL Editor do Supabase -> colar tudo -> Run.
-- ---------------------------------------------------------------------------

-- 1. EVENTOS ---------------------------------------------------------------

create table if not exists public.trafego_eventos (
  id                 text        primary key,            -- event_id (estável: o dwell atualiza a mesma linha)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  visitor_id         text        not null,
  session_id         text,

  origem_macro       text        not null,               -- google_ads | facebook_ads | openai_ads | organico
  sub_origem         text,

  utm_source         text,
  utm_medium         text,
  utm_campaign       text,
  utm_content        text,
  utm_term           text,
  utm_id             text,
  gclid              text,
  fbclid             text,
  oppref             text,
  referrer           text,

  -- IDs resolvidos para a Meta (ver trafego_meta_cache)
  campanha_id        text,
  conjunto_id        text,
  anuncio_id         text,

  acao               text        not null,
  pagina             text,
  veiculo_id         text,
  veiculo_nome       text,
  valor_veiculo      numeric,
  detalhe            text,

  -- Aparelho e localização (capturados no servidor)
  dispositivo        text,                               -- Mobile | Desktop
  dispositivo_detalhe text,                              -- "iPhone (iOS)", "Samsung (Android)", "Desktop Windows"
  navegador          text,
  cidade             text,
  uf                 text,
  pais               text,

  -- Engajamento no veículo
  tempo_segundos     integer     not null default 0,     -- tempo ATIVO (aba visível + interação)
  fotos_vistas       integer     not null default 0,
  abriu_galeria      boolean     not null default false,
  scroll_max         integer     not null default 0,     -- 0..100
  interacoes         jsonb       not null default '{}'::jsonb
);

create index if not exists trafego_eventos_created_idx   on public.trafego_eventos (created_at desc);
create index if not exists trafego_eventos_visitor_idx   on public.trafego_eventos (visitor_id, created_at);
create index if not exists trafego_eventos_veiculo_idx   on public.trafego_eventos (veiculo_id) where veiculo_id is not null;
create index if not exists trafego_eventos_cidade_idx    on public.trafego_eventos (cidade)     where cidade is not null;
create index if not exists trafego_eventos_campanha_idx  on public.trafego_eventos (campanha_id) where campanha_id is not null;

alter table public.trafego_eventos enable row level security;

-- 2. VISITANTES (deanonymization) ------------------------------------------

create table if not exists public.trafego_visitantes (
  visitor_id        text        primary key,
  first_seen        timestamptz not null default now(),
  last_seen         timestamptz not null default now(),

  -- Preenchido quando o visitante informa contato (funil, financiamento, venda)
  nome              text,
  telefone          text,                                -- só dígitos, com DDI 55
  idade             integer,                             -- só a idade; a data de nascimento NÃO é guardada aqui
  faixa_etaria      text,                                -- "25-34"
  identificado_em   timestamptz,

  -- Vínculo com o Manos CRM
  crm_lead_id       uuid,                                -- leads_manos_crm.id
  crm_status        text,                                -- espelho de leads_manos_crm.status
  crm_sincronizado_em timestamptz,

  cidade            text,
  uf                text,
  resumo            jsonb       not null default '{}'::jsonb
);

create index if not exists trafego_visitantes_telefone_idx on public.trafego_visitantes (telefone) where telefone is not null;
create index if not exists trafego_visitantes_crm_idx      on public.trafego_visitantes (crm_lead_id) where crm_lead_id is not null;

alter table public.trafego_visitantes enable row level security;

-- 3. CACHE DA META MARKETING API -------------------------------------------

create table if not exists public.trafego_meta_cache (
  object_id      text        primary key,                -- campaign_id / adset_id / ad_id
  nome           text,
  demografia     jsonb,                                  -- { predominante, genero_predominante, distribuicao:{ "25-34": 0.41, ... } }
  atualizado_em  timestamptz not null default now()
);

alter table public.trafego_meta_cache enable row level security;

-- 4. COLUNAS NOVAS NO MANOS CRM --------------------------------------------

alter table public.leads_manos_crm
  add column if not exists visitor_id     text,
  add column if not exists trafego_resumo jsonb;

create index if not exists leads_manos_crm_visitor_idx
  on public.leads_manos_crm (visitor_id) where visitor_id is not null;

comment on column public.leads_manos_crm.visitor_id is
  'Cookie manos_vid do site. Liga o lead à jornada em trafego_eventos.';
comment on column public.leads_manos_crm.trafego_resumo is
  'Resumo do comportamento no site: campanha, cidade, aparelho, carros vistos com tempo, carro de maior interesse, ações.';

-- Conferência rápida:
--   select cidade, uf, count(distinct visitor_id) from trafego_eventos group by 1,2 order by 3 desc limit 20;
--   select veiculo_nome, round(avg(tempo_segundos)) tempo_medio, count(*) views
--     from trafego_eventos where acao = 'view_vehicle' group by 1 order by 3 desc;
