/**
 * Verifica que a interface usa os tokens do design system, e nao cor literal.
 *
 *   npm run verificar:tokens
 *
 * Por que isto existe: a interface acumulou ~1.200 pontos de cor escritos a
 * mao (slate-900, blue-600, indigo-500, bg-white, #F8FAFC). Alem de produzir
 * cinco azuis diferentes para a mesma coisa, isso torna o tema escuro
 * impossivel sem reescrever cada um desses pontos - classe literal nao troca
 * de valor quando o tema muda. Os tokens de src/index.css trocam.
 *
 * A migracao e por fases. MIGRADOS lista o que ja passou e portanto nao pode
 * regredir - violacao ali derruba o script. O restante e apenas contado, para
 * dar a medida do que falta. Ao migrar uma tela, acrescente o caminho a
 * MIGRADOS no mesmo commit.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FONTE = join(RAIZ, 'src');

/** Arquivos que ja usam tokens. Nao podem regredir. */
const MIGRADOS = [
  'src/App.tsx',
  'src/components/ui',
  'src/components/layout/Sidebar.tsx',
  'src/components/layout/Topbar.tsx',
  'src/components/common/Skeleton.tsx',
  'src/pages/Contencioso/Andamentos.tsx',
];

const RAMPAS =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const REGRAS = [
  {
    nome: 'cor literal da paleta Tailwind',
    // bg-slate-900, text-blue-600, border-indigo-500/30, from-purple-600...
    regex: new RegExp(`\\b(?:${RAMPAS})-(?:50|[1-9]00|950)\\b`, 'g'),
  },
  {
    nome: 'bg-white / border-white opaco',
    // A forma translucida (bg-white/[0.05]) e legitima sobre a barra escura.
    regex: /\b(?:bg|border)-white\b(?!\/)/g,
  },
  {
    nome: 'hex escrito no componente',
    regex: /#[0-9a-fA-F]{3,8}\b/g,
  },
];

function arquivos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivos(caminho));
    } else if (/\.(tsx|ts)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

function ehMigrado(rel) {
  return MIGRADOS.some((m) => rel === m || rel.startsWith(m + '/'));
}

/**
 * Remove comentarios preservando a contagem de linhas.
 *
 * Os comentarios deste projeto citam as classes antigas para explicar o que
 * foi trocado e por que ("substitui bg-red-500 no badge NOVO"). Sem esta
 * limpeza, documentar a correcao acusaria o arquivo corrigido.
 */
function semComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((linha) => linha.replace(/\/\/.*$/, ''));
}

const problemas = [];
const pendentes = [];

for (const caminho of arquivos(FONTE)) {
  const rel = relative(RAIZ, caminho).split(sep).join('/');
  const linhas = semComentarios(readFileSync(caminho, 'utf8'));

  const achados = [];
  linhas.forEach((linha, i) => {
    for (const regra of REGRAS) {
      regra.regex.lastIndex = 0;
      const encontrados = linha.match(regra.regex);
      if (encontrados) {
        achados.push({ linha: i + 1, regra: regra.nome, trecho: encontrados.join(', ') });
      }
    }
  });

  if (achados.length === 0) continue;
  if (ehMigrado(rel)) {
    problemas.push({ rel, achados });
  } else {
    pendentes.push({ rel, total: achados.length });
  }
}

if (pendentes.length > 0) {
  console.log('\nAinda nao migrados (fase 3) - ocorrencias por arquivo:');
  pendentes
    .sort((a, b) => b.total - a.total)
    .forEach((p) => console.log(`  ${String(p.total).padStart(4)}  ${p.rel}`));
  console.log(`  ${'-'.repeat(40)}`);
  console.log(
    `  ${String(pendentes.reduce((s, p) => s + p.total, 0)).padStart(4)}  linhas em ${pendentes.length} arquivos`
  );
}

if (problemas.length > 0) {
  console.log('\nREGRESSAO em arquivo ja migrado:');
  for (const p of problemas) {
    console.log(`\n  ${p.rel}`);
    for (const a of p.achados) {
      console.log(`    linha ${a.linha}: ${a.regra} -> ${a.trecho}`);
    }
  }
  console.log('\nUse os tokens de src/index.css (bg-superficie-alta, text-texto-suave, ...).');
  console.log(`\n${problemas.length} arquivo(s) migrado(s) com cor literal.\n`);
  process.exit(1);
}

console.log(`\nok  ${MIGRADOS.length} caminho(s) migrado(s) sem cor literal.\n`);
