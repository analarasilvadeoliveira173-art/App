/* ============================================================
   O aplicativo

   Decide para onde levar a pessoa quando ela abre, monta a moldura e
   troca de tela. Nada de regra de ministério aqui — só a costura.
   ============================================================ */
import './estilo/tokens.css';
import './estilo/base.css';
import './estilo/componentes.css';
import './estilo/layout.css';

import { MODO_NUVEM, VERSAO } from './nucleo/config.js';
import { esc, iniciais } from './nucleo/util.js';
import { IC } from './ui/icones.js';
import { aplicarTema, alternarTema, temaGuardado } from './ui/tema.js';
import { fecharJanela, confirmar } from './ui/janela.js';
import { avisoRuim } from './ui/aviso.js';
import { pessoa, guardarPessoa, limparSessao, recuperarSessao, ehLideranca, ehAdmin } from './sessao/sessao.js';
import { carregar, cairParaOAparelho, noAparelho } from './dados/indice.js';
import { carregarDoAparelho, semearDemonstracao } from './dados/local.js';
import { telaEntrada } from './telas/entrada.js';
import { telaPainel } from './telas/painel.js';
import { telaEscalas } from './telas/escalas.js';
import { telaLouvores } from './telas/louvores.js';
import { telaMembros } from './telas/membros.js';

const raiz = document.getElementById('raiz');

/* ---------------- As telas ---------------- */
const TELAS = [
  { chave: 'painel', titulo: 'Painel', icone: IC.painel, desenhar: telaPainel, rodape: true },
  { chave: 'escalas', titulo: 'Escalas', icone: IC.escalas, desenhar: telaEscalas, rodape: true },
  { chave: 'louvores', titulo: 'Louvores', icone: IC.louvores, desenhar: telaLouvores, rodape: true },
  { chave: 'ensaios', titulo: 'Ensaios', icone: IC.ensaios },
  { chave: 'membros', titulo: 'Membros', icone: IC.membros, desenhar: telaMembros, soLideranca: true },
  { chave: 'relatorios', titulo: 'Relatórios', icone: IC.relatorios, soLideranca: true },
  { chave: 'avisos', titulo: 'Mural', icone: IC.avisos },
  { chave: 'perfil', titulo: 'Meu perfil', icone: IC.perfil, rodape: true },
  { chave: 'usuarios', titulo: 'Usuários', icone: IC.usuarios, soAdmin: true },
  { chave: 'configuracoes', titulo: 'Configurações', icone: IC.config, soAdmin: true },
];

const telasVisiveis = () => TELAS.filter((t) =>
  (!t.soLideranca || ehLideranca()) && (!t.soAdmin || ehAdmin()));

let telaAtual = 'painel';

export function ir(chave, contexto = {}) {
  /* Trocar de tela fecha a janela aberta. Uma janela sobrevivente sobre
     outra tela é confusão pura — e já aconteceu. */
  fecharJanela();
  const tela = telasVisiveis().find((t) => t.chave === chave) ?? telasVisiveis()[0];
  telaAtual = tela.chave;
  marcarMenu();
  const conteudo = document.getElementById('conteudo');
  window.scrollTo(0, 0);

  if (tela.desenhar) { tela.desenhar(conteudo, ir, contexto); return; }
  conteudo.innerHTML = `
    <div class="cabeca-pagina"><div><h2>${esc(tela.titulo)}</h2></div></div>
    <div class="cartao vazio">${IC.vazio}
      <h3>Em construção</h3>
      <p>Esta tela está sendo escrita. O painel e a entrada já funcionam.</p>
    </div>`;
}

