/* ============================================================
   Ícones — traço aberto, 24×24, herdando a cor do texto
   ============================================================ */
const traco = (miolo) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${miolo}</svg>`;

export const IC = {
  painel: traco('<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  escalas: traco('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>'),
  louvores: traco('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
  membros: traco('<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 5.2a3.4 3.4 0 010 5.6M18 14.4a6.5 6.5 0 013.5 5.6"/>'),
  ensaios: traco('<path d="M12 3v10.6"/><circle cx="9.5" cy="16" r="3"/><path d="M12 6l5-2v3l-5 2"/><path d="M3 20h18"/>'),
  relatorios: traco('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  avisos: traco('<path d="M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 20a2 2 0 003 0"/>'),
  perfil: traco('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0115 0"/>'),
  usuarios: traco('<circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0114 0"/><path d="M19 3l2 2-2 2"/>'),
  config: traco('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
  sair: traco('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>'),
  editar: traco('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>'),
  excluir: traco('<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>'),
  chave: traco('<circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13L20 3M17 6l3 3M14.5 8.5l3 3"/>'),
  atualizar: traco('<path d="M21 3v6h-6M3 12a9 9 0 0115-6.7L21 8M3 21v-6h6M21 12a9 9 0 01-15 6.7L3 16"/>'),
  sol: traco('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  lua: traco('<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'),
  olho: traco('<path d="M1.8 12S5.2 5.8 12 5.8 22.2 12 22.2 12 18.8 18.2 12 18.2 1.8 12 1.8 12z"/><circle cx="12" cy="12" r="3"/>'),
  olhoRiscado: traco('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.5 9.5 0 0112 6c6.8 0 10.2 6 10.2 6a17 17 0 01-3.6 4.3M6.6 7.7A17 17 0 001.8 12S5.2 18 12 18c1.3 0 2.4-.2 3.4-.6"/>'),
  vazio: traco('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 017 0M9 9.5h.01M15 9.5h.01"/>'),
  aviso: traco('<path d="M12 3l9.5 17H2.5z"/><path d="M12 10v4M12 17.5h.01"/>'),
};
