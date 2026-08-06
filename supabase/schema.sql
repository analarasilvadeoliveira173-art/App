-- ============================================================
-- EKKLESIA MUSIC — banco de dados (Supabase / PostgreSQL)
-- Versão multi-igreja
-- ------------------------------------------------------------
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique
-- em "Run". Pode rodar mais de uma vez sem estragar nada.
--
-- O passo a passo completo, com prints do que clicar, está em
-- docs/configurar-supabase.md.
--
-- COMO A SEGURANÇA FUNCIONA AQUI
-- A chave do aplicativo fica visível dentro dele — isso é normal
-- e não é o que protege os dados. Quem protege é este arquivo:
-- cada pessoa só enxerga as linhas da própria igreja, e essa
-- checagem é feita pelo banco, não pelo aplicativo. Nem mexendo
-- no app alguém alcança dados de outra igreja.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. IGREJAS — cada cliente que compra vira uma linha aqui
-- ============================================================
create table if not exists public.igrejas (
  id         text primary key default 'ig-'||replace(gen_random_uuid()::text,'-',''),
  nome       text not null,
  -- Código que o líder passa para a equipe. Curto e fácil de ditar.
  codigo     text not null unique,
  ministerio text default 'Ministério de Louvor',
  plano      text default 'essencial',
  -- ativa | teste | suspensa — quem não está ativa não consegue entrar
  situacao   text not null default 'teste',
  contato    text,
  observacoes text,
  criado_em  timestamptz default now(),
  expira_em  date
);

comment on column public.igrejas.codigo is
  'Código de acesso da igreja, digitado uma vez em cada aparelho.';

-- ============================================================
-- 2. TABELAS DO MINISTÉRIO
--    Todas apontam para a igreja dona da linha.
-- ============================================================
create table if not exists public.funcoes (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  nome       text not null,
  ordem      integer default 0,
  criado_em  timestamptz default now()
);

create table if not exists public.membros (
  id               text primary key,
  igreja_id        text not null references public.igrejas(id) on delete cascade,
  nome             text not null,
  telefone         text,
  funcao_principal text,
  status           text default 'ativo',
  data_entrada     date,
  cor_avatar       text,
  observacoes      text,
  criado_em        timestamptz default now()
);
-- Duas pessoas com o mesmo nome na mesma igreja impediriam o login por nome.
create unique index if not exists membros_nome_unico
  on public.membros (igreja_id, lower(nome));

create table if not exists public.usuarios (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  nome       text not null,
  usuario    text not null,
  papel      text not null default 'membro',
  ativo      boolean default true,
  membro_id  text references public.membros(id) on delete set null,
  -- O id da pessoa no sistema de login do Supabase.
  auth_id    uuid,
  criado_em  timestamptz default now()
);
create unique index if not exists usuarios_login_unico
  on public.usuarios (igreja_id, lower(usuario));

create table if not exists public.membros_funcoes (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  membro_id  text references public.membros(id) on delete cascade,
  funcao_id  text references public.funcoes(id) on delete cascade,
  criado_em  timestamptz default now()
);

