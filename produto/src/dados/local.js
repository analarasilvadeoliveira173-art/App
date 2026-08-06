/* ============================================================
   Modo aparelho

   Tudo guardado no próprio celular, sem servidor nenhum. Serve para
   dois casos: a versão de demonstração, que a igreja experimenta antes
   de comprar, e o socorro de quando a nuvem não responde no domingo de
   manhã — melhor um app com os dados de ontem do que nenhum app.

   O contrato é o mesmo do adaptador de nuvem, de propósito: as telas
   não sabem com qual dos dois estão falando.
   ============================================================ */
import { NOMES } from './tabelas.js';
import { id, hoje, mesesAtras, chaveNome } from '../nucleo/util.js';

const CHAVE = 'ekklesia.dados';
let memoria = {};

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch { /* cheio ou anônimo */ }
}

export function carregarDoAparelho() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) { memoria = JSON.parse(bruto); return true; }
  } catch { /* corrompido: começa limpo */ }
  return false;
}

export function limparAparelho() {
  memoria = {};
  try { localStorage.removeItem(CHAVE); } catch { /* nada a fazer */ }
}

function combina(linha, filtros) {
  if (filtros.coluna) {
    const v = linha[filtros.coluna];
    if (filtros.de && String(v ?? '') < filtros.de) return false;
    if (filtros.ate && String(v ?? '') > filtros.ate) return false;
  }
  for (const [col, valores] of Object.entries(filtros.em ?? {})) {
    if (!valores.map(String).includes(String(linha[col]))) return false;
  }
  return true;
}

export const local = {
  async listar(tabela, filtros = {}) {
    let lista = (memoria[tabela] ?? []).filter((l) => combina(l, filtros));
    if (filtros.ordem) {
      const { col, crescente } = filtros.ordem;
      const sinal = crescente === false ? -1 : 1;
      lista = [...lista].sort((a, b) => ((a[col] ?? '') > (b[col] ?? '') ? 1 : (a[col] ?? '') < (b[col] ?? '') ? -1 : 0) * sinal);
    }
    return JSON.parse(JSON.stringify(lista));
  },
  async inserir(tabela, linha) {
    const nova = { ...linha };
    if (!nova.id) nova.id = id(tabela.slice(0, 2));
    if (!nova.criado_em) nova.criado_em = new Date().toISOString();
    (memoria[tabela] ??= []).push(nova);
    salvar();
    return nova;
  },
  async atualizar(tabela, alvo, mudancas) {
    const lista = memoria[tabela] ?? [];
    const i = lista.findIndex((l) => l.id === alvo);
    if (i < 0) return null;
    lista[i] = { ...lista[i], ...mudancas };
    salvar();
    return lista[i];
  },
  async remover(tabela, alvo) {
    memoria[tabela] = (memoria[tabela] ?? []).filter((l) => l.id !== alvo);
    salvar();
  },
  async removerOnde(tabela, coluna, valor) {
    memoria[tabela] = (memoria[tabela] ?? []).filter((l) => String(l[coluna]) !== String(valor));
    salvar();
  },
};

/* ------------------------------------------------------------
   Dados de demonstração

   Uma igreja pequena e crível: sete pessoas, funções de verdade, um
   culto que já passou e um que vem aí. É o que a igreja interessada vê
   ao abrir a versão de teste, e o que os testes automáticos usam.
   ------------------------------------------------------------ */
