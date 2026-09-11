/**
 * Limite de tentativas de login.
 *
 * Sem isto, o endpoint de login aceita tentativas em sequencia contra
 * qualquer conta do escritorio. O bcrypt custo 12 torna cada tentativa lenta,
 * mas lento nao e o mesmo que inviavel - e o endpoint esta publico na
 * internet.
 *
 * O contador vive em tabela, nao em memoria. Nesta hospedagem nao ha
 * Passenger: o processo Node e reiniciado pelo cron, e contador em memoria
 * zeraria a cada reinicio. Um atacante so precisaria esperar a proxima
 * janela.
 *
 * DUAS CHAVES, de proposito:
 *
 *   por e-mail  protege uma conta especifica contra ataque distribuido, em
 *               que cada tentativa vem de um IP diferente
 *   por IP      impede varrer muitas contas a partir de uma origem so
 *
 * Nenhuma das duas sozinha cobre o outro caso.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from './auth';

/** Janela de observacao e de bloqueio. */
export const JANELA_MINUTOS = 15;
/** Falhas no mesmo e-mail que disparam o bloqueio. */
export const LIMITE_POR_EMAIL = 5;
/** Falhas do mesmo IP que disparam o bloqueio. */
export const LIMITE_POR_IP = 20;

export function ipDaRequisicao(req: AuthenticatedRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'desconhecido'
  );
}

function inicioDaJanela(): Date {
  return new Date(Date.now() - JANELA_MINUTOS * 60 * 1000);
}

/**
 * Registra o resultado de uma tentativa.
 *
 * Guarda apenas e-mail, IP e se deu certo. NAO guarda a senha tentada nem
 * hash dela: isso transformaria a tabela num deposito de senhas provaveis dos
 * usuarios, util para quem invadisse o banco.
 */
export async function registrarTentativa(
  email: string,
  ip: string,
  sucesso: boolean
): Promise<void> {
  try {
    await prisma.tentativaLogin.create({
      data: { email: email.trim().toLowerCase(), ip, sucesso },
    });

    // Login bem-sucedido zera o contador daquele e-mail: quem acertou a senha
    // nao deve ficar bloqueado por ter errado antes.
    if (sucesso) {
      await prisma.tentativaLogin.deleteMany({
        where: { email: email.trim().toLowerCase(), sucesso: false },
      });
    }
  } catch {
    // Falha ao registrar nao pode derrubar o login. O limite fica mais frouxo
    // por um instante, o que e melhor que negar acesso a todo mundo porque a
    // tabela de auditoria de tentativas teve um problema.
  }
}

/** Remove registros fora da janela. Chamado no login, sem job dedicado. */
async function limparAntigos(): Promise<void> {
  try {
    await prisma.tentativaLogin.deleteMany({
      where: { criado_em: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  } catch {
    // Limpeza e oportunista.
  }
}

/**
 * Barra a requisicao quando o e-mail ou o IP passou do limite na janela.
 *
 * Use antes do controller de login.
 */
export async function limitarLogin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const ip = ipDaRequisicao(req);
  const desde = inicioDaJanela();

  // 1 em cada 20 logins limpa o historico antigo.
  if (Math.random() < 0.05) void limparAntigos();

  try {
    const [falhasEmail, falhasIp] = await Promise.all([
      email
        ? prisma.tentativaLogin.count({
            where: { email, sucesso: false, criado_em: { gte: desde } },
          })
        : Promise.resolve(0),
      prisma.tentativaLogin.count({
        where: { ip, sucesso: false, criado_em: { gte: desde } },
      }),
    ]);

    if (falhasEmail >= LIMITE_POR_EMAIL || falhasIp >= LIMITE_POR_IP) {
      // 429 com Retry-After. A mensagem nao diz qual das duas chaves bateu:
      // informar isso ajudaria o atacante a calibrar o ataque.
      res.setHeader('Retry-After', String(JANELA_MINUTOS * 60));
      res.status(429).json({
        message:
          `Muitas tentativas de login. Aguarde ${JANELA_MINUTOS} minutos e tente de novo. ` +
          'Se voce esqueceu a senha, peca ao socio administrador para redefinir.',
        codigo: 'MUITAS_TENTATIVAS',
      });
      return;
    }
  } catch {
    // Banco indisponivel para a contagem: deixa passar. O login em si vai
    // falhar logo adiante de qualquer forma, e negar aqui daria uma mensagem
    // enganosa sobre o motivo.
  }

  next();
}
