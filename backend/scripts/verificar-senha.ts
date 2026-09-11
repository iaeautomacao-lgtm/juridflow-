/**
 * Auto-verificacao da politica de senha.
 *
 * Roda sem banco:  npm run verificar:senha
 *
 * Cobre o que um atacante tenta primeiro - senha curta, obvia, ou derivada do
 * e-mail e do nome da pessoa - e tambem os casos legitimos, para a politica
 * nao virar um muro que empurra o usuario para o post-it.
 */

import { validarSenha, TAMANHO_MINIMO, TAMANHO_MAXIMO } from '../src/lib/senha';

let ok = 0;
let bad = 0;

function t(descricao: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a === b) {
    ok++;
    console.log('  ok   ' + descricao);
  } else {
    bad++;
    console.log(`  FALHOU ${descricao}\n    esperado ${b}\n    obtido   ${a}`);
  }
}

const CONTEXTO = { email: 'ana.paula@grupoddm.ia.br', nome: 'Ana Paula Ferreira' };
const aceita = (senha: unknown, ctx = CONTEXTO) => validarSenha(senha, ctx).valida;

console.log('\ntamanho');
t(`${TAMANHO_MINIMO - 1} caracteres -> recusa`, aceita('a'.repeat(TAMANHO_MINIMO - 1)), false);
t(`${TAMANHO_MINIMO} caracteres -> aceita`, aceita('xKp9mQ2wZr'), true);
t(`${TAMANHO_MAXIMO + 1} caracteres -> recusa`, aceita('a'.repeat(TAMANHO_MAXIMO + 1)), false);
t('vazia -> recusa', aceita(''), false);
t('so espacos -> recusa', aceita('          '), false);

console.log('\ntipo');
t('numero -> recusa', aceita(12345678901 as unknown), false);
t('null -> recusa', aceita(null), false);
t('undefined -> recusa', aceita(undefined), false);
t('objeto -> recusa', aceita({ toString: () => 'senhalonga123' } as unknown), false);

console.log('\nsenhas conhecidas');
for (const s of ['1234567890', 'password123', 'qwertyuiop', 'juridflow2026', 'advogado123']) {
  t(`"${s}" -> recusa`, aceita(s), false);
}
t('"dev-juridflow-local-2026" (a do ambiente local) -> recusa', aceita('dev-juridflow-local-2026'), false);

console.log('\npadroes triviais');
t('caractere repetido -> recusa', aceita('aaaaaaaaaaaa'), false);

console.log('\nderivada do usuario');
t('contem o e-mail -> recusa', aceita('ana.paula-2026!'), false);
t('contem parte local do e-mail -> recusa', aceita('xxana.paulaxx99'), false);
t('contem o primeiro nome -> recusa', aceita('Ferreira2026xx'), false);
t('contem sobrenome -> recusa', aceita('zzPaulazz1234'), false);
t('maiuscula nao escapa da checagem -> recusa', aceita('ANA.PAULA.2026'), false);
t('acento nao escapa da checagem -> recusa', aceita('Ferreíra20261'), false);

console.log('\nnome curto nao bloqueia demais');
t(
  'nome de 3 letras nao barra senha que o contem',
  aceita('Luzeiro-do-Norte-99', { email: 'luz@x.br', nome: 'Luz' }),
  true
);

console.log('\nsenhas legitimas');
for (const s of ['Tempestade-Azul-77', 'kZ8!vNp2#qLw', 'cavalo bateria grampo azul', 'Jurisprudencia-2026-TJ']) {
  t(`"${s}" -> aceita`, aceita(s), true);
}

console.log('\n' + '-'.repeat(50));
console.log(`${ok} passaram, ${bad} falharam`);
process.exit(bad > 0 ? 1 : 0);
