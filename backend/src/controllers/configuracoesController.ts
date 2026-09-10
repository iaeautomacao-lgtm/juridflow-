import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { CARGOS, isCargo } from '../lib/cargos';
import { AuthenticatedRequest } from '../middleware/auth';

// --------------------------------------------------------------------------
// Certificados digitais - CONTROLE DE VALIDADE
//
// Este modulo cadastra metadado nao sigiloso (de quem e, qual OAB, quando
// vence) para o sistema avisar antes do vencimento. Ele NAO armazena o
// arquivo .pfx nem senha, e nao ha rota que aceite qualquer um dos dois.
//
// O texto anterior gravado na trilha de auditoria dizia "armazenado com
// sucesso no cofre HSM/KMS". Nao havia HSM, KMS nem cifra - e um escritorio
// que lesse aquilo poderia concluir que era seguro cadastrar a senha do PJe
// ali. O modulo foi renomeado para o que ele realmente faz.
// --------------------------------------------------------------------------

const DIAS_AVISO_VENCIMENTO = 30;

function statusPorValidade(validade: Date): 'valido' | 'expirando' | 'expirado' {
  const agora = Date.now();
  const limite = agora + DIAS_AVISO_VENCIMENTO * 86400000;
  if (validade.getTime() < agora) return 'expirado';
  if (validade.getTime() < limite) return 'expirando';
  return 'valido';
}

export const getCertificados = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;

    const certificados = await prisma.certificadoDigital.findMany({
      where: { tenant_id: tenantId },
      orderBy: { validade: 'asc' },
    });

    // Status recalculado na leitura: certificado nao "vira" expirado sozinho
    // no banco, e status gravado fica velho com o tempo.
    const itens = certificados.map((c) => ({
      ...c,
      status: statusPorValidade(c.validade),
      dias_para_vencer: Math.ceil((c.validade.getTime() - Date.now()) / 86400000),
    }));

    return res.json({
      certificados: itens,
      total: itens.length,
      expirando: itens.filter((c) => c.status === 'expirando').length,
      expirados: itens.filter((c) => c.status === 'expirado').length,
      aviso_escopo:
        'Este cadastro guarda apenas metadado para controle de validade. ' +
        'O JuridFlow nao armazena arquivo de certificado nem senha de tribunal.',
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao listar certificados');
  }
};

export const addCertificado = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { advogado_nome, advogado_id, oab, validade, tipo } = req.body ?? {};

    // Rejeita explicitamente qualquer tentativa de enviar segredo para ca.
    const camposProibidos = ['senha', 'senha_pfx', 'pin', 'arquivo', 'pfx', 'certificado_base64'];
    const enviouSegredo = camposProibidos.filter((c) => req.body?.[c] !== undefined);
    if (enviouSegredo.length > 0) {
      return res.status(400).json({
        message:
          `Este endpoint nao aceita ${enviouSegredo.join(', ')}. ` +
          'O JuridFlow nao armazena arquivo de certificado nem senha. ' +
          'Cadastre apenas nome, OAB e validade para controle de vencimento.',
        codigo: 'SEGREDO_NAO_ACEITO',
      });
    }

    if (!advogado_nome || !String(advogado_nome).trim()) {
      return res.status(400).json({ message: 'O nome do advogado e obrigatorio.' });
    }
    if (!oab || !String(oab).trim()) {
      return res.status(400).json({ message: 'A OAB e obrigatoria.' });
    }
    if (!validade) {
      return res.status(400).json({ message: 'A data de validade e obrigatoria.' });
    }

    const dataValidade = new Date(String(validade));
    if (Number.isNaN(dataValidade.getTime())) {
      return res.status(400).json({ message: `Data de validade invalida: ${validade}` });
    }

    const tipoFinal = String(tipo ?? 'A1').toUpperCase();
    if (tipoFinal === 'A3') {
      return res.status(400).json({
        message:
          'Certificado A3 vive em token fisico ou smartcard e nao pode ser usado por um ' +
          'servidor. Apenas A1 (arquivo) e viavel server-side, e mesmo assim so na fase 2 ' +
          'do projeto, fora de hospedagem compartilhada.',
        codigo: 'A3_NAO_SUPORTADO',
      });
    }

    let advogadoId: string | null = null;
    if (advogado_id) {
      const advogado = await prisma.user.findFirst({
        where: { id: String(advogado_id), tenant_id: tenantId },
        select: { id: true },
      });
      if (!advogado) {
        return res.status(400).json({ message: 'Advogado informado nao existe neste escritorio.' });
      }
      advogadoId = advogado.id;
    }

    const certificado = await prisma.certificadoDigital.create({
      data: {
        tenant_id: tenantId,
        advogado_id: advogadoId,
        advogado_nome: String(advogado_nome).trim(),
        oab: String(oab).trim(),
        tipo: 'A1',
        validade: dataValidade,
        status: statusPorValidade(dataValidade),
      },
    });

    return res.status(201).json({ certificado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar certificado');
  }
};

