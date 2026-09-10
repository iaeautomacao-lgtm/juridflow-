import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuracao validada no boot.
 *
 * Segredo nao tem valor padrao. Se JWT_SECRET faltar, o processo nao sobe -
 * um fallback embutido no codigo significa que qualquer pessoa com acesso ao
 * repositorio consegue assinar um token valido de producao.
 */
function obrigatorio(nome: string, minimo = 1): string {
  const valor = process.env[nome];
  if (!valor || valor.trim().length < minimo) {
    throw new Error(
      `Variavel de ambiente ${nome} ausente ou curta demais (minimo ${minimo} caracteres). ` +
        `Defina em backend/.env antes de iniciar. Veja backend/.env.example.`
    );
  }
  return valor;
}

/**
 * Segredos que ja foram versionados no repositorio e portanto sao publicos.
 *
 * NAO RENOMEIE ESTAS STRINGS. Elas nao sao branding - sao os valores exatos
 * que vazaram no commit 445a77d, quando o produto se chamava ACORDIO. Trocar
 * 'acordio' por 'juridflow' aqui inventaria strings que nunca vazaram e
 * liberaria de volta os segredos realmente comprometidos.
 *
 * A lista so cresce: se um segredo novo vazar, acrescente sem remover os
 * antigos.
 */
const SEGREDOS_PROIBIDOS = [
  // Vazaram no commit raiz do repositorio antigo, quando o produto se
  // chamava ACORDIO.
  'acordio-secret-key-2026-juridico-multitenant',
  'acordio-presto-vault-secret-key-2026',

  // Variantes com o nome novo: o rename para JuridFlow reescreveu o
  // DEPLOY_CPANEL_MYSQL.md, que prescrevia o segredo como valor a usar, e o
  // arquivo entrou no commit e2e3082. A string passou a existir no
  // repositorio, logo esta comprometida pelo mesmo motivo que as de cima.
  'juridflow-secret-key-2026-juridico-multitenant',
  'juridflow-presto-vault-secret-key-2026',

  // Placeholders que aparecem em tutorial e em copia-e-cola apressado.
  'changeme',
  'secret',
  'sua-chave-criptografia-aes256-presto',
];

export interface Config {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  isProducao: boolean;
}

export function carregarConfig(): Config {
  const jwtSecret = obrigatorio('JWT_SECRET', 32);

  if (SEGREDOS_PROIBIDOS.includes(jwtSecret.trim())) {
    throw new Error(
      'JWT_SECRET esta usando um valor que ja foi versionado no repositorio. ' +
        'Gere um novo: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }

  obrigatorio('DATABASE_URL', 5);

  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProducao = nodeEnv === 'production';

  const origensBrutas = (process.env.CORS_ORIGINS || '').trim();
  const corsOrigins = origensBrutas
    ? origensBrutas.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (isProducao && corsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGINS e obrigatorio em producao. Liste as origens do frontend ' +
        'separadas por virgula, ex: CORS_ORIGINS="https://juridflow.seudominio.com.br"'
    );
  }

  return {
    port: Number.parseInt(process.env.PORT || '3001', 10),
    nodeEnv,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    corsOrigins,
    isProducao,
  };
}

export const config = carregarConfig();
