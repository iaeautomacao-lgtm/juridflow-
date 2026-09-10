/**
 * Resolucao de tribunal a partir do numero unico CNJ.
 *
 * Formato (Resolucao CNJ 65/2008): NNNNNNN-DD.AAAA.J.TR.OOOO
 *   NNNNNNN sequencial   DD digito verificador   AAAA ano
 *   J  segmento do Judiciario (1 digito)
 *   TR tribunal dentro do segmento (2 digitos)
 *   OOOO unidade de origem
 *
 * O alias devolvido aqui e o sufixo do indice publico do DataJud:
 * https://api-publica.datajud.cnj.jus.br/api_publica_<alias>/_search
 */

export interface ProcessoCnjDecomposto {
  numero: string;
  sequencial: string;
  digito: string;
  ano: number;
  segmento: string;
  tribunal: string;
  origem: string;
  /** Alias do indice DataJud, ex.: "tjsp", "trf3", "trt2". */
  alias: string;
  /** Sigla de exibicao, ex.: "TJSP". */
  sigla: string;
  uf: string | null;
  nomeSegmento: string;
}

const UF_POR_CODIGO_ESTADUAL: Record<string, string> = {
  '01': 'AC', '02': 'AL', '03': 'AP', '04': 'AM', '05': 'BA', '06': 'CE',
  '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA', '11': 'MT', '12': 'MS',
  '13': 'MG', '14': 'PA', '15': 'PB', '16': 'PR', '17': 'PE', '18': 'PI',
  '19': 'RJ', '20': 'RN', '21': 'RS', '22': 'RO', '23': 'RR', '24': 'SC',
  '25': 'SE', '26': 'SP', '27': 'TO',
};

const NOME_SEGMENTO: Record<string, string> = {
  '1': 'Supremo Tribunal Federal',
  '2': 'Conselho Nacional de Justica',
  '3': 'Superior Tribunal de Justica',
  '4': 'Justica Federal',
  '5': 'Justica do Trabalho',
  '6': 'Justica Eleitoral',
  '7': 'Justica Militar da Uniao',
  '8': 'Justica dos Estados e do Distrito Federal',
  '9': 'Justica Militar Estadual',
};

export class CnjInvalidoError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'CnjInvalidoError';
  }
}

/**
 * Digito verificador do numero CNJ (modulo 97 base 10, norma ISO 7064).
 * Sequencia de validacao: NNNNNNN AAAA J TR OOOO DD, resto tem de ser 1.
 */
export function digitoVerificadorValido(digitos: string): boolean {
  if (digitos.length !== 20) return false;

  const sequencial = digitos.slice(0, 7);
  const digito = digitos.slice(7, 9);
  const ano = digitos.slice(9, 13);
  const segmento = digitos.slice(13, 14);
  const tribunal = digitos.slice(14, 16);
  const origem = digitos.slice(16, 20);

  const base = `${sequencial}${ano}${segmento}${tribunal}${origem}${digito}`;

  // Modulo 97 em blocos, para nao estourar o Number.
  let resto = 0;
  for (const caractere of base) {
    resto = (resto * 10 + Number(caractere)) % 97;
  }
  return resto === 1;
}

/**
 * Decompoe o numero CNJ e resolve o tribunal.
 *
 * `validarDigito` em true rejeita numero com digito verificador errado - use
 * quando o numero vem de digitacao manual. Para numero vindo de API oficial,
 * deixe false: alguns processos antigos migrados tem digito inconsistente.
 */
