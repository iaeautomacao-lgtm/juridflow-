import { prisma } from '../lib/prisma';
import { CHAVES_MODULO } from '../lib/modulos';
import { decomporCnj, formatarCnj, urlIndiceDataJud } from '../lib/tribunais';

/**
 * Conector DataJud (CNJ) - API publica de metadados e movimentacoes.
 *
 * Politica deste servico: se a API do CNJ nao responder, ou responder sem o
 * processo, isso e informado ao chamador como erro ou como "nao encontrado".
 * Em nenhuma hipotese o servico inventa processo, movimento, vara ou parte.
 *
 * A versao anterior tinha um bloco de fallback que, quando a chamada falhava,
 * montava um objeto com "4a Vara Civel do Foro Central", valor de causa
 * R$ 50.000 e dois movimentos ficticios, e gravava tudo no banco com
 * prisma.processo.create / andamento.create. Para um escritorio em producao
 * isso significa andamento falso indistinguivel do real na ficha dos autos.
 */

const TIMEOUT_MS = Number.parseInt(process.env.DATAJUD_TIMEOUT_MS || '20000', 10);

export class DataJudIndisponivelError extends Error {
  readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = 'DataJudIndisponivelError';
  }
}

export class ProcessoNaoEncontradoError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'ProcessoNaoEncontradoError';
  }
}

interface MovimentoDataJud {
  codigo: number | null;
  nome: string;
  dataHora: string;
}

interface ProcessoDataJud {
  numeroProcesso: string;
  classe: string;
  sistema: string;
  tribunal: string;
  orgaoJulgador: string;
  dataAjuizamento: string | null;
  movimentos: MovimentoDataJud[];
}

function chaveApi(): string {
  const chave = process.env.DATAJUD_API_KEY;
  if (!chave || !chave.trim()) {
    throw new DataJudIndisponivelError(
      'DATAJUD_API_KEY nao configurada. A chave publica do DataJud e distribuida ' +
        'pelo CNJ em https://datajud-wiki.cnj.jus.br/api-publica/acesso - ' +
        'copie o valor para backend/.env. Veja backend/.env.example.'
    );
  }
  return chave.trim();
}

/** Consulta o indice publico do tribunal correto para o numero informado. */
export async function consultarDataJud(cnj: string): Promise<ProcessoDataJud> {
  const decomposto = decomporCnj(cnj);
  const url = urlIndiceDataJud(decomposto.alias);
  const numeroLimpo = String(cnj).replace(/\D/g, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `APIKey ${chaveApi()}`,
      },
      body: JSON.stringify({
        size: 1,
        query: { match: { numeroProcesso: numeroLimpo } },
      }),
    });
  } catch (erro: any) {
    const motivo = erro?.name === 'AbortError' ? `timeout de ${TIMEOUT_MS}ms` : erro?.message;
    throw new DataJudIndisponivelError(
      `Nao foi possivel consultar o DataJud (${decomposto.sigla}): ${motivo}.`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new DataJudIndisponivelError(
      `DataJud (${decomposto.sigla}) respondeu HTTP ${resposta.status}. ${corpo.slice(0, 300)}`
    );
  }

  const json: any = await resposta.json().catch(() => null);
  const hit = json?.hits?.hits?.[0]?._source;

  if (!hit) {
    throw new ProcessoNaoEncontradoError(
      `Processo ${formatarCnj(cnj)} nao localizado no indice publico do ${decomposto.sigla}. ` +
        'Processo em segredo de justica ou ainda nao replicado no DataJud nao aparece na API publica.'
    );
  }

  const movimentos: MovimentoDataJud[] = Array.isArray(hit.movimentos)
    ? hit.movimentos
        .map((m: any) => ({
          codigo: typeof m?.codigo === 'number' ? m.codigo : null,
          nome: String(m?.nome ?? '').trim(),
          dataHora: String(m?.dataHora ?? ''),
        }))
        .filter((m: MovimentoDataJud) => m.nome !== '' && m.dataHora !== '')
    : [];

  return {
    numeroProcesso: formatarCnj(cnj),
    classe: String(hit.classe?.nome ?? '').trim(),
    sistema: String(hit.sistema?.nome ?? '').trim(),
    tribunal: String(hit.tribunal ?? decomposto.sigla).trim(),
    orgaoJulgador: String(hit.orgaoJulgador?.nome ?? '').trim(),
    dataAjuizamento: hit.dataAjuizamento ? String(hit.dataAjuizamento) : null,
    movimentos,
  };
}

