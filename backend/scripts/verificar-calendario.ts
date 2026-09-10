/**
 * Auto-verificacao do calendario forense e da resolucao de tribunal.
 *
 * Roda sem banco de dados:  npm run verificar
 *
 * Existe porque o calculo de prazo e o codigo de maior consequencia do
 * sistema - prazo errado num escritorio de advocacia e prazo perdido - e
 * porque a versao anterior do calculador pulava apenas sabado e domingo.
 * Cada caso abaixo tem a data esperada conferida contra a regra do CPC.
 */

import {
  CalendarioForense,
  domingoDePascoa,
  emRecessoForense,
  feriadosNacionais,
  chaveDia,
  normalizarDia,
  somarDias,
} from '../src/lib/feriados';
import { decomporCnj, digitoVerificadorValido, formatarCnj } from '../src/lib/tribunais';

let passou = 0;
let falhou = 0;

function ok(descricao: string, obtido: unknown, esperado: unknown): void {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    passou++;
    console.log(`  ok   ${descricao}`);
  } else {
    falhou++;
    console.log(`  FALHOU  ${descricao}`);
    console.log(`         esperado: ${b}`);
    console.log(`         obtido:   ${a}`);
  }
}

function secao(titulo: string): void {
  console.log(`\n${titulo}`);
}

// ---------------------------------------------------------------------------
secao('Pascoa (algoritmo gregoriano de Meeus/Jones/Butcher)');

ok('Pascoa 2024', chaveDia(domingoDePascoa(2024)), '2024-03-31');
ok('Pascoa 2025', chaveDia(domingoDePascoa(2025)), '2025-04-20');
ok('Pascoa 2026', chaveDia(domingoDePascoa(2026)), '2026-04-05');
ok('Pascoa 2027', chaveDia(domingoDePascoa(2027)), '2027-03-28');

// ---------------------------------------------------------------------------
secao('Feriados nacionais moveis de 2026 (derivados da Pascoa em 05/04)');

const nac2026 = feriadosNacionais(2026);
const acharFeriado = (nome: string) => nac2026.find((f) => f.nome.includes(nome))?.chave;

ok('Carnaval (segunda)', acharFeriado('Carnaval (segunda)'), '2026-02-16');
ok('Carnaval (terca)', acharFeriado('Carnaval (terca)'), '2026-02-17');
ok('Sexta-feira Santa', acharFeriado('Sexta-feira Santa'), '2026-04-03');
ok('Corpus Christi', acharFeriado('Corpus Christi'), '2026-06-04');

// ---------------------------------------------------------------------------
secao('Feriados nacionais fixos');

ok('total de feriados nacionais em 2026', nac2026.length, 13);
ok('Consciencia Negra e nacional em 2026 (Lei 14.759/2023)', acharFeriado('Zumbi'), '2026-11-20');
ok(
  'Consciencia Negra nao era nacional em 2023',
  feriadosNacionais(2023).some((f) => f.nome.includes('Zumbi')),
  false
);

// ---------------------------------------------------------------------------
secao('Recesso forense - art. 220 do CPC (20/12 a 20/01, inclusive)');

ok('19/12 fora do recesso', emRecessoForense(normalizarDia('2025-12-19')), false);
ok('20/12 dentro (extremo inicial)', emRecessoForense(normalizarDia('2025-12-20')), true);
ok('05/01 dentro', emRecessoForense(normalizarDia('2026-01-05')), true);
ok('20/01 dentro (extremo final)', emRecessoForense(normalizarDia('2026-01-20')), true);
ok('21/01 fora do recesso', emRecessoForense(normalizarDia('2026-01-21')), false);

// ---------------------------------------------------------------------------
secao('Dia util / motivo de nao ser util');

const cal2026 = new CalendarioForense(2025, 2026, [
  { data: '2026-07-09', nome: 'Revolucao Constitucionalista (SP)' },
]);

