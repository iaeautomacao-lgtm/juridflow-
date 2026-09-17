import { prisma } from '../lib/prisma';
import { registrarAuditoria } from '../middleware/auditLogger';
import { sincronizarIntimacoesDJEN } from './djenService';
import { consultarEAtualizarDataJud } from './datajudService';

/**
 * Captura agendada - DJEN e DataJud, sem ninguem clicar.
 *
 * Ate aqui a captura so existia como rota HTTP, disparada pelo botao da
 * Central de Captura. Na pratica isso significa que o escritorio so descobre
 * uma intimacao quando alguem lembra de abrir a tela e clicar - e intimacao e
 * o que dispara prazo.
 *
 * Este modulo e o mesmo trabalho, rodando sozinho pelo cron.
 *
 * Por que nao um cron chamando a propria API por HTTP: seria preciso deixar
 * uma credencial de servico no disco do servidor, ou abrir a rota sem
 * autenticacao. As duas saidas sao piores do que a que esta aqui - o job fala
 * direto com o banco, no mesmo processo, e nao ha token nenhum a roubar.
 *
 * Nenhuma senha de tribunal esta envolvida: DJEN e DataJud sao canais
 * publicos do CNJ. O DataJud usa uma chave publica, distribuida pelo proprio
 * CNJ na documentacao, que vive em DATAJUD_API_KEY.
 */

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

function inteiroDoAmbiente(nome: string, padrao: number, minimo: number, maximo: number): number {
  const bruto = Number.parseInt(process.env[nome] ?? '', 10);
  if (!Number.isFinite(bruto)) return padrao;
  return Math.min(Math.max(bruto, minimo), maximo);
}

/** Nao reconsulta no DataJud um processo verificado ha menos que isto. */
const INTERVALO_HORAS = inteiroDoAmbiente('CAPTURA_INTERVALO_HORAS', 6, 1, 168);

/**
 * Teto de processos por execucao.
 *
 * O DataJud e API publica do CNJ e nao existe para receber varredura de
 * catalogo inteiro de uma vez. Com o teto, a fila gira: quem foi verificado ha
 * mais tempo entra primeiro (ordenacao por ultima_verificacao), entao em
 * algumas execucoes todo mundo passa.
 */
const MAX_PROCESSOS = inteiroDoAmbiente('CAPTURA_MAX_PROCESSOS', 40, 1, 500);

/** Pausa entre consultas ao DataJud. Educacao com servico publico. */
const PAUSA_MS = inteiroDoAmbiente('CAPTURA_PAUSA_MS', 1500, 200, 30000);

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export interface ResultadoDjen {
  oab_uf: string;
  capturadas: number;
  novas: number;
  vinculadas: number;
  sem_processo: number;
  erro?: string;
}

export interface ResultadoDataJud {
  consultados: number;
  movimentos_novos: number;
  falhas: number;
  /** Na fila e ainda nao verificado nesta execucao, por causa do teto. */
  restantes: number;
}

export interface ResumoTenant {
  tenant_id: string;
  tenant_nome: string;
  djen: ResultadoDjen[];
  datajud: ResultadoDataJud;
  erro?: string;
}

// ---------------------------------------------------------------------------
// DJEN - intimacoes por OAB
// ---------------------------------------------------------------------------

async function capturarDjen(tenantId: string): Promise<ResultadoDjen[]> {
  const franquias = await prisma.franquiaCaptura.findMany({
    where: { tenant_id: tenantId, status: 'ativa' },
    orderBy: { criado_em: 'asc' },
  });

  const resultados: ResultadoDjen[] = [];

  for (const franquia of franquias) {
    try {
      const r = await sincronizarIntimacoesDJEN(tenantId, franquia.termo_oab);
      resultados.push({
        oab_uf: r.oab_uf,
        capturadas: r.capturadas,
        novas: r.novas,
        vinculadas: r.vinculadas,
        sem_processo: r.sem_processo,
      });

      // Trilha so quando houve novidade. Um registro por hora dizendo "nada
      // novo" transformaria a auditoria em ruido e esconderia o que importa.
      if (r.novas > 0) {
        await registrarAuditoria({
          tenantId,
          usuarioId: null, // job: nao ha usuario por tras
          acao: 'SYNC_DJEN',
          entidade: 'intimacao',
          detalhe:
            `Captura agendada do DJEN para a OAB ${r.oab_uf}. ` +
            `Capturadas: ${r.capturadas}, novas: ${r.novas}, ` +
            `vinculadas: ${r.vinculadas}, sem processo: ${r.sem_processo}.`,
          ip: 'cron',
        });
      }
    } catch (erro) {
      const mensagem = mensagemDoErro(erro);
      resultados.push({
        oab_uf: franquia.termo_oab,
        capturadas: 0,
        novas: 0,
        vinculadas: 0,
        sem_processo: 0,
        erro: mensagem,
      });

      // Falha de captura de intimacao precisa deixar rastro: e o canal que
      // dispara prazo. Silenciar aqui seria esconder justamente o que tem
      // consequencia.
      await registrarAuditoria({
        tenantId,
        usuarioId: null,
        acao: 'SYNC_DJEN_FALHA',
        entidade: 'intimacao',
        detalhe: `Captura agendada do DJEN falhou para a OAB ${franquia.termo_oab}: ${mensagem}`,
        ip: 'cron',
      });
    }
  }

  return resultados;
}