export function decomporCnj(
  cnj: string,
  opcoes: { validarDigito?: boolean } = {}
): ProcessoCnjDecomposto {
  const digitos = String(cnj ?? '').replace(/\D/g, '');

  if (digitos.length !== 20) {
    throw new CnjInvalidoError(
      `Numero CNJ deve ter 20 digitos, recebido ${digitos.length}. ` +
        'Formato esperado: NNNNNNN-DD.AAAA.J.TR.OOOO'
    );
  }

  if (opcoes.validarDigito && !digitoVerificadorValido(digitos)) {
    throw new CnjInvalidoError(`Digito verificador invalido para o numero ${cnj}.`);
  }

  const sequencial = digitos.slice(0, 7);
  const digito = digitos.slice(7, 9);
  const ano = Number(digitos.slice(9, 13));
  const segmento = digitos.slice(13, 14);
  const tribunal = digitos.slice(14, 16);
  const origem = digitos.slice(16, 20);

  const { alias, sigla, uf } = resolverIndice(segmento, tribunal);

  return {
    numero: formatarCnj(digitos),
    sequencial,
    digito,
    ano,
    segmento,
    tribunal,
    origem,
    alias,
    sigla,
    uf,
    nomeSegmento: NOME_SEGMENTO[segmento] ?? 'Segmento desconhecido',
  };
}

function resolverIndice(
  segmento: string,
  tribunal: string
): { alias: string; sigla: string; uf: string | null } {
  switch (segmento) {
    case '1':
      return { alias: 'stf', sigla: 'STF', uf: null };

    case '3':
      return { alias: 'stj', sigla: 'STJ', uf: null };

    case '4': {
      // Justica Federal: TR 01..06 -> TRF1..TRF6
      const n = Number(tribunal);
      if (n < 1 || n > 6) {
        throw new CnjInvalidoError(`Tribunal Regional Federal desconhecido: codigo ${tribunal}.`);
      }
      return { alias: `trf${n}`, sigla: `TRF${n}`, uf: null };
    }

    case '5': {
      // Justica do Trabalho: TR 00 -> TST, 01..24 -> TRT1..TRT24
      const n = Number(tribunal);
      if (n === 0) return { alias: 'tst', sigla: 'TST', uf: null };
      if (n < 1 || n > 24) {
        throw new CnjInvalidoError(`Tribunal Regional do Trabalho desconhecido: codigo ${tribunal}.`);
      }
      return { alias: `trt${n}`, sigla: `TRT${n}`, uf: null };
    }

    case '6': {
      // Justica Eleitoral: TR 00 -> TSE, senao codigo de UF -> TRE-UF
      if (Number(tribunal) === 0) return { alias: 'tse', sigla: 'TSE', uf: null };
      const uf = UF_POR_CODIGO_ESTADUAL[tribunal];
      if (!uf) {
        throw new CnjInvalidoError(`Tribunal Regional Eleitoral desconhecido: codigo ${tribunal}.`);
      }
      return { alias: `tre-${uf.toLowerCase()}`, sigla: `TRE-${uf}`, uf };
    }

    case '7':
      return { alias: 'stm', sigla: 'STM', uf: null };

    case '8': {
      const uf = UF_POR_CODIGO_ESTADUAL[tribunal];
      if (!uf) {
        throw new CnjInvalidoError(`Tribunal de Justica estadual desconhecido: codigo ${tribunal}.`);
      }
      return { alias: `tj${uf.toLowerCase()}`, sigla: `TJ${uf}`, uf };
    }

    case '9': {
      const uf = UF_POR_CODIGO_ESTADUAL[tribunal];
      if (!uf) {
        throw new CnjInvalidoError(`Tribunal de Justica Militar desconhecido: codigo ${tribunal}.`);
      }
      return { alias: `tjm${uf.toLowerCase()}`, sigla: `TJM${uf}`, uf };
    }

    default:
      throw new CnjInvalidoError(
        `Segmento "${segmento}" do numero CNJ nao possui indice publico no DataJud.`
      );
  }
}

export function formatarCnj(entrada: string): string {
  const d = String(entrada ?? '').replace(/\D/g, '');
  if (d.length !== 20) return String(entrada ?? '');
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

export function urlIndiceDataJud(alias: string): string {
  return `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`;
}