function marcarMenu() {
  document.querySelectorAll('[data-tela]').forEach((b) => {
    if (b.dataset.tela === telaAtual) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

/* ---------------- A moldura ---------------- */
function montarMoldura() {
  const visiveis = telasVisiveis();
  const noRodape = visiveis.filter((t) => t.rodape).slice(0, 4);

  raiz.innerHTML = `
    <div class="barra-topo">
      <div class="marca-linha"><div class="marca-selo">E</div>
        <div class="marca-nome"><b>Ekklesia Music</b></div></div>
      <div style="display:flex;gap:var(--e2)">
        <button class="btn-icone" data-trocar-tema aria-label="Alternar tema">${IC.sol}</button>
        <button class="btn-icone" data-sair aria-label="Sair">${IC.sair}</button>
      </div>
    </div>

    <div class="moldura">
      <aside class="lateral">
        <div class="lateral-marca"><div class="marca-selo">E</div>
          <div class="marca-nome"><b>Ekklesia Music</b><small>Ministério de Louvor</small></div></div>

        <nav class="menu" aria-label="Telas do aplicativo">
          ${visiveis.map((t) => `
            <button data-tela="${t.chave}">${t.icone}${esc(t.titulo)}</button>`).join('')}
        </nav>

        <div class="lateral-pe">
          <div class="cartao-pessoa">
            <span class="avatar">${esc(iniciais(pessoa?.nome))}</span>
            <div><b>${esc(pessoa?.nome ?? '')}</b><small>${esc(papelPorExtenso())}</small></div>
          </div>
          <div style="display:flex;gap:var(--e2);margin-top:var(--e2)">
            <button class="btn-icone" data-trocar-tema aria-label="Alternar tema">${IC.sol}</button>
            <button class="btn-icone" data-sair aria-label="Sair">${IC.sair}</button>
          </div>
          ${noAparelho && MODO_NUVEM ? `<p class="dica" style="margin-top:var(--e3)">
            Sem conexão com o servidor. Você está vendo os dados deste aparelho.</p>` : ''}
          <p class="dica" style="margin-top:var(--e2)">versão ${esc(VERSAO)}</p>
        </div>
      </aside>

      <main class="conteudo" id="conteudo"></main>
    </div>

    <nav class="barra-baixo" aria-label="Telas principais">
      ${noRodape.map((t) => `
        <button data-tela="${t.chave}">${t.icone}<span>${esc(t.titulo)}</span></button>`).join('')}
    </nav>`;

  raiz.querySelectorAll('[data-tela]').forEach((b) =>
    b.addEventListener('click', () => ir(b.dataset.tela)));
  raiz.querySelectorAll('[data-trocar-tema]').forEach((b) =>
    b.addEventListener('click', () => { alternarTema(); atualizarIconeTema(); }));
  raiz.querySelectorAll('[data-sair]').forEach((b) =>
    b.addEventListener('click', sair));

  atualizarIconeTema();
}

function papelPorExtenso() {
  return { admin: 'Administrador', lider: 'Líder', membro: 'Membro do louvor' }[pessoa?.papel] ?? '';
}

/* O <html> também carrega data-tema, para o CSS. Por isso os botões usam
   outro nome: com o mesmo, a busca pegava o documento inteiro e o
   substituía por um ícone — a página sumia no segundo clique. */
function atualizarIconeTema() {
  const escuro = document.documentElement.getAttribute('data-tema') === 'escuro'
    || (!document.documentElement.hasAttribute('data-tema') && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('[data-trocar-tema]').forEach((b) => { b.innerHTML = escuro ? IC.lua : IC.sol; });
}

function sair() {
  confirmar('Deseja sair da sua conta?', () => {
    limparSessao();
    abrirEntrada();
  }, 'Sair');
}

/* ---------------- Abertura ---------------- */
function esconderAbertura() {
  const el = document.getElementById('abertura');
  if (!el) return;
  el.style.transition = 'opacity .25s';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 260);
}

function abrirEntrada() {
  telaEntrada(raiz, async (quem) => {
    guardarPessoa(quem);
    await abrirApp();
  });
  esconderAbertura();
}

async function abrirApp() {
  try {
    await carregar();
  } catch (erro) {
    if (erro.message === 'SESSAO_EXPIRADA') { limparSessao(); abrirEntrada(); return; }
    /* Servidor fora do ar não pode virar tela de erro: o ministério
       precisa do aplicativo justamente no domingo de manhã. */
    cairParaOAparelho();
    if (!carregarDoAparelho()) semearDemonstracao();
    await carregar();
    avisoRuim('Sem conexão com o servidor. Mostrando o que está neste aparelho.');
  }
  montarMoldura();
  ir('painel');
  esconderAbertura();
}

async function comecar() {
  aplicarTema(temaGuardado());

  if (!MODO_NUVEM) {
    /* Versão de demonstração: sem servidor configurado, o aplicativo
       roda sozinho com uma igreja de exemplo. */
    if (!carregarDoAparelho()) semearDemonstracao();
  }

  const tinhaSessao = recuperarSessao();
  if (tinhaSessao && pessoa) { await abrirApp(); return; }
  abrirEntrada();
}

comecar();
