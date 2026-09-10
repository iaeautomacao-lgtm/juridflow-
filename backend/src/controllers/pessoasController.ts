import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { AuthenticatedRequest } from '../middleware/auth';

/** Valida CPF pelos dois digitos verificadores. */
function cpfValido(digitos: string): boolean {
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  for (const [tamanho, posicao] of [[9, 10], [10, 11]] as const) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(digitos[i]) * (posicao - i);
    }
    const resto = (soma * 10) % 11;
    const esperado = resto === 10 ? 0 : resto;
    if (esperado !== Number(digitos[tamanho])) return false;
  }
  return true;
}

/** Valida CNPJ pelos dois digitos verificadores. */
function cnpjValido(digitos: string): boolean {
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const calcular = (tamanho: number): number => {
    let peso = tamanho - 7;
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(digitos[i]) * peso;
      peso = peso - 1 < 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calcular(12) === Number(digitos[12]) && calcular(13) === Number(digitos[13]);
}

function normalizarDocumento(bruto: string): { digitos: string; formatado: string } {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  if (digitos.length === 11) {
    return {
      digitos,
      formatado: `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`,
    };
  }
  if (digitos.length === 14) {
    return {
      digitos,
      formatado: `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`,
    };
  }
  return { digitos, formatado: String(bruto ?? '') };
}

export const getPessoas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { tipo, busca, ativo } = req.query;

    const where: any = { tenant_id: tenantId };
    if (tipo) where.tipo_cliente = String(tipo);
    if (ativo !== undefined) where.ativo = ativo === 'true';
    if (busca) {
      const q = String(busca);
      where.OR = [
        { nome: { contains: q } },
        { cpf_cnpj: { contains: q } },
        { email: { contains: q } },
        { telefone: { contains: q } },
      ];
    }

    const [pessoas, total] = await Promise.all([
      prisma.pessoa.findMany({ where, orderBy: { nome: 'asc' }, take: p.take, skip: p.skip }),
      prisma.pessoa.count({ where }),
    ]);

    // Quantidade de processos por pessoa: o vinculo transversal permite
    // contar sem coluna dedicada.
    const ids = pessoas.map((pe) => pe.id);
    const vinculos = ids.length
      ? await prisma.tarefa.groupBy({
          by: ['codigo_registro_vinculo'],
          where: {
            tenant_id: tenantId,
            chave_modulo: 'pessoa',
            codigo_registro_vinculo: { in: ids },
          },
          _count: { _all: true },
        })
      : [];

    const porPessoa = vinculos.reduce<Record<string, number>>((acc, v) => {
      if (v.codigo_registro_vinculo) acc[v.codigo_registro_vinculo] = v._count._all;
      return acc;
    }, {});

    const itens = pessoas.map((pe) => ({ ...pe, total_tarefas: porPessoa[pe.id] ?? 0 }));

    return res.json(envelope('pessoas', itens, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar pessoas');
  }
};

export const createPessoa = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { nome, cpf_cnpj, tipo_cliente, email, telefone, endereco, cidade_uf } = req.body ?? {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: 'O nome e obrigatorio.' });
    }
    if (!cpf_cnpj) {
      return res.status(400).json({ message: 'CPF ou CNPJ e obrigatorio.' });
    }

    const doc = normalizarDocumento(String(cpf_cnpj));

    if (doc.digitos.length === 11) {
      if (!cpfValido(doc.digitos)) {
        return res.status(400).json({ message: `CPF invalido: ${cpf_cnpj}` });
      }
    } else if (doc.digitos.length === 14) {
      if (!cnpjValido(doc.digitos)) {
        return res.status(400).json({ message: `CNPJ invalido: ${cpf_cnpj}` });
      }
    } else {
      return res.status(400).json({
        message: `Documento deve ter 11 digitos (CPF) ou 14 (CNPJ), recebido ${doc.digitos.length}.`,
      });
    }

    const duplicado = await prisma.pessoa.findFirst({
      where: { tenant_id: tenantId, cpf_cnpj: doc.formatado },
      select: { id: true, nome: true },
    });
    if (duplicado) {
      return res.status(409).json({
        message: `${doc.formatado} ja esta cadastrado como "${duplicado.nome}".`,
        pessoa_id: duplicado.id,
      });
    }

    const pessoa = await prisma.pessoa.create({
      data: {
        tenant_id: tenantId,
        nome: String(nome).trim(),
        cpf_cnpj: doc.formatado,
        tipo_cliente: String(tipo_cliente ?? '').trim() || 'cliente',
        email: String(email ?? '').trim(),
        telefone: String(telefone ?? '').trim(),
        endereco: endereco ? String(endereco) : null,
        cidade_uf: String(cidade_uf ?? '').trim(),
      },
    });

    return res.status(201).json({ pessoa });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar pessoa');
  }
};

export const getPessoaById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;

    const pessoa = await prisma.pessoa.findFirst({ where: { id, tenant_id: tenantId } });
    if (!pessoa) {
      return res.status(404).json({ message: 'Pessoa nao encontrada.' });
    }

    // Processos em que a pessoa aparece como cliente ou nas partes.
    const processos = await prisma.processo.findMany({
      where: {
        tenant_id: tenantId,
        OR: [{ cliente: pessoa.nome }, { partes_json: { contains: pessoa.nome } }],
      },
      select: { id: true, cnj: true, titulo: true, status: true, orgao: true },
      take: 100,
    });

    return res.json({ pessoa: { ...pessoa, processos } });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao detalhar pessoa');
  }
};
