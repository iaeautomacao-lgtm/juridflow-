/**
 * Auto-verificacao da autenticacao, da revogacao de sessao e da autorizacao
 * por cargo.
 *
 * Roda sem banco:  npm run verificar:auth
 *
 * Existe por dois defeitos reais deste projeto:
 *
 * 1. A primeira versao do authMiddleware, ao falhar a verificacao do token,
 *    buscava o primeiro Tenant e o primeiro User do banco e chamava next() -
 *    toda rota "autenticada" respondia a qualquer requisicao sem credencial.
 *
 * 2. A segunda versao verificava so a assinatura do token. Desativar um
 *    usuario ou trocar a senha dele nao derrubava a sessao: ele seguia dentro
 *    por ate 12 horas. Alguem desligado do escritorio continuava nos autos.
 *
 * Os casos abaixo travam os dois.
 */

import jwt from 'jsonwebtoken';
import { authMiddleware, requireCargo } from '../src/middleware/auth';
import { prisma } from '../src/lib/prisma';

// O middleware consulta o banco - e o que torna a revogacao imediata. Aqui o
// findFirst e substituido para os casos rodarem sem banco.
let USUARIO_NO_BANCO: any = null;
(prisma as any).user = { findFirst: async () => USUARIO_NO_BANCO };

function usuarioBanco(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    tenant_id: 't1',
    nome: 'Dra Ana',
    email: 'a@b.c',
    cargo: 'advogado',
    ativo: true,
    token_valido_apos: null,
    senha_provisoria: false,
    ...over,
  };
}

let ok = 0;
let bad = 0;

function t(d: string, got: any, want: any) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    ok++;
    console.log('  ok   ' + d);
  } else {
    bad++;
    console.log(`  FALHOU ${d}\n    esperado ${b}\n    obtido   ${a}`);
  }
}

async function chamar(mw: any, headers: any, user?: any, caminho = '/processos') {
  const req: any = {
    headers,
    params: {},
    body: {},
    query: {},
    socket: {},
    ip: '1.1.1.1',
    user,
    baseUrl: '/api',
    path: caminho,
    originalUrl: '/api' + caminho,
  };
  if (user) req.tenant_id = user.tenant_id;

  let status: number | null = null;
  let corpo: any = null;
  let seguiu = false;
  const res: any = {
    status(c: number) { status = c; return res; },
    json(b: any) { corpo = b; return res; },
  };

  await mw(req, res, () => { seguiu = true; });
  return { status, corpo, seguiu, req };
}

const SEGREDO = process.env.JWT_SECRET!;

const valido = jwt.sign(
  { id: 'u1', tenant_id: 't1', nome: 'Dra Ana', email: 'a@b.c', cargo: 'advogado' },
  SEGREDO,
  { expiresIn: '1h' }
);

