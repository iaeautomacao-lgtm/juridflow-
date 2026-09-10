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
 * conferir e ajustar AQUI - este arquivo e o unico lugar a mudar.
 *
 * A UI ainda usa classes literais (slate-*, blue-*), herdadas da fase ACORDIO.
 * Migrar as ~1.000 ocorrencias para estes tokens e escopo proprio, nao parte
 * do rename. Ver DOCUMENTACAO.md.
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
        // Azul institucional do JuridFlow. 400/500/800 sao as cores do logo.
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

        // Acento dourado. 400 e a cor da seta e dos elos.
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

        // Cinza do pilar. Elemento unico, sem rampa completa.
        pillar: '#6E7B8A',
      },

      fontFamily: {
        // Poppins acompanha o wordmark do logo: geometrico, caixa alta, pesado.
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      boxShadow: {
        'card': '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        'card-hover': '0 8px 25px rgba(0, 0, 0, 0.07), 0 3px 6px rgba(0, 0, 0, 0.03)',
      },

      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