create table if not exists public.louvores (
  id            text primary key,
  igreja_id     text not null references public.igrejas(id) on delete cascade,
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

create table if not exists public.cultos (
  id          text primary key,
  igreja_id   text not null references public.igrejas(id) on delete cascade,
  tipo        text,
  data        date not null,
  horario     text,
  local       text,
  tema        text,
  observacoes text,
  status      text default 'rascunho',
  criado_em   timestamptz default now()
);

create table if not exists public.culto_louvores (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  culto_id   text references public.cultos(id) on delete cascade,
  louvor_id  text references public.louvores(id) on delete set null,
  nome_livre text,
  ordem      integer default 0,
  tom        text,
  observacao text,
  criado_em  timestamptz default now()
);

create table if not exists public.escalas (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  culto_id   text references public.cultos(id) on delete cascade,
  funcao     text not null,
  membro_id  text references public.membros(id) on delete set null,
  criado_em  timestamptz default now()
);

create table if not exists public.ensaios (
  id                 text primary key,
  igreja_id          text not null references public.igrejas(id) on delete cascade,
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
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  ensaio_id  text references public.ensaios(id) on delete cascade,
  louvor_id  text references public.louvores(id) on delete cascade,
  ordem      integer default 0,
  criado_em  timestamptz default now()
);

create table if not exists public.presencas (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  membro_id  text references public.membros(id) on delete cascade,
  culto_id   text references public.cultos(id) on delete cascade,
  ensaio_id  text references public.ensaios(id) on delete cascade,
  status     text default 'pendente',
  motivo     text,
  criado_em  timestamptz default now()
);

create table if not exists public.sugestoes_louvores (
  id                       text primary key,
  igreja_id                text not null references public.igrejas(id) on delete cascade,
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

create table if not exists public.indisponibilidades (
  id          text primary key,
  igreja_id   text not null references public.igrejas(id) on delete cascade,
  membro_id   text references public.membros(id) on delete cascade,
  data_inicio date not null,
  data_fim    date,
  motivo      text,
  criado_em   timestamptz default now()
);

create table if not exists public.avisos (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  titulo     text not null,
  texto      text not null,
  autor_nome text,
  criado_em  timestamptz default now()
);

create table if not exists public.auditoria (
  id         text primary key,
  igreja_id  text not null references public.igrejas(id) on delete cascade,
  usuario    text,
  acao       text,
  tabela     text,
  registro   text,
  detalhes   jsonb,
  criado_em  timestamptz default now()
);

-- ---------- Índices das telas mais usadas ----------
create index if not exists idx_cultos_data          on public.cultos (igreja_id, data desc);
create index if not exists idx_escalas_culto        on public.escalas (igreja_id, culto_id);
create index if not exists idx_escalas_membro       on public.escalas (igreja_id, membro_id);
create index if not exists idx_culto_louvores_culto on public.culto_louvores (igreja_id, culto_id);
create index if not exists idx_presencas_culto      on public.presencas (igreja_id, culto_id);
create index if not exists idx_presencas_ensaio     on public.presencas (igreja_id, ensaio_id);
create index if not exists idx_ensaios_data         on public.ensaios (igreja_id, data desc);
create index if not exists idx_indisp_membro        on public.indisponibilidades (igreja_id, membro_id);
create index if not exists idx_membros_funcoes_m    on public.membros_funcoes (igreja_id, membro_id);
create index if not exists idx_usuarios_auth        on public.usuarios (auth_id);

-- ============================================================
-- 3. ISOLAMENTO ENTRE IGREJAS
--    A igreja de cada pessoa vem do crachá de login (JWT) e é
--    conferida pelo banco em toda leitura e toda gravação.
-- ============================================================
create or replace function public.minha_igreja()
returns text language sql stable as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'igreja_id',
    auth.jwt() -> 'app_metadata'  ->> 'igreja_id'
  );
$$;

create or replace function public.meu_papel()
returns text language sql stable as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'papel',
    auth.jwt() -> 'app_metadata'  ->> 'papel',
    'membro'
  );
$$;

-- Qual integrante é esta pessoa. É o que permite ao membro confirmar a
-- própria presença sem poder mexer na dos outros.
create or replace function public.meu_membro_id()
returns text language sql stable as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'membro_id',
    auth.jwt() -> 'app_metadata'  ->> 'membro_id'
  );
$$;

create or replace function public.sou_lideranca()
returns boolean language sql stable as $$
  select public.meu_papel() in ('admin','lider');
$$;

create or replace function public.sou_admin()
returns boolean language sql stable as $$
  select public.meu_papel() = 'admin';
$$;

-- ------------------------------------------------------------
-- Quem pode o quê
--
-- Até aqui a regra dizia apenas "é da minha igreja?". Isso separava
-- uma igreja da outra, mas dentro da igreja liberava tudo para todos:
-- as permissões viviam só na tela, e quem chamasse a API direto
-- apagava cultos, escalas e repertório sendo um membro comum.
--
--   membro  → lê o ministério; escreve só o que é dele
--   líder   → cuida do ministério inteiro
--   admin   → cuida também dos acessos
-- ------------------------------------------------------------
do $$
declare
  t text;
  -- Conteúdo do ministério: todos leem, só a liderança altera.
  conteudo text[] := array[
    'funcoes','membros','membros_funcoes','louvores','cultos',
    'culto_louvores','escalas','ensaios','ensaio_louvores','avisos'
  ];
  -- Registros pessoais: cada um cuida da própria linha.
  pessoais text[] := array['presencas','indisponibilidades','sugestoes_louvores'];
  -- Toda política que este arquivo cria precisa estar aqui, senão rodar
  -- o schema uma segunda vez falha com "policy already exists".
  antigas text[] := array['acesso_app','isolamento_por_igreja','leitura','escrita_lideranca',
                          'escrita_propria','leitura_propria','acessos_admin',
                          'auditoria_lideranca','auditoria_escrita'];
  pol text;
