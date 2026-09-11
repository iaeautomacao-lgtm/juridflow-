import React from 'react';
import { cx } from './cx';

/**
 * Etiqueta curta de estado.
 *
 * Os tons nao sao livres: verde, ambar e vermelho comunicam estado nesta
 * interface e em nenhum outro lugar. "novo" e azul de marca porque novidade
 * nao e alerta - o que era `bg-red-500 NOVO` em Andamentos pintava de
 * vermelho um andamento que so estava por ler.
 */
export type TomBadge = 'marca' | 'novo' | 'prazo' | 'ok' | 'erro' | 'neutro';

const TONS: Record<TomBadge, string> = {
  marca: 'bg-marca-fundo text-marca',
  novo: 'bg-marca-fundo text-marca',
  prazo: 'bg-atencao-fundo text-atencao',
  ok: 'bg-ok-fundo text-ok',
  erro: 'bg-erro-fundo text-erro',
  neutro: 'bg-superficie-sutil text-texto-suave',
};

interface BadgeProps {
  tom?: TomBadge;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ tom = 'neutro', children, className }) => (
  <span
    className={cx(
      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      TONS[tom],
      className
    )}
  >
    {children}
  </span>
);
