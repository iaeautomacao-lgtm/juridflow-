import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { calcularPrazo, coberturaCalendario } from '../services/prazoService';
import { AuthenticatedRequest } from '../middleware/auth';

export const getIntimacoes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { status, oab, busca } = req.query;

    const where: any = { tenant_id: tenantId };
    if (status) where.status = String(status);
    if (oab) where.oab_uf = String(oab);
    if (busca) {
      const q = String(busca);
      where.OR = [
        { cnj: { contains: q } },
        { cliente: { contains: q } },
        { descricao: { contains: q } },
        { orgao: { contains: q } },
      ];
    }

    const [intimacoes, total, porStatus] = await Promise.all([
      prisma.intimacao.findMany({
        where,
        orderBy: { disponibilizacao: 'desc' },
        take: p.take,
        skip: p.skip,
        include: {
          processo: { select: { id: true, cnj: true, titulo: true, cliente: true, vara: true } },
        },
      }),
      prisma.intimacao.count({ where }),
      prisma.intimacao.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: { _all: true },
      }),
    ]);

    return res.json({
      ...envelope('intimacoes', intimacoes, total, p),
      total_por_status: porStatus.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = s._count._all;
        return acc;
      }, {}),
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar intimacoes');
  }
};

/**
 * Vincula a intimacao a um processo e, opcionalmente, abre a tarefa de prazo.
 *
 * Diferenca em relacao a versao anterior: nao cria processo do nada. Se o CNJ
 * da intimacao nao existe na base, responde 409 com o CNJ e pede que o
 * escritorio cadastre ou informe o processo - criar processo com vara
 * "Juizo Origem" e instancia "1a Instancia" inventava dado de autos.
 *
 * Quando `criar_tarefa` vem com `dias_prazo`, o vencimento e calculado pelo
 * calendario forense (art. 219, 220 e 224 do CPC), nao por "+5 dias".
 */
export const vincularIntimacao = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const {
      processo_id,
      criar_tarefa,
      titulo_tarefa,
      dias_prazo,
      tipo_dias,
      responsavel_nome,
    } = req.body ?? {};

    const intimacao = await prisma.intimacao.findFirst({ where: { id, tenant_id: tenantId } });
    if (!intimacao) {
      return res.status(404).json({ message: 'Intimacao nao encontrada.' });
    }

    let processo = processo_id
      ? await prisma.processo.findFirst({
          where: { id: String(processo_id), tenant_id: tenantId },
        })
      : await prisma.processo.findFirst({
          where: { tenant_id: tenantId, cnj: intimacao.cnj },
        });

    if (!processo) {
      return res.status(409).json({
        message:
          `O processo ${intimacao.cnj || '(sem numero na intimacao)'} nao esta cadastrado. ` +
          'Cadastre o processo ou informe processo_id para vincular.',
        codigo: 'PROCESSO_NAO_CADASTRADO',
        cnj: intimacao.cnj,
      });
    }

    const intimacaoAtualizada = await prisma.intimacao.update({
      where: { id },
      data: { processo_id: processo.id, status: 'vinculado' },
    });

    let novaTarefa = null;
    let prazoCalculado = null;
    let avisoCalendario: string | null = null;

    if (criar_tarefa) {
      const dias = Number.parseInt(String(dias_prazo ?? ''), 10);
      if (!Number.isInteger(dias) || dias <= 0) {
        return res.status(400).json({
          message:
            'Para abrir a tarefa de prazo informe dias_prazo (inteiro positivo). ' +
            'Sem o numero de dias nao ha como calcular o vencimento.',
        });
      }

      prazoCalculado = await calcularPrazo({
        tenantId,
        disponibilizacao: intimacao.disponibilizacao,
        dias,
        tipoDias: tipo_dias === 'corridos' ? 'corridos' : 'uteis',
        orgao: processo.orgao,
        municipio: processo.comarca || undefined,
      });

      const cobertura = await coberturaCalendario(
        tenantId,
        new Date(prazoCalculado.vencimento).getUTCFullYear()
      );
      avisoCalendario = cobertura.aviso;

      novaTarefa = await prisma.tarefa.create({
        data: {
          tenant_id: tenantId,
          chave_modulo: 'processo',
          codigo_registro_vinculo: processo.id,
          titulo:
            String(titulo_tarefa ?? '').trim() || `Cumprir intimacao - ${processo.cnj}`,
          descricao: intimacao.descricao,
          tipo: 'Prazo',
          vencimento: new Date(`${prazoCalculado.vencimento}T00:00:00.000Z`),
          prazo_fatal: new Date(`${prazoCalculado.vencimento}T00:00:00.000Z`),
          prioridade: 'alta',
          status: 'a_fazer',
          responsavel_id: req.user!.id,
          responsavel_nome: String(responsavel_nome ?? '').trim() || req.user!.nome,
        },
      });
    }

    return res.json({
      message: 'Intimacao vinculada com sucesso.',
      intimacao: intimacaoAtualizada,
      processo: { id: processo.id, cnj: processo.cnj, titulo: processo.titulo },
      tarefa: novaTarefa,
      prazo: prazoCalculado,
      aviso_calendario: avisoCalendario,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao vincular intimacao');
  }
};

export const arquivarIntimacao = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    const intimacao = await prisma.intimacao.findFirst({ where: { id, tenant_id: tenantId } });
    if (!intimacao) {
      return res.status(404).json({ message: 'Intimacao nao encontrada.' });
    }

    const atualizada = await prisma.intimacao.update({
      where: { id },
      data: { status: 'arquivado' },
    });

    return res.json({ intimacao: atualizada });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao arquivar intimacao');
  }
};

export const getFranquiaIntimacoes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const franquias = await prisma.franquiaCaptura.findMany({
      where: { tenant_id: tenantId },
      orderBy: { criado_em: 'desc' },
    });

    return res.json({ franquias, total: franquias.length });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao consultar franquia de captura');
  }
};
