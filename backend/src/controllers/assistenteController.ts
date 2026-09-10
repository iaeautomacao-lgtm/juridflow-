import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { tratarErro } from '../lib/httpError';
import { AuthenticatedRequest } from '../middleware/auth';
import { calcularPrazo, coberturaCalendario } from '../services/prazoService';

/**
 * Flow - assistente do JuridFlow.
 *
 * IMPORTANTE, sobre o que este modulo e e o que nao e:
 *
 * Ele NAO chama modelo de linguagem. E um assistente deterministico: consulta
 * o banco do escritorio e responde com regra explicita, escrita neste arquivo.
 *
 * A versao anterior devolvia o campo `modelo: 'JuridFlow Legal LLM v4.2 (RAG
 * Enabled)'` e `creditos_restantes: 4850` sobre exatamente esta mesma cadeia
 * de if/else - nao havia modelo, nem RAG, nem credito. O rotulo foi removido:
 * a resposta agora declara `modo: 'regras_locais'`.
 *
 * Para plugar uma LLM de verdade depois, o ponto de extensao e a funcao
 * `responder`. A chamada precisa ser assincrona (resposta de LLM nao cabe no
 * tempo de um request sincrono), a conversa precisa ser persistida, e o
 * contexto enviado ao provedor precisa passar por decisao explicita sobre
 * sigilo profissional - dado de cliente saindo do servidor do escritorio para
 * um terceiro e tratamento de dado pessoal sob a LGPD.
 */

interface RespostaAssistente {
  resposta: string;
  fundamento?: string[];
  acao_sugerida?: { tipo: string; rotulo: string; payload?: Record<string, unknown> };
}

const REGEX_CNJ = /(\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4})/;

