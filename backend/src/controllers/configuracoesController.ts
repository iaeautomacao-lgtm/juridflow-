import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { lerPaginacao, envelope } from '../lib/pagination';
import { CARGOS, isCargo } from '../lib/cargos';
import { AuthenticatedRequest } from '../middleware/auth';
import { registrarAuditoria } from '../middleware/auditLogger';
import { validarSenha } from '../lib/senha';

function ipDaRequisicao(req: AuthenticatedRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    ''
  );
}

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
    const validacaoSenha = validarSenha(senha, { email: String(email), nome: String(nome) });
    if (!validacaoSenha.valida) {
      return res.status(400).json({ message: validacaoSenha.erro });
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
        senha: await bcrypt.hash(senha as string, 12),
        cargo,
        oab: oab ? String(oab).trim() : null,
        // Senha definida pelo socio, nao pela pessoa: ela entra uma vez e e
        // obrigada a trocar. Ate la, o authMiddleware so libera a rota de
        // troca de senha.
        senha_provisoria: true,
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

    const desativando = !Boolean(ativo);

    // Desativar o ultimo socio ativo deixaria o escritorio sem ninguem capaz
    // de gerir usuarios, financeiro e auditoria - so o terminal resolveria.
    if (desativando && usuario.cargo === 'socio') {
      const outrosSocios = await prisma.user.count({
        where: { tenant_id: tenantId, cargo: 'socio', ativo: true, id: { not: id } },
      });
      if (outrosSocios === 0) {
        return res.status(409).json({
          message:
            'Este e o unico socio ativo do escritorio. Promova outro usuario a socio antes de desativa-lo.',
          codigo: 'ULTIMO_SOCIO',
        });
      }
    }

    const atualizado = await prisma.user.update({
      where: { id },
      data: {
        ativo: Boolean(ativo),
        // Desativar precisa derrubar a sessao na hora. Sem isto, alguem
        // desligado do escritorio seguiria acessando os autos ate o token
        // expirar, ate 12 horas depois.
        ...(desativando ? { token_valido_apos: new Date() } : {}),
      },
      select: { id: true, nome: true, email: true, cargo: true, ativo: true },
    });

    await registrarAuditoria({
      tenantId,
      usuarioId: req.user!.id,
      acao: desativando ? 'DESATIVAR_USUARIO' : 'ATIVAR_USUARIO',
      entidade: 'usuario',
      entidadeId: id,
      detalhe: `${req.user!.email} ${desativando ? 'desativou' : 'reativou'} ${usuario.email}` +
        (desativando ? '. Sessoes encerradas.' : '.'),
      ip: ipDaRequisicao(req),
      userAgent: String(req.headers['user-agent'] ?? ''),
    });

    return res.json({ usuario: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao alterar situacao do usuario');
  }
};

/**
 * Socio redefine a senha de outro usuario do escritorio.
 *
 * A senha nasce provisoria: quem a definiu nao foi o dono da conta, entao ela
 * serve so para uma entrada, e o authMiddleware bloqueia tudo ate a troca.
 * Sem isso, o socio ficaria sabendo a senha de acesso de um advogado - e a
 * trilha de auditoria perderia o sentido, porque nao daria para distinguir o
 * que foi feito por quem.
 *
 * Encerra tambem as sessoes ativas do usuario: se a redefinicao foi porque a
 * conta estava comprometida, deixar a sessao do invasor viva anularia a medida.
 */
export const redefinirSenhaUsuario = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { senha_nova } = req.body ?? {};

    const alvo = await prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true, nome: true, email: true, cargo: true },
    });

    if (!alvo) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const validacao = validarSenha(senha_nova, { email: alvo.email, nome: alvo.nome });
    if (!validacao.valida) {
      return res.status(400).json({ message: validacao.erro });
    }

    await prisma.user.update({
      where: { id },
      data: {
        senha: await bcrypt.hash(senha_nova as string, 12),
        senha_provisoria: true,
        token_valido_apos: new Date(),
      },
    });

    await registrarAuditoria({
      tenantId,
      usuarioId: req.user!.id,
      acao: 'REDEFINIR_SENHA_USUARIO',
      entidade: 'usuario',
      entidadeId: id,
      detalhe:
        `${req.user!.email} redefiniu a senha de ${alvo.email}. ` +
        'Senha marcada como provisoria e sessoes encerradas.',
      ip: ipDaRequisicao(req),
      userAgent: String(req.headers['user-agent'] ?? ''),
    });

    return res.json({
      message:
        `Senha de ${alvo.email} redefinida. ` +
        'Ela e provisoria: o usuario sera obrigado a definir uma nova no proximo acesso.',
      usuario: { id: alvo.id, nome: alvo.nome, email: alvo.email },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao redefinir a senha do usuario');
  }
};

