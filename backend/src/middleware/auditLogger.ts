import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from './auth';

export type AcaoAuditada = 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC' | 'LOGIN';

/** Campos que nunca entram na trilha de auditoria. */
const CAMPOS_SENSIVEIS = new Set([
  'senha',
  'senha_atual',
  'nova_senha',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'pin',
  'secret',
  'chave_privada',
]);

function redigir(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 4 || valor === null || typeof valor !== 'object') {
    return valor;
  }
  if (Array.isArray(valor)) {
    return valor.slice(0, 50).map((v) => redigir(v, profundidade + 1));
  }
  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    saida[chave] = CAMPOS_SENSIVEIS.has(chave.toLowerCase())
      ? '[REDIGIDO]'
      : redigir(v, profundidade + 1);
  }
  return saida;
}

/**
 * Middleware de auditoria LGPD.
 *
 * Grava quem visualizou, criou, alterou ou excluiu registro, com nome, cargo,
 * IP, user-agent e rota. Grava apos a resposta sair, e somente quando o status
 * indica sucesso - operacao que falhou com 4xx/5xx nao alterou dado.
 *
 * Falha de gravacao do log nunca derruba a requisicao: e registrada no console
 * e a resposta ao cliente segue normal.
 */
export function logUserAction(acao: AcaoAuditada, entidade: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 400) return;

      const tenantId = req.tenant_id ?? req.user?.tenant_id;
      if (!tenantId) return;

      const ip =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '';

      const detalhe = {
        usuario: req.user?.nome ?? 'desconhecido',
        cargo: req.user?.cargo ?? 'desconhecido',
        metodo: req.method,
        rota: req.originalUrl,
        status: res.statusCode,
        params: req.params,
        query: redigir(req.query),
        body: acao === 'VIEW' ? undefined : redigir(req.body),
      };

      const entidadeId =
        (typeof req.params.id === 'string' && req.params.id) ||
        (typeof req.body?.id === 'string' && req.body.id) ||
        null;

      // Deliberadamente sem await: a trilha nao deve atrasar a resposta.
      prisma.auditLog
        .create({
          data: {
            tenant_id: tenantId,
            usuario_id: req.user?.id ?? null,
            acao: `${acao}_${entidade.toUpperCase()}`,
            entidade,
            entidade_id: entidadeId,
            detalhe: JSON.stringify(detalhe),
            ip: String(ip).slice(0, 190),
            user_agent: String(req.headers['user-agent'] ?? '').slice(0, 500),
          },
        })
        .catch((err) => {
          console.error('[JuridFlow AuditLog] falha ao gravar trilha:', err);
        });
    });

    next();
  };
}

/** Registro de auditoria fora do ciclo de request (login, jobs, sincronizacao). */
export async function registrarAuditoria(params: {
  tenantId: string;
  usuarioId?: string | null;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhe?: string;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenant_id: params.tenantId,
        usuario_id: params.usuarioId ?? null,
        acao: params.acao,
        entidade: params.entidade,
        entidade_id: params.entidadeId ?? null,
        detalhe: params.detalhe ?? null,
        ip: (params.ip ?? '').slice(0, 190),
        user_agent: (params.userAgent ?? '').slice(0, 500),
      },
    });
  } catch (err) {
    console.error('[JuridFlow AuditLog] falha ao gravar trilha:', err);
  }
}