async function responder(
  tenantId: string,
  prompt: string,
  contexto: { processoId?: string }
): Promise<RespostaAssistente> {
  const q = prompt.toLowerCase();

  // 1. Numero de processo no texto: consulta a base e responde com dado real.
  const cnjNoTexto = REGEX_CNJ.exec(prompt);
  if (cnjNoTexto) {
    const { formatarCnj } = await import('../lib/tribunais');
    const cnj = formatarCnj(cnjNoTexto[1]);
    const processo = await prisma.processo.findFirst({
      where: { tenant_id: tenantId, cnj },
    });

    if (!processo) {
      return {
        resposta:
          `Nao encontrei o processo ${cnj} na base do escritorio. ` +
          'Se ele existe no tribunal, use a Central de Captura para consultar o DataJud e cadastra-lo.',
        acao_sugerida: {
          tipo: 'consultar_datajud',
          rotulo: `Consultar ${cnj} no DataJud`,
          payload: { cnj },
        },
      };
    }

    const andamentos = await prisma.andamento.findMany({
      where: {
        tenant_id: tenantId,
        chave_modulo: 'processo',
        codigo_registro_vinculo: processo.id,
      },
      orderBy: { data: 'desc' },
      take: 3,
    });

    const tarefasAbertas = await prisma.tarefa.count({
      where: {
        tenant_id: tenantId,
        chave_modulo: 'processo',
        codigo_registro_vinculo: processo.id,
        status: { in: ['a_fazer', 'em_andamento'] },
      },
    });

    const linhasAndamento = andamentos.length
      ? andamentos
          .map(
            (a) =>
              `- ${new Date(a.data).toLocaleDateString('pt-BR')}: ${a.descricao} (fonte: ${a.fonte})`
          )
          .join('\n')
      : '- Nenhum andamento registrado.';

    return {
      resposta:
        `**${processo.titulo}**\n` +
        `CNJ ${processo.cnj} | ${processo.orgao}${processo.vara ? ` | ${processo.vara}` : ''}\n` +
        `Cliente: ${processo.cliente || 'nao informado'} | Status: ${processo.status}\n\n` +
        `Ultimos andamentos:\n${linhasAndamento}\n\n` +
        `Tarefas abertas: ${tarefasAbertas}`,
      acao_sugerida: {
        tipo: 'abrir_processo',
        rotulo: 'Abrir ficha dos autos',
        payload: { processo_id: processo.id },
      },
    };
  }

  // 2. Perguntas sobre prazo: responde a regra e encaminha para a calculadora,
  //    que usa o calendario forense de verdade.
  if (q.includes('prazo') || q.includes('contesta') || q.includes('recurso') || q.includes('apela')) {
    return {
      resposta:
        'Prazos processuais correm em dias uteis (art. 219 do CPC), com a contagem ' +
        'iniciando no primeiro dia util seguinte a publicacao (art. 224, par. 3), e ' +
        'suspensos entre 20/12 e 20/01 (art. 220).\n\n' +
        'Prazos mais comuns:\n' +
        '- Contestacao: 15 dias uteis\n' +
        '- Apelacao e agravo de instrumento: 15 dias uteis\n' +
        '- Embargos de declaracao: 5 dias uteis\n' +
        '- Contrarrazoes de apelacao: 15 dias uteis\n\n' +
        'Para a data exata use a calculadora: ela aplica feriado nacional, recesso e ' +
        'os feriados locais cadastrados em Configuracoes.',
      fundamento: [
        'CPC/2015 art. 219',
        'CPC/2015 art. 220',
        'CPC/2015 art. 224',
      ],
      acao_sugerida: { tipo: 'abrir_calculadora_prazo', rotulo: 'Calcular prazo' },
    };
  }

  // 3. Intimacoes pendentes.
  if (q.includes('intima') || q.includes('pendente') || q.includes('djen')) {
    const [pendentes, semProcesso] = await Promise.all([
      prisma.intimacao.count({ where: { tenant_id: tenantId, status: 'pendente' } }),
      prisma.intimacao.count({
        where: { tenant_id: tenantId, status: 'processo_nao_localizado' },
      }),
    ]);

    return {
      resposta:
        `Intimacoes pendentes de tratamento: **${pendentes}**\n` +
        `Intimacoes cujo processo nao esta cadastrado: **${semProcesso}**\n\n` +
        (pendentes + semProcesso === 0
          ? 'Worklist limpa.'
          : 'Abra a tela de Intimacoes para vincular e abrir os prazos.'),
      acao_sugerida: { tipo: 'navegar', rotulo: 'Ver intimacoes', payload: { tab: 'intimacoes' } },
    };
  }

  // 4. Agenda e tarefas.
  if (q.includes('tarefa') || q.includes('agenda') || q.includes('vencendo') || q.includes('hoje')) {
    const agora = new Date();
    const em7dias = new Date(agora.getTime() + 7 * 86400000);

    const [atrasadas, proximas] = await Promise.all([
      prisma.tarefa.count({
        where: {
          tenant_id: tenantId,
          status: { in: ['a_fazer', 'em_andamento'] },
          vencimento: { lt: agora },
        },
      }),
      prisma.tarefa.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ['a_fazer', 'em_andamento'] },
          vencimento: { gte: agora, lte: em7dias },
        },
        orderBy: { vencimento: 'asc' },
        take: 5,
      }),
    ]);

    const lista = proximas.length
      ? proximas
          .map(
            (t) =>
              `- ${new Date(t.vencimento).toLocaleDateString('pt-BR')}: ${t.titulo} (${t.responsavel_nome})`
          )
          .join('\n')
      : '- Nada nos proximos 7 dias.';

    return {
      resposta:
        (atrasadas > 0 ? `**${atrasadas} tarefa(s) em atraso.**\n\n` : '') +
        `Proximos 7 dias:\n${lista}`,
      acao_sugerida: { tipo: 'navegar', rotulo: 'Abrir atividades', payload: { tab: 'atividades' } },
    };
  }

  // 5. Modelos de peca.
  if (q.includes('minuta') || q.includes('peticao') || q.includes('modelo') || q.includes('peca')) {
    const modelos = await prisma.modeloDocumento.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, titulo: true, categoria: true },
      take: 10,
    });

    return {
      resposta: modelos.length
        ? `Modelos cadastrados:\n${modelos.map((m) => `- ${m.titulo} (${m.categoria})`).join('\n')}\n\n` +
          'Tags disponiveis: {nome_cliente}, {numero_processo}, {vara}, {comarca}, ' +
          '{orgao}, {valor_causa}, {data_hoje}, {advogado_nome}, {advogado_oab}, {escritorio_nome}.'
        : 'Nenhum modelo de peca cadastrado ainda. Cadastre em Documentos > Modelos.',
      acao_sugerida: { tipo: 'navegar', rotulo: 'Abrir modelos', payload: { tab: 'modelos' } },
    };
  }

  // 6. Contexto de processo aberto na tela.
  if (contexto.processoId) {
    const processo = await prisma.processo.findFirst({
      where: { id: contexto.processoId, tenant_id: tenantId },
      select: { cnj: true, titulo: true, cliente: true, status: true },
    });
    if (processo) {
      return {
        resposta:
          `Voce esta no processo ${processo.cnj} (${processo.cliente || 'cliente nao informado'}), ` +
          `status ${processo.status}. Posso listar os ultimos andamentos, as tarefas abertas ` +
          'ou calcular um prazo. Pergunte de forma direta, ex.: "prazo de contestacao" ou ' +
          '"tarefas vencendo".',
      };
    }
  }

  // 7. Sem correspondencia: diz o que sabe fazer, em vez de fingir entender.
  return {
    resposta:
      'Nao entendi a pergunta. O que eu sei fazer hoje:\n\n' +
      '- Resumir um processo: cole o numero CNJ\n' +
      '- Calcular prazo em dias uteis pelo calendario forense\n' +
      '- Dizer quantas intimacoes estao pendentes\n' +
      '- Listar tarefas em atraso e as dos proximos 7 dias\n' +
      '- Listar os modelos de peca cadastrados\n\n' +
      'Sou um assistente por regras, nao um modelo de linguagem: respondo com dado ' +
      'do banco do escritorio e com o texto da lei, e digo quando nao sei.',
  };
}

