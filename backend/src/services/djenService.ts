import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { formatarCnj } from '../lib/tribunais';

/**
 * Conector DJEN / API Comunica (CNJ) - intimacoes publicas por OAB/UF.
 *
 * API publica, sem credencial: exige apenas numero de OAB e UF.
 *
 * Politica deste servico: falha de rede, HTTP de erro ou resposta vazia sao
 * propagadas ao chamador. O servico nao gera intimacao para "mostrar algo na
 * tela".
 *
 * A versao anterior tinha um bloco que, quando `comunicacoes.length === 0`,
 * montava uma intimacao com o texto "Fica o advogado intimado para manifestacao
 * nos autos no prazo de 15 dias uteis" no processo 1002345-89.2024.8.26.0100 e
 * a gravava via prisma.intimacao.create. Num escritorio em producao isso e uma
 * intimacao inexistente na worklist, com prazo que ninguem deve.
 */

const URL_BASE = process.env.DJEN_API_URL || 'https://comunica.pje.jus.br/api/v1/comunicacao';
const TIMEOUT_MS = Number.parseInt(process.env.DJEN_TIMEOUT_MS || '20000', 10);
const ITENS_POR_PAGINA = 50;
const MAX_PAGINAS = 20;

export class DjenIndisponivelError extends Error {
  readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'DjenIndisponivelError';
  }
}

export class OabInvalidaError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'OabInvalidaError';
  }
}

export interface ComunicacaoDjen {
  idExterno: string;
  numeroProcesso: string;
  orgao: string;
  texto: string;
  dataDisponibilizacao: string;
  siglaTribunal: string;
  meio: string;
}

const UFS_VALIDAS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'SP', 'TO',
]);

export function parseOabUf(oabUf: string): { numero: string; uf: string } {
  const bruto = String(oabUf ?? '').trim();
  const partes = bruto.split(/[\/\-\s]+/);

  const numero = (partes[0] ?? '').replace(/\D/g, '');
  const uf = (partes[1] ?? '').toUpperCase();

  if (!numero) {
    throw new OabInvalidaError(
      `Numero de OAB nao identificado em "${bruto}". Formato esperado: 123456/SP.`
    );
  }
  if (!UFS_VALIDAS.has(uf)) {
    throw new OabInvalidaError(
      `UF "${uf || '(vazia)'}" invalida em "${bruto}". Formato esperado: 123456/SP.`
    );
  }

  return { numero, uf };
}

async function buscarPagina(
  numeroOab: string,
  uf: string,
  pagina: number
): Promise<ComunicacaoDjen[]> {
  const url = `${URL_BASE}?numeroOab=${encodeURIComponent(numeroOab)}&ufOab=${encodeURIComponent(uf)}&pagina=${pagina}&itensPorPagina=${ITENS_POR_PAGINA}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
  } catch (erro: any) {
    const motivo = erro?.name === 'AbortError' ? `timeout de ${TIMEOUT_MS}ms` : erro?.message;
    throw new DjenIndisponivelError(
      `Nao foi possivel consultar o DJEN (OAB ${numeroOab}/${uf}, pagina ${pagina}): ${motivo}.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new DjenIndisponivelError(
      `DJEN respondeu HTTP ${resposta.status} para a OAB ${numeroOab}/${uf}. ${corpo.slice(0, 300)}`
    );
  }

  const json: any = await resposta.json().catch(() => null);
  const itens: any[] = json?.items ?? json?.data ?? json?.content ?? [];

  if (!Array.isArray(itens)) {
    throw new DjenIndisponivelError(
      'Resposta do DJEN em formato inesperado: nao foi possivel localizar a lista de comunicacoes.'
    );
  }

  return itens
    .map((item: any): ComunicacaoDjen | null => {
      const texto = String(item?.texto ?? item?.textoComunicacao ?? '').trim();
      const numero = String(item?.numero_processo ?? item?.numeroProcesso ?? '').trim();
      const idExterno = String(item?.id ?? item?.hash ?? '').trim();

      // Sem texto ou sem identificador nao ha o que gravar de forma confiavel.
      if (!texto || !idExterno) return null;

      return {
        idExterno,
        numeroProcesso: numero ? formatarCnj(numero) : '',
        orgao: String(item?.nomeOrgao ?? item?.orgao ?? '').trim(),
        texto,
        dataDisponibilizacao: String(
          item?.data_disponibilizacao ?? item?.dataDisponibilizacao ?? ''
        ),
        siglaTribunal: String(item?.siglaTribunal ?? '').trim(),
        meio: String(item?.meio ?? 'Diario de Justica Eletronico Nacional').trim(),
      };
    })
    .filter((c): c is ComunicacaoDjen => c !== null);
}

export interface ResultadoSincronizacaoDjen {
  oab_uf: string;
  capturadas: number;
  novas: number;
  vinculadas: number;
  sem_processo: number;
  paginas_lidas: number;
}

/**
 * Varre o DJEN para uma OAB/UF e grava as intimacoes novas.
 *
 * Deduplicacao pelo id da comunicacao no DJEN, via unique (tenant_id, id_externo).
 * Intimacao cujo CNJ nao existe na base entra com status
 * "processo_nao_localizado" - fica visivel na worklist para o escritorio
 * decidir, em vez de ser descartada em silencio.
 */
export async function sincronizarIntimacoesDJEN(
  tenantId: string,
  oabUf: string
): Promise<ResultadoSincronizacaoDjen> {
  const { numero, uf } = parseOabUf(oabUf);
  const rotulo = `${numero}/${uf}`;

  const comunicacoes: ComunicacaoDjen[] = [];
  let pagina = 1;

  while (pagina <= MAX_PAGINAS) {
    const lote = await buscarPagina(numero, uf, pagina);
    comunicacoes.push(...lote);
    if (lote.length < ITENS_POR_PAGINA) break;
    pagina++;
  }

  let novas = 0;
  let vinculadas = 0;
  let semProcesso = 0;

  for (const item of comunicacoes) {
    const processo = item.numeroProcesso
      ? await prisma.processo.findFirst({
          where: { tenant_id: tenantId, cnj: item.numeroProcesso },
          select: { id: true, cliente: true },
        })
      : null;

    const disponibilizacao = new Date(item.dataDisponibilizacao);
    const dataValida = !Number.isNaN(disponibilizacao.getTime());

    try {
      await prisma.intimacao.create({
        data: {
          tenant_id: tenantId,
          cnj: item.numeroProcesso,
          disponibilizacao: dataValida ? disponibilizacao : new Date(),
          publicacao: dataValida ? disponibilizacao : new Date(),
          orgao: item.orgao || item.siglaTribunal,
          cliente: processo?.cliente ?? '',
          descricao: item.texto,
          status: processo ? 'pendente' : 'processo_nao_localizado',
          oab_uf: rotulo,
          fonte: 'djen',
          id_externo: item.idExterno,
          processo_id: processo?.id ?? null,
        },
      });

      novas++;
      if (processo) vinculadas++;
      else semProcesso++;
    } catch (erro) {
      // P2002 = violacao de unique: a comunicacao ja foi capturada antes.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        continue;
      }
      throw erro;
    }
  }

  return {
    oab_uf: rotulo,
    capturadas: comunicacoes.length,
    novas,
    vinculadas,
    sem_processo: semProcesso,
    paginas_lidas: pagina > MAX_PAGINAS ? MAX_PAGINAS : pagina,
  };
}