/**
 * Socio edita nome, cargo e OAB de um usuario do escritorio.
 *
 * Nao permite alterar o proprio cargo, nem rebaixar o ultimo socio ativo: as
 * duas coisas levariam o escritorio a ficar sem ninguem capaz de administrar.
 */
export const updateUsuario = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { id } = req.params;
    const { nome, cargo, oab } = req.body ?? {};

    const alvo = await prisma.user.findFirst({ where: { id, tenant_id: tenantId } });
    if (!alvo) {
      return res.status(404).json({ message: 'Usuario nao encontrado.' });
    }

    const dados: Record<string, unknown> = {};

    if (nome !== undefined) {
      if (!String(nome).trim()) {
        return res.status(400).json({ message: 'O nome nao pode ficar vazio.' });
      }
      dados.nome = String(nome).trim();
    }

    if (oab !== undefined) {
      dados.oab = oab ? String(oab).trim() : null;
    }

    const mudouCargo = cargo !== undefined && cargo !== alvo.cargo;

    if (cargo !== undefined) {
      if (!isCargo(cargo)) {
        return res
          .status(400)
          .json({ message: `Cargo invalido. Valores aceitos: ${CARGOS.join(', ')}.` });
      }

      // Auto-promocao e auto-rebaixamento saem pela mesma porta: se alguem
      // pudesse mudar o proprio cargo, requireCargo viraria decoracao.
      if (id === req.user!.id) {
        return res.status(403).json({
          message: 'Voce nao pode alterar o proprio cargo. Peca a outro socio.',
          codigo: 'CARGO_PROPRIO',
        });
      }

      if (mudouCargo && alvo.cargo === 'socio') {
        const outrosSocios = await prisma.user.count({
          where: { tenant_id: tenantId, cargo: 'socio', ativo: true, id: { not: id } },
        });
        if (outrosSocios === 0) {
          return res.status(409).json({
            message:
              'Este e o unico socio ativo do escritorio. Promova outro usuario a socio antes de mudar o cargo dele.',
            codigo: 'ULTIMO_SOCIO',
          });
        }
      }

      dados.cargo = cargo;
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({ message: 'Nada para alterar.' });
    }

    // Mudanca de cargo encerra as sessoes: o cargo ja vem do banco a cada
    // requisicao, mas forcar novo login evita que a pessoa siga vendo uma
    // tela montada com as permissoes antigas.
    if (mudouCargo) {
      dados.token_valido_apos = new Date();
    }

    const atualizado = await prisma.user.update({
      where: { id },
      data: dados,
      select: { id: true, nome: true, email: true, cargo: true, oab: true, ativo: true },
    });

    await registrarAuditoria({
      tenantId,
      usuarioId: req.user!.id,
      acao: 'ATUALIZAR_USUARIO',
      entidade: 'usuario',
      entidadeId: id,
      detalhe:
        `${req.user!.email} alterou ${alvo.email}: ` +
        Object.keys(dados)
          .filter((k) => k !== 'token_valido_apos')
          .join(', ') +
        (mudouCargo ? ` (cargo ${alvo.cargo} -> ${cargo}, sessoes encerradas)` : ''),
      ip: ipDaRequisicao(req),
      userAgent: String(req.headers['user-agent'] ?? ''),
    });

    return res.json({ usuario: atualizado });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao atualizar usuario');
  }
};
