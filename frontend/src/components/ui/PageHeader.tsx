import React from 'react';

/**
 * Cabecalho de pagina: onde estou, o que e isto, o que posso fazer aqui.
 *
 * Repetia-se a mao em 12 telas, com tamanho e cor de icone diferentes em cada
 * uma (indigo em Andamentos, azul em Pessoas, ambar em Financeiro). O icone
 * saiu: a trilha ja diz o modulo, e um icone colorido por tela fazia a barra
 * de titulo mudar de cor a cada clique no menu.
 *
 * Titulo em Inter 700. Sem serifa - decidido com a Gih: serifa em tela
 * operacional briga com a densidade.
 */
interface PageHeaderProps {
  /** Ex.: ['Contencioso', 'Andamentos']. O ultimo item e a pagina atual. */
  trilha?: string[];
  titulo: string;
  descricao?: string;
  /** Botoes da direita. */
  acoes?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ trilha, titulo, descricao, acoes }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    <div className="min-w-0">
      {trilha && trilha.length > 0 && (
        <nav aria-label="Trilha de navegação" className="flex items-center gap-1.5 mb-2">
          {trilha.map((item, i) => (
            <React.Fragment key={item}>
              {i > 0 && (
                <span className="text-texto-fraco" aria-hidden="true">
                  /
                </span>
              )}
              <span className="text-[11px] text-texto-suave">{item}</span>
            </React.Fragment>
          ))}
        </nav>
      )}

      <h1 className="text-[25px] font-bold tracking-tight text-texto text-balance">{titulo}</h1>

      {descricao && <p className="mt-1.5 text-[13px] text-texto-suave max-w-2xl">{descricao}</p>}
    </div>

    {acoes && <div className="flex items-center gap-2 shrink-0">{acoes}</div>}
  </div>
);
