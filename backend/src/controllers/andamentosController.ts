import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { assertVinculoExiste, parseVinculo } from '../lib/modulos';
import { AuthenticatedRequest } from '../middleware/auth';

export const getAndamentos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { chave_modulo, codigo_registro_vinculo, lido, fonte, busca } = req.query;

    const where: any = { tenant_id: tenantId };

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      where.chave_modulo = vinculo.chave_modulo;
      where.codigo_registro_vinculo = vinculo.codigo_registro_vinculo;
    }

    if (lido !== undefined) where.lido = lido === 'true';
    if (fonte) where.fonte = String(fonte);
    if (busca) {
      const q = String(busca);
      where.OR = [
        { cnj: { contains: q } },
        { descricao: { contains: q } },
        { cliente: { contains: q } },
        { tipo: { contains: q } },
      ];
    }

    const [andamentos, total] = await Promise.all([
      prisma.andamento.findMany({
        where,
        orderBy: { data: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.andamento.count({ where }),
    ]);

    return res.json(envelope('andamentos', andamentos, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar andamentos');
  }
};

export const createAndamento = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { chave_modulo, codigo_registro_vinculo, cnj, data, orgao, tipo, cliente, descricao } =
      req.body ?? {};

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (!vinculo) {
      return res.status(400).json({
        message: 'chave_modulo e codigo_registro_vinculo sao obrigatorios para criar andamento.',
      });
    }
    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ message: 'A descricao do andamento e obrigatoria.' });
    }

    // Sem FK no banco, esta checagem e o que impede andamento orfao e
    // andamento gravado no registro de outro tenant.
    await assertVinculoExiste(
      prisma,
      tenantId,
      vinculo.chave_modulo,
      vinculo.codigo_registro_vinculo
    );

    const andamento = await prisma.andamento.create({
      data: {
        tenant_id: tenantId,
        chave_modulo: vinculo.chave_modulo,
        codigo_registro_vinculo: vinculo.codigo_registro_vinculo,
        cnj: String(cnj ?? '').trim(),
        data: data ? new Date(String(data)) : new Date(),
        orgao: String(orgao ?? '').trim(),
        tipo: String(tipo ?? '').trim() || 'Andamento',
        cliente: String(cliente ?? '').trim(),
        descricao: String(descricao).trim(),
        fonte: 'manual',
        lido: true,
      },
    });

    return res.status(201).json({ andamento });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao criar andamento');
  }
};

export const marcarComoLido = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { lido } = req.body ?? {};

    const andamento = await prisma.andamento.findFirst({ where: { id, tenant_id: tenantId } });
    if (!andamento) {
      return res.status(404).json({ message: 'Andamento nao encontrado.' });
    }

    const atualizado = await prisma.andamento.update({
      where: { id },
      data: { lido: lido === undefined ? true : Boolean(lido) },
    });

    return res.json({ andamento: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao atualizar andamento');
  }
};
