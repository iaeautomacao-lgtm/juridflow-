import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { CalendarioForense, feriadosNacionais, normalizarDia, chaveDia } from '../lib/feriados';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Calendario forense do escritorio.
 *
 * Feriado nacional e recesso do art. 220 sao calculados em lib/feriados.ts.
 * Esta tela cadastra o que varia por comarca e por tribunal - e sem esse
 * cadastro o calculo de prazo nao pode ser tratado como prazo fatal.
 */

const ABRANGENCIAS = ['estadual', 'municipal', 'forense'] as const;

export const getFeriados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const ano = Number.parseInt(String(req.query.ano ?? new Date().getFullYear()), 10);

    if (!Number.isInteger(ano) || ano < 1900 || ano > 2200) {
      return res.status(400).json({ message: `Ano invalido: ${req.query.ano}` });
    }

    const where = {
      OR: [{ tenant_id: tenantId }, { tenant_id: null }],
      data: {
        gte: new Date(Date.UTC(ano, 0, 1)),
        lte: new Date(Date.UTC(ano, 11, 31)),
      },
    };

    const [cadastrados, total] = await Promise.all([
      prisma.feriado.findMany({ where, orderBy: { data: 'asc' }, take: p.take, skip: p.skip }),
      prisma.feriado.count({ where }),
    ]);

    return res.json({
      ...envelope('feriados', cadastrados, total, p),
      ano,
      // Os nacionais vao junto para a tela mostrar o calendario completo sem
      // duplicar a regra no frontend.
      nacionais: feriadosNacionais(ano)
        .map((f) => ({ data: f.chave, nome: f.nome, movel: f.movel, abrangencia: 'nacional' }))
        .sort((a, b) => a.data.localeCompare(b.data)),
      recesso_forense: {
        inicio: `${ano}-12-20`,
        fim: `${ano + 1}-01-20`,
        fundamento: 'CPC/2015 art. 220',
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao listar feriados');
  }
};

export const createFeriado = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { nome, data, abrangencia, uf, municipio, orgao } = req.body ?? {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: 'O nome do feriado e obrigatorio.' });
    }
    if (!data) {
      return res.status(400).json({ message: 'A data e obrigatoria.' });
    }
    if (!ABRANGENCIAS.includes(String(abrangencia) as any)) {
      return res.status(400).json({
        message:
          `Abrangencia invalida. Valores aceitos: ${ABRANGENCIAS.join(', ')}. ` +
          'Feriado nacional nao precisa de cadastro: e calculado automaticamente.',
      });
    }

    let dataNormalizada: Date;
    try {
      dataNormalizada = normalizarDia(String(data));
    } catch {
      return res.status(400).json({ message: `Data invalida: ${data}` });
    }

    const feriado = await prisma.feriado.create({
      data: {
        tenant_id: tenantId,
        nome: String(nome).trim(),
        data: dataNormalizada,
        abrangencia: String(abrangencia),
        uf: uf ? String(uf).toUpperCase().slice(0, 2) : null,
        municipio: municipio ? String(municipio).trim() : null,
        orgao: orgao ? String(orgao).trim() : null,
      },
    });

    return res.status(201).json({ feriado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar feriado');
  }
};

export const deleteFeriado = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    // Somente feriado do proprio tenant. Linha global (tenant_id null) e
    // mantida pelo seed, nao pela tela.
    const feriado = await prisma.feriado.findFirst({ where: { id, tenant_id: tenantId } });
    if (!feriado) {
      return res.status(404).json({
        message: 'Feriado nao encontrado entre os cadastrados por este escritorio.',
      });
    }

    await prisma.feriado.delete({ where: { id } });
    return res.json({ removido: true, id });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao remover feriado');
  }
};

/** Verifica se uma data e dia util, com o motivo quando nao e. */
export const verificarDia = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { data, uf } = req.query;

    if (!data) {
      return res.status(400).json({ message: 'Informe a data no formato AAAA-MM-DD.' });
    }

    let dia: Date;
    try {
      dia = normalizarDia(String(data));
    } catch {
      return res.status(400).json({ message: `Data invalida: ${data}` });
    }

    const ano = dia.getUTCFullYear();
    const extras = await prisma.feriado.findMany({
      where: {
        OR: [{ tenant_id: tenantId }, { tenant_id: null }],
        data: { gte: new Date(Date.UTC(ano - 1, 0, 1)), lte: new Date(Date.UTC(ano + 1, 11, 31)) },
        ...(uf ? { OR: [{ uf: String(uf) }, { uf: null }] } : {}),
      },
      select: { data: true, nome: true },
    });

    const calendario = new CalendarioForense(ano, ano, extras);
    const motivo = calendario.motivo(dia);

    return res.json({
      data: chaveDia(dia),
      dia_util: motivo === null,
      motivo,
      proximo_dia_util: chaveDia(calendario.proximoDiaUtilInclusivo(dia)),
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao verificar dia util');
  }
};
