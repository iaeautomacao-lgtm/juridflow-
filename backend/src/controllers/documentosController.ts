import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { assertVinculoExiste, parseVinculo } from '../lib/modulos';
import { AuthenticatedRequest } from '../middleware/auth';

export const getDocumentos = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { categoria, busca, chave_modulo, codigo_registro_vinculo } = req.query;

    const where: any = { tenant_id: tenantId };

    const vinculo = parseVinculo(chave_modulo, codigo_registro_vinculo);
    if (vinculo) {
      where.chave_modulo = vinculo.chave_modulo;
      where.codigo_registro_vinculo = vinculo.codigo_registro_vinculo;
    }

    if (categoria) where.categoria = String(categoria);
    if (busca) {
      const q = String(busca);
      where.OR = [{ titulo: { contains: q } }, { categoria: { contains: q } }];
    }

    const [documentos, total] = await Promise.all([
      prisma.documento.findMany({
        where,
        orderBy: { criado_em: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.documento.count({ where }),
    ]);

    return res.json(envelope('documentos', documentos, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar documentos');
  }
};

export const createDocumento = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { titulo, categoria, url, tamanho_bytes, chave_modulo, codigo_registro_vinculo } =
      req.body ?? {};

    if (!titulo || !String(titulo).trim()) {
      return res.status(400).json({ message: 'O titulo do documento e obrigatorio.' });
    }
    if (!url || !String(url).trim()) {
      return res.status(400).json({ message: 'A URL do documento e obrigatoria.' });
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

    const tamanho = Number(tamanho_bytes);

    const documento = await prisma.documento.create({
      data: {
        tenant_id: tenantId,
        chave_modulo: vinculo?.chave_modulo ?? null,
        codigo_registro_vinculo: vinculo?.codigo_registro_vinculo ?? null,
        titulo: String(titulo).trim(),
        categoria: String(categoria ?? '').trim() || 'Outros',
        url: String(url).trim(),
        tamanho_bytes: Number.isFinite(tamanho) && tamanho >= 0 ? BigInt(Math.floor(tamanho)) : BigInt(0),
      },
    });

    return res.status(201).json({ documento });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar documento');
  }
};

export const getModelosDocumento = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { categoria } = req.query;

    const where: any = { tenant_id: tenantId };
    if (categoria) where.categoria = String(categoria);

    const [modelos, total] = await Promise.all([
      prisma.modeloDocumento.findMany({
        where,
        orderBy: { titulo: 'asc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.modeloDocumento.count({ where }),
    ]);

    return res.json(envelope('modelos', modelos, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar modelos de documentos');
  }
};

/** Tags reconhecidas pelo gerador de pecas. */
const TAGS_SUPORTADAS = [
  'nome_cliente',
  'numero_processo',
  'vara',
  'comarca',
  'orgao',
  'valor_causa',
  'data_hoje',
  'advogado_nome',
  'advogado_oab',
  'escritorio_nome',
] as const;

/**
 * Gera a minuta substituindo as tags do modelo pelos dados do processo.
 *
 * Aceita {tag} e {{tag}}. Tag desconhecida no modelo e devolvida na lista
 * `tags_nao_reconhecidas` em vez de ser apagada em silencio - assim o
 * escritorio ve que o modelo tem um campo que o sistema nao sabe preencher.
 */
export const gerarPeca = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { modelo_id, processo_id } = req.body ?? {};

    if (!modelo_id) {
      return res.status(400).json({ message: 'modelo_id e obrigatorio.' });
    }

    const modelo = await prisma.modeloDocumento.findFirst({
      where: { id: String(modelo_id), tenant_id: tenantId },
    });
    if (!modelo) {
      return res.status(404).json({ message: 'Modelo de documento nao encontrado.' });
    }

    const processo = processo_id
      ? await prisma.processo.findFirst({
          where: { id: String(processo_id), tenant_id: tenantId },
        })
      : null;

    if (processo_id && !processo) {
      return res.status(404).json({ message: 'Processo nao encontrado.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true },
    });
    const usuario = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { nome: true, oab: true },
    });

    const valores: Record<string, string> = {
      nome_cliente: processo?.cliente ?? '',
      numero_processo: processo?.cnj ?? '',
      vara: processo?.vara ?? '',
      comarca: processo?.comarca ?? '',
      orgao: processo?.orgao ?? '',
      valor_causa: processo
        ? Number(processo.valor_causa).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })
        : '',
      data_hoje: new Date().toLocaleDateString('pt-BR'),
      advogado_nome: usuario?.nome ?? '',
      advogado_oab: usuario?.oab ?? '',
      escritorio_nome: tenant?.nome ?? '',
    };

    const naoReconhecidas = new Set<string>();
    const vazias = new Set<string>();

    const conteudo = modelo.conteudo_template_com_variaveis.replace(
      /\{\{?\s*([a-z_]+)\s*\}?\}/gi,
      (original, tag: string) => {
        const chave = tag.toLowerCase();
        if (!(TAGS_SUPORTADAS as readonly string[]).includes(chave)) {
          naoReconhecidas.add(chave);
          return original;
        }
        const valor = valores[chave];
        if (!valor) {
          vazias.add(chave);
          return original;
        }
        return valor;
      }
    );

    return res.json({
      modelo: { id: modelo.id, titulo: modelo.titulo, categoria: modelo.categoria },
      conteudo,
      tags_suportadas: TAGS_SUPORTADAS,
      tags_nao_reconhecidas: [...naoReconhecidas],
      tags_sem_valor: [...vazias],
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao gerar peca a partir do modelo');
  }
};
