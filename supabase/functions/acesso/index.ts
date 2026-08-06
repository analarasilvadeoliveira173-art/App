/* ============================================================
   EKKLESIA MUSIC — função de acessos
   ------------------------------------------------------------
   Criar e alterar logins exige um poder que o aplicativo não pode
   ter: com ele, qualquer pessoa criaria acesso em qualquer igreja.
   Por isso essa parte roda aqui no servidor, onde a chave secreta
   fica guardada e nunca chega ao celular de ninguém.

   O que esta função faz:
     entrar             — confere nome e senha e devolve o crachá
     usar_recuperacao   — troca a senha com o código que a liderança mandou
     criar_igreja       — só você, com a chave mestra (venda nova)
     resetar_admin      — só você, quando o administrador esquece a senha
     criar_acesso       — o líder cria o login de um integrante
     trocar_senha       — o líder redefine a senha de alguém
     gerar_recuperacao  — o líder gera o código de uso único
     atualizar_acesso   — muda nome, papel ou vínculo (e o crachá junto)
     remover_acesso     — o líder tira o acesso de alguém

   Publicar:  supabase functions deploy acesso --no-verify-jwt
   O passo a passo está em docs/configurar-supabase.md
   ============================================================ */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Definida por você em Edge Functions → Secrets. Sem ela, ninguém cria igreja.
const CHAVE_MESTRA = Deno.env.get('CHAVE_MESTRA') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
function erro(mensagem: string, status = 400) {
  return responder({ erro: mensagem }, status);
}

/* Mesmas regras do banco, para o endereço técnico bater. */
function semAcento(t: string) {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function montarEmail(codigo: string, usuario: string) {
  const u = semAcento(usuario).replace(/[^a-zA-Z0-9]+/g, '.').toLowerCase();
  const c = codigo.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  return `${u}@${c}.ekklesia.app`;
}
function novoId(prefixo: string) {
  return prefixo + crypto.randomUUID().replace(/-/g, '').slice(0, 18);
}

/* ------------------------------------------------------------
   Freio de tentativas

   O código da igreja circula em grupo de WhatsApp — não é segredo.
   Sem freio, quem tivesse o código poderia ficar chutando nomes e
   senhas à vontade. Aqui cada tentativa que dá errado fica anotada, e
   depois de LIMITE erros no mesmo lugar a porta fecha por um tempo.
   Quem acerta zera a contagem: um integrante que entra todo domingo
   nunca esbarra nisso.
   ------------------------------------------------------------ */
const LIMITE_TENTATIVAS = 10;
const JANELA_MINUTOS = 10;

function origemDaChamada(req: Request) {
  const encaminhado = req.headers.get('x-forwarded-for') ?? '';
  const ip = encaminhado.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
  return ip || 'origem-desconhecida';
}

async function tentativasDemais(origem: string, codigo: string) {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();
  const { count } = await admin.from('tentativas_acesso')
    .select('id', { count: 'exact', head: true })
    .eq('origem', origem).eq('codigo', codigo).gte('quando', desde);
  return (count ?? 0) >= LIMITE_TENTATIVAS;
}

async function anotarErro(origem: string, codigo: string) {
  await admin.from('tentativas_acesso').insert({ origem, codigo });
  // Varre o que já passou da validade. A tabela existe para contar os
  // últimos minutos; guardar mais que isso só ocuparia espaço.
  const ontem = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await admin.from('tentativas_acesso').delete().lt('quando', ontem);
}

async function limparErros(origem: string, codigo: string) {
  await admin.from('tentativas_acesso').delete().eq('origem', origem).eq('codigo', codigo);
}

/* Sem acento, sem maiúscula e sem espaço sobrando — é assim que os nomes
   são comparados, para "João" e "joao" serem a mesma pessoa. */
function chaveNome(t: string) {
  return semAcento(String(t ?? '')).trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ------------------------------------------------------------
   Recuperação de senha

   Os endereços de login são técnicos e não recebem e-mail, então o
   "clique no link que mandamos" não existe aqui. O que existe é o
   WhatsApp do ministério: a liderança gera um código de uso único e
   manda para a pessoa, que troca a senha sozinha.

   O código vale 30 minutos e some depois de usado. Guardamos só o
   embaralhado dele — nem abrindo a tabela dá para ler o que foi gerado.
   ------------------------------------------------------------ */
const VALIDADE_MINUTOS = 30;
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';  // sem 0/O e 1/I, que confundem

function novoCodigoRecuperacao() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]);
  return letras.slice(0, 3).join('') + '-' + letras.slice(3).join('');  // ABC-DEF, fácil de ditar
}