begin
  foreach t in array (conteudo || pessoais || array['usuarios','auditoria'])
  loop
    execute format('alter table public.%I enable row level security', t);
    foreach pol in array antigas loop
      execute format('drop policy if exists %I on public.%I', pol, t);
    end loop;
  end loop;

  -- ---------- Conteúdo do ministério ----------
  foreach t in array conteudo
  loop
    execute format($f$
      create policy "leitura" on public.%I for select to authenticated
        using (igreja_id = public.minha_igreja())
    $f$, t);
    execute format($f$
      create policy "escrita_lideranca" on public.%I for all to authenticated
        using      (igreja_id = public.minha_igreja() and public.sou_lideranca())
        with check (igreja_id = public.minha_igreja() and public.sou_lideranca())
    $f$, t);
  end loop;

  -- ---------- Presença, indisponibilidade e sugestão ----------
  -- A equipe inteira precisa enxergar quem confirmou, mas ninguém
  -- responde no lugar de outra pessoa.
  foreach t in array pessoais
  loop
    execute format($f$
      create policy "leitura" on public.%I for select to authenticated
        using (igreja_id = public.minha_igreja())
    $f$, t);
    execute format($f$
      create policy "escrita_propria" on public.%I for all to authenticated
        using      (igreja_id = public.minha_igreja()
                    and (public.sou_lideranca() or membro_id = public.meu_membro_id()))
        with check (igreja_id = public.minha_igreja()
                    and (public.sou_lideranca() or membro_id = public.meu_membro_id()))
    $f$, t);
  end loop;
end $$;

-- ---------- Acessos ----------
-- Um membro enxerga apenas o próprio registro: a lista de quem é líder
-- e de quem tem acesso é assunto da administração. Alterar acesso é só
-- pela função do servidor, que confere papel antes.
create policy "leitura_propria" on public.usuarios for select to authenticated
  using (igreja_id = public.minha_igreja()
         and (public.sou_lideranca() or auth_id = auth.uid()));

create policy "acessos_admin" on public.usuarios for all to authenticated
  using      (igreja_id = public.minha_igreja() and public.sou_admin())
  with check (igreja_id = public.minha_igreja() and public.sou_admin());

-- ---------- Histórico de alterações ----------
-- Só a liderança lê, e ninguém apaga: registro que se apaga não serve
-- para nada.
create policy "auditoria_lideranca" on public.auditoria for select to authenticated
  using (igreja_id = public.minha_igreja() and public.sou_lideranca());

create policy "auditoria_escrita" on public.auditoria for insert to authenticated
  with check (igreja_id = public.minha_igreja());

-- A tabela de igrejas nunca é listada pelo aplicativo: cada pessoa
-- só enxerga a linha da própria igreja, e só para leitura.
alter table public.igrejas enable row level security;
drop policy if exists "minha_igreja_leitura" on public.igrejas;
create policy "minha_igreja_leitura" on public.igrejas
  for select to authenticated
  using (id = public.minha_igreja());

-- ============================================================
-- 4. ENTRADA NO APLICATIVO
--    A pessoa digita o código da igreja, o nome e a senha. Quem
--    confere tudo isso é a função "acesso", que roda no servidor
--    (supabase/functions/acesso). O aplicativo manda os três dados
--    e recebe uma resposta só: entrou ou não entrou.
--
--    Por que não é o aplicativo que confere: antes ele perguntava
--    ao banco o endereço técnico de fulano e só depois tentava a
--    senha. A resposta era diferente para nome que existe e nome
--    que não existe — com o código da igreja em mãos, que é ditado
--    para a equipe toda, dava para descobrir o nome de cada
--    integrante uma pergunta por vez. Agora nome errado e senha
--    errada dão exatamente a mesma resposta.
-- ============================================================

