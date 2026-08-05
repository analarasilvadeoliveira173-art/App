-- ============================================================
-- EKKLESIA MUSIC — esquema do banco (Supabase / PostgreSQL)
-- ------------------------------------------------------------
-- Como usar:
--   1. Crie um projeto em https://supabase.com
--   2. Abra "SQL Editor" e cole este arquivo inteiro
--   3. Clique em "Run"
--   4. Em Settings → API, copie "Project URL" e a chave "anon"
--      para as constantes SUPABASE_URL e SUPABASE_KEY no www/index.html
--
-- Os ids são TEXT porque o aplicativo gera identificadores no
-- próprio aparelho (função uid()), o que permite trabalhar
-- offline e sincronizar depois sem conflito de chaves.
-- ============================================================

-- ---------- Funções do ministério (teclado, vocal, bateria…) ----------
create table if not exists public.funcoes (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  nome       text not null,
  ordem      integer default 0,
  criado_em  timestamptz default now()
);

-- ---------- Integrantes do ministério ----------
create table if not exists public.membros (
  id               text primary key,
  igreja_id        text not null default 'igreja-local',
  nome             text not null,
  telefone         text,
  funcao_principal text,
  status           text default 'ativo',
  pin              text,
  data_entrada     date,
  cor_avatar       text,
  observacoes      text,
  criado_em        timestamptz default now()
);

-- ---------- Acessos ao sistema ----------
create table if not exists public.usuarios (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  nome       text not null,
  usuario    text not null,
  pin        text not null,
  papel      text not null default 'membro',
  ativo      boolean default true,
  membro_id  text references public.membros(id) on delete set null,
  criado_em  timestamptz default now()
);
create unique index if not exists usuarios_login_unico on public.usuarios (igreja_id, lower(usuario));

-- ---------- Funções que cada integrante exerce ----------
create table if not exists public.membros_funcoes (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  membro_id  text references public.membros(id) on delete cascade,
  funcao_id  text references public.funcoes(id) on delete cascade,
  criado_em  timestamptz default now()
);

-- ---------- Repertório ----------
create table if not exists public.louvores (
  id            text primary key,
  igreja_id     text not null default 'igreja-local',
  nome          text not null,
  categoria     text,
  tom           text,
  cantor        text,
  link_youtube  text,
  link_cifra    text,
  vezes_cantado integer default 0,
  ultima_vez    date,
  observacoes   text,
  arquivo       jsonb,
  criado_em     timestamptz default now()
);

-- ---------- Cultos ----------
create table if not exists public.cultos (
  id          text primary key,
  igreja_id   text not null default 'igreja-local',
  tipo        text,
  data        date not null,
  horario     text,
  local       text,
  tema        text,
  observacoes text,
  status      text default 'rascunho',
  criado_em   timestamptz default now()
);

-- ---------- Louvores de cada culto ----------
create table if not exists public.culto_louvores (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  culto_id   text references public.cultos(id) on delete cascade,
  louvor_id  text references public.louvores(id) on delete set null,
  nome_livre text,
  ordem      integer default 0,
  tom        text,
  observacao text,
  criado_em  timestamptz default now()
);

-- ---------- Escala (quem toca/canta o quê em cada culto) ----------
create table if not exists public.escalas (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  culto_id   text references public.cultos(id) on delete cascade,
  funcao     text not null,
  membro_id  text references public.membros(id) on delete set null,
  criado_em  timestamptz default now()
);

-- ---------- Ensaios ----------
create table if not exists public.ensaios (
  id                 text primary key,
  igreja_id          text not null default 'igreja-local',
  data               date not null,
  horario            text,
  local              text,
  membros_convocados jsonb default '[]'::jsonb,
  checklist          jsonb default '[]'::jsonb,
  observacoes        text,
  status             text default 'agendado',
  criado_em          timestamptz default now()
);

create table if not exists public.ensaio_louvores (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  ensaio_id  text references public.ensaios(id) on delete cascade,
  louvor_id  text references public.louvores(id) on delete cascade,
  ordem      integer default 0,
  criado_em  timestamptz default now()
);

-- ---------- Confirmações de presença ----------
create table if not exists public.presencas (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  membro_id  text references public.membros(id) on delete cascade,
  culto_id   text references public.cultos(id) on delete cascade,
  ensaio_id  text references public.ensaios(id) on delete cascade,
  status     text default 'pendente',
  motivo     text,
  criado_em  timestamptz default now()
);

