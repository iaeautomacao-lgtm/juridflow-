import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { decomporCnj } from '../lib/tribunais';
import { AuthenticatedRequest } from '../middleware/auth';
import { registrarAuditoria } from '../middleware/auditLogger';
import { sincronizarIntimacoesDJEN } from '../services/djenService';
import { consultarEAtualizarDataJud } from '../services/datajudService';

export const getCapturas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { status } = req.query;

    const where: any = { tenant_id: tenantId };
    if (status) where.status = String(status);

    const [capturas, total] = await Promise.all([
      prisma.capturaPush.findMany({
        where,
        orderBy: { ultima_verificacao: 'desc' },
        take: p.take,
        skip: p.skip,
      }),
      prisma.capturaPush.count({ where }),
    ]);

    return res.json(envelope('capturas', capturas, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar monitoramentos de captura');
  }
};

/**
 * Painel da Central de Captura.
 *
 * Rota GET /captura/status, que o frontend chamava e nao existia. Todo numero
 * aqui vem de contagem no banco - nao ha valor de exemplo. Quando nao ha
 * franquia cadastrada, os campos vem nulos e `configurado: false`, para a tela
 * poder pedir o cadastro em vez de exibir "Conectado" sem base.
 */
export const getStatusCaptura = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;

    const [franquia, monitorados, ativos, comErro, ultimaCaptura, intimacoesPendentes] =
      await Promise.all([
        prisma.franquiaCaptura.findFirst({
          where: { tenant_id: tenantId },
          orderBy: { criado_em: 'desc' },
        }),
        prisma.capturaPush.count({ where: { tenant_id: tenantId } }),
        prisma.capturaPush.count({ where: { tenant_id: tenantId, status: 'ativa' } }),
        prisma.capturaPush.count({ where: { tenant_id: tenantId, status: 'erro' } }),
        prisma.capturaPush.findFirst({
          where: { tenant_id: tenantId },
          orderBy: { ultima_verificacao: 'desc' },
          select: { ultima_verificacao: true, ultimo_erro: true },
        }),
        prisma.intimacao.count({ where: { tenant_id: tenantId, status: 'pendente' } }),
      ]);

    return res.json({
      status: {
        configurado: franquia !== null,
        oab_lote: franquia?.termo_oab ?? null,
        uf_oab: franquia?.ufs ?? null,
        franquia_ativa: franquia ? franquia.status === 'ativa' : false,
        creditos_contratados: franquia?.contratadas ?? null,
        creditos_consumidos: franquia?.consumidas ?? null,
        creditos_restantes: franquia ? franquia.contratadas - franquia.consumidas : null,
        total_processos_monitorados: monitorados,
        monitoramentos_ativos: ativos,
        monitoramentos_com_erro: comErro,
        intimacoes_pendentes: intimacoesPendentes,
        ultima_verificacao: ultimaCaptura?.ultima_verificacao ?? null,
        ultimo_erro: ultimaCaptura?.ultimo_erro ?? null,
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao consultar status da central de captura');
  }
};

export const createCaptura = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { cnj, grau, cadastrar_automatico, capturar_docs } = req.body ?? {};

    if (!cnj) {
      return res.status(400).json({ message: 'O numero CNJ e obrigatorio.' });
    }

    const decomposto = decomporCnj(String(cnj), { validarDigito: true });

    const existente = await prisma.capturaPush.findFirst({
      where: { tenant_id: tenantId, cnj: decomposto.numero },
      select: { id: true },
    });
    if (existente) {
      return res.status(409).json({
        message: `O processo ${decomposto.numero} ja esta monitorado.`,
        captura_id: existente.id,
      });
    }

    const novaCaptura = await prisma.capturaPush.create({
      data: {
        tenant_id: tenantId,
        cnj: decomposto.numero,
        orgao: decomposto.sigla,
        status: 'ativa',
        grau: String(grau ?? '').trim() || '1o Grau',
        cadastrar_automatico: cadastrar_automatico ?? true,
        capturar_docs: capturar_docs ?? true,
        ultima_verificacao: new Date(),
      },
    });

    // Primeira sincronizacao. Falha aqui nao desfaz o monitoramento, mas fica
    // registrada em ultimo_erro e e devolvida ao chamador - antes o erro era
    // apenas um console.warn e a tela dizia que deu tudo certo.
    let sincronizacao: unknown = null;
    let erroSincronizacao: string | null = null;

    try {
      sincronizacao = await consultarEAtualizarDataJud(tenantId, decomposto.numero);
    } catch (erro: any) {
      erroSincronizacao = erro?.message ?? String(erro);
      await prisma.capturaPush.update({
        where: { id: novaCaptura.id },
        data: { status: 'erro', ultimo_erro: erroSincronizacao?.slice(0, 2000) },
      });
    }

    const franquia = await prisma.franquiaCaptura.findFirst({ where: { tenant_id: tenantId } });
    if (franquia) {
      await prisma.franquiaCaptura.update({
        where: { id: franquia.id },
        data: { consumidas: { increment: 1 } },
      });
    }

    return res.status(201).json({
      captura: novaCaptura,
      tribunal: { sigla: decomposto.sigla, uf: decomposto.uf },
      sincronizacao,
      erro_sincronizacao: erroSincronizacao,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar monitoramento de captura');
  }
};

/** Varredura manual do DJEN por OAB/UF. */
export const sincronizarDjen = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { oab_uf } = req.body ?? {};

    // Sem OAB no body, usa a franquia cadastrada. Sem franquia, para aqui -
    // a versao anterior caia num numero de OAB fixo no codigo ('432109/SP').
    let alvo = String(oab_uf ?? '').trim();

    if (!alvo) {
      const franquia = await prisma.franquiaCaptura.findFirst({
        where: { tenant_id: tenantId, status: 'ativa' },
        orderBy: { criado_em: 'desc' },
      });
      if (!franquia) {
        return res.status(400).json({
          message:
            'Nenhuma OAB informada e nenhuma franquia de captura cadastrada. ' +
            'Cadastre a OAB do escritorio em Configuracoes antes de disparar a captura.',
          codigo: 'OAB_NAO_CONFIGURADA',
        });
      }
      alvo = franquia.termo_oab;
    }

    const resultado = await sincronizarIntimacoesDJEN(tenantId, alvo);

    await registrarAuditoria({
      tenantId,
      usuarioId: req.user!.id,
      acao: 'SYNC_DJEN',
      entidade: 'intimacao',
      detalhe:
        `Varredura DJEN para OAB ${resultado.oab_uf}. ` +
        `Capturadas: ${resultado.capturadas}, novas: ${resultado.novas}, ` +
        `vinculadas: ${resultado.vinculadas}, sem processo: ${resultado.sem_processo}.`,
      ip: req.ip,
    });

    return res.json({
      message:
        resultado.novas > 0
          ? `${resultado.novas} intimacao(oes) nova(s) capturada(s) para a OAB ${resultado.oab_uf}.`
          : `Nenhuma intimacao nova para a OAB ${resultado.oab_uf}.`,
      ...resultado,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao sincronizar DJEN');
  }
};

/** Consulta pontual de um processo no DataJud. */
export const sincronizarDatajud = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { cnj } = req.body ?? {};

    if (!cnj) {
      return res.status(400).json({ message: 'O numero CNJ do processo e obrigatorio.' });
    }

    const resultado = await consultarEAtualizarDataJud(tenantId, String(cnj));

    await prisma.capturaPush.updateMany({
      where: { tenant_id: tenantId, cnj: decomporCnj(String(cnj)).numero },
      data: { ultima_verificacao: new Date(), status: 'ativa', ultimo_erro: null },
    });

    await registrarAuditoria({
      tenantId,
      usuarioId: req.user!.id,
      acao: 'SYNC_DATAJUD',
      entidade: 'processo',
      entidadeId: resultado.processoId,
      detalhe:
        `Consulta DataJud (${resultado.tribunal}) do processo ${cnj}. ` +
        `Movimentos recebidos: ${resultado.movimentosRecebidos}, novos: ${resultado.movimentosNovos}.`,
      ip: req.ip,
    });

    return res.json({
      message:
        resultado.movimentosNovos > 0
          ? `${resultado.movimentosNovos} movimento(s) novo(s) do ${resultado.tribunal}.`
          : `Nenhum movimento novo no ${resultado.tribunal}.`,
      ...resultado,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao consultar DataJud');
  }
};

export const upsertFranquia = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { termo_oab, nome_pesquisado, ufs, contratadas, valor_mensal } = req.body ?? {};

    if (!termo_oab || !String(termo_oab).trim()) {
      return res.status(400).json({
        message: 'Informe a OAB do escritorio no formato 123456/SP.',
      });
    }

    const { parseOabUf } = await import('../services/djenService');
    const { numero, uf } = parseOabUf(String(termo_oab));

    const existente = await prisma.franquiaCaptura.findFirst({
      where: { tenant_id: tenantId, termo_oab: `${numero}/${uf}` },
    });

    const dados = {
      tenant_id: tenantId,
      termo_oab: `${numero}/${uf}`,
      nome_pesquisado: String(nome_pesquisado ?? '').trim(),
      ufs: String(ufs ?? uf).trim(),
      status: 'ativa',
      contratadas: Number.isFinite(Number(contratadas)) ? Number(contratadas) : 100,
      valor_mensal: Number.isFinite(Number(valor_mensal)) ? Number(valor_mensal) : 0,
    };

    const franquia = existente
      ? await prisma.franquiaCaptura.update({ where: { id: existente.id }, data: dados })
      : await prisma.franquiaCaptura.create({ data: dados });

    return res.status(existente ? 200 : 201).json({ franquia });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao salvar franquia de captura');
  }
};
