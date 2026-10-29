/**
 * A marca da Pquadrado.
 *
 * Existia um "logo" improvisado repetido em 5 telas: um quadrado com gradiente roxo e
 * o ícone genérico Building2 do lucide dentro. Isto substitui os cinco por um lugar só,
 * usando os arquivos oficiais que vêm do site da agência:
 *   /marca.svg          o símbolo, vetor, para o bloco quadrado
 *   /logo-pquadrado.png o logotipo deitado em branco, para o cabeçalho
 */

export const Simbolo = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <img src="/marca.svg" alt="Pquadrado" className={className} width={100} height={100} />
);

export const Logotipo = ({ className = 'h-7' }: { className?: string }) => (
  <img
    src="/logo-pquadrado.png"
    alt="Pquadrado"
    className={`${className} w-auto`}
    width={300}
    height={68}
  />
);