-- Toda tentativa que dá errado fica anotada aqui, e depois de
-- algumas seguidas do mesmo lugar a porta fecha por uns minutos.
-- Quem acerta a senha zera a própria contagem, então ninguém da
-- equipe esbarra nisso no domingo de manhã.
create table if not exists public.tentativas_acesso (
  id      bigserial primary key,
  origem  text not null,
  codigo  text not null,
  quando  timestamptz not null default now()
);
create index if not exists tentativas_acesso_busca
  on public.tentativas_acesso (origem, codigo, quando desc);

-- Sem nenhuma política: ninguém, nem logado, lê ou escreve nesta
-- tabela pelo aplicativo. Só a função do servidor encosta nela.
alter table public.tentativas_acesso enable row level security;
-- Troca as letras acentuadas mais comuns do português. Evita depender
-- da extensão unaccent, que nem todo projeto tem habilitada.
create or replace function public.unaccent_simples(t text)
returns text language sql immutable as $$
  select translate(coalesce(t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC');
$$;

-- Endereço técnico usado só pelo sistema de login. Ninguém digita isso.
create or replace function public.montar_email(p_codigo text, p_usuario text)
returns text language sql immutable as $$
  select lower(regexp_replace(unaccent_simples(p_usuario),'[^a-zA-Z0-9]+','.','g'))
      || '@' || lower(regexp_replace(p_codigo,'[^a-zA-Z0-9]+','','g'))
      || '.ekklesia.app';
$$;

create or replace function public.email_de_acesso(p_codigo text, p_nome text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_igreja  public.igrejas%rowtype;
  v_chave   text;
  v_achados text[];
  v_usuario text;
begin
  select * into v_igreja from public.igrejas
   where lower(codigo) = lower(trim(p_codigo)) limit 1;
  if not found then
    raise exception 'IGREJA_NAO_ENCONTRADA';
  end if;
  if v_igreja.situacao = 'suspensa' then
    raise exception 'IGREJA_SUSPENSA';
  end if;

  -- Compara sem acento e sem diferenciar maiúsculas, como o app faz.
  v_chave := lower(unaccent_simples(trim(p_nome)));

  -- 1) login de liderança, exato
  select u.usuario into v_usuario from public.usuarios u
   where u.igreja_id = v_igreja.id and u.ativo is not false
     and lower(unaccent_simples(u.usuario)) = v_chave
   limit 1;

  -- 2) nome completo de alguém com acesso
  if v_usuario is null then
    select array_agg(u.usuario) into v_achados from public.usuarios u
     where u.igreja_id = v_igreja.id and u.ativo is not false
       and lower(unaccent_simples(u.nome)) = v_chave;
    if array_length(v_achados,1) = 1 then v_usuario := v_achados[1]; end if;
    if array_length(v_achados,1) > 1 then raise exception 'NOME_AMBIGUO'; end if;
  end if;

  -- 3) só o primeiro nome, quando não houver dúvida de quem é
  if v_usuario is null then
    select array_agg(u.usuario) into v_achados from public.usuarios u
     where u.igreja_id = v_igreja.id and u.ativo is not false
       and split_part(lower(unaccent_simples(u.nome)),' ',1) = v_chave;
    if array_length(v_achados,1) = 1 then v_usuario := v_achados[1]; end if;
    if array_length(v_achados,1) > 1 then raise exception 'NOME_AMBIGUO'; end if;
  end if;

  if v_usuario is null then
    raise exception 'PESSOA_NAO_ENCONTRADA';
  end if;

  return public.montar_email(v_igreja.codigo, v_usuario);
end $$;

-- Esta função continua existindo para consulta pela liderança no SQL
-- Editor ("com que nome fulano entra?"), mas o aplicativo não a chama
-- mais e ninguém de fora pode executá-la: era ela que respondia de um
-- jeito para nome que existe e de outro para nome que não existe.
revoke execute on function public.email_de_acesso(text,text) from anon, authenticated, public;

-- ============================================================
-- 5. CONFERIR SE DEU CERTO
--    Depois de rodar, esta consulta deve listar as tabelas todas
--    com rls_ativo = true.
-- ============================================================
-- select tablename, rowsecurity as rls_ativo
--   from pg_tables where schemaname = 'public' order by tablename;
