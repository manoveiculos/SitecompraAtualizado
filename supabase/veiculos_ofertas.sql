-- ===========================================================================
-- BANCO DE DADOS MANOS VEÍCULOS — MÓDULO DE OFERTAS / LANDING PAGES INDIVIDUAIS
-- ===========================================================================
--
-- Instruções de Execução:
-- 1. Acesse o painel do Supabase (https://supabase.com/dashboard)
-- 2. Selecione o projeto -> Vá em "SQL Editor".
-- 3. Cole este script e clique em "Run".
-- 4. Este script é 100% isolado: cria apenas tabelas e bucket exclusivos do
--    módulo /ofertas sem alterar nenhuma tabela existente.
--
-- ===========================================================================

-- 1. TABELA DE VEÍCULOS DE OFERTAS (LANDING PAGES INDIVIDUAIS)
create table if not exists public.veiculos_ofertas (
  id                      bigserial primary key,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- IDENTIFICAÇÃO
  marca                   text not null,
  modelo                  text not null,
  versao                  text default '',
  ano_fabricacao          integer,
  ano_modelo              integer,
  titulo_personalizado    text default '',
  slug                    text not null unique,

  -- INFORMAÇÕES COMERCIAIS
  preco_venda             numeric(12, 2) not null default 0,
  quilometragem           integer,
  cambio                  text default '',
  motorizacao             text default '',
  combustivel             text default '',
  cor                     text default '',
  portas                  integer,
  observacoes_comerciais  text default '',
  diferenciais            jsonb not null default '[]'::jsonb,

  -- FOTOS
  foto_principal          text default '',
  fotos                   jsonb not null default '[]'::jsonb,

  -- LOCALIZAÇÃO
  localizacao             text not null default 'Itapema/SC',

  -- VENDEDOR RESPONSÁVEL (Inicialmente Alexandre - 5547988467855, expansível por anúncio)
  vendedor_nome           text not null default 'Alexandre',
  vendedor_whatsapp       text not null default '5547988467855',

  -- PUBLICAÇÃO
  status                  text not null default 'rascunho'
                          check (status in ('rascunho', 'publicado', 'vendido', 'pausado'))
);

-- Índices para busca rápida por slug e listagem de publicados
create unique index if not exists veiculos_ofertas_slug_idx on public.veiculos_ofertas (slug);
create index if not exists veiculos_ofertas_status_idx on public.veiculos_ofertas (status);
create index if not exists veiculos_ofertas_created_idx on public.veiculos_ofertas (created_at desc);

-- Trigger para atualizar updated_at automaticamente
create or replace function public.set_veiculos_ofertas_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_veiculos_ofertas_updated_at on public.veiculos_ofertas;
create trigger trg_veiculos_ofertas_updated_at
  before update on public.veiculos_ofertas
  for each row execute function public.set_veiculos_ofertas_updated_at();

-- Políticas RLS da Tabela veiculos_ofertas
alter table public.veiculos_ofertas enable row level security;

drop policy if exists "veiculos_ofertas select public" on public.veiculos_ofertas;
create policy "veiculos_ofertas select public"
  on public.veiculos_ofertas for select to anon, authenticated using (true);

drop policy if exists "veiculos_ofertas insert anon" on public.veiculos_ofertas;
create policy "veiculos_ofertas insert anon"
  on public.veiculos_ofertas for insert to anon, authenticated with check (true);

drop policy if exists "veiculos_ofertas update anon" on public.veiculos_ofertas;
create policy "veiculos_ofertas update anon"
  on public.veiculos_ofertas for update to anon, authenticated using (true) with check (true);

drop policy if exists "veiculos_ofertas delete anon" on public.veiculos_ofertas;
create policy "veiculos_ofertas delete anon"
  on public.veiculos_ofertas for delete to anon, authenticated using (true);


-- 2. TABELA DE MÉTRICAS E EVENTOS DE RASTREAMENTO (/OFERTAS)
create table if not exists public.ofertas_metricas (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  event_id        text not null,
  evento          text not null check (evento in ('PageView', 'ViewContent', 'Contact', 'WhatsAppClick')),
  veiculo_id      text,
  veiculo_slug    text,
  veiculo_nome    text,
  valor_veiculo   numeric(12, 2),
  page_url        text,
  canal           text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  fbclid          text,
  gclid           text,
  referrer        text,
  user_agent      text
);

create index if not exists ofertas_metricas_slug_idx on public.ofertas_metricas (veiculo_slug);
create index if not exists ofertas_metricas_evento_idx on public.ofertas_metricas (evento);
create index if not exists ofertas_metricas_created_idx on public.ofertas_metricas (created_at desc);

alter table public.ofertas_metricas enable row level security;

drop policy if exists "ofertas_metricas insert public" on public.ofertas_metricas;
create policy "ofertas_metricas insert public"
  on public.ofertas_metricas for insert to anon, authenticated with check (true);

drop policy if exists "ofertas_metricas select public" on public.ofertas_metricas;
create policy "ofertas_metricas select public"
  on public.ofertas_metricas for select to anon, authenticated using (true);


-- 3. TABELA DE CONFIGURAÇÕES DO MÓDULO (PIXEL, GA4 E VENDEDOR PADRÃO)
create table if not exists public.ofertas_config (
  chave           text primary key,
  valor           text not null default '',
  updated_at      timestamptz not null default now()
);

alter table public.ofertas_config enable row level security;

drop policy if exists "ofertas_config select public" on public.ofertas_config;
create policy "ofertas_config select public"
  on public.ofertas_config for select to anon, authenticated using (true);

drop policy if exists "ofertas_config upsert public" on public.ofertas_config;
create policy "ofertas_config upsert public"
  on public.ofertas_config for all to anon, authenticated using (true) with check (true);


-- 4. BUCKET DE ARMAZENAMENTO DE FOTOS NO SUPABASE STORAGE
insert into storage.buckets (id, name, public)
values ('fotos-ofertas', 'fotos-ofertas', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos_ofertas_select_public" on storage.objects;
create policy "fotos_ofertas_select_public"
  on storage.objects for select to public using (bucket_id = 'fotos-ofertas');

drop policy if exists "fotos_ofertas_insert_public" on storage.objects;
create policy "fotos_ofertas_insert_public"
  on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos-ofertas');

drop policy if exists "fotos_ofertas_update_public" on storage.objects;
create policy "fotos_ofertas_update_public"
  on storage.objects for update to anon, authenticated using (bucket_id = 'fotos-ofertas');

drop policy if exists "fotos_ofertas_delete_public" on storage.objects;
create policy "fotos_ofertas_delete_public"
  on storage.objects for delete to anon, authenticated using (bucket_id = 'fotos-ofertas');


-- 5. SEED INICIAL COM OS 3 VEÍCULOS DE REFERÊNCIA DA ESPECIFICAÇÃO
insert into public.veiculos_ofertas (
  marca, modelo, versao, ano_fabricacao, ano_modelo, titulo_personalizado, slug,
  preco_venda, quilometragem, cambio, motorizacao, combustivel, cor, portas,
  observacoes_comerciais, diferenciais, foto_principal, fotos, localizacao,
  vendedor_nome, vendedor_whatsapp, status
)
values
(
  'Volkswagen',
  'Polo',
  '1.0 200 TSI Comfortline Automático',
  2022,
  2022,
  'Volkswagen Polo Comfortline 200 TSI 2022',
  'volkswagen-polo-2022',
  89900.00,
  42000,
  'Automático',
  '1.0 200 TSI Turbo',
  'Flex',
  'Branca',
  4,
  'Veículo em excelente estado de conservação, revisado e pronto para transferência em Itapema/SC. Possui chave presencial (Kessy), painel multimídia VW Play, sensores de estacionamento dianteiro e traseiro e rodas de liga leve.',
  '["Chave presencial com partida por botão", "Central multimídia com Apple CarPlay e Android Auto", "Câmbio automático de 6 marchas com paddle shifts", "Documentação em dia para transferência imediata"]'::jsonb,
  'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1400&q=85',
  '[
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=85"
  ]'::jsonb,
  'Itapema/SC',
  'Alexandre',
  '5547988467855',
  'publicado'
),
(
  'Chevrolet',
  'Onix',
  '1.0 Turbo LTZ Automático',
  2021,
  2021,
  'Chevrolet Onix LTZ 1.0 Turbo 2021',
  'chevrolet-onix-2021',
  78900.00,
  54000,
  'Automático',
  '1.0 Turbo',
  'Flex',
  'Prata',
  4,
  'Chevrolet Onix LTZ Turbo Automático disponível em Itapema/SC. Versão topo de linha com 6 airbags, carregador por indução, MyLink de 8 polegadas, câmera de ré e excelente economia de combustível.',
  '["6 Airbags e Controle de Estabilidade", "Central MyLink 8\" com espelhamento sem fio", "Carregador de celular por indução", "Câmera de ré e sensor de estacionamento"]'::jsonb,
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=85',
  '[
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1400&q=85"
  ]'::jsonb,
  'Itapema/SC',
  'Alexandre',
  '5547988467855',
  'publicado'
),
(
  'Hyundai',
  'Creta',
  '1.0 TGDI Platinum Automático',
  2023,
  2023,
  'Hyundai Creta Platinum 1.0 Turbo 2023',
  'hyundai-creta-2023',
  134900.00,
  28500,
  'Automático',
  '1.0 TGDI Turbo',
  'Flex',
  'Cinza',
  4,
  'SUV impecável disponível em Itapema/SC. Versão Platinum com teto solar panorâmico, bancos em couro com ventilação para o motorista, câmera 360 graus, painel digital de 7 polegadas e freio de estacionamento eletrônico.',
  '["Teto solar panorâmico elétrico", "Câmera 360º e monitoramento de ponto cego no painel", "Bancos em couro com ventilação no banco do motorista", "Multimídia de 10,25\" com GPS nativo e Bluelink"]'::jsonb,
  'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=85',
  '[
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1400&q=85",
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1400&q=85"
  ]'::jsonb,
  'Itapema/SC',
  'Alexandre',
  '5547988467855',
  'publicado'
)
on conflict (slug) do nothing;
