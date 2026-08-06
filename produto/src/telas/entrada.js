/* ============================================================
   A tela de entrada

   Todo mundo entra pelo mesmo lugar, digitando o próprio nome. Não
   existe lista de pessoas para escolher: além de expor quem é da
   equipe, ela fazia a tela crescer com o ministério.
   ============================================================ */
import { MODO_NUVEM } from '../nucleo/config.js';
import { esc } from '../nucleo/util.js';
import { IC } from '../ui/icones.js';
import { janela, fecharJanela, valor, protegerBotao } from '../ui/janela.js';
import { avisoBom, avisoRuim } from '../ui/aviso.js';
import { sessao } from '../sessao/sessao.js';
import { entrarNaIgreja, trocarSenhaComCodigo, SENHA_MINIMA } from '../sessao/entrar.js';
import { noAparelho } from '../dados/indice.js';

const notas = [
  { esq: 8, alto: 24, baixo: 44, dur: 11, atraso: 0 },
  { esq: 17, alto: 44, baixo: 34, dur: 14, atraso: -3 },
  { esq: 26, alto: 54, baixo: 24, dur: 9, atraso: -6 },
  { esq: 36, alto: 34, baixo: 64, dur: 16, atraso: -2, grande: true },
  { esq: 63, alto: 64, baixo: 44, dur: 12, atraso: -8 },
  { esq: 74, alto: 24, baixo: 54, dur: 15, atraso: -4, grande: true },
  { esq: 85, alto: 44, baixo: 24, dur: 10, atraso: -1 },
  { esq: 93, alto: 54, baixo: 64, dur: 13, atraso: -7 },
];

export function telaEntrada(raiz, aoEntrar) {
  const pedeCodigo = MODO_NUVEM && !noAparelho && !sessao.codigo;

  raiz.innerHTML = `
    <div class="entrada-tela">
      <div class="pauta" aria-hidden="true">
        ${[24, 34, 44, 54, 64].map((t) => `<i class="pauta-linha" style="top:${t}%"></i>`).join('')}
        ${notas.map((n) => `<i class="nota${n.grande ? ' nota-g' : ''}" style="left:${n.esq}%;--alto:${n.alto}%;--baixo:${n.baixo}%;animation-duration:${n.dur}s;animation-delay:${n.atraso}s"></i>`).join('')}
      </div>

      <main class="cartao-entrada">
        <div class="marca-linha">
          <div class="marca-selo">E</div>
          <div class="marca-nome"><b>Ekklesia Music</b><small>Ministério de Louvor</small></div>
        </div>

        <h1 class="titulo-entrada">Entre para ver<br>sua escala</h1>
        <p class="sub-entrada">Digite seu nome e a senha que a liderança cadastrou.</p>

        <form id="forma-entrada" novalidate>
          <div class="campo${pedeCodigo ? '' : ' escondido'}" id="campo-igreja">
            <label for="ent-igreja">Código da igreja</label>
            <input id="ent-igreja" class="entrada" placeholder="Ex.: BETEL-4K2P"
                   autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(sessao.codigo)}">
            <div class="dica">A liderança passa esse código uma vez. Ele fica guardado neste aparelho.</div>
          </div>

          <div class="campo">
            <label for="ent-nome">Seu nome</label>
            <input id="ent-nome" class="entrada" autocomplete="username"
                   placeholder="Como você está cadastrado" autocapitalize="words">
          </div>

          <div class="campo">
            <label for="ent-senha">Senha</label>
            <div class="campo-senha">
              <input id="ent-senha" class="entrada" type="password" autocomplete="current-password" placeholder="••••••">
              <button type="button" class="ver-senha" data-ver aria-label="Mostrar a senha">${IC.olho}</button>
            </div>
          </div>

          <button class="btn btn-principal btn-bloco btn-grande" type="submit">Entrar</button>
        </form>

        <div class="rodape-entrada">
          <button type="button" class="btn-texto" data-esqueci>Esqueci minha senha</button>
        </div>
      </main>
    </div>`;

  raiz.querySelector('[data-ver]').addEventListener('click', (e) => {
    const campo = document.getElementById('ent-senha');
    const mostrando = campo.type === 'text';
    campo.type = mostrando ? 'password' : 'text';
    e.currentTarget.innerHTML = mostrando ? IC.olho : IC.olhoRiscado;
    e.currentTarget.setAttribute('aria-label', mostrando ? 'Mostrar a senha' : 'Esconder a senha');
    campo.focus();
  });

  raiz.querySelector('[data-esqueci]').addEventListener('click', esqueciMinhaSenha);

  raiz.querySelector('#forma-entrada').addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = e.target.querySelector('[type=submit]');
    const codigo = valor('ent-igreja') || sessao.codigo;
    const nome = valor('ent-nome');
    const senha = document.getElementById('ent-senha').value;

    if (MODO_NUVEM && !noAparelho && !codigo) { avisoRuim('Digite o código da sua igreja.'); foco('ent-igreja'); return; }
    if (!nome) { avisoRuim('Digite seu nome.'); foco('ent-nome'); return; }
    if (!senha) { avisoRuim('Digite sua senha.'); foco('ent-senha'); return; }

    botao.disabled = true;
    botao.textContent = 'Entrando…';
    try {
      const pessoa = await entrarNaIgreja(codigo, nome, senha);
      await aoEntrar(pessoa);
    } catch (erro) {
      botao.disabled = false;
      botao.textContent = 'Entrar';
      avisoRuim(erro.message || 'Não consegui entrar.');
      foco(/igreja/i.test(erro.message ?? '') ? 'ent-igreja' : 'ent-senha');
    }
  });

  document.getElementById(pedeCodigo ? 'ent-igreja' : 'ent-nome')?.focus();
}

