import { defineConfig } from 'vite';

/* O Capacitor empacota o que estiver em www/, então é para lá que o build vai.
   base relativo: dentro do APK as páginas são servidas de file://, e caminho
   absoluto quebraria tudo. */
export default defineConfig({
  base: './',
  build: {
    outDir: 'www',
    emptyOutDir: true,
    // O aplicativo é pequeno e roda em celular com internet ruim: um pedaço
    // só evita a espera de vários arquivos em sequência.
    rollupOptions: { output: { manualChunks: undefined } },
  },
  server: { port: 5173 },
});
