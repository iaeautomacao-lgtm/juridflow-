import { prisma } from '../lib/prisma';
import {
  CalendarioForense,
  FeriadoExtra,
  chaveDia,
  normalizarDia,
  somarDias,
} from '../lib/feriados';

export type TipoDias = 'uteis' | 'corridos';

export interface EntradaCalculoPrazo {
  tenantId: string;
  /** Data em que a comunicacao foi disponibilizada no DJEN. */
  disponibilizacao?: Date | string;
  /** Data de publicacao, quando ja conhecida. Dispensa `disponibilizacao`. */
  publicacao?: Date | string;
  dias: number;
  tipoDias?: TipoDias;
  uf?: string;
  municipio?: string;
  orgao?: string;
}

export interface EtapaPrazo {
  rotulo: string;
  data: string;
  fundamento: string;
}

export interface ResultadoCalculoPrazo {
  disponibilizacao: string | null;
  publicacao: string;
  inicio_contagem: string;
  vencimento: string;
  dias: number;
  tipo_dias: TipoDias;
  dias_nao_uteis_pulados: Array<{ data: string; motivo: string }>;
  etapas: EtapaPrazo[];
  fundamento_legal: string[];
}

/**
 * Carrega os feriados da tabela (estadual, municipal, forense) que se aplicam
 * ao tenant e ao recorte geografico informado.
 *
 * Linhas com tenant_id null valem para todos os tenants.
 */
async function carregarFeriadosExtras(
  tenantId: string,
  anoInicial: number,
  anoFinal: number,
  filtro: { uf?: string; municipio?: string; orgao?: string }
): Promise<FeriadoExtra[]> {
  const linhas = await prisma.feriado.findMany({
    where: {
      OR: [{ tenant_id: tenantId }, { tenant_id: null }],
      data: {
        gte: new Date(Date.UTC(anoInicial - 1, 0, 1)),
        lte: new Date(Date.UTC(anoFinal + 1, 11, 31)),
      },
    },
    select: { data: true, nome: true, abrangencia: true, uf: true, municipio: true, orgao: true },
  });

  return linhas
    .filter((f) => {
      // Feriado estadual so vale se a UF bater (ou se a linha nao restringe UF).
      if (f.abrangencia === 'estadual' && f.uf && filtro.uf && f.uf !== filtro.uf) return false;
      if (
        f.abrangencia === 'municipal' &&
        f.municipio &&
        filtro.municipio &&
        f.municipio !== filtro.municipio
      ) {
        return false;
      }
      if (f.abrangencia === 'forense' && f.orgao && filtro.orgao && f.orgao !== filtro.orgao) {
        return false;
      }
      return true;
    })
    .map((f) => ({ data: f.data, nome: f.nome }));
}

/**
 * Calcula prazo processual conforme o CPC/2015.
 *
 * Cadeia aplicada:
 *   1. publicacao = 1o dia util seguinte a disponibilizacao  (art. 224, par. 2)
 *   2. inicio da contagem = 1o dia util seguinte a publicacao (art. 224, par. 3)
 *   3. contagem em dias uteis, quando prazo processual          (art. 219)
 *   4. vencimento protraido ao proximo dia util, se cair em dia sem expediente
 *                                                              (art. 224, par. 1)
 *
 * Dias nao uteis considerados: sabado, domingo (art. 216), feriado nacional,
 * recesso de 20/12 a 20/01 (art. 220) e os feriados estaduais, municipais e
 * forenses cadastrados na tabela Feriado.
 */
