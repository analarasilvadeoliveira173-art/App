-- ============================================================
-- MIGRAÇÃO — de uma igreja para várias
-- ------------------------------------------------------------
-- Rode este arquivo UMA VEZ, no SQL Editor do Supabase, DEPOIS
-- de rodar o schema.sql.
--
-- O que ele faz com os dados que já existem:
--   • cria a linha da sua igreja
--   • liga todos os registros antigos a ela
--   • prepara os acessos para o novo login
--
-- ANTES DE RODAR: abra o aplicativo e faça
-- Configurações → Baixar backup completo. Guarde o arquivo.
-- ============================================================

-- ------------------------------------------------------------
-- PASSO 1 — Escreva aqui os dados da sua igreja
-- ------------------------------------------------------------
do $$
declare
  -- >>> TROQUE ESTES TRÊS VALORES <<<
  v_nome     text := 'Igreja Modelo';        -- nome da sua igreja
  v_codigo   text := 'MINHA-IGREJA';         -- código que a equipe vai digitar
  v_contato  text := '';                     -- seu WhatsApp, opcional

  v_igreja_id text;
  t           text;
begin
  -- Se já existe uma igreja com esse código, reaproveita.
  select id into v_igreja_id from public.igrejas where upper(codigo) = upper(v_codigo);

  if v_igreja_id is null then
    v_igreja_id := 'ig-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.igrejas (id, nome, codigo, contato, plano, situacao)
    values (v_igreja_id, v_nome, upper(v_codigo), nullif(v_contato,''), 'completo', 'ativa');
    raise notice 'Igreja criada: % (código %)', v_nome, upper(v_codigo);
  else
    raise notice 'Igreja já existia, reaproveitando: %', v_igreja_id;
  end if;

  -- Todos os registros sem dono passam a pertencer a ela. O valor
  -- 'igreja-local' é o que a versão anterior gravava.
  foreach t in array array[
    'funcoes','membros','usuarios','membros_funcoes','louvores','cultos',
    'culto_louvores','escalas','ensaios','ensaio_louvores','presencas',
    'sugestoes_louvores','indisponibilidades','avisos','auditoria'
  ]
  loop
    execute format(
      'update public.%I set igreja_id = %L where igreja_id is null or igreja_id = %L',
      t, v_igreja_id, 'igreja-local');
  end loop;

  raise notice 'Pronto. Anote o código da igreja: %', upper(v_codigo);
end $$;

-- ------------------------------------------------------------
-- PASSO 2 — Confira antes de seguir
-- ------------------------------------------------------------
-- Deve aparecer uma linha por tabela, todas com a mesma igreja:
select 'membros' as tabela, igreja_id, count(*) from public.membros group by igreja_id
union all select 'cultos',   igreja_id, count(*) from public.cultos   group by igreja_id
union all select 'louvores', igreja_id, count(*) from public.louvores group by igreja_id
union all select 'escalas',  igreja_id, count(*) from public.escalas  group by igreja_id
union all select 'usuarios', igreja_id, count(*) from public.usuarios group by igreja_id;

-- ------------------------------------------------------------
-- PASSO 3 — As senhas
-- ------------------------------------------------------------
-- As senhas antigas ficavam em texto puro na coluna "pin". Agora
-- elas passam a viver no sistema de login do Supabase, embaralhadas.
-- Elas NÃO são migradas automaticamente, por dois motivos: o
-- embaralhamento não tem volta, e é uma boa hora para trocar senhas
-- que estavam guardadas de forma insegura.
--
-- Rode a consulta abaixo para ver quem tem acesso hoje e com qual
-- senha. Anote em algum lugar seguro — é a última vez que dá para ler.
select nome, usuario, papel, pin as senha_antiga
  from public.usuarios
 where pin is not null
 order by papel, nome;

-- Depois de anotar, crie os acessos novos pelo aplicativo, em
-- Usuários. Cada pessoa recebe a senha e pode trocá-la no Perfil.
--
-- Quando todos estiverem criados e testados, apague as senhas
-- antigas do banco tirando o comentário das duas linhas abaixo:
-- alter table public.usuarios drop column if exists pin;
-- alter table public.membros  drop column if exists pin;
