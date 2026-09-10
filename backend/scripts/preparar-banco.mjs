/**
 * Gera o SQL que cria o banco e o usuario do JuridFlow, lendo a
 * DATABASE_URL de backend/.env.
 *
 * Por que um script em vez de um .sql no repositorio: o comando precisa da
 * senha da aplicacao. Escrever ela num arquivo .sql a coloca no disco (e a um
 * `git add -f` de distancia do repositorio); digitar no terminal a deixa no
 * historico do shell. Aqui ela sai por um pipe e nao encosta em nenhum dos
 * dois.
 *
 * Uso:
 *   node scripts/preparar-banco.mjs | mysql -u root -p
 *   npm run banco:preparar
 *
 * Para revisar antes de executar, sem revelar a senha:
 *   node scripts/preparar-banco.mjs --mascarado
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ENV = resolve(AQUI, '..', '.env');

function morrer(mensagem) {
  console.error(`\nerro: ${mensagem}\n`);
  process.exit(1);
}

let bruto;
try {
  bruto = readFileSync(ENV, 'utf8');
} catch {
  morrer(`nao consegui ler ${ENV}. Copie backend/.env.example para backend/.env primeiro.`);
}

// Le DATABASE_URL sem depender do dotenv: o script roda antes de qualquer
// npm install ter acontecido, em maquina nova.
const linha = bruto
  .split(/\r?\n/)
  .filter((l) => !l.trim().startsWith('#'))
  .find((l) => l.trim().startsWith('DATABASE_URL'));

if (!linha) morrer('DATABASE_URL nao encontrada em backend/.env');

const valor = linha.slice(linha.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');

let url;
try {
  url = new URL(valor);
} catch {
  morrer('DATABASE_URL nao e uma URL valida. Formato esperado:\n' +
    '  DATABASE_URL="mysql://usuario:senha@localhost:3306/banco"');
}

if (url.protocol !== 'mysql:') {
  morrer(`protocolo "${url.protocol}" inesperado. O JuridFlow usa MySQL/MariaDB (mysql://).`);
}

const usuario = decodeURIComponent(url.username);
const senha = decodeURIComponent(url.password);
const host = url.hostname;
const porta = url.port || '3306';
const banco = decodeURIComponent(url.pathname.replace(/^\//, ''));

if (!usuario || !senha || !banco) {
  morrer('DATABASE_URL precisa de usuario, senha e nome do banco.');
}

// Caractere reservado em URL que aparece sem escape indica senha nao
// codificada - o Prisma trunca a senha ali e a conexao falha com "access
// denied" sem explicacao. Melhor avisar agora.
if (/[@/?#[\]]/.test(senha)) {
  console.error(
    '\naviso: a senha contem caractere reservado de URL (@ / ? # [ ]).\n' +
    'Ele precisa estar percent-encoded na DATABASE_URL, senao o Prisma le a\n' +
    'senha cortada. Ex.: @ vira %40, # vira %23.\n'
  );
}

// Escape de literal de string SQL: barra invertida e apostrofo.
const sql = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const mascarado = process.argv.includes('--mascarado');
const senhaSaida = mascarado ? '<senha do .env>' : sql(senha);

// utf8mb4 e obrigatorio: nome de parte e descricao de intimacao trazem
// acentuacao e, em publicacao de diario, emoji e simbolo fora do BMP.
// utf8 do MySQL guarda so 3 bytes e trunca esses casos.
process.stdout.write(`-- JuridFlow: criacao de banco e usuario da aplicacao
-- Gerado por scripts/preparar-banco.mjs a partir de backend/.env
-- Execute como root:  node scripts/preparar-banco.mjs | mysql -u root -p

CREATE DATABASE IF NOT EXISTS \`${banco}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${sql(usuario)}'@'localhost'
  IDENTIFIED BY '${senhaSaida}';

-- Privilegio restrito ao banco da aplicacao. Sem GRANT global: a aplicacao
-- nao precisa criar usuario, ler outros bancos nem administrar o servidor.
GRANT ALL PRIVILEGES ON \`${banco}\`.* TO '${sql(usuario)}'@'localhost';

FLUSH PRIVILEGES;

SELECT 'banco e usuario prontos' AS resultado;
`);

console.error(
  `\nSQL gerado para:\n` +
  `  banco    ${banco}\n` +
  `  usuario  ${usuario}@localhost\n` +
  `  servidor ${host}:${porta}\n` +
  (mascarado
    ? '\nmodo --mascarado: a senha foi omitida, este SQL nao funciona como esta.\n'
    : '\nPara aplicar:  node scripts/preparar-banco.mjs | mysql -u root -p\n')
);
