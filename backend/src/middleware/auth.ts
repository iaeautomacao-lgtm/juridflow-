import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { Cargo, isCargo } from '../lib/cargos';
import { prisma } from '../lib/prisma';

export interface UsuarioAutenticado {
  id: string;
  tenant_id: string;
  nome: string;
  email: string;
  cargo: Cargo;
}

export interface AuthenticatedRequest extends Request {
  user?: UsuarioAutenticado;
  tenant_id?: string;
}

interface PayloadToken {
  id?: unknown;
  tenant_id?: unknown;
  nome?: unknown;
  email?: unknown;
  cargo?: unknown;
  /** Emitido em, em segundos desde a epoca. Preenchido pelo jsonwebtoken. */
  iat?: unknown;
}

/**
 * Rotas liberadas para quem esta com senha provisoria.
 *
 * Senha definida por outra pessoa - pelo seed ou pelo socio - nao deve dar
 * acesso ao sistema: ela existe apenas para a pessoa entrar uma vez e trocar.
 * Enquanto nao trocar, so estas passam.
 */
const ROTAS_COM_SENHA_PROVISORIA = ['/auth/trocar-senha', '/auth/me'];

function exigeTrocaDeSenha(req: AuthenticatedRequest): boolean {
  const caminho = (req.baseUrl || '') + (req.path || '');
  return !ROTAS_COM_SENHA_PROVISORIA.some((rota) => caminho.endsWith(rota));
}

/**
 * Exige token JWT valido e sessao ainda vigente.
 *
 * Nao existe caminho alternativo. Token ausente, malformado, expirado ou com
 * assinatura invalida resulta em 401 - nunca em sessao de outro usuario.
 *
 * A versao anterior deste arquivo, ao falhar a verificacao, buscava o primeiro
 * Tenant e o primeiro User do banco e seguia com next(). O efeito era que toda
 * rota "autenticada" respondia a qualquer requisicao, sem credencial, com os
 * dados do primeiro usuario cadastrado.
 *
 * POR QUE CONSULTA O BANCO
 *   Verificar so a assinatura torna o token soberano ate expirar. Desativar
 *   um usuario ou trocar a senha dele nao derrubava a sessao: ele seguia
 *   dentro por ate 12 horas. Para um sistema com gestao de perfis isso e
 *   inaceitavel - alguem desligado do escritorio continuaria acessando os
 *   autos.
 *
 *   A consulta tambem faz o CARGO vir do banco, nao do token. Rebaixar
 *   alguem passa a valer na requisicao seguinte, sem esperar novo login.
 *
 *   Custo: uma query por requisicao autenticada. Na escala de um escritorio
 *   isso e irrelevante perto do que compra.
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      message: 'Token de acesso ausente.',
      codigo: 'TOKEN_AUSENTE',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    res.status(401).json({ message: 'Token de acesso vazio.', codigo: 'TOKEN_AUSENTE' });
    return;
  }

  let payload: PayloadToken;
  try {
    payload = jwt.verify(token, config.jwtSecret) as PayloadToken;
  } catch (error) {
    const expirado = error instanceof jwt.TokenExpiredError;
    res.status(401).json({
      message: expirado ? 'Sessao expirada. Faca login novamente.' : 'Token invalido.',
      codigo: expirado ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO',
    });
    return;
  }

  if (
    typeof payload.id !== 'string' ||
    typeof payload.tenant_id !== 'string' ||
    typeof payload.nome !== 'string' ||
    typeof payload.email !== 'string' ||
    !isCargo(payload.cargo)
  ) {
    res.status(401).json({
      message: 'Token com formato inesperado.',
      codigo: 'TOKEN_INVALIDO',
    });
    return;
  }

  const usuario = await prisma.user.findFirst({
    where: { id: payload.id, tenant_id: payload.tenant_id },
    select: {
      id: true,
      tenant_id: true,
      nome: true,
      email: true,
      cargo: true,
      ativo: true,
      token_valido_apos: true,
      senha_provisoria: true,
    },
  });

  if (!usuario) {
    res.status(401).json({
      message: 'Sessao invalida. Faca login novamente.',
      codigo: 'TOKEN_INVALIDO',
    });
    return;
  }

  if (!usuario.ativo) {
    res.status(403).json({
      message: 'Este usuario esta inativo. Procure o socio administrador do escritorio.',
      codigo: 'USUARIO_INATIVO',
    });
    return;
  }

  // Token emitido antes da ultima revogacao. O `iat` vem em segundos; a
  // comparacao desce o corte para o segundo cheio, senao um token emitido no
  // mesmo segundo da revogacao poderia ser aceito por arredondamento.
  if (usuario.token_valido_apos) {
    const emitidoEm = typeof payload.iat === 'number' ? payload.iat : 0;
    const corte = Math.floor(usuario.token_valido_apos.getTime() / 1000);
    if (emitidoEm < corte) {
      res.status(401).json({
        message: 'Sua sessao foi encerrada. Faca login novamente.',
        codigo: 'SESSAO_REVOGADA',
      });
      return;
    }
  }

  if (!isCargo(usuario.cargo)) {
    res.status(403).json({
      message: 'Perfil de acesso invalido. Procure o socio administrador.',
      codigo: 'CARGO_INVALIDO',
    });
    return;
  }

  if (usuario.senha_provisoria && exigeTrocaDeSenha(req)) {
    res.status(403).json({
      message: 'Sua senha e provisoria. Defina uma nova senha para continuar.',
      codigo: 'SENHA_PROVISORIA',
    });
    return;
  }

  // Dados do banco, nao do token: cargo e nome alterados valem de imediato.
  req.user = {
    id: usuario.id,
    tenant_id: usuario.tenant_id,
    nome: usuario.nome,
    email: usuario.email,
    cargo: usuario.cargo,
  };
  req.tenant_id = usuario.tenant_id;

  next();
};

/**
 * Restringe a rota a cargos especificos. Use sempre depois de authMiddleware.
 *
 * Ex.: router.get('/financeiro/transacoes', authMiddleware,
 *        requireCargo('socio', 'financeiro'), financeiroController.getTransacoes)
 */
export function requireCargo(...cargosPermitidos: Cargo[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Nao autenticado.', codigo: 'TOKEN_AUSENTE' });
      return;
    }

    if (!cargosPermitidos.includes(req.user.cargo)) {
      res.status(403).json({
        message: 'Seu perfil de acesso nao permite esta operacao.',
        codigo: 'CARGO_SEM_PERMISSAO',
        cargo_atual: req.user.cargo,
        cargos_necessarios: cargosPermitidos,
      });
      return;
    }

    next();
  };
}
