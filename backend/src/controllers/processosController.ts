import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { decomporCnj, formatarCnj } from '../lib/tribunais';
import { AuthenticatedRequest } from '../middleware/auth';

function parsePartes(json: string | null): unknown[] {
  try {
    const valor = JSON.parse(json || '[]');
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

export const getProcessos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { status, orgao, busca } = req.query;

    const where: any = { tenant_id: tenantId };
    if (status) where.status = String(status);
    if (orgao) where.orgao = String(orgao);
    if (busca) {
      const q = String(busca);
      where.OR = [
        { cnj: { contains: q } },
        { cliente: { contains: q } },
        { titulo: { contains: q } },
        { vara: { contains: q } },
        { comarca: { contains: q } },
      ];
    }

    const [processos, total] = await Promise.all([
      prisma.processo.findMany({
        where,
        orderBy: { data_distribuicao: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.processo.count({ where }),
    ]);

    // Contagens dos recursos transversais: sem FK, o _count do Prisma nao
    // alcanca. Uma consulta agrupada por vinculo resolve para a pagina toda,
    // em vez de uma consulta por processo.
    const ids = processos.map((proc) => proc.id);
    const [andamentos, tarefas, documentos, intimacoes] = await Promise.all([
      ids.length
        ? prisma.andamento.groupBy({
            by: ['codigo_registro_vinculo'],
            where: {
              tenant_id: tenantId,
              chave_modulo: 'processo',
              codigo_registro_vinculo: { in: ids },
            },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? prisma.tarefa.groupBy({
            by: ['codigo_registro_vinculo'],
            where: {
              tenant_id: tenantId,
              chave_modulo: 'processo',
              codigo_registro_vinculo: { in: ids },
            },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? prisma.documento.groupBy({
            by: ['codigo_registro_vinculo'],
            where: {
              tenant_id: tenantId,
              chave_modulo: 'processo',
              codigo_registro_vinculo: { in: ids },
            },
            _count: { _all: true },
          })
        : [],
      ids.length
        ? prisma.intimacao.groupBy({
            by: ['processo_id'],
            where: { tenant_id: tenantId, processo_id: { in: ids } },
            _count: { _all: true },
          })
        : [],
    ]);

    const contar = (
      linhas: Array<{ _count: { _all: number } } & Record<string, any>>,
      campo: string
    ): Record<string, number> =>
      linhas.reduce<Record<string, number>>((acc, linha) => {
        const chave = linha[campo];
        if (typeof chave === 'string') acc[chave] = linha._count._all;
        return acc;
      }, {});

    const cAndamentos = contar(andamentos as any, 'codigo_registro_vinculo');
    const cTarefas = contar(tarefas as any, 'codigo_registro_vinculo');
    const cDocumentos = contar(documentos as any, 'codigo_registro_vinculo');
    const cIntimacoes = contar(intimacoes as any, 'processo_id');

    const itens = processos.map((proc) => ({
      ...proc,
      partes: parsePartes(proc.partes_json),
      _count: {
        andamentos: cAndamentos[proc.id] ?? 0,
        tarefas: cTarefas[proc.id] ?? 0,
        documentos: cDocumentos[proc.id] ?? 0,
        intimacoes: cIntimacoes[proc.id] ?? 0,
      },
    }));

    return res.json(envelope('processos', itens, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao listar processos');
  }
};

export const createProcesso = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { cnj, titulo, cliente, orgao, instancia, vara, comarca, status, valor_causa, partes } =
      req.body ?? {};

    if (!cnj || !cliente) {
      return res.status(400).json({ message: 'Numero CNJ e cliente sao obrigatorios.' });
    }

    // Valida o numero e deriva o tribunal. Numero digitado errado para aqui,
    // em vez de virar processo com orgao invalido no banco.
    const decomposto = decomporCnj(String(cnj), { validarDigito: true });
    const cnjFormatado = decomposto.numero;

    const duplicado = await prisma.processo.findFirst({
      where: { tenant_id: tenantId, cnj: cnjFormatado },
      select: { id: true },
    });
    if (duplicado) {
      return res.status(409).json({
        message: `O processo ${cnjFormatado} ja esta cadastrado.`,
        processo_id: duplicado.id,
      });
    }

    const novoProcesso = await prisma.processo.create({
      data: {
        tenant_id: tenantId,
        cnj: cnjFormatado,
        titulo: String(titulo ?? '').trim() || `Processo ${cnjFormatado}`,
        cliente: String(cliente).trim(),
        orgao: String(orgao ?? '').trim() || decomposto.sigla,
        instancia: String(instancia ?? '').trim(),
        vara: String(vara ?? '').trim(),
        comarca: String(comarca ?? '').trim(),
        status: String(status ?? '').trim() || 'Em Andamento',
        valor_causa: Number.isFinite(Number(valor_causa)) ? Number(valor_causa) : 0,
        partes_json: JSON.stringify(Array.isArray(partes) ? partes : []),
      },
    });

    await prisma.capturaPush.create({
      data: {
        tenant_id: tenantId,
        cnj: cnjFormatado,
        orgao: novoProcesso.orgao,
        status: 'ativa',
        grau: novoProcesso.instancia || '1o Grau',
        cadastrar_automatico: true,
        capturar_docs: true,
      },
    });

    return res.status(201).json({
      processo: { ...novoProcesso, partes: parsePartes(novoProcesso.partes_json) },
      tribunal: { sigla: decomposto.sigla, uf: decomposto.uf, segmento: decomposto.nomeSegmento },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar processo');
  }
};

/**
 * Ficha dos autos.
 *
 * Os recursos transversais vem por consulta ao par (chave_modulo, id) em vez
 * de include do Prisma, que nao existe mais para eles.
 */
export const getProcessoById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    const processo = await prisma.processo.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!processo) {
      return res.status(404).json({ message: 'Processo nao encontrado.' });
    }

    const vinculo = {
      tenant_id: tenantId,
      chave_modulo: 'processo',
      codigo_registro_vinculo: processo.id,
    };

    const [andamentos, tarefas, documentos, financeiro, intimacoes] = await Promise.all([
      prisma.andamento.findMany({ where: vinculo, orderBy: { data: 'desc' }, take: 200 }),
      prisma.tarefa.findMany({ where: vinculo, orderBy: { vencimento: 'asc' }, take: 200 }),
      prisma.documento.findMany({ where: vinculo, orderBy: { criado_em: 'desc' }, take: 200 }),
      prisma.financeiro.findMany({
        where: vinculo,
        orderBy: { data_vencimento: 'desc' },
        take: 200,
      }),
      prisma.intimacao.findMany({
        where: { tenant_id: tenantId, processo_id: processo.id },
        orderBy: { disponibilizacao: 'desc' },
        take: 200,
      }),
    ]);

    let tribunal: Record<string, unknown> | null = null;
    try {
      const d = decomporCnj(processo.cnj);
      tribunal = { sigla: d.sigla, uf: d.uf, segmento: d.nomeSegmento, alias_datajud: d.alias };
    } catch {
      tribunal = null;
    }

    return res.json({
      processo: {
        ...processo,
        partes: parsePartes(processo.partes_json),
        tribunal,
        andamentos,
        tarefas,
        documentos,
        financeiro,
        intimacoes,
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao detalhar processo');
  }
};

/** Linha do tempo consolidada da ficha dos autos. */
export const getLinhaDoTempo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    const processo = await prisma.processo.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true, cnj: true },
    });
    if (!processo) {
      return res.status(404).json({ message: 'Processo nao encontrado.' });
    }

    const vinculo = {
      tenant_id: tenantId,
      chave_modulo: 'processo',
      codigo_registro_vinculo: processo.id,
    };

    const [andamentos, intimacoes, tarefas] = await Promise.all([
      prisma.andamento.findMany({ where: vinculo, orderBy: { data: 'desc' }, take: 300 }),
      prisma.intimacao.findMany({
        where: { tenant_id: tenantId, processo_id: processo.id },
        orderBy: { disponibilizacao: 'desc' },
        take: 300,
      }),
      prisma.tarefa.findMany({ where: vinculo, orderBy: { vencimento: 'desc' }, take: 300 }),
    ]);

    const eventos = [
      ...andamentos.map((a) => ({
        tipo: 'andamento' as const,
        id: a.id,
        data: a.data,
        titulo: a.tipo,
        descricao: a.descricao,
        fonte: a.fonte,
      })),
      ...intimacoes.map((i) => ({
        tipo: 'intimacao' as const,
        id: i.id,
        data: i.disponibilizacao,
        titulo: `Intimacao - ${i.orgao}`,
        descricao: i.descricao,
        fonte: i.fonte,
      })),
      ...tarefas.map((t) => ({
        tipo: 'tarefa' as const,
        id: t.id,
        data: t.vencimento,
        titulo: t.titulo,
        descricao: t.descricao ?? '',
        fonte: 'manual',
      })),
    ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return res.json({ processo_id: processo.id, cnj: processo.cnj, eventos, total: eventos.length });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao montar linha do tempo');
  }
};

/**
 * Busca no DataJud para pre-preenchimento de cadastro.
 * Nao grava nada: apenas devolve o que a API oficial informou.
 */
export const consultarCnjParaCadastro = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cnj = String(req.query.cnj ?? req.params.cnj ?? '');
    if (!cnj) {
      return res.status(400).json({ message: 'Informe o numero CNJ.' });
    }

    const { consultarDataJud } = await import('../services/datajudService');
    const dados = await consultarDataJud(cnj);
    const decomposto = decomporCnj(cnj);

    return res.json({
      encontrado: true,
      cnj: formatarCnj(cnj),
      tribunal: { sigla: decomposto.sigla, uf: decomposto.uf, segmento: decomposto.nomeSegmento },
      sugestao: {
        titulo: dados.classe,
        orgao: dados.tribunal,
        vara: dados.orgaoJulgador,
        sistema: dados.sistema,
        data_distribuicao: dados.dataAjuizamento,
      },
      total_movimentos: dados.movimentos.length,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao consultar processo no DataJud');
  }
};
