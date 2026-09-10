/**
 * Auto-verificacao da validacao de ambiente do boot.
 *
 * Roda sem banco:  npm run verificar:config
 *
 * Existe por dois incidentes reais deste projeto:
 *
 * 1. O commit raiz do repositorio antigo tinha
 *    `process.env.JWT_SECRET || 'acordio-secret-key-2026-...'` no codigo. Com
 *    a variavel ausente, a aplicacao assinava token com um segredo publicado
 *    no GitHub - qualquer pessoa com acesso ao repositorio entrava como
 *    qualquer usuario.
 *
 * 2. O rename para JuridFlow reescreveu o DEPLOY_CPANEL_MYSQL.md, que
 *    prescrevia aquele segredo como valor a usar em producao. A variante
 *    'juridflow-secret-key-2026-...' passou a existir no repositorio e ficou
 *    comprometida pelo mesmo motivo - mas fora da blocklist, portanto aceita.
 *
 * Estes casos travam os dois. Segredo que aparece em documentacao, exemplo ou
 * historico de repositorio nao pode subir em producao.
 */

import { carregarConfig } from '../src/lib/config';

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

const SEGREDO_VALIDO = 'j'.repeat(48);

/**
 * Roda carregarConfig() com o ambiente pedido e devolve o que aconteceu:
 * 'ok', ou o motivo da recusa.
 */
function comAmbiente(env: Record<string, string | undefined>): string {
  const anterior = { ...process.env };
  try {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    carregarConfig();
    return 'ok';
  } catch (e) {
    const m = String((e as Error).message);
    if (/ja foi versionado/i.test(m)) return 'segredo-comprometido';
    if (/ausente ou curta/i.test(m)) return 'ausente-ou-curta';
    if (/CORS_ORIGINS e obrigatorio/i.test(m)) return 'cors-faltando';
    return 'outro: ' + m.slice(0, 60);
  } finally {
    process.env = anterior;
  }
}

const BASE = {
  DATABASE_URL: 'mysql://u:p@localhost:3306/d',
  NODE_ENV: 'development',
  CORS_ORIGINS: 'http://localhost:5173',
};

console.log('\nJWT_SECRET - segredos comprometidos sao recusados');

const COMPROMETIDOS = [
  'acordio-secret-key-2026-juridico-multitenant',
  'acordio-presto-vault-secret-key-2026',
  'juridflow-secret-key-2026-juridico-multitenant',
  'juridflow-presto-vault-secret-key-2026',
  'sua-chave-criptografia-aes256-presto',
];

for (const segredo of COMPROMETIDOS) {
  t(
    `"${segredo.slice(0, 34)}..." -> recusado`,
    comAmbiente({ ...BASE, JWT_SECRET: segredo }),
    'segredo-comprometido'
  );
}

console.log('\nJWT_SECRET - tamanho e presenca');
t('ausente -> recusado', comAmbiente({ ...BASE, JWT_SECRET: undefined }), 'ausente-ou-curta');
t('vazio -> recusado', comAmbiente({ ...BASE, JWT_SECRET: '' }), 'ausente-ou-curta');
t('31 caracteres -> recusado', comAmbiente({ ...BASE, JWT_SECRET: 'x'.repeat(31) }), 'ausente-ou-curta');
t('32 caracteres -> aceito', comAmbiente({ ...BASE, JWT_SECRET: 'x'.repeat(32) }), 'ok');
t('48 caracteres -> aceito', comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO }), 'ok');

// 'changeme' e 'secret' estao na blocklist, mas tambem tem menos de 32
// caracteres. Testados aqui so para garantir que sao recusados de algum modo -
// qual das duas regras pegou nao importa.
console.log('\nplaceholders de tutorial');
for (const p of ['changeme', 'secret']) {
  t(`"${p}" -> recusado de algum modo`, comAmbiente({ ...BASE, JWT_SECRET: p }) !== 'ok', true);
}

console.log('\nDATABASE_URL');
t(
  'ausente -> recusado',
  comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO, DATABASE_URL: undefined }),
  'ausente-ou-curta'
);

console.log('\nCORS_ORIGINS - obrigatorio em producao');
t(
  'producao sem CORS -> recusado',
  comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO, NODE_ENV: 'production', CORS_ORIGINS: undefined }),
  'cors-faltando'
);
t(
  'producao com CORS vazio -> recusado',
  comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO, NODE_ENV: 'production', CORS_ORIGINS: '  ' }),
  'cors-faltando'
);
t(
  'producao com CORS -> aceito',
  comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO, NODE_ENV: 'production', CORS_ORIGINS: 'https://juridflow.exemplo.br' }),
  'ok'
);
t(
  'desenvolvimento sem CORS -> aceito',
  comAmbiente({ ...BASE, JWT_SECRET: SEGREDO_VALIDO, CORS_ORIGINS: undefined }),
  'ok'
);

console.log('\nCORS_ORIGINS - parsing');
{
  const anterior = { ...process.env };
  Object.assign(process.env, {
    ...BASE,
    JWT_SECRET: SEGREDO_VALIDO,
    CORS_ORIGINS: ' https://a.br , https://b.br ,, ',
  });
  const c = carregarConfig();
  process.env = anterior;
  t('separa por virgula, apara espaco e descarta vazio', c.corsOrigins, ['https://a.br', 'https://b.br']);
}

console.log('\n' + '-'.repeat(50));
console.log(`${ok} passaram, ${bad} falharam`);
process.exit(bad > 0 ? 1 : 0);
