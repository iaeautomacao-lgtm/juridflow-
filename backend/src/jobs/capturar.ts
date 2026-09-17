import { prisma } from '../lib/prisma';
import { capturarTudo } from '../services/capturaAgendada';
import { consultarDjenSemGravar } from '../services/djenService';
import { consultarDataJud } from '../services/datajudService';

/**
 * Captura agendada - ponto de entrada do cron.
 *
 *   node dist/jobs/capturar.js                 roda a captura
 *   node dist/jobs/capturar.js --diagnostico   testa sem gravar nada
 *
 * Pelo npm, no diretorio backend:
 *
 *   npm run capturar
 *   npm run capturar:diagnostico
 *
 * NENHUMA senha de tribunal esta envolvida. O DJEN e canal publico e a
 * consulta leva so o numero da OAB. O DataJud pede uma chave que o proprio
 * CNJ publica em datajud-wiki.cnj.jus.br - e a mesma para todo mundo, nao e
 * do escritorio, e nao da acesso a nada alem do indice publico.
 */

const AZUL = (t: string) => `\x1b[36m${t}\x1b[0m`;
const VERDE = (t: string) => `\x1b[32m${t}\x1b[0m`;
const VERMELHO = (t: string) => `\x1b[31m${t}\x1b[0m`;
const CINZA = (t: string) => `\x1b[90m${t}\x1b[0m`;

