/** @type {import('tailwindcss').Config} */

/**
 * Design system do JuridFlow.
 *
 * A paleta vem do logo: pilar cinza, fita em tres azuis e seta dourada.
 *
 *   navy   #17365D  wordmark e base do fluxo
 *   azul   #2E6CA4  corpo da fita
 *   claro  #5BA3D9  fita superior e corpo da seta
 *   ouro   #E0A64E  ponta da seta e elos
 *   pilar  #6E7B8A  a coluna
 *
 * ATENCAO: estes hex foram obtidos por conta-gotas num mockup JPEG do logo.
 * Quando o vetor oficial (SVG/AI) ou o manual de marca estiver disponivel,
 * conferir e ajustar em DOIS lugares: as rampas `juridflow`/`gold` aqui e as
 * variaveis --marca-* em src/index.css.
 *
 * ------------------------------------------------------------------------
 * Como usar cor neste projeto
 * ------------------------------------------------------------------------
 *
 * Use os tokens semanticos: bg-superficie-alta, text-texto-suave,
 * border-borda, bg-marca, text-ok. Eles apontam para as custom properties de
 * index.css e por isso funcionam nos dois temas sem nenhum dark: no JSX.
 *
 * NAO use as rampas literais do Tailwind (slate-900, blue-600, indigo-500).
 * Elas nao trocam no tema escuro e foi assim que a interface acumulou ~1.200
 * pontos de cor espalhados. Ha verificacao: npm run verificar:tokens
 *
 * As rampas `juridflow` e `gold` abaixo ficam como referencia da marca e para
 * o raro caso de precisar de um degrau que os tokens nao cobrem.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // -------------------------------------------------------------
        // Tokens semanticos. Preferir sempre estes.
        // -------------------------------------------------------------

        superficie: {
          DEFAULT: 'rgb(var(--superficie) / <alpha-value>)',
          alta: 'rgb(var(--superficie-alta) / <alpha-value>)',
          sutil: 'rgb(var(--superficie-sutil) / <alpha-value>)',
        },

        borda: {
          DEFAULT: 'rgb(var(--borda) / <alpha-value>)',
          forte: 'rgb(var(--borda-forte) / <alpha-value>)',
        },

        texto: {
          DEFAULT: 'rgb(var(--texto) / <alpha-value>)',
          suave: 'rgb(var(--texto-suave) / <alpha-value>)',
          fraco: 'rgb(var(--texto-fraco) / <alpha-value>)',
        },

        marca: {
          DEFAULT: 'rgb(var(--marca) / <alpha-value>)',
          escura: 'rgb(var(--marca-escura) / <alpha-value>)',
          clara: 'rgb(var(--marca-clara) / <alpha-value>)',
          fundo: 'rgb(var(--marca-fundo) / <alpha-value>)',
        },

        nav: {
          DEFAULT: 'rgb(var(--nav) / <alpha-value>)',
          alta: 'rgb(var(--nav-alta) / <alpha-value>)',
          texto: 'rgb(var(--nav-texto) / <alpha-value>)',
          'texto-fraco': 'rgb(var(--nav-texto-fraco) / <alpha-value>)',
        },

        ouro: 'rgb(var(--ouro) / <alpha-value>)',

        // Estado. Verde, ambar e vermelho existem SO aqui: se aparecem na
        // tela, comunicam alguma coisa. Nao servem de enfeite.
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          fundo: 'rgb(var(--ok-fundo) / <alpha-value>)',
        },
        atencao: {
          DEFAULT: 'rgb(var(--atencao) / <alpha-value>)',
          fundo: 'rgb(var(--atencao-fundo) / <alpha-value>)',
        },
        erro: {
          DEFAULT: 'rgb(var(--erro) / <alpha-value>)',
          fundo: 'rgb(var(--erro-fundo) / <alpha-value>)',
        },

        // -------------------------------------------------------------
        // Rampas da marca. Referencia; os tokens acima derivam daqui.
        // -------------------------------------------------------------

        juridflow: {
          50: '#F0F4F9',
          100: '#DCE6F1',
          200: '#BCCFE3',
          300: '#8FAFCE',
          400: '#5BA3D9', // fita superior / seta
          500: '#2E6CA4', // corpo da fita
          600: '#245A8B',
          700: '#1D4872',
          800: '#17365D', // wordmark
          900: '#112947',
          950: '#0A1A2E',
        },

        gold: {
          50: '#FDF8EE',
          100: '#FAEFD6',
          200: '#F4DDAB',
          300: '#ECC77C',
          400: '#E0A64E', // seta / elos
          500: '#D18F32',
          600: '#B27427',
          700: '#8E5A22',
          800: '#714822',
          900: '#5C3B1F',
        },

        pillar: '#6E7B8A',
      },

      fontFamily: {
        // Poppins acompanha o wordmark do logo: geometrico, caixa alta,
        // pesado. Fica restrita a marca - titulo de pagina e corpo sao Inter.
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Escala da interface. Corpo 13px, rotulo 11px - densidade de
        // software juridico, nao de landing page.
        rotulo: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },

      boxShadow: {
        // Quase imperceptivel de proposito. A separacao entre blocos vem da
        // borda de 1px e do espaco; sombra aqui so tira o cartao do fundo.
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.05)',
        'card-hover': '0 2px 4px rgba(15, 23, 42, 0.06), 0 4px 10px rgba(15, 23, 42, 0.05)',
        menu: '0 8px 24px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)',
      },

      borderRadius: {
        // Menos arredondado que o padrao. O visual anterior usava rounded-xl
        // (12px) e rounded-2xl (16px) em tudo, o que da aparencia de pilula.
        // Redefinir os degraus aqui corrige de uma vez as telas que ainda nao
        // foram migradas, sem tocar no JSX delas.
        lg: '8px', // controles: botao, campo, badge
        xl: '10px', // cartoes e paineis
        '2xl': '12px', // blocos grandes, modal
      },
    },
  },
  plugins: [],
}
