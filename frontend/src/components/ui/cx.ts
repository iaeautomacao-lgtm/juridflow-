/**
 * Junta classes condicionais.
 *
 * Substitui as concatenacoes com template string espalhadas pela interface,
 * que produziam classe " undefined " e espaco duplo quando a condicao era
 * falsa. Sem dependencia nova: clsx nao vale 2 kB para isto.
 */
export function cx(...partes: Array<string | false | null | undefined>): string {
  return partes.filter(Boolean).join(' ');
}