async function principal() {
  console.log('\nauthMiddleware - sem caminho alternativo');
  USUARIO_NO_BANCO = usuarioBanco();

  t('sem header -> 401', (await chamar(authMiddleware, {})).status, 401);
  t('sem header -> nao segue', (await chamar(authMiddleware, {})).seguiu, false);
  t('header sem Bearer -> 401', (await chamar(authMiddleware, { authorization: 'Token abc' })).status, 401);
  t('token lixo -> 401', (await chamar(authMiddleware, { authorization: 'Bearer nao.e.jwt' })).status, 401);
  t('token lixo -> codigo', (await chamar(authMiddleware, { authorization: 'Bearer nao.e.jwt' })).corpo.codigo, 'TOKEN_INVALIDO');

  const outroSegredo = jwt.sign(
    { id: '1', tenant_id: 't', nome: 'X', email: 'a@b.c', cargo: 'socio' },
    'segredo-de-atacante-que-nao-e-o-nosso-1234567890'
  );
  t('assinado com outro segredo -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${outroSegredo}` })).status, 401);

  const expirado = jwt.sign(
    { id: '1', tenant_id: 't', nome: 'X', email: 'a@b.c', cargo: 'socio' },
    SEGREDO, { expiresIn: '-1h' }
  );
  t('token expirado -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${expirado}` })).status, 401);
  t('token expirado -> codigo', (await chamar(authMiddleware, { authorization: `Bearer ${expirado}` })).corpo.codigo, 'TOKEN_EXPIRADO');

  const semCargo = jwt.sign({ id: '1', tenant_id: 't', nome: 'X', email: 'a@b.c' }, SEGREDO);
  t('payload sem cargo -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${semCargo}` })).status, 401);

  const cargoInvalido = jwt.sign(
    { id: '1', tenant_id: 't', nome: 'X', email: 'a@b.c', cargo: 'admin_supremo' }, SEGREDO
  );
  t('cargo fora da lista -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${cargoInvalido}` })).status, 401);

  const r = await chamar(authMiddleware, { authorization: `Bearer ${valido}` });
  t('token valido -> segue', r.seguiu, true);
  t('token valido -> sem status de erro', r.status, null);
  t('token valido -> injeta tenant_id', r.req.tenant_id, 't1');
  t('token valido -> injeta cargo', r.req.user.cargo, 'advogado');

  console.log('\nrevogacao de sessao - o banco manda, nao o token');

  USUARIO_NO_BANCO = null;
  t('usuario sumiu do banco -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` })).status, 401);

  USUARIO_NO_BANCO = usuarioBanco({ ativo: false });
  t('usuario desativado -> 403', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` })).status, 403);
  t('usuario desativado -> codigo', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` })).corpo.codigo, 'USUARIO_INATIVO');

  // Token emitido ha uma hora, revogacao feita agora: tem de cair.
  const tokenAntigo = jwt.sign(
    {
      id: 'u1', tenant_id: 't1', nome: 'Dra Ana', email: 'a@b.c', cargo: 'advogado',
      iat: Math.floor(Date.now() / 1000) - 3600,
    },
    SEGREDO
  );
  USUARIO_NO_BANCO = usuarioBanco({ token_valido_apos: new Date() });
  t('token anterior a revogacao -> 401', (await chamar(authMiddleware, { authorization: `Bearer ${tokenAntigo}` })).status, 401);
  t('token anterior a revogacao -> codigo', (await chamar(authMiddleware, { authorization: `Bearer ${tokenAntigo}` })).corpo.codigo, 'SESSAO_REVOGADA');

  // Revogacao de ontem, token de agora: segue.
  USUARIO_NO_BANCO = usuarioBanco({ token_valido_apos: new Date(Date.now() - 86400000) });
  t('token posterior a revogacao -> segue', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` })).seguiu, true);

  console.log('\ncargo vem do banco, nao do token');

  // Cenario: alguem foi rebaixado, mas ainda tem o token antigo dizendo socio.
  const tokenSocio = jwt.sign(
    { id: 'u1', tenant_id: 't1', nome: 'X', email: 'a@b.c', cargo: 'socio' },
    SEGREDO, { expiresIn: '1h' }
  );
  USUARIO_NO_BANCO = usuarioBanco({ cargo: 'estagiario' });
  const rebaixado = await chamar(authMiddleware, { authorization: `Bearer ${tokenSocio}` });
  t('token diz socio, banco diz estagiario -> vale o banco', rebaixado.req.user.cargo, 'estagiario');
  t('requireCargo recusa com o cargo do banco', (await chamar(requireCargo('socio'), {}, rebaixado.req.user)).status, 403);

  console.log('\nsenha provisoria tranca o sistema');

  USUARIO_NO_BANCO = usuarioBanco({ senha_provisoria: true });
  t('rota comum -> 403', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` }, undefined, '/processos')).status, 403);
  t('rota comum -> codigo', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` }, undefined, '/processos')).corpo.codigo, 'SENHA_PROVISORIA');
  t('trocar-senha -> liberada', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` }, undefined, '/auth/trocar-senha')).seguiu, true);
  t('auth/me -> liberada', (await chamar(authMiddleware, { authorization: `Bearer ${valido}` }, undefined, '/auth/me')).seguiu, true);

  console.log('\nrequireCargo');
  USUARIO_NO_BANCO = usuarioBanco();

  const mwFin = requireCargo('socio', 'financeiro');
  const u = (cargo: string) => ({ id: 'u', tenant_id: 't', nome: 'N', email: 'e', cargo });
  t('advogado no financeiro -> 403', (await chamar(mwFin, {}, u('advogado'))).status, 403);
  t('estagiario no financeiro -> 403', (await chamar(mwFin, {}, u('estagiario'))).status, 403);
  t('financeiro no financeiro -> segue', (await chamar(mwFin, {}, u('financeiro'))).seguiu, true);
  t('socio no financeiro -> segue', (await chamar(mwFin, {}, u('socio'))).seguiu, true);
  t('sem user -> 401', (await chamar(mwFin, {})).status, 401);

  console.log('\n' + '-'.repeat(50));
  console.log(`${ok} passaram, ${bad} falharam`);
}

principal().then(() => process.exit(bad > 0 ? 1 : 0));
