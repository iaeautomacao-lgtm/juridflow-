/**
 * Calendario forense brasileiro - parte calculavel.
 *
 * Este arquivo cobre o que e regra de lei e portanto igual todo ano:
 *   - feriados nacionais fixos (Lei 662/1949, Lei 6.802/1980, Lei 10.607/2002,
 *     Lei 14.759/2023)
 *   - feriados nacionais moveis, derivados da Pascoa
 *   - recesso forense do art. 220 do CPC/2015
 *   - sabado e domingo (art. 216 do CPC)
 *
 * O que varia por escritorio - feriado estadual, municipal e suspensao de
 * expediente de tribunal especifico - vive na tabela Feriado do banco, porque
 * nao ha regra fechada: depende da comarca e do tribunal.
 *
 * Todas as datas sao tratadas em UTC a meia-noite, para que o resultado nao
 * mude com o fuso do servidor.
 */

/** Chave canonica de um dia: "YYYY-MM-DD". */
export type ChaveDia = string;

export function chaveDia(data: Date): ChaveDia {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Normaliza qualquer Date/string para meia-noite UTC do mesmo dia civil. */
export function normalizarDia(entrada: Date | string): Date {
  if (typeof entrada === 'string') {
    const soData = /^(\d{4})-(\d{2})-(\d{2})/.exec(entrada);
    if (soData) {
      return new Date(
        Date.UTC(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
      );
    }
  }
  const d = new Date(entrada);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Data invalida: ${String(entrada)}`);
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function somarDias(data: Date, dias: number): Date {
  return new Date(data.getTime() + dias * 86400000);
}

/**
 * Domingo de Pascoa pelo algoritmo gregoriano de Meeus/Jones/Butcher.
 * Deterministico, sem tabela: vale para qualquer ano do calendario gregoriano.
 */
export function domingoDePascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marco, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export interface FeriadoNacional {
  chave: ChaveDia;
  nome: string;
  movel: boolean;
}

/** Feriados nacionais de um ano, fixos e moveis. */
export function feriadosNacionais(ano: number): FeriadoNacional[] {
  const pascoa = domingoDePascoa(ano);

  const fixos: Array<[number, number, string]> = [
    [1, 1, 'Confraternizacao Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independencia do Brasil'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamacao da Republica'],
    [12, 25, 'Natal'],
  ];

  // Feriado nacional a partir da Lei 14.759/2023.
  if (ano >= 2024) {
    fixos.push([11, 20, 'Dia Nacional de Zumbi e da Consciencia Negra']);
  }

  const lista: FeriadoNacional[] = fixos.map(([mes, dia, nome]) => ({
    chave: chaveDia(new Date(Date.UTC(ano, mes - 1, dia))),
    nome,
    movel: false,
  }));

  const moveis: Array<[number, string]> = [
    [-48, 'Carnaval (segunda)'],
    [-47, 'Carnaval (terca)'],
    [-2, 'Sexta-feira Santa'],
    [60, 'Corpus Christi'],
  ];

  for (const [deslocamento, nome] of moveis) {
    lista.push({ chave: chaveDia(somarDias(pascoa, deslocamento)), nome, movel: true });
  }

  return lista;
}

/**
 * Recesso forense - art. 220 do CPC/2015: "Suspende-se o curso do prazo
 * processual nos dias compreendidos entre 20 de dezembro e 20 de janeiro,
 * inclusive."
 *
 * Os dois extremos entram no intervalo.
 */
export function emRecessoForense(data: Date): boolean {
  const mes = data.getUTCMonth() + 1;
  const dia = data.getUTCDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}

export function ehFimDeSemana(data: Date): boolean {
  const d = data.getUTCDay();
  return d === 0 || d === 6;
}

export interface FeriadoExtra {
  data: Date | string;
  nome: string;
}

export interface MotivoNaoUtil {
  chave: ChaveDia;
  motivo: string;
}

/**
 * Conjunto de dias nao uteis para uma faixa de anos.
 *
 * `extras` recebe as linhas da tabela Feriado (estadual, municipal, forense),
 * que este arquivo nao tem como calcular.
 */
export class CalendarioForense {
  private readonly naoUteis = new Map<ChaveDia, string>();

  constructor(anoInicial: number, anoFinal: number, extras: FeriadoExtra[] = []) {
    for (let ano = anoInicial - 1; ano <= anoFinal + 1; ano++) {
      for (const f of feriadosNacionais(ano)) {
        this.naoUteis.set(f.chave, f.nome);
      }
    }
    for (const extra of extras) {
      this.naoUteis.set(chaveDia(normalizarDia(extra.data)), extra.nome);
    }
  }

  /** Retorna o motivo de o dia nao ser util, ou null se for dia util. */
  motivo(data: Date): string | null {
    if (ehFimDeSemana(data)) {
      return data.getUTCDay() === 0 ? 'Domingo' : 'Sabado';
    }
    if (emRecessoForense(data)) {
      return 'Recesso forense (art. 220 do CPC)';
    }
    return this.naoUteis.get(chaveDia(data)) ?? null;
  }

  ehDiaUtil(data: Date): boolean {
    return this.motivo(data) === null;
  }

  /** Primeiro dia util em `data` ou depois (protracao do art. 224, par. 1). */
  proximoDiaUtilInclusivo(data: Date): Date {
    let cursor = normalizarDia(data);
    let guarda = 0;
    while (!this.ehDiaUtil(cursor)) {
      cursor = somarDias(cursor, 1);
      if (++guarda > 400) {
        throw new Error('Nao foi possivel encontrar dia util: calendario inconsistente.');
      }
    }
    return cursor;
  }

  /** Primeiro dia util estritamente depois de `data`. */
  proximoDiaUtilExclusivo(data: Date): Date {
    return this.proximoDiaUtilInclusivo(somarDias(normalizarDia(data), 1));
  }
}
