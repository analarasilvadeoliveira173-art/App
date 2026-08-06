-- ============================================================
-- TESTE DE ISOLAMENTO
-- ------------------------------------------------------------
-- Prova, com dados de mentira, que:
--   1. uma igreja não enxerga dados de outra
--   2. um membro não altera o que é da liderança
--   3. um membro não responde presença no lugar de outro
--
-- Cole no SQL Editor do Supabase e clique em Run. Ele cria tudo
-- que precisa, testa e apaga no fim — não encosta nos seus dados.
--
-- No fim aparece uma tabela. TODAS as linhas precisam dizer
-- "PASSOU". Uma linha com "FALHOU" significa que aquele caminho
-- está aberto e não dá para vender assim.
-- ============================================================

do $$
declare
  ig_a text := 'ig-teste-alfa';
  ig_b text := 'ig-teste-beta';
  m_a1 text := 'mb-teste-a1';
  m_a2 text := 'mb-teste-a2';
  resultado text;
  contagem int;
  falhou boolean;
  total_falhas int := 0;

  -- Simula o crachá de alguém, sem precisar fazer login de verdade.
  procedure_crachar text;
begin
  create temp table if not exists resultado_teste(
    caso text, esperado text, obtido text, veredito text
  ) on commit drop;
  delete from resultado_teste;

  -- ---------- Monta o cenário ----------
  delete from public.igrejas where id in (ig_a, ig_b);

  insert into public.igrejas (id,nome,codigo,situacao) values
    (ig_a,'Igreja Alfa (teste)','TESTE-ALFA','ativa'),
    (ig_b,'Igreja Beta (teste)','TESTE-BETA','ativa');

  insert into public.membros (id,igreja_id,nome,status) values
    (m_a1, ig_a, 'Ana Teste',  'ativo'),
    (m_a2, ig_a, 'Bruno Teste','ativo'),
    ('mb-teste-b1', ig_b, 'Carla Teste','ativo');

  insert into public.cultos (id,igreja_id,tipo,data,status) values
    ('ct-teste-a', ig_a, 'Culto Alfa', current_date + 7, 'definida'),
    ('ct-teste-b', ig_b, 'Culto Beta', current_date + 7, 'definida');

  insert into public.presencas (id,igreja_id,membro_id,culto_id,status) values
    ('pr-teste-a1', ig_a, m_a1, 'ct-teste-a', 'pendente'),
    ('pr-teste-a2', ig_a, m_a2, 'ct-teste-a', 'pendente');

  delete from public.tentativas_acesso where origem = 'origem-de-teste';
  insert into public.tentativas_acesso (origem,codigo) values ('origem-de-teste','TESTE-ALFA');

  raise notice 'Cenário criado. Rodando os casos...';
end $$;

-- ------------------------------------------------------------
-- Os casos rodam como "authenticated", com um crachá montado à mão.
-- É exatamente o que o aplicativo envia depois do login.
-- ------------------------------------------------------------
create or replace function public.__teste_isolamento()
returns table(caso text, veredito text)
language plpgsql
as $$
declare
  n int;
  erro_esperado boolean;
