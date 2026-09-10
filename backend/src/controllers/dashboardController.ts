import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { AuthenticatedRequest } from '../middleware/auth';

export const getDashboardKpis = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const agora = new Date();
    const podeVerFinanceiro = req.user!.cargo === 'socio' || req.user!.cargo === 'financeiro';

    const [
      totalProcessos,
      processosAtivos,
      intimacoesPendentes,
      intimacoesSemProcesso,
      tarefasPendentes,
      tarefasAtrasadas,
      andamentosNaoLidos,
      atendimentosAbertos,
      franquia,
      certificadosExpirando,
    ] = await Promise.all([
      prisma.processo.count({ where: { tenant_id: tenantId } }),
      prisma.processo.count({
        where: { tenant_id: tenantId, status: { in: ['Em Andamento', 'Ativo'] } },
      }),
      prisma.intimacao.count({ where: { tenant_id: tenantId, status: 'pendente' } }),
      prisma.intimacao.count({
        where: { tenant_id: tenantId, status: 'processo_nao_localizado' },
      }),
      prisma.tarefa.count({
        where: { tenant_id: tenantId, status: { in: ['a_fazer', 'em_andamento'] } },
      }),
      prisma.tarefa.count({
        where: {
          tenant_id: tenantId,
          status: { in: ['a_fazer', 'em_andamento'] },
          vencimento: { lt: agora },
        },
      }),
      prisma.andamento.count({ where: { tenant_id: tenantId, lido: false } }),
      prisma.atendimento.count({
        where: { tenant_id: tenantId, fase: { notIn: ['contrato_assinado', 'perdido'] } },
      }),
      prisma.franquiaCaptura.findFirst({ where: { tenant_id: tenantId } }),
      prisma.certificadoDigital.count({
        where: {
          tenant_id: tenantId,
          validade: { lte: new Date(agora.getTime() + 30 * 86400000) },
        },
      }),
    ]);

    // Bloco financeiro so para socio e financeiro. Advogado e estagiario
    // recebem `financeiro: null` - antes o caixa do escritorio ia no payload
    // do dashboard para qualquer usuario.
    let financeiro: Record<string, number> | null = null;
    if (podeVerFinanceiro) {
      const linhas = await prisma.financeiro.groupBy({
        by: ['tipo_receita_despesa', 'status_pago'],
        where: { tenant_id: tenantId },
        _sum: { valor: true },
      });

      const somar = (tipo: string, pago?: boolean): number =>
        linhas
          .filter(
            (l) => l.tipo_receita_despesa === tipo && (pago === undefined || l.status_pago === pago)
          )
          .reduce((acc, l) => acc + Number(l._sum.valor ?? 0), 0);

      const receitaRealizada = somar('receita', true);
      const despesaRealizada = somar('despesa', true);

      financeiro = {
        receita: receitaRealizada,
        despesa: despesaRealizada,
        saldo: receitaRealizada - despesaRealizada,
        a_receber: somar('receita', false),
        a_pagar: somar('despesa', false),
      };
    }

    return res.json({
      processos: { total: totalProcessos, ativos: processosAtivos },
      intimacoes: { pendentes: intimacoesPendentes, sem_processo: intimacoesSemProcesso },
      tarefas: { pendentes: tarefasPendentes, atrasadas: tarefasAtrasadas },
      andamentos: { nao_lidos: andamentosNaoLidos },
      crm: { atendimentos_abertos: atendimentosAbertos },
      certificados: { vencendo_em_30_dias: certificadosExpirando },
      financeiro,
      franquia: franquia
        ? {
            termo: franquia.termo_oab,
            contratadas: franquia.contratadas,
            consumidas: franquia.consumidas,
            restantes: franquia.contratadas - franquia.consumidas,
            percentual_uso:
              franquia.contratadas > 0
                ? Math.round((franquia.consumidas / franquia.contratadas) * 100)
                : 0,
          }
        : null,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao calcular indicadores do dashboard');
  }
};

export const getDashboardAgenda = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;

    const [tarefas, andamentos] = await Promise.all([
      prisma.tarefa.findMany({
        where: { tenant_id: tenantId, status: { in: ['a_fazer', 'em_andamento'] } },
        orderBy: { vencimento: 'asc' },
        take: 15,
      }),
      prisma.andamento.findMany({
        where: { tenant_id: tenantId },
        orderBy: { data: 'desc' },
        take: 10,
      }),
    ]);

    // Nome do processo vinculado: sem FK, resolve-se em uma consulta por lote.
    const idsProcesso = [
      ...new Set(
        [...tarefas, ...andamentos]
          .filter((r) => r.chave_modulo === 'processo' && r.codigo_registro_vinculo)
          .map((r) => r.codigo_registro_vinculo as string)
      ),
    ];

    const processos = idsProcesso.length
      ? await prisma.processo.findMany({
          where: { tenant_id: tenantId, id: { in: idsProcesso } },
          select: { id: true, cnj: true, cliente: true, orgao: true, titulo: true },
        })
      : [];

    const porId = new Map(processos.map((p) => [p.id, p]));

    return res.json({
      tarefas: tarefas.map((t) => ({
        ...t,
        processo:
          t.chave_modulo === 'processo' && t.codigo_registro_vinculo
            ? porId.get(t.codigo_registro_vinculo) ?? null
            : null,
      })),
      ultimos_andamentos: andamentos.map((a) => ({
        ...a,
        processo:
          a.chave_modulo === 'processo' ? porId.get(a.codigo_registro_vinculo) ?? null : null,
      })),
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar agenda do dashboard');
  }
};