export function semearDemonstracao() {
  const proximoDomingo = (() => {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  memoria = Object.fromEntries(NOMES.map((n) => [n, []]));

  memoria.funcoes = [
    { id: 'f1', nome: 'Dirigente', ordem: 1 },
    { id: 'f2', nome: 'Vocal', ordem: 2 },
    { id: 'f3', nome: 'Violão', ordem: 3 },
    { id: 'f4', nome: 'Teclado', ordem: 4 },
    { id: 'f5', nome: 'Baixo', ordem: 5 },
    { id: 'f6', nome: 'Bateria', ordem: 6 },
    { id: 'f7', nome: 'Som', ordem: 7 },
  ];

  memoria.membros = [
    { id: 'm1', nome: 'João Pereira', telefone: '73 99999-0001', funcao_principal: 'Dirigente', status: 'ativo', cor_avatar: '#0e6b5c', data_entrada: '2022-03-01' },
    { id: 'm2', nome: 'Maria Santos', telefone: '73 99999-0002', funcao_principal: 'Vocal', status: 'ativo', cor_avatar: '#c9a227', data_entrada: '2023-01-15' },
    { id: 'm3', nome: 'Pedro Lima', telefone: '73 99999-0003', funcao_principal: 'Teclado', status: 'ativo', cor_avatar: '#1d4ed8', data_entrada: '2021-07-10' },
    { id: 'm4', nome: 'Ana Costa', telefone: '73 99999-0004', funcao_principal: 'Bateria', status: 'ativo', cor_avatar: '#b3261e', data_entrada: '2023-09-05' },
    { id: 'm5', nome: 'Lucas Alves', telefone: '73 99999-0005', funcao_principal: 'Violão', status: 'ativo', cor_avatar: '#6b21a8', data_entrada: '2020-02-20' },
    { id: 'm6', nome: 'Rute Andrade', telefone: '73 99999-0006', funcao_principal: 'Vocal', status: 'ativo', cor_avatar: '#0f7a3d', data_entrada: '2024-05-12' },
    { id: 'm7', nome: 'Tiago Nunes', telefone: '73 99999-0007', funcao_principal: 'Baixo', status: 'inativo', cor_avatar: '#9a6300', data_entrada: '2019-11-03' },
  ];

  memoria.membros_funcoes = [
    ['m1', 'f1'], ['m1', 'f3'], ['m2', 'f2'], ['m3', 'f4'], ['m3', 'f2'],
    ['m4', 'f6'], ['m5', 'f3'], ['m5', 'f5'], ['m6', 'f2'], ['m7', 'f5'],
  ].map(([membro_id, funcao_id], i) => ({ id: 'mf' + i, membro_id, funcao_id }));

  memoria.louvores = [
    { id: 'l1', nome: 'Deus é Deus', artista: 'Delino Marçal', tom: 'G', ritmo: 'Balada', status: 'ativo' },
    { id: 'l2', nome: 'Nada Além do Sangue', artista: 'Fernandinho', tom: 'D', ritmo: 'Balada', status: 'ativo' },
    { id: 'l3', nome: 'Ousado Amor', artista: 'Isaías Saad', tom: 'A', ritmo: 'Balada', status: 'ativo' },
    { id: 'l4', nome: 'Teu Santo Nome', artista: 'Gabriela Rocha', tom: 'C', ritmo: 'Balada', status: 'ativo' },
    { id: 'l5', nome: 'Lugar Secreto', artista: 'Gabriela Rocha', tom: 'E', ritmo: 'Lenta', status: 'ativo' },
    { id: 'l6', nome: 'Teu Amor Não Falha', artista: 'Nívea Soares', tom: 'G', ritmo: 'Lenta', status: 'ativo' },
  ];

  memoria.cultos = [
    { id: 'c1', tipo: 'Culto da Família', data: mesesAtras(0, hoje()).slice(0, 8) + '01', horario: '19:00', status: 'realizada', observacoes: '' },
    { id: 'c2', tipo: 'Culto de Celebração', data: proximoDomingo, horario: '19:00', status: 'definida', observacoes: 'Tema: fidelidade' },
  ];

  memoria.escalas = [
    { id: 'e1', culto_id: 'c2', membro_id: 'm1', funcao: 'Dirigente' },
    { id: 'e2', culto_id: 'c2', membro_id: 'm2', funcao: 'Vocal' },
    { id: 'e3', culto_id: 'c2', membro_id: 'm3', funcao: 'Teclado' },
    { id: 'e4', culto_id: 'c2', membro_id: 'm4', funcao: 'Bateria' },
    { id: 'e5', culto_id: 'c2', membro_id: 'm5', funcao: 'Violão' },
  ];

  memoria.presencas = [
    { id: 'p1', culto_id: 'c2', membro_id: 'm1', status: 'confirmado' },
    { id: 'p2', culto_id: 'c2', membro_id: 'm2', status: 'pendente' },
    { id: 'p3', culto_id: 'c2', membro_id: 'm3', status: 'pendente' },
    { id: 'p4', culto_id: 'c2', membro_id: 'm4', status: 'pendente' },
    { id: 'p5', culto_id: 'c2', membro_id: 'm5', status: 'recusado' },
  ];

  memoria.culto_louvores = [
    { id: 'cl1', culto_id: 'c2', louvor_id: 'l1', ordem: 1, tom: 'G' },
    { id: 'cl2', culto_id: 'c2', louvor_id: 'l3', ordem: 2, tom: 'A' },
    { id: 'cl3', culto_id: 'c2', louvor_id: 'l5', ordem: 3, tom: 'E' },
  ];

  memoria.ensaios = [
    { id: 'en1', data: proximoDomingo, horario: '15:00', local: 'Templo', observacoes: 'Chegar 15 min antes', culto_id: 'c2' },
  ];
  memoria.ensaio_louvores = [
    { id: 'el1', ensaio_id: 'en1', louvor_id: 'l1' },
    { id: 'el2', ensaio_id: 'en1', louvor_id: 'l3' },
  ];

  memoria.avisos = [
    { id: 'a1', titulo: 'Ensaio geral', texto: 'Todos no templo às 15h, sem atraso.', criado_em: new Date().toISOString(), autor: 'João Pereira' },
  ];

  memoria.usuarios = [
    { id: 'u1', nome: 'Administrador', usuario: 'admin', papel: 'admin', ativo: true, membro_id: null, senha: 'ekklesia' },
    { id: 'u2', nome: 'João Pereira', usuario: 'joao', papel: 'lider', ativo: true, membro_id: 'm1', senha: 'ekklesia' },
    { id: 'u3', nome: 'Maria Santos', usuario: 'maria', papel: 'membro', ativo: true, membro_id: 'm2', senha: 'ekklesia' },
  ];

  memoria.indisponibilidades = [];
  memoria.sugestoes_louvores = [];

  salvar();
}

/* Entrada no modo aparelho: sem servidor, a conferência é aqui mesmo.
   A senha fica em texto no próprio celular — o que é aceitável porque
   ela só destrava este aparelho e não abre dado de igreja nenhuma. */
export async function entrarNoAparelho(nomeOuLogin, senha) {
  const chave = chaveNome(nomeOuLogin);
  const ativos = (memoria.usuarios ?? []).filter((u) => u.ativo !== false);

  const achar = (fn) => ativos.filter(fn);
  let candidatos = achar((u) => chaveNome(u.usuario) === chave);
  if (!candidatos.length) candidatos = achar((u) => chaveNome(u.nome) === chave);
  if (!candidatos.length) candidatos = achar((u) => chaveNome(u.nome).split(' ')[0] === chave);

  if (candidatos.length > 1) throw new Error('Há mais de uma pessoa com esse nome. Digite o nome completo.');
  const pessoa = candidatos[0];
  /* Uma resposta só para nome errado e senha errada. */
  if (!pessoa || String(pessoa.senha) !== String(senha)) {
    throw new Error('Nome ou senha incorretos. Confira com a liderança como você está cadastrado.');
  }
  return { nome: pessoa.nome, usuario: pessoa.usuario, papel: pessoa.papel, membro_id: pessoa.membro_id ?? null };
}