// ---------------------------------------------------------------------------
// DataJud - movimentacao dos processos monitorados
// ---------------------------------------------------------------------------

async function capturarDataJud(tenantId: string): Promise<ResultadoDataJud> {
  const corte = new Date(Date.now() - INTERVALO_HORAS * 3_600_000);

  const criterio = {
    tenant_id: tenantId,
    // 'pausada' fica de fora de proposito: alguem pausou por algum motivo.
    status: { in: ['ativa', 'erro'] },
    ultima_verificacao: { lt: corte },
  };

  const [fila, naFila] = await Promise.all([
    prisma.capturaPush.findMany({
      where: criterio,
      orderBy: { ultima_verificacao: 'asc' },
      take: MAX_PROCESSOS,
    }),
    prisma.capturaPush.count({ where: criterio }),
  ]);

  let movimentosNovos = 0;
  let falhas = 0;

  for (const [indice, monitorado] of fila.entries()) {
    try {
      const r = await consultarEAtualizarDataJud(tenantId, monitorado.cnj);
      movimentosNovos += r.movimentosNovos;

      await prisma.capturaPush.update({
        where: { id: monitorado.id },
        data: { ultima_verificacao: new Date(), status: 'ativa', ultimo_erro: null },
      });
    } catch (erro) {
      falhas++;

      // ultima_verificacao avanca mesmo na falha. Sem isso, um processo que o
      // DataJud nao conhece voltaria ao topo da fila em toda execucao e
      // consumiria o teto para sempre, impedindo os demais de serem vistos.
      await prisma.capturaPush.update({
        where: { id: monitorado.id },
        data: {
          ultima_verificacao: new Date(),
          status: 'erro',
          ultimo_erro: mensagemDoErro(erro).slice(0, 1000),
        },
      });
    }

    if (indice < fila.length - 1) await esperar(PAUSA_MS);
  }

  if (movimentosNovos > 0 || falhas > 0) {
    await registrarAuditoria({
      tenantId,
      usuarioId: null,
      acao: 'SYNC_DATAJUD',
      entidade: 'processo',
      detalhe:
        `Captura agendada do DataJud. Processos consultados: ${fila.length}, ` +
        `movimentos novos: ${movimentosNovos}, falhas: ${falhas}.`,
      ip: 'cron',
    });
  }

  return {
    consultados: fila.length,
    movimentos_novos: movimentosNovos,
    falhas,
    restantes: Math.max(naFila - fila.length, 0),
  };
}

// ---------------------------------------------------------------------------
// Orquestracao
// ---------------------------------------------------------------------------

/** Roda a captura de um escritorio. Erro aqui nao derruba os demais. */
export async function capturarTenant(tenant: {
  id: string;
  nome: string;
}): Promise<ResumoTenant> {
  const base: ResumoTenant = {
    tenant_id: tenant.id,
    tenant_nome: tenant.nome,
    djen: [],
    datajud: { consultados: 0, movimentos_novos: 0, falhas: 0, restantes: 0 },
  };

  try {
    base.djen = await capturarDjen(tenant.id);
    base.datajud = await capturarDataJud(tenant.id);
  } catch (erro) {
    base.erro = mensagemDoErro(erro);
  }

  return base;
}

/** Roda a captura de todos os escritorios cadastrados. */
export async function capturarTudo(): Promise<ResumoTenant[]> {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, nome: true },
    orderBy: { criado_em: 'asc' },
  });

  const resumos: ResumoTenant[] = [];
  for (const tenant of tenants) {
    resumos.push(await capturarTenant(tenant));
  }
  return resumos;
}
