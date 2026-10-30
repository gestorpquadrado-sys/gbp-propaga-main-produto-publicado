/// <reference types="vite/client" />

// Este arquivo não existia, e por isso `import.meta.env` em src/lib/env.ts acusava
// "Property 'env' does not exist on type 'ImportMeta'" no tsc. O Vite só injeta a
// tipagem de import.meta.env por esta referência; o build passava porque o esbuild
// não checa tipo, mas o erro escondia os outros na saída do tsc.
