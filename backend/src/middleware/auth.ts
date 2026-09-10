import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { Cargo, isCargo } from '../lib/cargos';

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
}

/**
 * Exige token JWT valido.
 *
 * Nao existe caminho alternativo. Token ausente, malformado, expirado ou com
 * assinatura invalida resulta em 401 - nunca em sessao de outro usuario.
 *
 * A versao anterior deste arquivo, ao falhar a verificacao, buscava o primeiro
 * Tenant e o primeiro User do banco e seguia com next(). O efeito era que toda
 * rota "autenticada" respondia a qualquer requisicao, sem credencial, com os
 * dados do primeiro usuario cadastrado.
 */
export const authMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
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

  req.user = {
    id: payload.id,
    tenant_id: payload.tenant_id,
    nome: payload.nome,
    email: payload.email,
    cargo: payload.cargo,
  };
  req.tenant_id = payload.tenant_id;

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
