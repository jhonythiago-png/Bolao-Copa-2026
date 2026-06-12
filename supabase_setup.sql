-- ================================================
-- BOLÃO COPA 2026 — Setup Supabase
-- Cole este SQL no SQL Editor do Supabase
-- ================================================

-- 1. Participantes
create table if not exists participantes (
  id text primary key,
  nome text not null,
  fone text default '',
  criado_em timestamptz default now()
);

-- 2. Jogos
create table if not exists jogos (
  id text primary key,
  data text not null,
  time_a text not null,
  time_b text not null,
  rodada text default 'Fase de Grupos',
  criado_em timestamptz default now()
);

-- 3. Palpites
create table if not exists palpites (
  id text primary key,
  participante_id text references participantes(id) on delete cascade,
  jogo_id text references jogos(id) on delete cascade,
  gols_a integer not null,
  gols_b integer not null,
  criado_em timestamptz default now(),
  unique(participante_id, jogo_id)
);

-- 4. Resultados
create table if not exists resultados (
  id text primary key,
  jogo_id text references jogos(id) on delete cascade unique,
  gols_a integer not null,
  gols_b integer not null,
  criado_em timestamptz default now()
);

-- 5. Config (valor do bolão)
create table if not exists config (
  chave text primary key,
  valor text not null
);
insert into config (chave, valor) values ('valor_bolao', '20') on conflict do nothing;

-- ================================================
-- Habilitar acesso público (Row Level Security)
-- ================================================
alter table participantes enable row level security;
alter table jogos enable row level security;
alter table palpites enable row level security;
alter table resultados enable row level security;
alter table config enable row level security;

-- Leitura pública para todos
create policy "leitura publica participantes" on participantes for select using (true);
create policy "leitura publica jogos"         on jogos         for select using (true);
create policy "leitura publica palpites"      on palpites      for select using (true);
create policy "leitura publica resultados"    on resultados    for select using (true);
create policy "leitura publica config"        on config        for select using (true);

-- Escrita pública (admin controla pela senha no front)
create policy "escrita publica participantes" on participantes for all using (true);
create policy "escrita publica jogos"         on jogos         for all using (true);
create policy "escrita publica palpites"      on palpites      for all using (true);
create policy "escrita publica resultados"    on resultados    for all using (true);
create policy "escrita publica config"        on config        for all using (true);
