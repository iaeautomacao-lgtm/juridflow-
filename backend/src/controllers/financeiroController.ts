import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { assertVinculoExiste, parseVinculo } from '../lib/modulos';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Modulo financeiro.
 *
 * Todas as rotas daqui estao restritas a socio e financeiro no roteador
 * (requireCargo). Advogado e estagiario recebem 403.
 */

export const getTransacoes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { tipo, status_pago, categoria, busca, chave_modulo, codigo_registro_vinculo } = req.query;

    const where: any = { tenant_id: tenantId };

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      where.chave_modulo = vinculo.chave_modulo;
      where.codigo_registro_vinculo = vinculo.codigo_registro_vinculo;
    }

    if (tipo) where.tipo_receita_despesa = String(tipo);
    if (categoria) where.categoria = String(categoria);
    if (status_pago !== undefined) where.status_pago = status_pago === 'true';
    if (busca) {
      const q = String(busca);
      where.OR = [
        { descricao: { contains: q } },
        { cliente: { contains: q } },
        { categoria: { contains: q } },
      ];
    }

    const [lancamentos, total] = await Promise.all([
      prisma.financeiro.findMany({
        where,
        orderBy: { data_vencimento: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.financeiro.count({ where }),
    ]);

    return res.json(envelope('transacoes', lancamentos, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar transacoes financeiras');
  }
};

export const createTransacao = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const {
      descricao,
      valor,
      tipo_receita_despesa,
      categoria,
      data_vencimento,
      status_pago,
      cliente,
      chave_modulo,
      codigo_registro_vinculo,
    } = req.body ?? {};

    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ message: 'A descricao do lancamento e obrigatoria.' });
    }
    if (!['receita', 'despesa'].includes(String(tipo_receita_despesa))) {
      return res
        .status(400)
        .json({ message: 'tipo_receita_despesa deve ser "receita" ou "despesa".' });
    }
    const valorNumerico = Number(valor);
    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
      return res.status(400).json({ message: 'O valor deve ser um numero maior ou igual a zero.' });
    }
    if (!data_vencimento) {
      return res.status(400).json({ message: 'A data de vencimento e obrigatoria.' });
    }
    const vencimento = new Date(String(data_vencimento));
    if (Number.isNaN(vencimento.getTime())) {
      return res.status(400).json({ message: `Data de vencimento invalida: ${data_vencimento}` });
    }

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      await assertVinculoExiste(
        prisma,
        tenantId,
        vinculo.chave_modulo,
        vinculo.codigo_registro_vinculo
      );
    }

    const pago = Boolean(status_pago);

    const lancamento = await prisma.financeiro.create({
      data: {
        tenant_id: tenantId,
        chave_modulo: vinculo?.chave_modulo ?? null,
        codigo_registro_vinculo: vinculo?.codigo_registro_vinculo ?? null,
        descricao: String(descricao).trim(),
        valor: valorNumerico,
        tipo_receita_despesa: String(tipo_receita_despesa),
        categoria: String(categoria ?? '').trim() || 'Operacional',
        data_vencimento: vencimento,
        data_pagamento: pago ? new Date() : null,
        status_pago: pago,
        cliente: cliente ? String(cliente).trim() : null,
      },
    });

    return res.status(201).json({ transacao: lancamento });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao criar lancamento financeiro');
  }
};

export const baixarTransacao = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { status_pago } = req.body ?? {};

    const lancamento = await prisma.financeiro.findFirst({ where: { id, tenant_id: tenantId } });
    if (!lancamento) {
      return res.status(404).json({ message: 'Lancamento nao encontrado.' });
    }

    const pago = status_pago === undefined ? true : Boolean(status_pago);

    const atualizado = await prisma.financeiro.update({
      where: { id },
      data: { status_pago: pago, data_pagamento: pago ? new Date() : null },
    });

    return res.json({ transacao: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao dar baixa no lancamento');
  }
};

export const getResumo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;

    // Um unico groupBy no lugar de quatro aggregate: menos ida ao banco e
    // o resultado sai consistente entre os totais.
    const linhas = await prisma.financeiro.groupBy({
      by: ['tipo_receita_despesa', 'status_pago'],
      where: { tenant_id: tenantId },
      _sum: { valor: true },
      _count: { _all: true },
    });

    const somar = (tipo: string, pago?: boolean): number =>
      linhas
        .filter((l) => l.tipo_receita_despesa === tipo && (pago === undefined || l.status_pago === pago))
        .reduce((acc, l) => acc + Number(l._sum.valor ?? 0), 0);

    const totalReceita = somar('receita');
    const totalDespesa = somar('despesa');
    const receitaRealizada = somar('receita', true);
    const despesaRealizada = somar('despesa', true);

    const hoje = new Date();
    const atrasados = await prisma.financeiro.count({
      where: { tenant_id: tenantId, status_pago: false, data_vencimento: { lt: hoje } },
    });

    return res.json({
      resumo: {
        total_receita: totalReceita,
        total_despesa: totalDespesa,
        saldo_previsto: totalReceita - totalDespesa,
        total_receita_realizada: receitaRealizada,
        total_despesa_realizada: despesaRealizada,
        saldo_realizado: receitaRealizada - despesaRealizada,
        a_receber: totalReceita - receitaRealizada,
        a_pagar: totalDespesa - despesaRealizada,
        lancamentos_atrasados: atrasados,
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao obter balanco financeiro');
  }
};

// --------------------------------------------------------------------------
// Contratos de honorarios
// Rota /financeiro/contratos, que o frontend ja chamava e nao existia.
// --------------------------------------------------------------------------

export const getContratos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { status, tipo, busca } = req.query;

    const where: any = { tenant_id: tenantId };
    if (status) where.status = String(status);
    if (tipo) where.tipo = String(tipo);
    if (busca) {
      const q = String(busca);
      where.OR = [{ cliente_nome: { contains: q } }, { titulo: { contains: q } }];
    }

    const [contratos, total] = await Promise.all([
      prisma.contratoHonorarios.findMany({
        where,
        orderBy: { data_inicio: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.contratoHonorarios.count({ where }),
    ]);

    return res.json(envelope('contratos', contratos, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar contratos de honorarios');
  }
};

export const createContrato = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const {
      cliente_nome,
      titulo,
      valor_total,
      forma_pagamento,
      tipo,
      percentual_exito,
      status,
      data_inicio,
      data_fim,
    } = req.body ?? {};

    if (!cliente_nome || !String(cliente_nome).trim()) {
      return res.status(400).json({ message: 'O nome do cliente e obrigatorio.' });
    }
    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ message: 'O titulo do contrato e obrigatorio.' });
    }

    const contrato = await prisma.contratoHonorarios.create({
      data: {
        tenant_id: tenantId,
        cliente_nome: String(cliente_nome).trim(),
        titulo: String(titulo).trim(),
        valor_total: Number.isFinite(Number(valor_total)) ? Number(valor_total) : 0,
        forma_pagamento: String(forma_pagamento ?? '').trim(),
        tipo: String(tipo ?? '').trim() || 'contratual',
        percentual_exito: Number.isFinite(Number(percentual_exito))
          ? Number(percentual_exito)
          : null,
        status: String(status ?? '').trim() || 'vigente',
        data_inicio: data_inicio ? new Date(String(data_inicio)) : new Date(),
        data_fim: data_fim ? new Date(String(data_fim)) : null,
      },
    });

    return res.status(201).json({ contrato });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao criar contrato de honorarios');
  }
};