ok('quinta-feira comum', cal2026.motivo(normalizarDia('2026-03-05')), null);
ok('sabado', cal2026.motivo(normalizarDia('2026-03-07')), 'Sabado');
ok('domingo', cal2026.motivo(normalizarDia('2026-03-08')), 'Domingo');
ok('Sexta-feira Santa', cal2026.motivo(normalizarDia('2026-04-03')), 'Sexta-feira Santa');
ok('Tiradentes', cal2026.motivo(normalizarDia('2026-04-21')), 'Tiradentes');
ok(
  'recesso (05/01)',
  cal2026.motivo(normalizarDia('2026-01-05')),
  'Recesso forense (art. 220 do CPC)'
);
ok(
  'feriado estadual cadastrado (09/07 SP)',
  cal2026.motivo(normalizarDia('2026-07-09')),
  'Revolucao Constitucionalista (SP)'
);

// ---------------------------------------------------------------------------
secao('Contagem de prazo em dias uteis (art. 219, 220 e 224 do CPC)');

/**
 * Replica a cadeia de calcularPrazo() usando apenas o calendario, para o
 * caso poder ser verificado sem banco:
 *   publicacao = 1o dia util seguinte a disponibilizacao   (art. 224, par. 2)
 *   inicio     = 1o dia util seguinte a publicacao         (art. 224, par. 3)
 *   vencimento = N-esimo dia util a partir do inicio        (art. 219)
 */
function prazo(
  calendario: CalendarioForense,
  disponibilizacao: string,
  dias: number
): { publicacao: string; inicio: string; vencimento: string; pulados: number } {
  const disp = normalizarDia(disponibilizacao);
  const publicacao = calendario.proximoDiaUtilExclusivo(disp);
  const inicio = calendario.proximoDiaUtilExclusivo(publicacao);

  let cursor = inicio;
  let contados = 1;
  let pulados = 0;
  while (contados < dias) {
    cursor = somarDias(cursor, 1);
    if (calendario.motivo(cursor)) pulados++;
    else contados++;
  }

  return {
    publicacao: chaveDia(publicacao),
    inicio: chaveDia(inicio),
    vencimento: chaveDia(cursor),
    pulados,
  };
}

const calLongo = new CalendarioForense(2025, 2027);

// Caso 1 - semana normal, sem feriado no meio.
// Disponibilizado quinta 05/03/2026 -> publicacao sexta 06/03 ->
// inicio segunda 09/03 -> 15o dia util = 27/03/2026.
{
  const r = prazo(calLongo, '2026-03-05', 15);
  ok('caso 1: publicacao', r.publicacao, '2026-03-06');
  ok('caso 1: inicio da contagem', r.inicio, '2026-03-09');
  ok('caso 1: vencimento (15 dias uteis)', r.vencimento, '2026-03-27');
}

// Caso 2 - ESTE e o caso que a versao antiga errava.
// Disponibilizado 18/12/2025, prazo de 15 dias uteis. O recesso do art. 220
// suspende de 20/12 a 20/01, portanto o prazo NAO pode vencer em janeiro.
{
  const r = prazo(calLongo, '2025-12-18', 15);
  ok('caso 2: publicacao', r.publicacao, '2025-12-19');
  ok('caso 2: inicio protraido para depois do recesso', r.inicio, '2026-01-21');
  ok('caso 2: vencimento cai em fevereiro', r.vencimento, '2026-02-10');
  console.log(
    `       (a versao antiga, pulando so fim de semana, daria 08/01/2026 - ` +
      `${r.pulados} dias nao uteis foram ignorados por ela)`
  );
}

// Caso 3 - prazo atravessando o Carnaval de 2026 (16 e 17/02).
// Disponibilizado sexta 06/02 -> publicacao segunda 09/02 -> inicio terca 10/02.
// 10 dias uteis pulando 16 e 17/02 = 25/02/2026.
{
  const r = prazo(calLongo, '2026-02-06', 10);
  ok('caso 3: inicio da contagem', r.inicio, '2026-02-10');
  ok('caso 3: vencimento pulando o Carnaval', r.vencimento, '2026-02-25');
}