-- ---------- Sugestões de louvor feitas pela voz principal ----------
create table if not exists public.sugestoes_louvores (
  id                       text primary key,
  igreja_id                text not null default 'igreja-local',
  culto_id                 text references public.cultos(id) on delete cascade,
  membro_id                text references public.membros(id) on delete cascade,
  louvor_id                text references public.louvores(id) on delete set null,
  nome_livre               text,
  tom                      text,
  justificativa            text,
  base_biblica             text,
  status                   text default 'pendente',
  justificativa_reprovacao text,
  criado_em                timestamptz default now()
);

-- ---------- Períodos em que o integrante não pode servir ----------
create table if not exists public.indisponibilidades (
  id          text primary key,
  igreja_id   text not null default 'igreja-local',
  membro_id   text references public.membros(id) on delete cascade,
  data_inicio date not null,
  data_fim    date,
  motivo      text,
  criado_em   timestamptz default now()
);

-- ---------- Mural de avisos ----------
create table if not exists public.avisos (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  titulo     text not null,
  texto      text not null,
  autor_nome text,
  criado_em  timestamptz default now()
);

-- ---------- Histórico de alterações ----------
create table if not exists public.auditoria (
  id         text primary key,
  igreja_id  text not null default 'igreja-local',
  usuario    text,
  acao       text,
  tabela     text,
  registro   text,
  detalhes   jsonb,
  criado_em  timestamptz default now()
);

-- ---------- Índices que aceleram as telas mais usadas ----------
create index if not exists idx_cultos_data          on public.cultos (igreja_id, data desc);
create index if not exists idx_escalas_culto        on public.escalas (igreja_id, culto_id);
create index if not exists idx_escalas_membro       on public.escalas (igreja_id, membro_id);
create index if not exists idx_culto_louvores_culto on public.culto_louvores (igreja_id, culto_id);
create index if not exists idx_presencas_culto      on public.presencas (igreja_id, culto_id);
create index if not exists idx_presencas_ensaio     on public.presencas (igreja_id, ensaio_id);
create index if not exists idx_ensaios_data         on public.ensaios (igreja_id, data desc);
create index if not exists idx_indisp_membro        on public.indisponibilidades (igreja_id, membro_id);
create index if not exists idx_membros_funcoes_m    on public.membros_funcoes (igreja_id, membro_id);

-- ============================================================
-- SEGURANÇA (Row Level Security)
-- ------------------------------------------------------------
-- ATENÇÃO: a chave "anon" fica visível dentro do aplicativo, então
-- é o RLS que realmente protege os dados. As políticas abaixo são o
-- MÍNIMO para o app funcionar em uma única igreja e liberam leitura
-- e escrita para qualquer portador da chave anon.
--
-- Antes de vender o acesso para várias igrejas, troque estas
-- políticas pelas de multi-igreja no fim deste arquivo, que usam
-- o Supabase Auth para amarrar cada usuário ao seu igreja_id.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'funcoes','membros','usuarios','membros_funcoes','louvores','cultos',
    'culto_louvores','escalas','ensaios','ensaio_louvores','presencas',
    'sugestoes_louvores','indisponibilidades','avisos','auditoria'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acesso_app" on public.%I', t);
    execute format(
      'create policy "acesso_app" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- MULTI-IGREJA (opcional — para a versão comercial)
-- ------------------------------------------------------------
-- Descomente este bloco quando migrar para o Supabase Auth. Cada
-- pessoa passa a fazer login de verdade e só enxerga os dados da
-- própria igreja, gravada em user_metadata.igreja_id.
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array[
--     'funcoes','membros','usuarios','membros_funcoes','louvores','cultos',
--     'culto_louvores','escalas','ensaios','ensaio_louvores','presencas',
--     'sugestoes_louvores','indisponibilidades','avisos','auditoria'
--   ]
--   loop
--     execute format('drop policy if exists "acesso_app" on public.%I', t);
--     execute format($f$
--       create policy "isolamento_por_igreja" on public.%I for all to authenticated
--       using      (igreja_id = (auth.jwt() -> 'user_metadata' ->> 'igreja_id'))
--       with check (igreja_id = (auth.jwt() -> 'user_metadata' ->> 'igreja_id'))
--     $f$, t);
--   end loop;
-- end $$;