// --------------------------------------------------------------------------
// Trilha de auditoria LGPD
// --------------------------------------------------------------------------

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const p = lerPaginacao(req);
    const { acao, entidade, usuario_id, desde, ate } = req.query;

    const where: any = { tenant_id: tenantId };
    if (acao) where.acao = { contains: String(acao) };
    if (entidade) where.entidade = String(entidade);
    if (usuario_id) where.usuario_id = String(usuario_id);
    if (desde || ate) {
      where.timestamp = {};
      if (desde) where.timestamp.gte = new Date(String(desde));
      if (ate) where.timestamp.lte = new Date(String(ate));
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: p.take,
        skip: p.skip,
        include: {
          usuario: { select: { id: true, nome: true, email: true, cargo: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json(envelope('logs', logs, total, p));
  } catch (error) {
    return tratarErro(res, error, 'Erro ao consultar trilha de auditoria');
  }
};

// --------------------------------------------------------------------------
// Usuarios e perfis de acesso
// --------------------------------------------------------------------------

export const getUsuarios = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;

    const usuarios = await prisma.user.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        oab: true,
        ativo: true,
        criado_em: true,
      },
      orderBy: { nome: 'asc' },
    });

    return res.json({ usuarios, total: usuarios.length, cargos_disponiveis: CARGOS });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao listar usuarios');
  }
};

export const createUsuario = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { nome, email, senha, cargo, oab } = req.body ?? {};

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({ message: 'O nome e obrigatorio.' });
    }
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ message: 'E-mail invalido.' });
    }
    if (typeof senha !== 'string' || senha.length < 10) {
      return res.status(400).json({ message: 'A senha deve ter ao menos 10 caracteres.' });
    }
    if (!isCargo(cargo)) {
      return res
        .status(400)
        .json({ message: `Cargo invalido. Valores aceitos: ${CARGOS.join(', ')}.` });
    }

    const emailNormalizado = String(email).trim().toLowerCase();

    const existente = await prisma.user.findUnique({
      where: { email: emailNormalizado },
      select: { id: true },
    });
    if (existente) {
      return res.status(409).json({ message: 'Ja existe usuario com este e-mail.' });
    }

    const usuario = await prisma.user.create({
      data: {
        tenant_id: tenantId,
        nome: String(nome).trim(),
        email: emailNormalizado,
        senha: await bcrypt.hash(senha, 12),
        cargo,
        oab: oab ? String(oab).trim() : null,
      },
      select: { id: true, nome: true, email: true, cargo: true, oab: true, ativo: true },
    });

    return res.status(201).json({ usuario });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao cadastrar usuario');
  }
};

export const setUsuarioAtivo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { ativo } = req.body ?? {};

    if (id === req.user!.id) {
      return res.status(400).json({ message: 'Nao e possivel desativar o proprio usuario.' });
    }

    const usuario = await prisma.user.findFirst({ where: { id, tenant_id: tenantId } });
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const atualizado = await prisma.user.update({
      where: { id },
      data: { ativo: Boolean(ativo) },
      select: { id: true, nome: true, email: true, cargo: true, ativo: true },
    });

    return res.json({ usuario: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao alterar situacao do usuario');
  }
};
