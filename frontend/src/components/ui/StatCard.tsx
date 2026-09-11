import React from 'react';
import { cx } from './cx';

/**
 * Indicador numerico da faixa superior da tela.
 *
 * Sem icone e sem cor de fundo: quatro cartoes coloridos lado a lado disputam
 * atencao entre si e nenhum vence. Quando o numero precisa alertar, use
 * tom="atencao" - e a excecao, nao o padrao.
 */
interface StatCardProps {
  rotulo: string;
  valor: React.ReactNode;
  detalhe?: string;
  tom?: 'neutro' | 'atencao' | 'erro';
  /** Torna o cartao clicavel (ex.: filtrar a lista por este recorte). */
  onClick?: () => void;
}

const TONS = {
  neutro: 'text-texto',
  atencao: 'text-atencao',
  erro: 'text-erro',
};

export const StatCard: React.FC<StatCardProps> = ({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
  onClick,
}) => {
  const conteudo = (
    <>
      <div className="text-rotulo font-semibold uppercase text-texto-suave">{rotulo}</div>
      <div className={cx('mt-1.5 text-[22px] font-bold tabular leading-none', TONS[tom])}>
        {valor}
      </div>
      {detalhe && <div className="mt-1.5 text-[11px] text-texto-suave">{detalhe}</div>}
    </>
  );

  const classe = 'bg-superficie-alta border border-borda rounded-xl shadow-card px-4 py-3.5';

  if (!onClick) {
    return <div className={classe}>{conteudo}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(classe, 'text-left w-full transition-colors hover:border-borda-forte')}
    >
      {conteudo}
    </button>
  );
};

/** Faixa de indicadores. Quatro em desktop, dois em tablet, um no telefone. */
export const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{children}</div>
);