function foco(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus();
  el.select?.();
}

/* ------------------------------------------------------------
   Esqueci minha senha

   Não existe "clique no link que mandamos": os endereços de login são
   técnicos e não recebem e-mail. O caminho é o mesmo por onde o
   ministério já se fala — a liderança gera um código e manda no grupo.
   ------------------------------------------------------------ */
export function esqueciMinhaSenha() {
  if (!MODO_NUVEM || noAparelho) {
    janela('Esqueci minha senha', `
      <p style="margin-top:0">Neste aparelho a senha fica guardada aqui mesmo, sem servidor — então quem
      redefine é a liderança, na tela de <b>Usuários</b>.</p>
      <p style="color:var(--texto-fraco);margin-bottom:0">Procure quem cuida do ministério e peça uma senha nova.</p>`,
      `<button class="btn btn-principal" data-ok>Entendi</button>`);
    document.querySelector('[data-ok]').addEventListener('click', fecharJanela);
    return;
  }

  janela('Esqueci minha senha', `
    <p style="margin-top:0;color:var(--texto-fraco)">Peça à liderança um <b>código de recuperação</b>.
    Ele vale por poucos minutos e serve uma vez só.</p>
    <div class="campo"><label for="rec-igreja">Código da igreja</label>
      <input id="rec-igreja" class="entrada" value="${esc(sessao.codigo)}" autocapitalize="characters" autocomplete="off" spellcheck="false"></div>
    <div class="campo"><label for="rec-nome">Seu nome</label>
      <input id="rec-nome" class="entrada" placeholder="Como você está cadastrado" autocapitalize="words"></div>
    <div class="campo"><label for="rec-codigo">Código de recuperação</label>
      <input id="rec-codigo" class="entrada" placeholder="Ex.: 7KM-P4Q" autocapitalize="characters" autocomplete="off" spellcheck="false"></div>
    <div class="linha-2">
      <div class="campo"><label for="rec-senha">Nova senha</label>
        <input id="rec-senha" class="entrada" type="password" autocomplete="new-password" placeholder="Mínimo de ${SENHA_MINIMA}"></div>
      <div class="campo"><label for="rec-senha2">Repita a nova senha</label>
        <input id="rec-senha2" class="entrada" type="password" autocomplete="new-password" placeholder="A mesma de cima"></div>
    </div>`,
    `<button class="btn" data-cancelar>Cancelar</button>
     <button class="btn btn-principal" data-trocar>Trocar a senha</button>`);

  document.querySelector('[data-cancelar]').addEventListener('click', fecharJanela);
  protegerBotao(document.querySelector('[data-trocar]'), async () => {
    const igreja = valor('rec-igreja'), nome = valor('rec-nome'), codigo = valor('rec-codigo');
    const s1 = document.getElementById('rec-senha').value;
    const s2 = document.getElementById('rec-senha2').value;
    if (!igreja || !nome || !codigo) { avisoRuim('Preencha a igreja, seu nome e o código.'); return; }
    if (!s1 || s1 !== s2) { avisoRuim('As senhas não conferem.'); return; }
    if (s1.length < SENHA_MINIMA) { avisoRuim(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`); return; }

    try {
      await trocarSenhaComCodigo(igreja, nome, codigo, s1);
      fecharJanela();
      /* Deixa o caminho pronto: falta só digitar a senha recém-criada. */
      const ci = document.getElementById('ent-igreja'); if (ci) ci.value = igreja;
      const cn = document.getElementById('ent-nome'); if (cn) cn.value = nome;
      foco('ent-senha');
      avisoBom('Senha trocada. Agora é só entrar.');
    } catch (erro) {
      avisoRuim(erro.message || 'Não consegui trocar a senha.');
    }
  });
}
