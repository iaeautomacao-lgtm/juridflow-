import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { config } from '../lib/config';
import { tratarErro } from '../lib/httpError';
import { AuthenticatedRequest } from '../middleware/auth';
import { registrarAuditoria } from '../middleware/auditLogger';
import { validarSenha } from '../lib/senha';
import { registrarTentativa } from '../middleware/rateLimit';

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
      // Conta para o limite de tentativas. E-mail inexistente tambem conta:
      // senao varrer quais contas existem sairia de graca.
      await registrarTentativa(email, ipDaRequisicao(req), false);
      return res.status(401).json({ message: 'Credenciais invalidas.' });
    }

    if (!user.ativo) {
      await registrarTentativa(email, ipDaRequisicao(req), false);
      return res.status(403).json({
        message: 'Este usuario esta inativo. Procure o socio administrador do escritorio.',
      });
    }

    await registrarTentativa(email, ipDaRequisicao(req), true);

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
        // O frontend usa isto para mandar direto a tela de troca: senha
        // definida por outra pessoa nao da acesso ao sistema.
        senha_provisoria: user.senha_provisoria,
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

/**
 * Troca a senha do proprio usuario autenticado.
 *
 * Exige a senha atual. Sem isso, um token roubado - deixado numa maquina
 * aberta, por exemplo - permitiria trocar a senha e tomar a conta em
 * definitivo, expulsando o dono.
 *
 * Ao trocar, `token_valido_apos` e movido para agora: todas as sessoes
 * anteriores caem, inclusive a de quem eventualmente tivesse roubado o token.
 * O usuario recebe um token novo na resposta, para nao ser deslogado da
 * sessao em que esta.
 */
export const trocarSenha = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { senha_atual, senha_nova } = req.body ?? {};

    if (typeof senha_atual !== 'string' || !senha_atual) {
      return res.status(400).json({ message: 'Informe a senha atual.' });
    }

    const user = await prisma.user.findFirst({
      where: { id: req.user!.id, tenant_id: req.tenant_id! },
      include: { tenant: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const confere = await bcrypt.compare(senha_atual, user.senha);
    if (!confere) {
      // Auditar a tentativa: trocar senha e operacao sensivel, e falha
      // repetida aqui pode indicar alguem mexendo numa sessao alheia.
      await registrarAuditoria({
        tenantId: user.tenant_id,
        usuarioId: user.id,
        acao: 'TROCAR_SENHA_FALHA',
        entidade: 'usuario',
        entidadeId: user.id,
        detalhe: 'Senha atual incorreta ao tentar trocar a propria senha.',
        ip: ipDaRequisicao(req),
        userAgent: String(req.headers['user-agent'] ?? ''),
      });
      return res.status(401).json({ message: 'A senha atual esta incorreta.' });
    }

    const validacao = validarSenha(senha_nova, { email: user.email, nome: user.nome });
    if (!validacao.valida) {
      return res.status(400).json({ message: validacao.erro });
    }

    if (await bcrypt.compare(senha_nova as string, user.senha)) {
      return res.status(400).json({ message: 'A senha nova precisa ser diferente da atual.' });
    }

    const agora = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        senha: await bcrypt.hash(senha_nova as string, 12),
        senha_provisoria: false,
        token_valido_apos: agora,
      },
    });

    await registrarAuditoria({
      tenantId: user.tenant_id,
      usuarioId: user.id,
      acao: 'TROCAR_SENHA',
      entidade: 'usuario',
      entidadeId: user.id,
      detalhe: `${user.email} trocou a propria senha. Sessoes anteriores encerradas.`,
      ip: ipDaRequisicao(req),
      userAgent: String(req.headers['user-agent'] ?? ''),
    });

    // Token novo, emitido depois do corte, para o usuario seguir na sessao
    // atual. Os demais dispositivos precisam entrar de novo.
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

    return res.json({
      message: 'Senha alterada. As outras sessoes foram encerradas.',
      token,
      expira_em: config.jwtExpiresIn,
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao trocar a senha');
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
        senha_provisoria: true,
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
