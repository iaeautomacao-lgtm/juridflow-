import React from 'react';
import { Search } from 'lucide-react';
import { cx } from './cx';

/**
 * Barra de filtro: busca a esquerda, seletores a direita.
 *
 * Um unico desenho para todas as telas. Antes cada pagina montava o seu -
 * altura, raio e cor de campo diferentes em Processos, Intimacoes,
 * Andamentos e Pessoas, embora o comportamento fosse o mesmo.
 */
export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-superficie-alta border border-borda rounded-xl shadow-card p-3 flex flex-wrap items-center gap-2.5">
    {children}
  </div>
);

const CAMPO =
  'h-9 rounded-lg border border-borda bg-superficie-alta text-xs text-texto ' +
  'placeholder:text-texto-fraco transition-colors ' +
  'focus:border-marca focus:ring-2 focus:ring-marca/15';

interface CampoBuscaProps {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rotulo: string;
  className?: string;
}

export const CampoBusca: React.FC<CampoBuscaProps> = ({
  valor,
  onChange,
  placeholder,
  rotulo,
  className,
}) => (
  <div className={cx('relative flex-1 basis-64 min-w-0', className)}>
    <Search
      className="w-3.5 h-3.5 text-texto-fraco absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
      aria-hidden="true"
    />
    <input
      type="search"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={rotulo}
      className={cx(CAMPO, 'w-full pl-9 pr-3')}
    />
  </div>
);

interface SeletorProps {
  valor: string;
  onChange: (v: string) => void;
  rotulo: string;
  opcoes: Array<{ valor: string; texto: string }>;
}

export const Seletor: React.FC<SeletorProps> = ({ valor, onChange, rotulo, opcoes }) => (
  <select
    value={valor}
    onChange={(e) => onChange(e.target.value)}
    aria-label={rotulo}
    className={cx(CAMPO, 'px-2.5 min-w-[9rem] font-medium cursor-pointer')}
  >
    {opcoes.map((o) => (
      <option key={o.valor} value={o.valor}>
        {o.texto}
      </option>
    ))}
  </select>
);