async function embaralhar(codigo: string) {
  const dados = new TextEncoder().encode(codigo.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const digest = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Compara sem deixar o tempo de resposta contar quantos caracteres bateram. */
function mesmoTexto(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/* Acha quem é a pessoa pelo que ela digitou: o login, o nome completo ou
   só o primeiro nome quando não houver dúvida. Mesma regra da entrada. */
type Acesso = { id?: string; usuario: string; nome: string; ativo?: boolean };
function acharPorNome(lista: Acesso[], nome: string) {
  const ativos = lista.filter((u) => u.ativo !== false);
  const chave = chaveNome(nome);
  const porLogin = ativos.filter((u) => chaveNome(u.usuario) === chave);
  if (porLogin.length === 1) return { achado: porLogin[0], ambiguo: false };
  const porNome = ativos.filter((u) => chaveNome(u.nome) === chave);
  if (porNome.length === 1) return { achado: porNome[0], ambiguo: false };
  if (porNome.length > 1) return { achado: null, ambiguo: true };
  const porPrimeiro = ativos.filter((u) => chaveNome(u.nome).split(' ')[0] === chave);
  if (porPrimeiro.length === 1) return { achado: porPrimeiro[0], ambiguo: false };
  return { achado: null, ambiguo: porPrimeiro.length > 1 };
}

/* Quem está chamando? Confere o crachá e devolve igreja e papel. */
async function quemChama(req: Request) {
  const cabecalho = req.headers.get('Authorization') ?? '';
  const token = cabecalho.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, string>;
  if (!meta.igreja_id) return null;
  return { id: data.user.id, igreja_id: meta.igreja_id, papel: meta.papel ?? 'membro' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return erro('Use POST.', 405);

  let corpo: Record<string, string>;
  try { corpo = await req.json(); } catch { return erro('Corpo inválido.'); }
  const acao = corpo.acao;

  /* ---------- Venda nova: só você, com a chave mestra ---------- */
  if (acao === 'criar_igreja') {
    if (!CHAVE_MESTRA || corpo.chave_mestra !== CHAVE_MESTRA) {
      return erro('Chave mestra inválida.', 401);
    }
    const { nome, codigo, contato, admin_nome, admin_senha, plano, situacao } = corpo;
    if (!nome || !codigo || !admin_senha) {
      return erro('Informe nome da igreja, código e a senha do administrador.');
    }
    if (admin_senha.length < 6) return erro('A senha do administrador precisa de 6 caracteres ou mais.');

    const codigoLimpo = codigo.trim().toUpperCase();
    const { data: existe } = await admin.from('igrejas').select('id').eq('codigo', codigoLimpo).maybeSingle();
    if (existe) return erro('Já existe uma igreja com esse código.');

    const igrejaId = novoId('ig-');
    const { error: e1 } = await admin.from('igrejas').insert({
      id: igrejaId, nome, codigo: codigoLimpo, contato: contato ?? null,
      plano: plano ?? 'essencial', situacao: situacao ?? 'teste',
    });
    if (e1) return erro('Não consegui criar a igreja: ' + e1.message, 500);

    const usuario = 'admin';
    const email = montarEmail(codigoLimpo, usuario);
    const { data: criado, error: e2 } = await admin.auth.admin.createUser({
      email, password: admin_senha, email_confirm: true,
      user_metadata: { igreja_id: igrejaId, papel: 'admin', nome: admin_nome ?? 'Administrador',
                       usuario, membro_id: null },
    });
    if (e2) {
      await admin.from('igrejas').delete().eq('id', igrejaId);
      return erro('Não consegui criar o acesso do administrador: ' + e2.message, 500);
    }

    await admin.from('usuarios').insert({
      id: novoId('u-'), igreja_id: igrejaId, nome: admin_nome ?? 'Administrador',
      usuario, papel: 'admin', ativo: true, auth_id: criado.user!.id,
    });

    return responder({ ok: true, igreja_id: igrejaId, codigo: codigoLimpo, entrar_com: usuario });
  }

  /* ------------------------------------------------------------
     Entrada no aplicativo

     Antes, o aplicativo perguntava ao banco "qual é o endereço técnico
     de fulano?" e só depois tentava a senha. Quem tivesse o código da
     igreja descobria, uma pergunta por vez, o nome de todo mundo — a
     resposta era diferente para quem existia e para quem não existia.

     Agora a conferência inteira acontece aqui. O aplicativo manda
     código, nome e senha e recebe uma única resposta. Nome errado e
     senha errada dão exatamente a mesma coisa, então não há o que
     descobrir tentando.
     ------------------------------------------------------------ */
  if (acao === 'entrar') {
    const codigo = (corpo.codigo ?? '').trim().toUpperCase();
    const nome = corpo.nome ?? '';
    const senha = corpo.senha ?? '';
    if (!codigo) return erro('Digite o código da sua igreja.');
    if (!nome || !senha) return erro('Digite seu nome e sua senha.');

    const origem = origemDaChamada(req);
    if (await tentativasDemais(origem, codigo)) {
      return erro(`Muitas tentativas seguidas. Espere ${JANELA_MINUTOS} minutos e tente de novo.`, 429);
    }

    const { data: igrejaEntrada } = await admin.from('igrejas')
      .select('id,codigo,situacao').ilike('codigo', codigo).maybeSingle();

    /* O código da igreja não é segredo: ele é ditado para a equipe toda.
       Dizer que está errado poupa a pessoa de culpar a própria senha. */
    if (!igrejaEntrada) {
      await anotarErro(origem, codigo);
      return erro('Não encontrei esse código de igreja. Confira com a liderança.', 404);
    }
    if (igrejaEntrada.situacao === 'suspensa') {
      return erro('O acesso desta igreja está suspenso. Fale com quem contratou o aplicativo.', 403);
    }

    const { data: acessos } = await admin.from('usuarios')
      .select('usuario,nome,ativo').eq('igreja_id', igrejaEntrada.id);
    const { achado, ambiguo } = acharPorNome(acessos ?? [], nome);
    const usuario = achado?.usuario ?? null;

    /* Só este caso precisa de resposta própria: sem ela, quem tem xará
       na equipe nunca descobriria que precisa digitar o nome completo. */
    if (ambiguo) {
      return erro('Há mais de uma pessoa com esse nome. Digite o nome completo.', 409);
    }

    /* Nome que não existe também tenta entrar — com um endereço que
       nunca vai existir. Assim a resposta demora o mesmo tanto e diz a
       mesma coisa, e não dá para separar "não existe" de "senha errada". */
    const email = usuario
      ? montarEmail(igrejaEntrada.codigo, usuario)
      : montarEmail(igrejaEntrada.codigo, 'nao.existe.' + crypto.randomUUID().slice(0, 8));

    const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });

    if (!login.ok) {
      await anotarErro(origem, codigo);
      return erro('Nome ou senha incorretos. Confira com a liderança como você está cadastrado.', 401);
    }

    await limparErros(origem, codigo);
    return responder(await login.json());
  }

  /* ---------- Trocar a senha com o código que a liderança mandou ---------- */
  if (acao === 'usar_recuperacao') {
    const codigoIgreja = (corpo.codigo_igreja ?? '').trim().toUpperCase();
    const { nome, codigo, nova_senha } = corpo;
    if (!codigoIgreja || !nome || !codigo || !nova_senha) {
      return erro('Preencha o código da igreja, seu nome, o código recebido e a nova senha.');
    }
    if (nova_senha.length < 6) return erro('A nova senha precisa de 6 caracteres ou mais.');

    const origem = origemDaChamada(req);
    if (await tentativasDemais(origem, codigoIgreja)) {
      return erro(`Muitas tentativas seguidas. Espere ${JANELA_MINUTOS} minutos e tente de novo.`, 429);
    }

    /* Uma resposta só para tudo que der errado — nome que não existe,
       código trocado, código vencido. Senão o próprio formulário de
       recuperação viraria o jeito de descobrir quem é da equipe. */
    const recusar = async () => {
      await anotarErro(origem, codigoIgreja);
      return erro('Código de recuperação inválido ou vencido. Peça outro à liderança.', 401);
    };

    const { data: igrejaRec } = await admin.from('igrejas')
      .select('id,situacao').ilike('codigo', codigoIgreja).maybeSingle();
    if (!igrejaRec) return await recusar();
    if (igrejaRec.situacao === 'suspensa') {
      return erro('O acesso desta igreja está suspenso. Fale com quem contratou o aplicativo.', 403);
    }

    const { data: acessosRec } = await admin.from('usuarios')
      .select('id,usuario,nome,ativo,auth_id').eq('igreja_id', igrejaRec.id);
    const { achado } = acharPorNome(acessosRec ?? [], nome);
    if (!achado?.id) return await recusar();

    const { data: pedidos } = await admin.from('recuperacoes')
      .select('id,codigo_hash,expira_em')
      .eq('usuario_id', achado.id).is('usado_em', null)
      .gt('expira_em', new Date().toISOString());

    const enviado = await embaralhar(codigo);
    const pedido = (pedidos ?? []).find((p) => mesmoTexto(p.codigo_hash, enviado));
    if (!pedido) return await recusar();

    const alvo = (acessosRec ?? []).find((u) => u.id === achado.id) as { auth_id?: string };
    if (!alvo?.auth_id) return await recusar();

    const { error: eSenha } = await admin.auth.admin
      .updateUserById(alvo.auth_id, { password: nova_senha });
    if (eSenha) return erro('Não consegui trocar a senha: ' + eSenha.message, 500);

    /* Usado é usado: some o pedido atendido e os outros pendentes junto,
       para um código antigo no WhatsApp não valer mais nada. */
    await admin.from('recuperacoes').delete().eq('usuario_id', achado.id);
    await limparErros(origem, codigoIgreja);
    return responder({ ok: true, entrar_com: achado.nome });
  }

  /* ---------- Resgate do administrador, só com a chave mestra ----------
     Quando quem esquece a senha é o próprio administrador da igreja, não
     há liderança acima dele para gerar código. Aí quem resolve é você. */
  if (acao === 'resetar_admin') {
    if (!CHAVE_MESTRA || corpo.chave_mestra !== CHAVE_MESTRA) {
      return erro('Chave mestra inválida.', 401);
    }
    const codigoIgreja = (corpo.codigo ?? '').trim().toUpperCase();
    const { nova_senha } = corpo;
    if (!codigoIgreja || !nova_senha) return erro('Informe o código da igreja e a nova senha.');
    if (nova_senha.length < 6) return erro('A nova senha precisa de 6 caracteres ou mais.');

    const { data: igrejaAdm } = await admin.from('igrejas')
      .select('id').ilike('codigo', codigoIgreja).maybeSingle();
    if (!igrejaAdm) return erro('Igreja não encontrada.', 404);

    const { data: adm } = await admin.from('usuarios')
      .select('auth_id').eq('igreja_id', igrejaAdm.id).eq('usuario', 'admin').maybeSingle();
    if (!adm?.auth_id) return erro('Essa igreja não tem acesso de administrador.', 404);

    const { error } = await admin.auth.admin.updateUserById(adm.auth_id, { password: nova_senha });
    if (error) return erro('Não consegui trocar a senha: ' + error.message, 500);
    return responder({ ok: true, codigo: codigoIgreja, entrar_com: 'admin' });
  }

  /* ---------- Daqui para baixo, só líder ou administrador ---------- */
  const chamador = await quemChama(req);
  if (!chamador) return erro('Faça login novamente.', 401);
  if (!['admin', 'lider'].includes(chamador.papel)) {
    return erro('Só a liderança pode mexer nos acessos.', 403);
  }

  const { data: igreja } = await admin.from('igrejas')
    .select('id,codigo,situacao').eq('id', chamador.igreja_id).maybeSingle();
  if (!igreja) return erro('Igreja não encontrada.', 404);
  if (igreja.situacao === 'suspensa') return erro('Esta igreja está suspensa.', 403);

  if (acao === 'criar_acesso') {
    const { nome, usuario, senha, papel, membro_id } = corpo;
    if (!nome || !usuario || !senha) return erro('Informe nome, usuário e senha.');
    if (senha.length < 6) return erro('A senha precisa de 6 caracteres ou mais.');
    if (papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador cria outro administrador.', 403);
    }

    const { data: jaTem } = await admin.from('usuarios')
      .select('id').eq('igreja_id', igreja.id).ilike('usuario', usuario).maybeSingle();
    if (jaTem) return erro('Já existe um acesso com esse usuário nesta igreja.');

    const email = montarEmail(igreja.codigo, usuario);
    const { data: criado, error: e1 } = await admin.auth.admin.createUser({
      email, password: senha, email_confirm: true,
      user_metadata: { igreja_id: igreja.id, papel: papel ?? 'membro', nome,
                       usuario, membro_id: membro_id ?? null },
    });
    if (e1) return erro('Não consegui criar o acesso: ' + e1.message, 500);

    const { error: e2 } = await admin.from('usuarios').insert({
      id: novoId('u-'), igreja_id: igreja.id, nome, usuario,
      papel: papel ?? 'membro', ativo: true, membro_id: membro_id ?? null,
      auth_id: criado.user!.id,
    });
    if (e2) {
      await admin.auth.admin.deleteUser(criado.user!.id);
      return erro('Não consegui salvar o acesso: ' + e2.message, 500);
    }
    return responder({ ok: true });
  }

  if (acao === 'trocar_senha') {
    const { usuario_id, senha } = corpo;
    if (!usuario_id || !senha) return erro('Informe quem é e a nova senha.');
    if (senha.length < 6) return erro('A senha precisa de 6 caracteres ou mais.');

    const { data: alvo } = await admin.from('usuarios')
      .select('auth_id,papel').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo?.auth_id) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador troca a senha de outro administrador.', 403);
    }

    const { error } = await admin.auth.admin.updateUserById(alvo.auth_id, { password: senha });
    if (error) return erro('Não consegui trocar a senha: ' + error.message, 500);
    return responder({ ok: true });
  }

  /* O crachá carrega papel e vínculo. Mudar isso só na tabela deixaria a
     permissão antiga valendo até a pessoa sair e entrar de novo. */
  if (acao === 'atualizar_acesso') {
    const { usuario_id, nome, papel, membro_id, ativo } = corpo;
    if (!usuario_id) return erro('Informe qual acesso atualizar.');

    const { data: alvo } = await admin.from('usuarios')
      .select('auth_id,papel,usuario').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador altera outro administrador.', 403);
    }
    if (papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador promove alguém a administrador.', 403);
    }
    if (alvo.usuario === 'admin' && papel && papel !== 'admin') {
      return erro('O acesso principal precisa continuar sendo administrador.');
    }

    const mudancas: Record<string, unknown> = {};
    if (nome !== undefined) mudancas.nome = nome;
    if (papel !== undefined) mudancas.papel = papel;
    if (membro_id !== undefined) mudancas.membro_id = membro_id || null;
    if (ativo !== undefined) mudancas.ativo = !!ativo;
    if (Object.keys(mudancas).length) {
      const { error } = await admin.from('usuarios')
        .update(mudancas).eq('id', usuario_id).eq('igreja_id', igreja.id);
      if (error) return erro('Não consegui salvar: ' + error.message, 500);
    }

    if (alvo.auth_id) {
      const { data: atual } = await admin.from('usuarios')
        .select('nome,usuario,papel,membro_id').eq('id', usuario_id).maybeSingle();
      await admin.auth.admin.updateUserById(alvo.auth_id, {
        user_metadata: { igreja_id: igreja.id, papel: atual!.papel, nome: atual!.nome,
                         usuario: atual!.usuario, membro_id: atual!.membro_id },
      });
    }
    return responder({ ok: true });
  }

  /* ---------- A liderança gera o código para mandar no WhatsApp ---------- */
  if (acao === 'gerar_recuperacao') {
    const { usuario_id } = corpo;
    if (!usuario_id) return erro('Informe de quem é a senha esquecida.');

    const { data: alvo } = await admin.from('usuarios')
      .select('nome,usuario,papel,ativo').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.ativo === false) return erro('Esse acesso está desativado. Reative antes de gerar o código.');
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador gera código para outro administrador.', 403);
    }

    const codigo = novoCodigoRecuperacao();
    const expira = new Date(Date.now() + VALIDADE_MINUTOS * 60_000);

    // Um código de cada vez: gerar outro invalida o anterior, então
    // o que ficou para trás no WhatsApp deixa de servir.
    await admin.from('recuperacoes').delete().eq('usuario_id', usuario_id);
    const { error } = await admin.from('recuperacoes').insert({
      igreja_id: igreja.id, usuario_id,
      codigo_hash: await embaralhar(codigo), expira_em: expira.toISOString(),
    });
    if (error) return erro('Não consegui gerar o código: ' + error.message, 500);

    // Varre os vencidos de todo mundo, de carona.
    await admin.from('recuperacoes').delete().lt('expira_em', new Date().toISOString());

    return responder({ ok: true, codigo, nome: alvo.nome,
                       minutos: VALIDADE_MINUTOS, codigo_igreja: igreja.codigo });
  }

  if (acao === 'remover_acesso') {
    const { usuario_id } = corpo;
    if (!usuario_id) return erro('Informe qual acesso remover.');

    const { data: alvo } = await admin.from('usuarios')
      .select('auth_id,papel,usuario').eq('id', usuario_id).eq('igreja_id', igreja.id).maybeSingle();
    if (!alvo) return erro('Acesso não encontrado nesta igreja.', 404);
    if (alvo.usuario === 'admin') return erro('O acesso principal não pode ser removido.');
    if (alvo.papel === 'admin' && chamador.papel !== 'admin') {
      return erro('Só um administrador remove outro administrador.', 403);
    }

    if (alvo.auth_id) await admin.auth.admin.deleteUser(alvo.auth_id);
    await admin.from('usuarios').delete().eq('id', usuario_id).eq('igreja_id', igreja.id);
    return responder({ ok: true });
  }

  return erro('Ação desconhecida: ' + acao);
});
