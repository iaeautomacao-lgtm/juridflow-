import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

/**
 * Lista de registros processuais.
 *
 * Tres pecas que se encaixam:
 *
 *   Painel      moldura com cabecalho e contagem
 *   GrupoData   faixa "HOJE - 11 DE SETEMBRO DE 2026" separando os blocos
 *   LinhaLista  o registro
 *
 * O agrupamento por data nao e enfeite: em andamento e intimacao, a data e a
 * primeira pergunta de quem abre a tela - "o que entrou hoje". Uma lista
 * corrida com o carimbo de data repetido em cada cartao obriga a ler linha
 * por linha para descobrir onde o dia virou.
 */

export const Painel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="bg-superficie-alta border border-borda rounded-xl shadow-card overflow-hidden">
    {children}
  </section>
);

interface PainelCabecalhoProps {
  titulo: string;
  contagem?: React.ReactNode;
  acoes?: React.ReactNode;
}

export const PainelCabecalho: React.FC<PainelCabecalhoProps> = ({ titulo, contagem, acoes }) => (
  <div className="min-h-[46px] px-4 py-2 flex items-center justify-between gap-3 border-b border-borda">
    <span className="text-xs font-bold text-texto">{titulo}</span>
    <div className="flex items-center gap-3">
      {contagem !== undefined && (
        <span className="text-[11px] text-texto-suave tabular">{contagem}</span>
      )}
      {acoes}
    </div>
  </div>
);

export const GrupoData: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-4 py-2 bg-superficie text-rotulo font-bold uppercase text-texto-suave border-b border-borda">
    {children}
  </div>
);

const TONS_ICONE = {
  marca: 'bg-marca-fundo text-marca',
  atencao: 'bg-atencao-fundo text-atencao',
  neutro: 'bg-superficie-sutil text-texto-suave',
};

interface LinhaListaProps {
  icone: LucideIcon;
  tomIcone?: keyof typeof TONS_ICONE;
  /** Origem curta, ex.: "TJSP", "TRT 2a Regiao". */
  etiqueta?: string;
  /** Badges de estado. Slot: fica vazio quando nao ha nada a sinalizar. */
  badges?: React.ReactNode;
  /** Numero CNJ ou outro identificador - renderizado em fonte mono. */
  identificador?: string;
  titulo: string;
  /** Vara, comarca, partes. Aceita JSX para distribuir em mais de uma linha. */
  meta?: React.ReactNode;
  /** Canto superior direito: tempo relativo. */
  tempo?: string;
  /** Canto inferior direito: acao da linha. */
  acoes?: React.ReactNode;
  /** Fundo levemente destacado - usado para "ainda nao lido". */
  destaque?: boolean;
}

export const LinhaLista: React.FC<LinhaListaProps> = ({
  icone: Icone,
  tomIcone = 'marca',
  etiqueta,
  badges,
  identificador,
  titulo,
  meta,
  tempo,
  acoes,
  destaque = false,
}) => (
  <article
    className={cx(
      'grid gap-3 px-4 py-4 border-b border-borda last:border-b-0 transition-colors',
      'grid-cols-[38px_minmax(0,1fr)] sm:grid-cols-[38px_minmax(0,1fr)_auto]',
      // O destaque do nao lido e o fundo de marca cheio, nao a meia
      // opacidade: --marca-fundo (#F0F4F9) ja e quase branco, e a 50% sobre o
      // cartao branco a diferenca desaparecia.
      destaque ? 'bg-marca-fundo hover:bg-marca/[0.09]' : 'hover:bg-superficie'
    )}
  >
    <div
      className={cx('w-[38px] h-[38px] rounded-lg grid place-items-center', TONS_ICONE[tomIcone])}
    >
      <Icone className="w-4 h-4" aria-hidden="true" />
    </div>

    <div className="min-w-0">
      {(etiqueta || badges) && (
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          {etiqueta && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-texto-suave">
              {etiqueta}
            </span>
          )}
          {badges}
        </div>
      )}

      {identificador && (
        <div className="font-mono text-[13px] font-semibold text-texto tabular mb-1 break-all">
          {identificador}
        </div>
      )}

      <p className="text-[13px] font-semibold text-texto break-words">{titulo}</p>

      {meta && <p className="mt-1 text-[11px] text-texto-suave break-words">{meta}</p>}
    </div>

    <div className="col-start-2 sm:col-start-3 flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:min-w-[7.5rem]">
      {tempo && <span className="text-[10px] text-texto-suave whitespace-nowrap">{tempo}</span>}
      {acoes && <div className="flex items-center gap-1.5">{acoes}</div>}
    </div>
  </article>
);
