/**
 * Sigla do tribunal a partir do numero unico CNJ - para exibicao.
 *
 * Formato (Resolucao CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
 *   J  segmento do Judiciario (1 digito)
 *   TR tribunal dentro do segmento (2 digitos)
 *
 * Esta e a versao de interface: so traduz o numero em rotulo. Nao valida o
 * digito verificador e nao resolve o indice do DataJud - isso e trabalho do
 * backend, em src/lib/tribunais.ts, e continua sendo a fonte de verdade para
 * qualquer decisao. Aqui e rotulo de tela; se o numero vier torto, devolve
 * null e a linha aparece sem etiqueta em vez de quebrar a lista.
 */

const UF_POR_CODIGO: Record<string, string> = {
  '01': 'AC', '02': 'AL', '03': 'AP', '04': 'AM', '05': 'BA', '06': 'CE',
  '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA', '11': 'MT', '12': 'MS',
  '13': 'MG', '14': 'PA', '15': 'PB', '16': 'PR', '17': 'PE', '18': 'PI',
  '19': 'RJ', '20': 'RN', '21': 'RS', '22': 'RO', '23': 'RR', '24': 'SC',
  '25': 'SE', '26': 'SP', '27': 'TO',
};

/**
 * Extrai J e TR de um CNJ com ou sem mascara.
 * Aceita "1001234-56.2026.8.26.0100" e "10012345620268260100".
 */
function segmentos(cnj: string): { j: string; tr: string } | null {
  const digitos = (cnj ?? '').replace(/\D/g, '');
  if (digitos.length !== 20) return null;
  return { j: digitos.slice(13, 14), tr: digitos.slice(14, 16) };
}

/** Ex.: "TJSP", "TRT2", "TRF3", "TRE-SP", "STJ". Null se o numero nao servir. */
export function siglaTribunal(cnj: string): string | null {
  const s = segmentos(cnj);
  if (!s) return null;

  const { j, tr } = s;
  const uf = UF_POR_CODIGO[tr];
  const numero = String(Number(tr));

  switch (j) {
    case '1':
      return 'STF';
    case '2':
      return 'CNJ';
    case '3':
      return 'STJ';
    case '4':
      return `TRF${numero}`;
    case '5':
      return `TRT${numero}`;
    case '6':
      return uf ? `TRE-${uf}` : 'TRE';
    case '7':
      return 'STM';
    case '8':
      return uf ? `TJ${uf}` : null;
    case '9':
      return uf ? `TJM-${uf}` : null;
    default:
      return null;
  }
}

/** Aplica a mascara NNNNNNN-DD.AAAA.J.TR.OOOO. Devolve a entrada se nao der. */
export function formatarCnj(cnj: string): string {
  const d = (cnj ?? '').replace(/\D/g, '');
  if (d.length !== 20) return cnj ?? '';
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}`;
}
