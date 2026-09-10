import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../lib/config';
import { tratarErro } from '../lib/httpError';
import { AuthenticatedRequest } from '../middleware/auth';
import { registrarAuditoria } from '../middleware/auditLogger';

function ipDaRequisicao(req: AuthenticatedRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    ''
  );
}

export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, senha } = req.body ?? {};

    if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
      return res.status(400).json({ message: 'E-mail e senha sao obrigatorios.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { tenant: true },
    });

    // Mensagem identica para usuario inexistente e senha errada, e bcrypt
    // executado nos dois caminhos: mensagens distintas permitiriam descobrir
    // quais e-mails existem no sistema.
    const hashComparacao =
      user?.senha ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
    const senhaConfere = await bcrypt.compare(senha, hashComparacao);

    if (!user || !senhaConfere) {
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    if (!user.ativo) {
      return res.status(403).json({
        message: 'Este usuario esta inativo. Procure o socio administrador do escritorio.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: user.tenant_id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    await registrarAuditoria({
      tenantId: user.tenant_id,
      usuarioId: user.id,
      acao: 'LOGIN',
      entidade: 'sessao',
      entidadeId: user.id,
      detalhe: `Login efetuado por ${user.email}.`,
      ip: ipDaRequisicao(req),
      userAgent: String(req.headers['user-agent'] ?? ''),
    });

    return res.json({
      token,
      expira_em: config.jwtExpiresIn,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        oab: user.oab,
        tenant: {
          id: user.tenant.id,
          nome: user.tenant.nome,
          cnpj: user.tenant.cnpj,
        },
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro interno ao realizar login');
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, tenant_id: req.tenant_id! },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        oab: true,
        ativo: true,
        tenant: { select: { id: true, nome: true, cnpj: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }
    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuario inativo.' });
    }

    return res.json({ user });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao buscar dados do usuario');
  }
};