export async function calcularPrazo(
  entrada: EntradaCalculoPrazo
): Promise<ResultadoCalculoPrazo> {
  const { tenantId, dias, uf, municipio, orgao } = entrada;
  const tipoDias: TipoDias = entrada.tipoDias === 'corridos' ? 'corridos' : 'uteis';

  if (!Number.isInteger(dias) || dias <= 0) {
    throw new PrazoInvalidoError('A quantidade de dias do prazo deve ser um inteiro positivo.');
  }
  if (dias > 3650) {
    throw new PrazoInvalidoError('Prazo acima de 3650 dias nao e suportado.');
  }
  if (!entrada.disponibilizacao && !entrada.publicacao) {
    throw new PrazoInvalidoError(
      'Informe a data de disponibilizacao no DJEN ou a data de publicacao.'
    );
  }

  const baseInformada = normalizarDia(
    (entrada.publicacao ?? entrada.disponibilizacao) as Date | string
  );
  const anoInicial = baseInformada.getUTCFullYear();
  const anoFinal = anoInicial + Math.ceil(dias / 200) + 1;

  const extras = await carregarFeriadosExtras(tenantId, anoInicial, anoFinal, {
    uf,
    municipio,
    orgao,
  });
  const calendario = new CalendarioForense(anoInicial, anoFinal, extras);

  const etapas: EtapaPrazo[] = [];
  const pulados: Array<{ data: string; motivo: string }> = [];

  // Etapa 1 - publicacao
  let publicacao: Date;
  if (entrada.publicacao) {
    publicacao = normalizarDia(entrada.publicacao);
    etapas.push({
      rotulo: 'Publicacao',
      data: chaveDia(publicacao),
      fundamento: 'Data de publicacao informada pelo usuario.',
    });
  } else {
    const disp = normalizarDia(entrada.disponibilizacao as Date | string);
    publicacao = calendario.proximoDiaUtilExclusivo(disp);
    etapas.push({
      rotulo: 'Disponibilizacao no DJEN',
      data: chaveDia(disp),
      fundamento: 'Data em que a comunicacao foi disponibilizada.',
    });
    etapas.push({
      rotulo: 'Publicacao',
      data: chaveDia(publicacao),
      fundamento: 'Primeiro dia util seguinte a disponibilizacao (art. 224, par. 2, do CPC).',
    });
  }

  // Etapa 2 - termo inicial
  const inicioContagem = calendario.proximoDiaUtilExclusivo(publicacao);
  etapas.push({
    rotulo: 'Inicio da contagem',
    data: chaveDia(inicioContagem),
    fundamento: 'Primeiro dia util seguinte a publicacao (art. 224, par. 3, do CPC).',
  });

  // Etapa 3 - contagem
  let vencimento: Date;

  if (tipoDias === 'uteis') {
    let cursor = inicioContagem;
    let contados = 1; // o proprio termo inicial e o dia 1
    let guarda = 0;

    while (contados < dias) {
      cursor = somarDias(cursor, 1);
      const motivo = calendario.motivo(cursor);
      if (motivo) {
        pulados.push({ data: chaveDia(cursor), motivo });
      } else {
        contados++;
      }
      if (++guarda > dias * 12 + 500) {
        throw new Error('Contagem de prazo nao convergiu: calendario inconsistente.');
      }
    }
    vencimento = cursor;
    etapas.push({
      rotulo: 'Vencimento',
      data: chaveDia(vencimento),
      fundamento: `${dias}o dia util contado a partir do inicio (art. 219 do CPC).`,
    });
  } else {
    // Dias corridos: prazo de direito material. Nao se aplica o art. 219,
    // mas a protracao do vencimento do art. 224, par. 1, continua valendo.
    const bruto = somarDias(inicioContagem, dias - 1);
    vencimento = calendario.proximoDiaUtilInclusivo(bruto);

    if (chaveDia(vencimento) !== chaveDia(bruto)) {
      etapas.push({
        rotulo: 'Vencimento (bruto)',
        data: chaveDia(bruto),
        fundamento: `${dias}o dia corrido, caiu em ${calendario.motivo(bruto)}.`,
      });
    }
    etapas.push({
      rotulo: 'Vencimento',
      data: chaveDia(vencimento),
      fundamento: 'Protraido ao primeiro dia util (art. 224, par. 1, do CPC).',
    });
  }

  return {
    disponibilizacao: entrada.disponibilizacao
      ? chaveDia(normalizarDia(entrada.disponibilizacao))
      : null,
    publicacao: chaveDia(publicacao),
    inicio_contagem: chaveDia(inicioContagem),
    vencimento: chaveDia(vencimento),
    dias,
    tipo_dias: tipoDias,
    dias_nao_uteis_pulados: pulados,
    etapas,
    fundamento_legal:
      tipoDias === 'uteis'
        ? [
            'CPC/2015 art. 219 - prazos processuais em dias uteis',
            'CPC/2015 art. 216 - sabados, domingos e dias sem expediente forense',
            'CPC/2015 art. 220 - suspensao entre 20/12 e 20/01',
            'CPC/2015 art. 224 - exclusao do dia do comeco e protracao',
          ]
        : [
            'CPC/2015 art. 224, par. 1 - protracao do vencimento ao dia util',
            'Contagem em dias corridos (prazo de direito material)',
          ],
  };
}

/**
 * Verifica se o calendario tem cobertura de feriado local para a UF pedida.
 *
 * Sem feriado estadual/municipal cadastrado, o calculo usa apenas feriado
 * nacional e recesso - o que produz vencimento errado em comarcas com feriado
 * local. Os controllers usam isso para devolver um aviso explicito junto do
 * resultado, em vez de entregar uma data com aparencia de certeza.
 */
export async function coberturaCalendario(
  tenantId: string,
  ano: number,
  uf?: string
): Promise<{ tem_feriado_local: boolean; total_cadastrado: number; aviso: string | null }> {
  const total = await prisma.feriado.count({
    where: {
      OR: [{ tenant_id: tenantId }, { tenant_id: null }],
      data: {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lte: new Date(Date.UTC(ano, 11, 31)),
      },
      ...(uf ? { OR: [{ uf }, { uf: null }] } : {}),
    },
  });

  if (total === 0) {
    return {
      tem_feriado_local: false,
      total_cadastrado: 0,
      aviso:
        `Nenhum feriado local cadastrado para ${ano}` +
        (uf ? ` na UF ${uf}` : '') +
        '. O calculo usou apenas feriados nacionais e o recesso do art. 220. ' +
        'Confira o prazo na secretaria antes de usar como prazo fatal.',
    };
  }

  return { tem_feriado_local: true, total_cadastrado: total, aviso: null };
}

export class PrazoInvalidoError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'PrazoInvalidoError';
  }
}
