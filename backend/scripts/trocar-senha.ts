/**
 * Troca a senha de um usuario, ou lista os usuarios do escritorio.
 *
 * Existe para recuperacao administrativa: quando ninguem consegue entrar, a
 * troca pela interface do sistema nao esta disponivel. O caminho normal e
 * pela tela Configuracoes > Perfis & Permissoes, ja logado.
 *
 * Uso:
 *   npm run usuarios                                   lista os usuarios
 *   npm run trocar-senha -- EMAIL SENHA                troca a senha
 *   npm run trocar-senha -- EMAIL -                    le a senha do stdin
 *
 * Exemplo:
 *   npm run trocar-senha -- socio@grupoddm.ia.br "MinhaSenhaForte123"
 *
 * A senha passada como argumento fica no historico do shell. Para evitar,
 * use `-` e digite depois, ou limpe com `history -c`. Em producao, troque
 * pela interface do sistema assim que conseguir entrar.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

const MINIMO = 10;

async function listar() {
  const usuarios = await prisma.user.findMany({
    orderBy: [{ cargo: 'asc' }, { email: 'asc' }],
    select: { email: true, nome: true, cargo: true, ativo: true, tenant: { select: { nome: true } } },
  });

  if (usuarios.length === 0) {
    console.log('\nNenhum usuario cadastrado. Rode o seed primeiro.\n');
    return;
  }

  console.log(`\n${usuarios.length} usuario(s):\n`);
  const largura = Math.max(...usuarios.map((u) => u.email.length));
  for (const u of usuarios) {
    const estado = u.ativo ? '' : '  (inativo)';
    console.log(`  ${u.email.padEnd(largura)}  ${u.cargo.padEnd(11)}  ${u.nome}${estado}`);
  }
  console.log(`\nEscritorio: ${usuarios[0].tenant.nome}\n`);
  console.log('Para trocar uma senha:');
  console.log('  npm run trocar-senha -- EMAIL "NovaSenha"\n');
}

function lerStdin(): Promise<string> {
  return new Promise((resolve) => {
    let dado = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (dado += c));
    process.stdin.on('end', () => resolve(dado.trim()));
  });
}

async function trocar(email: string, senhaBruta: string) {
  const senha = senhaBruta === '-' ? await lerStdin() : senhaBruta;

  if (senha.length < MINIMO) {
    console.error(`\nSenha com ${senha.length} caractere(s). Minimo ${MINIMO}.\n`);
    process.exit(1);
  }

  const usuario = await prisma.user.findUnique({ where: { email } });
  if (!usuario) {
    console.error(`\nUsuario "${email}" nao encontrado.`);
    console.error('Rode `npm run usuarios` para ver quais existem.\n');
    process.exit(1);
  }

  await prisma.user.update({
    where: { email },
    data: { senha: await bcrypt.hash(senha, 10) },
  });

  console.log(`\nSenha de ${email} (${usuario.cargo}) atualizada.`);
  console.log('\nEntre em https://juridflow.grupoddm.ia.br e troque pela');
  console.log('interface do sistema, em Configuracoes > Perfis & Permissoes.\n');
}

async function principal() {
  const [email, senha] = process.argv.slice(2);

  if (!email) {
    await listar();
    return;
  }

  if (!senha) {
    console.error('\nFalta a senha.\n');
    console.error('  npm run trocar-senha -- EMAIL "NovaSenha"');
    console.error('  npm run trocar-senha -- EMAIL -        (le do stdin)\n');
    process.exit(1);
  }

  await trocar(email, senha);
}

principal()
  .catch((e) => {
    console.error(`\nErro: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