export interface ResultadoSincronizacaoDataJud {
  processoId: string;
  processoCriado: boolean;
  tribunal: string;
  movimentosRecebidos: number;
  movimentosNovos: number;
}

/**
 * Consulta o DataJud e grava o resultado.
 *
 * Cria o Processo quando ele ainda nao existe, usando exclusivamente os campos
 * que a API devolveu. Campo que a API nao trouxe fica vazio - nao e preenchido
 * com valor de exemplo.
 */
export async function consultarEAtualizarDataJud(
  tenantId: string,
  cnj: string
): Promise<ResultadoSincronizacaoDataJud> {
  const dados = await consultarDataJud(cnj);
  const numeroFormatado = dados.numeroProcesso;

  let processo = await prisma.processo.findFirst({
    where: { tenant_id: tenantId, cnj: numeroFormatado },
  });

  let processoCriado = false;

  if (!processo) {
    processo = await prisma.processo.create({
      data: {
        tenant_id: tenantId,
        cnj: numeroFormatado,
        titulo: dados.classe || `Processo ${numeroFormatado}`,
        cliente: '',
        orgao: dados.tribunal,
        instancia: '',
        vara: dados.orgaoJulgador,
        comarca: '',
        status: 'Em Andamento',
        valor_causa: 0,
        partes_json: '[]',
        data_distribuicao: dados.dataAjuizamento ? new Date(dados.dataAjuizamento) : new Date(),
      },
    });
    processoCriado = true;
  } else {
    // Completa apenas campo vazio; nao sobrescreve o que o escritorio digitou.
    const atualizacoes: Record<string, unknown> = {};
    if (!processo.vara && dados.orgaoJulgador) atualizacoes.vara = dados.orgaoJulgador;
    if (!processo.orgao && dados.tribunal) atualizacoes.orgao = dados.tribunal;
    if (Object.keys(atualizacoes).length > 0) {
      processo = await prisma.processo.update({
        where: { id: processo.id },
        data: atualizacoes,
      });
    }
  }

  // Deduplicacao por (vinculo, descricao, data) - o DataJud nao expoe id estavel
  // de movimento, entao a chave natural e o trio.
  const existentes = await prisma.andamento.findMany({
    where: {
      tenant_id: tenantId,
      chave_modulo: CHAVES_MODULO[0],
      codigo_registro_vinculo: processo.id,
      fonte: 'datajud',
    },
    select: { descricao: true, data: true },
  });

  const jaGravados = new Set(
    existentes.map((a) => `${a.descricao}|${a.data.toISOString().slice(0, 10)}`)
  );

  const novos = dados.movimentos.filter((m) => {
    const data = new Date(m.dataHora);
    if (Number.isNaN(data.getTime())) return false;
    return !jaGravados.has(`${m.nome}|${data.toISOString().slice(0, 10)}`);
  });

  if (novos.length > 0) {
    await prisma.andamento.createMany({
      data: novos.map((m) => ({
        tenant_id: tenantId,
        chave_modulo: 'processo',
        codigo_registro_vinculo: processo!.id,
        cnj: numeroFormatado,
        data: new Date(m.dataHora),
        orgao: dados.tribunal,
        tipo: m.codigo !== null ? `Movimento CNJ ${m.codigo}` : 'Movimentacao',
        cliente: processo!.cliente,
        descricao: m.nome,
        fonte: 'datajud',
        lido: false,
      })),
    });
  }

  return {
    processoId: processo.id,
    processoCriado,
    tribunal: dados.tribunal,
    movimentosRecebidos: dados.movimentos.length,
    movimentosNovos: novos.length,
  };
}