function agora(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

// ---------------------------------------------------------------------------
// Diagnostico - so leitura
// ---------------------------------------------------------------------------

/**
 * Responde tres perguntas sem escrever uma linha no banco:
 *
 *   1. A configuracao esta completa?
 *   2. Os canais do CNJ respondem?
 *   3. O que a proxima execucao faria?
 */
async function diagnostico(): Promise<number> {
  let problemas = 0;

  console.log(`\n${AZUL('JuridFlow - diagnostico da captura')}  ${CINZA(agora())}`);
  console.log(CINZA('Nada sera gravado. Somente consulta.\n'));

  // --- 1. configuracao -----------------------------------------------------
  console.log(AZUL('1. Configuracao'));

  const temChave = Boolean((process.env.DATAJUD_API_KEY ?? '').trim());
  if (temChave) {
    console.log(`   ${VERDE('ok')}   DATAJUD_API_KEY presente`);
  } else {
    problemas++;
    console.log(`   ${VERMELHO('falta')} DATAJUD_API_KEY vazia no backend/.env`);
    console.log(
      CINZA('          Chave publica do CNJ: https://datajud-wiki.cnj.jus.br/api-publica/acesso')
    );
  }

  // --- 2. o que esta cadastrado -------------------------------------------
  console.log(`\n${AZUL('2. Cadastro')}`);

  const tenants = await prisma.tenant.findMany({
    select: { id: true, nome: true },
    orderBy: { criado_em: 'asc' },
  });

  if (tenants.length === 0) {
    problemas++;
    console.log(`   ${VERMELHO('falta')} nenhum escritorio no banco`);
    return problemas;
  }

  const oabsParaTestar: string[] = [];
  const cnjsParaTestar: string[] = [];

  for (const tenant of tenants) {
    const [franquias, monitorados, pausados] = await Promise.all([
      prisma.franquiaCaptura.findMany({
        where: { tenant_id: tenant.id, status: 'ativa' },
        select: { termo_oab: true },
      }),
      prisma.capturaPush.count({
        where: { tenant_id: tenant.id, status: { in: ['ativa', 'erro'] } },
      }),
      prisma.capturaPush.count({ where: { tenant_id: tenant.id, status: 'pausada' } }),
    ]);

    console.log(`   ${tenant.nome}`);

    if (franquias.length === 0) {
      problemas++;
      console.log(
        `     ${VERMELHO('falta')} nenhuma OAB cadastrada - o DJEN nao tem o que consultar`
      );
      console.log(CINZA('            Cadastre em Configuracoes > Central de Captura'));
    } else {
      console.log(
        `     ${VERDE('ok')}   ${franquias.length} OAB(s): ${franquias.map((f) => f.termo_oab).join(', ')}`
      );
      oabsParaTestar.push(...franquias.map((f) => f.termo_oab));
    }

    console.log(
      `     ${monitorados > 0 ? VERDE('ok') : CINZA('--')}   ${monitorados} processo(s) monitorado(s)` +
        (pausados > 0 ? CINZA(` (+${pausados} pausado(s))`) : '')
    );

    if (monitorados > 0) {
      const amostra = await prisma.capturaPush.findFirst({
        where: { tenant_id: tenant.id, status: { in: ['ativa', 'erro'] } },
        select: { cnj: true },
        orderBy: { criado_em: 'asc' },
      });
      if (amostra?.cnj) cnjsParaTestar.push(amostra.cnj);
    }
  }

  // --- 3. os canais respondem? --------------------------------------------
  console.log(`\n${AZUL('3. Canais do CNJ')}  ${CINZA('(consulta real, sem gravar)')}`);

  const oabArgumento = process.argv.find((a) => a.startsWith('--oab='))?.split('=')[1];
  const cnjArgumento = process.argv.find((a) => a.startsWith('--cnj='))?.split('=')[1];

  const oabAlvo = oabArgumento ?? oabsParaTestar[0];
  const cnjAlvo = cnjArgumento ?? cnjsParaTestar[0];

  if (!oabAlvo) {
    console.log(`   ${CINZA('--')}   DJEN nao testado: nenhuma OAB. Use --oab=123456/SP`);
  } else {
    try {
      const comunicacoes = await consultarDjenSemGravar(oabAlvo);
      console.log(
        `   ${VERDE('ok')}   DJEN respondeu para ${oabAlvo}: ${comunicacoes.length} comunicacao(oes) na 1a pagina`
      );
      const primeira = comunicacoes[0];
      if (primeira) {
        console.log(
          CINZA(
            `          exemplo: ${primeira.siglaTribunal || '?'} ${primeira.numeroProcesso || '(sem CNJ)'} ` +
              `em ${primeira.dataDisponibilizacao || '?'}`
          )
        );
      }
    } catch (erro) {
      problemas++;
      console.log(`   ${VERMELHO('erro')} DJEN (${oabAlvo}): ${mensagem(erro)}`);
    }
  }

  if (!temChave) {
    console.log(`   ${CINZA('--')}   DataJud nao testado: falta a chave`);
  } else if (!cnjAlvo) {
    console.log(`   ${CINZA('--')}   DataJud nao testado: nenhum processo. Use --cnj=NUMERO`);
  } else {
    try {
      const processo = await consultarDataJud(cnjAlvo);
      console.log(
        `   ${VERDE('ok')}   DataJud respondeu para ${cnjAlvo}: ${processo.tribunal}, ` +
          `${processo.movimentos.length} movimento(s)`
      );
      // "exemplo", nao "ultimo": o DataJud nao garante ordem na lista de
      // movimentos, e afirmar que e o mais recente seria chute.
      const exemplo = processo.movimentos[0];
      if (exemplo) {
        console.log(CINZA(`          exemplo: ${exemplo.nome} em ${exemplo.dataHora}`));
      }
    } catch (erro) {
      problemas++;
      console.log(`   ${VERMELHO('erro')} DataJud (${cnjAlvo}): ${mensagem(erro)}`);
    }
  }

  console.log(
    problemas === 0
      ? `\n${VERDE('Tudo pronto.')} A captura agendada tem o que precisa.\n`
      : `\n${VERMELHO(`${problemas} pendencia(s).`)} Resolva antes de confiar na captura automatica.\n`
  );

  return problemas;
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------

async function executar(): Promise<number> {
  console.log(`\n${AZUL('JuridFlow - captura agendada')}  ${CINZA(agora())}`);

  const resumos = await capturarTudo();
  let falhas = 0;

  for (const r of resumos) {
    console.log(`\n  ${r.tenant_nome}`);

    if (r.erro) {
      falhas++;
      console.log(`    ${VERMELHO('erro')} ${r.erro}`);
      continue;
    }

    if (r.djen.length === 0) {
      console.log(`    ${CINZA('DJEN     nenhuma OAB cadastrada')}`);
    }
    for (const d of r.djen) {
      if (d.erro) {
        falhas++;
        console.log(`    ${VERMELHO('DJEN')}     ${d.oab_uf}: ${d.erro}`);
      } else {
        console.log(
          `    DJEN     ${d.oab_uf}: ${d.novas} nova(s) de ${d.capturadas} ` +
            `(vinculadas ${d.vinculadas}, sem processo ${d.sem_processo})`
        );
      }
    }

    const dj = r.datajud;
    console.log(
      `    DataJud  ${dj.consultados} consultado(s), ${dj.movimentos_novos} movimento(s) novo(s)` +
        (dj.falhas > 0 ? `, ${dj.falhas} falha(s)` : '') +
        (dj.restantes > 0 ? CINZA(` - ${dj.restantes} na fila para a proxima execucao`) : '')
    );
  }

  console.log(
    falhas === 0 ? `\n${VERDE('Concluido.')}\n` : `\n${VERMELHO(`Concluido com ${falhas} falha(s).`)}\n`
  );

  // Sai 0 mesmo com falha pontual: um processo que o DataJud nao conhece nao
  // e motivo para o cron mandar e-mail de erro a cada hora. O que importa
  // ficou no texto acima e na trilha de auditoria.
  return 0;
}

async function principal(): Promise<void> {
  const ehDiagnostico = process.argv.includes('--diagnostico');
  let saida = 0;

  try {
    saida = ehDiagnostico ? await diagnostico() : await executar();
  } catch (erro) {
    console.error(`\n${VERMELHO('Falha geral:')} ${mensagem(erro)}\n`);
    saida = 1;
  } finally {
    await prisma.$disconnect();
  }

  process.exit(ehDiagnostico ? (saida > 0 ? 1 : 0) : saida);
}

void principal();
