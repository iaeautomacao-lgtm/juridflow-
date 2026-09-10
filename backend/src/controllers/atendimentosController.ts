import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * CRM pre-processual (modulo Atendimento).
 *
 * O frontend chamava GET /crm desde o inicio, e a rota nao existia - o
 * fallback do api.ts engolia o 404 e a tela renderizava vazia. Agora existe
 * o model Atendimento e as rotas.
 *
 * Atendimento e um modulo de primeira classe: tarefa, andamento, documento e
 * lancamento financeiro podem se vincular a ele por
 * (chave_modulo: 'atendimento', codigo_registro_vinculo: <id>).
 */

const FASES = [
  'primeiro_contato',
  'analise_viabilidade',
  'proposta_enviada',
  'contrato_assinado',
  'perdido',
] as const;

export const getAtendimentos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { fase, busca } = req.query;

    const where: any = { tenant_id: tenantId };
    if (fase) where.fase = String(fase);
    if (busca) {
      const q = String(busca);
      where.OR = [
        { cliente_nome: { contains: q } },
        { assunto: { contains: q } },
        { telefone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const [atendimentos, total] = await Promise.all([
      prisma.atendimento.findMany({
        where,
        orderBy: { data_inicio: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.atendimento.count({ where }),
    ]);

    // Funil: contagem e valor estimado por fase, do banco inteiro.
    const agrupado = await prisma.atendimento.groupBy({
      by: ['fase'],
      where: { tenant_id: tenantId },
      _count: { _all: true },
      _sum: { valor_estimado: true },
    });

    const funil = FASES.map((f) => {
      const linha = agrupado.find((a) => a.fase === f);
      return {
        fase: f,
        quantidade: linha?._count._all ?? 0,
        valor_estimado: Number(linha?._sum.valor_estimado ?? 0),
      };
    });

    return res.json({ ...envelope('atendimentos', atendimentos, total, p), funil });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar atendimentos do CRM');
  }
};

export const createAtendimento = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { cliente_nome, telefone, email, assunto, fase, valor_estimado, origem } = req.body ?? {};

    if (!cliente_nome || !String(cliente_nome).trim()) {
      return res.status(400).json({ message: 'O nome do cliente e obrigatorio.' });
    }
    if (!assunto || !String(assunto).trim()) {
      return res.status(400).json({ message: 'O assunto do atendimento e obrigatorio.' });
    }

    const faseFinal = FASES.includes(String(fase) as any) ? String(fase) : 'primeiro_contato';

    const atendimento = await prisma.atendimento.create({
      data: {
        tenant_id: tenantId,
        cliente_nome: String(cliente_nome).trim(),
        telefone: String(telefone ?? '').trim(),
        email: String(email ?? '').trim(),
        assunto: String(assunto).trim(),
        fase: faseFinal,
        valor_estimado: Number.isFinite(Number(valor_estimado)) ? Number(valor_estimado) : 0,
        origem: String(origem ?? '').trim(),
      },
    });

    return res.status(201).json({ atendimento });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao criar atendimento');
  }
};

export const updateFase = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { fase } = req.body ?? {};

    if (!FASES.includes(String(fase) as any)) {
      return res
        .status(400)
        .json({ message: `Fase invalida. Valores aceitos: ${FASES.join(', ')}.` });
    }

    const atendimento = await prisma.atendimento.findFirst({ where: { id, tenant_id: tenantId } });
    if (!atendimento) {
      return res.status(404).json({ message: 'Atendimento nao encontrado.' });
    }

    const atualizado = await prisma.atendimento.update({
      where: { id },
      data: { fase: String(fase) },
    });

    return res.json({ atendimento: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao atualizar fase do atendimento');
  }
};

/**
 * Converte atendimento em processo.
 *
 * Equivale ao /processo-judicial/atendimento/{codigo-atendimento} do Projuris:
 * o CRM alimenta o contencioso, sem redigitacao.
 */
export const converterEmProcesso = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { cnj, orgao, vara, comarca, valor_causa } = req.body ?? {};

    const atendimento = await prisma.atendimento.findFirst({ where: { id, tenant_id: tenantId } });
    if (!atendimento) {
      return res.status(404).json({ message: 'Atendimento nao encontrado.' });
    }
    if (!cnj) {
      return res.status(400).json({ message: 'O numero CNJ do processo e obrigatorio.' });
    }

    const { decomporCnj } = await import('../lib/tribunais');
    const decomposto = decomporCnj(String(cnj), { validarDigito: true });

    const duplicado = await prisma.processo.findFirst({
      where: { tenant_id: tenantId, cnj: decomposto.numero },
      select: { id: true },
    });
    if (duplicado) {
      return res.status(409).json({
        message: `O processo ${decomposto.numero} ja esta cadastrado.`,
        processo_id: duplicado.id,
      });
    }

    const [processo] = await prisma.$transaction([
      prisma.processo.create({
        data: {
          tenant_id: tenantId,
          cnj: decomposto.numero,
          titulo: atendimento.assunto.slice(0, 190),
          cliente: atendimento.cliente_nome,
          orgao: String(orgao ?? '').trim() || decomposto.sigla,
          instancia: '',
          vara: String(vara ?? '').trim(),
          comarca: String(comarca ?? '').trim(),
          status: 'Em Andamento',
          valor_causa: Number.isFinite(Number(valor_causa))
            ? Number(valor_causa)
            : Number(atendimento.valor_estimado),
          partes_json: JSON.stringify([
            { nome: atendimento.cliente_nome, papel: 'Cliente' },
          ]),
        },
      }),
      prisma.atendimento.update({
        where: { id },
        data: { fase: 'contrato_assinado' },
      }),
    ]);

    return res.status(201).json({
      processo,
      atendimento_id: id,
      tribunal: { sigla: decomposto.sigla, uf: decomposto.uf },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao converter atendimento em processo');
  }
};