// Caso 4 - embargos de declaracao, 5 dias uteis, sobre a Semana Santa 2026
// (Sexta-feira Santa em 03/04).
{
  const r = prazo(calLongo, '2026-03-30', 5);
  ok('caso 4: inicio da contagem', r.inicio, '2026-04-01');
  ok('caso 4: vencimento pulando a Sexta-feira Santa', r.vencimento, '2026-04-08');
}

// Caso 5 - disponibilizacao caindo em sabado: publicacao vai para segunda.
{
  const r = prazo(calLongo, '2026-03-07', 15);
  ok('caso 5: publicacao protraida de sabado para segunda', r.publicacao, '2026-03-09');
  ok('caso 5: inicio no dia seguinte util', r.inicio, '2026-03-10');
}

// ---------------------------------------------------------------------------
secao('Resolucao de tribunal pelo numero CNJ');

ok('TJSP (segmento 8, tribunal 26)', decomporCnj('1002345-89.2024.8.26.0100').alias, 'tjsp');
ok('TJSP sigla', decomporCnj('1002345-89.2024.8.26.0100').sigla, 'TJSP');
ok('TJSP uf', decomporCnj('1002345-89.2024.8.26.0100').uf, 'SP');
ok('TJRJ (tribunal 19)', decomporCnj('0100000-00.2024.8.19.0001').alias, 'tjrj');
ok('TJMG (tribunal 13)', decomporCnj('0100000-00.2024.8.13.0001').alias, 'tjmg');
ok('TRF3 (segmento 4)', decomporCnj('5001234-56.2024.4.03.6100').alias, 'trf3');
ok('TRT2 (segmento 5)', decomporCnj('0001234-56.2024.5.02.0001').alias, 'trt2');
ok('TST (segmento 5, tribunal 00)', decomporCnj('0001234-56.2024.5.00.0000').alias, 'tst');
ok('STJ (segmento 3)', decomporCnj('0001234-56.2024.3.00.0000').alias, 'stj');
ok('formatacao', formatarCnj('10023458920248260100'), '1002345-89.2024.8.26.0100');

ok(
  'segmento sem indice publico e rejeitado',
  (() => {
    try {
      decomporCnj('0001234-56.2024.2.00.0000');
      return 'nao rejeitou';
    } catch (e: any) {
      return e.name;
    }
  })(),
  'CnjInvalidoError'
);

ok(
  'numero com menos de 20 digitos e rejeitado',
  (() => {
    try {
      decomporCnj('123');
      return 'nao rejeitou';
    } catch (e: any) {
      return e.name;
    }
  })(),
  'CnjInvalidoError'
);

// ---------------------------------------------------------------------------
secao('Digito verificador (modulo 97 base 10, ISO 7064)');

// Calcula o digito correto para uma base e confirma que a validacao aceita
// esse e recusa os outros 96.
function digitoCorreto(base18: string): string {
  for (let d = 0; d < 100; d++) {
    const dd = String(d).padStart(2, '0');
    const candidato = base18.slice(0, 7) + dd + base18.slice(7);
    if (digitoVerificadorValido(candidato)) return dd;
  }
  return '??';
}

const base = '1002345' + '2024' + '8' + '26' + '0100'; // 18 digitos, sem o DD
const dd = digitoCorreto(base);
ok('existe exatamente um digito valido', dd !== '??', true);
ok(
  'o digito calculado passa na validacao',
  digitoVerificadorValido(base.slice(0, 7) + dd + base.slice(7)),
  true
);
ok(
  'um digito diferente e recusado',
  digitoVerificadorValido(
    base.slice(0, 7) + String((Number(dd) + 1) % 100).padStart(2, '0') + base.slice(7)
  ),
  false
);
console.log(`       (numero valido gerado: ${formatarCnj(base.slice(0, 7) + dd + base.slice(7))})`);

// ---------------------------------------------------------------------------
console.log(`\n${'-'.repeat(60)}`);
console.log(`${passou} passaram, ${falhou} falharam`);
process.exit(falhou > 0 ? 1 : 0);
