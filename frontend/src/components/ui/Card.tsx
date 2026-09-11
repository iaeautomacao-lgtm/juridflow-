import React from 'react';
import { cx } from './cx';

/**
 * Bloco de conteudo sobre a superficie da pagina.
 *
 * Nem tudo e cartao. Borda, fundo, raio e sombra dizem "objeto separado" -
 * quando todos os blocos da tela recebem os quatro, a hierarquia some. Use
 * Card para o que realmente e uma unidade; para agrupar sem separar, basta
 * espaco.
 */
interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Remove o preenchimento interno (util quando o filho controla o espaco). */
  semPadding?: boolean;
  as?: 'div' | 'section' | 'article';
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  semPadding = false,
  as: Tag = 'div',
}) => (
  <Tag
    className={cx(
      'bg-superficie-alta border border-borda rounded-xl shadow-card',
      !semPadding && 'p-4',
      className
    )}
  >
    {children}
  </Tag>
);