begin
  -- ============ 1. Membro da Alfa enxerga só a Alfa ============
  perform set_config('request.jwt.claims', json_build_object(
    'role','authenticated','sub','00000000-0000-0000-0000-000000000001',
    'user_metadata', json_build_object(
      'igreja_id','ig-teste-alfa','papel','membro','membro_id','mb-teste-a1')
  )::text, true);
  set local role authenticated;

  select count(*) into n from public.cultos where igreja_id = 'ig-teste-beta';
  caso := 'Membro da Alfa lendo cultos da Beta';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — leu '||n||' culto(s) de outra igreja' end;
  return next;

  select count(*) into n from public.membros where igreja_id = 'ig-teste-beta';
  caso := 'Membro da Alfa lendo integrantes da Beta';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — leu '||n||' pessoa(s) de outra igreja' end;
  return next;

  -- ============ 2. Membro não altera conteúdo do ministério ============
  erro_esperado := false;
  begin
    update public.cultos set tipo = 'INVADIDO' where id = 'ct-teste-a';
    get diagnostics n = row_count;
    if n = 0 then erro_esperado := true; end if;   -- RLS filtrou: nada mudou
  exception when others then erro_esperado := true;
  end;
  caso := 'Membro alterando um culto da própria igreja';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — o membro editou o culto' end;
  return next;

  erro_esperado := false;
  begin
    delete from public.cultos where id = 'ct-teste-a';
    get diagnostics n = row_count;
    if n = 0 then erro_esperado := true; end if;
  exception when others then erro_esperado := true;
  end;
  caso := 'Membro apagando um culto da própria igreja';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — o membro apagou o culto' end;
  return next;

  erro_esperado := false;
  begin
    insert into public.louvores (id,igreja_id,nome)
      values ('lv-teste-x','ig-teste-alfa','Louvor Invadido');
    erro_esperado := false;
  exception when others then erro_esperado := true;
  end;
  caso := 'Membro cadastrando louvor';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — o membro cadastrou louvor' end;
  return next;

  -- ============ 3. Presença: a própria sim, a dos outros não ============
  erro_esperado := false;
  begin
    update public.presencas set status = 'confirmado' where id = 'pr-teste-a1';
    get diagnostics n = row_count;
    erro_esperado := (n = 1);
  exception when others then erro_esperado := false;
  end;
  caso := 'Membro confirmando a PRÓPRIA presença';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — não conseguiu confirmar a própria presença' end;
  return next;

  erro_esperado := false;
  begin
    update public.presencas set status = 'confirmado' where id = 'pr-teste-a2';
    get diagnostics n = row_count;
    if n = 0 then erro_esperado := true; end if;
  exception when others then erro_esperado := true;
  end;
  caso := 'Membro respondendo presença DE OUTRA pessoa';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — respondeu no lugar de outro' end;
  return next;

  -- ============ 4. Membro não lê a lista de acessos ============
  select count(*) into n from public.usuarios where igreja_id = 'ig-teste-alfa';
  caso := 'Membro lendo a lista de acessos da igreja';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — enxergou '||n||' acesso(s)' end;
  return next;

  -- ============ 5. Líder cuida do ministério ============
  perform set_config('request.jwt.claims', json_build_object(
    'role','authenticated','sub','00000000-0000-0000-0000-000000000002',
    'user_metadata', json_build_object(
      'igreja_id','ig-teste-alfa','papel','lider','membro_id',null)
  )::text, true);

  erro_esperado := false;
  begin
    update public.cultos set tipo = 'Culto Alfa Editado' where id = 'ct-teste-a';
    get diagnostics n = row_count;
    erro_esperado := (n = 1);
  exception when others then erro_esperado := false;
  end;
  caso := 'Líder editando um culto da própria igreja';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — o líder não conseguiu editar' end;
  return next;

  select count(*) into n from public.cultos where igreja_id = 'ig-teste-beta';
  caso := 'Líder da Alfa lendo cultos da Beta';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — leu '||n||' culto(s) de outra igreja' end;
  return next;

  erro_esperado := false;
  begin
    update public.cultos set tipo = 'INVADIDO' where igreja_id = 'ig-teste-beta';
    get diagnostics n = row_count;
    if n = 0 then erro_esperado := true; end if;
  exception when others then erro_esperado := true;
  end;
  caso := 'Líder da Alfa editando culto da Beta';
  veredito := case when erro_esperado then 'PASSOU' else 'FALHOU — editou dado de outra igreja' end;
  return next;

  -- ============ 6. Sem crachá, nada ============
  perform set_config('request.jwt.claims', json_build_object(
    'role','authenticated','sub','00000000-0000-0000-0000-000000000003',
    'user_metadata', json_build_object('papel','membro')
  )::text, true);

  select count(*) into n from public.cultos;
  caso := 'Pessoa sem igreja no crachá lendo cultos';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — leu '||n||' culto(s) sem pertencer a igreja nenhuma' end;
  return next;

  -- ============ 7. Nada de descobrir quem é da equipe ============
  -- A função que traduzia nome em endereço de login respondia de um
  -- jeito para quem existe e de outro para quem não existe. Ela agora
  -- é só da liderança, pelo SQL Editor.
  select count(*) into n from public.tentativas_acesso;
  caso := 'Alguém logado lendo o registro de tentativas';
  veredito := case when n = 0 then 'PASSOU' else 'FALHOU — leu '||n||' tentativa(s)' end;
  return next;

  reset role;

  caso := 'Visitante executando a busca de login por nome';
  veredito := case
    when not has_function_privilege('anon','public.email_de_acesso(text,text)','execute')
     and not has_function_privilege('authenticated','public.email_de_acesso(text,text)','execute')
    then 'PASSOU' else 'FALHOU — a função ainda pode ser chamada de fora' end;
  return next;
end $$;

-- ---------- Resultado ----------
select caso, veredito from public.__teste_isolamento();

-- ---------- Limpeza ----------
drop function if exists public.__teste_isolamento();
delete from public.igrejas where id in ('ig-teste-alfa','ig-teste-beta');
delete from public.tentativas_acesso where origem = 'origem-de-teste';

-- Confere que não sobrou nada do teste:
select 'sobrou dado de teste' as aviso, count(*) as quantidade
  from public.igrejas where id like 'ig-teste-%';
