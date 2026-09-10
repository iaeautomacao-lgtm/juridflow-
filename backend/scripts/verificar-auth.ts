/**
 * Auto-verificacao da autenticacao e da autorizacao por cargo.
 *
 * Roda sem banco:  npm run verificar:auth
 *
 * Existe porque a versao anterior do authMiddleware, ao falhar a verificacao
 * do token, buscava o primeiro Tenant e o primeiro User do banco e chamava
 * next() - o efeito era que toda rota "autenticada" respondia a qualquer
 * requisicao sem credencial. Estes casos travam esse comportamento.
 */

import jwt from 'jsonwebtoken';
import { authMiddleware, requireCargo } from '../src/middleware/auth';

let ok=0, bad=0;
function t(d:string, got:any, want:any){ const a=JSON.stringify(got),b=JSON.stringify(want);
  if(a===b){ok++;console.log('  ok   '+d);} else {bad++;console.log('  FALHOU '+d+'\n    esperado '+b+'\n    obtido   '+a);} }

function chamar(mw:any, headers:any, user?:any){
  const req:any={headers,params:{},body:{},query:{},socket:{},ip:'1.1.1.1',user};
  if(user) req.tenant_id=user.tenant_id;
  let status:number|null=null, corpo:any=null, seguiu=false;
  const res:any={status(c:number){status=c;return res;},json(b:any){corpo=b;return res;}};
  mw(req,res,()=>{seguiu=true;});
  return {status,corpo,seguiu,req};
}

const SEGREDO = process.env.JWT_SECRET!;

console.log('\nauthMiddleware - sem fallback');
t('sem header -> 401', chamar(authMiddleware,{}).status, 401);
t('sem header -> nao segue', chamar(authMiddleware,{}).seguiu, false);
t('header sem Bearer -> 401', chamar(authMiddleware,{authorization:'Token abc'}).status, 401);
t('token lixo -> 401', chamar(authMiddleware,{authorization:'Bearer nao.e.jwt'}).status, 401);
t('token lixo -> codigo', chamar(authMiddleware,{authorization:'Bearer nao.e.jwt'}).corpo.codigo, 'TOKEN_INVALIDO');

const outroSegredo = jwt.sign({id:'1',tenant_id:'t',nome:'X',email:'a@b.c',cargo:'socio'},'segredo-de-atacante-que-nao-e-o-nosso-1234567890');
t('assinado com outro segredo -> 401', chamar(authMiddleware,{authorization:`Bearer ${outroSegredo}`}).status, 401);

const expirado = jwt.sign({id:'1',tenant_id:'t',nome:'X',email:'a@b.c',cargo:'socio'},SEGREDO,{expiresIn:'-1h'});
t('token expirado -> 401', chamar(authMiddleware,{authorization:`Bearer ${expirado}`}).status, 401);
t('token expirado -> codigo', chamar(authMiddleware,{authorization:`Bearer ${expirado}`}).corpo.codigo, 'TOKEN_EXPIRADO');

const semCargo = jwt.sign({id:'1',tenant_id:'t',nome:'X',email:'a@b.c'},SEGREDO);
t('payload sem cargo -> 401', chamar(authMiddleware,{authorization:`Bearer ${semCargo}`}).status, 401);

const cargoInvalido = jwt.sign({id:'1',tenant_id:'t',nome:'X',email:'a@b.c',cargo:'admin_supremo'},SEGREDO);
t('cargo fora da lista -> 401', chamar(authMiddleware,{authorization:`Bearer ${cargoInvalido}`}).status, 401);

const valido = jwt.sign({id:'u1',tenant_id:'t1',nome:'Dra Ana',email:'a@b.c',cargo:'advogado'},SEGREDO,{expiresIn:'1h'});
const r = chamar(authMiddleware,{authorization:`Bearer ${valido}`});
t('token valido -> segue', r.seguiu, true);
t('token valido -> sem status de erro', r.status, null);
t('token valido -> injeta tenant_id', r.req.tenant_id, 't1');
t('token valido -> injeta cargo', r.req.user.cargo, 'advogado');

console.log('\nrequireCargo');
const mwFin = requireCargo('socio','financeiro');
t('advogado no financeiro -> 403', chamar(mwFin,{},{id:'u',tenant_id:'t',nome:'N',email:'e',cargo:'advogado'}).status, 403);
t('estagiario no financeiro -> 403', chamar(mwFin,{},{id:'u',tenant_id:'t',nome:'N',email:'e',cargo:'estagiario'}).status, 403);
t('financeiro no financeiro -> segue', chamar(mwFin,{},{id:'u',tenant_id:'t',nome:'N',email:'e',cargo:'financeiro'}).seguiu, true);
t('socio no financeiro -> segue', chamar(mwFin,{},{id:'u',tenant_id:'t',nome:'N',email:'e',cargo:'socio'}).seguiu, true);
t('sem user -> 401', chamar(mwFin,{}).status, 401);

console.log('\n'+'-'.repeat(50));
console.log(`${ok} passaram, ${bad} falharam`);
process.exit(bad>0?1:0);
