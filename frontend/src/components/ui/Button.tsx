import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

/**
 * Botao.
 *
 * Quatro variantes e so. A interface anterior tinha botao azul, indigo,
 * ardosia, esmeralda e ambar decidindo a cor pelo assunto do botao, e nao
 * pela importancia da acao - o resultado era que tudo parecia igualmente
 * urgente. Aqui a cor diz o peso: primario e a acao principal da tela,
 * secundario a alternativa, sutil o que quase nao chama, perigo o que
 * destroi.
 */
export type VarianteBotao = 'primario' | 'secundario' | 'sutil' | 'perigo';

const VARIANTES: Record<VarianteBotao, string> = {
  primario: 'bg-marca text-white hover:bg-marca-escura disabled:bg-borda-forte',
  secundario:
    'bg-superficie-alta text-texto border border-borda hover:bg-superficie-sutil disabled:text-texto-fraco',
  sutil: 'bg-transparent text-texto-suave hover:bg-superficie-sutil hover:text-texto',
  perigo: 'bg-transparent text-erro border border-erro/30 hover:bg-erro-fundo',
};

const TAMANHOS = {
  sm: 'h-8 px-2.5 text-[11px] gap-1.5',
  md: 'h-9 px-3.5 text-xs gap-2',
};

interface BotaoProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variante?: VarianteBotao;
  tamanho?: keyof typeof TAMANHOS;
  icone?: LucideIcon;
  carregando?: boolean;
  className?: string;
}

export const Botao: React.FC<BotaoProps> = ({
  variante = 'secundario',
  tamanho = 'md',
  icone: Icone,
  carregando = false,
  className,
  children,
  disabled,
  type = 'button',
  ...resto
}) => (
  <button
    type={type}
    disabled={disabled || carregando}
    className={cx(
      'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap',
      'transition-colors disabled:cursor-not-allowed',
      VARIANTES[variante],
      TAMANHOS[tamanho],
      className
    )}
    {...resto}
  >
    {carregando ? (
      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
    ) : (
      Icone && <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
    )}
    {children}
  </button>
);