export const chatAssistente = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const { prompt } = req.body ?? {};
    const contextoProcessoId = req.body?.contexto_processo_id ?? req.body?.contextoProcessoId;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ message: 'O campo prompt e obrigatorio.' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ message: 'Pergunta acima de 4000 caracteres.' });
    }

    const resultado = await responder(tenantId, prompt.trim(), {
      processoId: contextoProcessoId ? String(contextoProcessoId) : undefined,
    });

    return res.json({
      ...resultado,
      modo: 'regras_locais',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao processar a pergunta');
  }
};

/**
 * Calculadora de prazo.
 *
 * Delega para prazoService, que aplica o calendario forense completo. A versao
 * anterior calculava aqui mesmo pulando apenas sabado e domingo - sem feriado
 * nacional, sem recesso do art. 220 e sem feriado local -, o que produz
 * vencimento errado em quase todo prazo que atravessa dezembro, Carnaval,
 * Semana Santa ou Corpus Christi.
 */
export const calcularPrazoAssistente = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant_id!;
    const {
      data_publicacao,
      data_disponibilizacao,
      dias_prazo,
      tipo_dias,
      uf,
      municipio,
      orgao,
    } = req.body ?? {};

    const dias = Number.parseInt(String(dias_prazo ?? ''), 10);

    const resultado = await calcularPrazo({
      tenantId,
      disponibilizacao: data_disponibilizacao ?? undefined,
      publicacao: data_publicacao ?? undefined,
      dias,
      tipoDias: tipo_dias === 'corridos' ? 'corridos' : 'uteis',
      uf: uf ? String(uf) : undefined,
      municipio: municipio ? String(municipio) : undefined,
      orgao: orgao ? String(orgao) : undefined,
    });

    const cobertura = await coberturaCalendario(
      tenantId,
      new Date(resultado.vencimento).getUTCFullYear(),
      uf ? String(uf) : undefined
    );

    return res.json({
      prazo: resultado,
      // Aviso explicito quando o calendario nao tem feriado local cadastrado:
      // sem isso o resultado tem aparencia de certeza que nao possui.
      aviso: cobertura.aviso,
      calendario: {
        tem_feriado_local: cobertura.tem_feriado_local,
        feriados_cadastrados_no_ano: cobertura.total_cadastrado,
      },
    });
  } catch (error) {
    return tratarErro(res, error, 'Erro ao calcular prazo');
  }
};
