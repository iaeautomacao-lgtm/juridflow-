import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { assertVinculoExiste, parseVinculo } from '../lib/modulos';
import { AuthenticatedRequest } from '../middleware/auth';

const STATUS_VALIDOS = ['a_fazer', 'em_andamento', 'concluido'] as const;
const PRIORIDADES_VALIDAS = ['alta', 'media', 'baixa'] as const;

export const getAtividades = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { status, prioridade, responsavel_id, chave_modulo, codigo_registro_vinculo } = req.query;

    const where: any = { tenant_id: tenantId };

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      where.chave_modulo = vinculo.chave_modulo;
      where.codigo_registro_vinculo = vinculo.codigo_registro_vinculo;
    }

    if (status) where.status = String(status);
    if (prioridade) where.prioridade = String(prioridade);
    if (responsavel_id) where.responsavel_id = String(responsavel_id);

    const [tarefas, total] = await Promise.all([
      prisma.tarefa.findMany({
        where,
        orderBy: { vencimento: 'asc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.tarefa.count({ where }),
    ]);

    // Contagem por coluna vem do banco, nao do filtro da pagina atual: com
    // paginacao, filtrar o array carregado daria numero errado no Kanban.
    const contagens = await prisma.tarefa.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _count: { _all: true },
    });

    const totalPorStatus = STATUS_VALIDOS.reduce<Record<string, number>>((acc, s) => {
      acc[s] = contagens.find((c) => c.status === s)?._count._all ?? 0;
      return acc;
    }, {});

    return res.json({
      ...envelope('tarefas', tarefas, total, p),
      kanban: {
        a_fazer: tarefas.filter((t) => t.status === 'a_fazer'),
        em_andamento: tarefas.filter((t) => t.status === 'em_andamento'),
        concluido: tarefas.filter((t) => t.status === 'concluido'),
      },
      total_por_status: totalPorStatus,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar tarefas e atividades');
  }
};

export const createAtividade = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const {
      titulo,
      descricao,
      tipo,
      vencimento,
      prazo_fatal,
      prioridade,
      status,
      chave_modulo,
      codigo_registro_vinculo,
      responsavel_id,
      responsavel_nome,
    } = req.body ?? {};

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ message: 'O titulo da tarefa e obrigatorio.' });
    }
    if (!vencimento) {
      return res.status(400).json({ message: 'A data de vencimento e obrigatoria.' });
    }

    const dataVencimento = new Date(String(vencimento));
    if (Number.isNaN(dataVencimento.getTime())) {
      return res.status(400).json({ message: `Data de vencimento invalida: ${vencimento}` });
    }

    const prioridadeFinal = PRIORIDADES_VALIDAS.includes(String(prioridade) as any)
      ? String(prioridade)
      : 'media';
    const statusFinal = STATUS_VALIDOS.includes(String(status) as any)
      ? String(status)
      : 'a_fazer';

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      await assertVinculoExiste(
        prisma,
        tenantId,
        vinculo.chave_modulo,
        vinculo.codigo_registro_vinculo
      );
    }

    let responsavelId: string | null = null;
    if (responsavel_id) {
      const responsavel = await prisma.user.findFirst({
        where: { id: String(responsavel_id), tenant_id: tenantId },
        select: { id: true },
      });
      if (!responsavel) {
        return res.status(400).json({ message: 'Responsavel informado nao existe neste escritorio.' });
      }
      responsavelId = responsavel.id;
    }

    const tarefa = await prisma.tarefa.create({
      data: {
        tenant_id: tenantId,
        chave_modulo: vinculo?.chave_modulo ?? null,
        codigo_registro_vinculo: vinculo?.codigo_registro_vinculo ?? null,
        titulo: String(titulo).trim(),
        descricao: descricao ? String(descricao) : null,
        tipo: String(tipo ?? '').trim() || 'Prazo',
        vencimento: dataVencimento,
        prazo_fatal: prazo_fatal ? new Date(String(prazo_fatal)) : null,
        prioridade: prioridadeFinal,
        status: statusFinal,
        responsavel_id: responsavelId,
        responsavel_nome: String(responsavel_nome ?? '').trim() || req.user!.nome,
      },
    });

    return res.status(201).json({ tarefa });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao criar tarefa');
  }
};

export const updateStatusAtividade = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!STATUS_VALIDOS.includes(String(status) as any)) {
      return res.status(400).json({
        message: `Status invalido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}.`,
      });
    }

    const tarefa = await prisma.tarefa.findFirst({ where: { id, tenant_id: tenantId } });
    if (!tarefa) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    const atualizada = await prisma.tarefa.update({
      where: { id },
      data: { status: String(status) },
    });

    return res.json({ tarefa: atualizada });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao atualizar status da tarefa');
  }
};

export const deleteAtividade = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    const tarefa = await prisma.tarefa.findFirst({ where: { id, tenant_id: tenantId } });
    if (!tarefa) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }

    await prisma.tarefa.delete({ where: { id } });
    return res.json({ removida: true, id });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao remover tarefa');
  }
};
