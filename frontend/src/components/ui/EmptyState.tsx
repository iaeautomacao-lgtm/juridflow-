import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Botao } from './Button';

/**
 * Estado vazio compacto.
 *
 * A versao anterior era um retangulo com borda ocupando a largura inteira da
 * tela para dizer uma frase. Aqui o bloco e centrado e pequeno: vazio nao
 * merece mais peso visual do que conteudo.
 */
interface EmptyStateProps {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icone: Icone,
  titulo,
  descricao,
  acao,
}) => (
  <div className="py-14 px-5 text-center">
    <div className="w-11 h-11 rounded-xl bg-superficie-sutil text-texto-suave grid place-items-center mx-auto mb-3.5">
      <Icone className="w-5 h-5" aria-hidden="true" />
    </div>
    <p className="text-[13px] font-semibold text-texto">{titulo}</p>
    {descricao && (
      <p className="max-w-sm mx-auto mt-1.5 text-[11px] leading-relaxed text-texto-suave">
        {descricao}
      </p>
    )}
    {acao && <div className="mt-4 flex justify-center">{acao}</div>}
  </div>
);

/**
 * Falha de carregamento - deliberadamente diferente do estado vazio.
 *
 * "Nenhum andamento encontrado" e "a API nao respondeu" sao fatos distintos.
 * A camada HTTP foi corrigida justamente para parar de transformar falha em
 * lista vazia; renderizar os dois com o mesmo desenho desfaria a correcao na
 * interface, e o usuario concluiria que nao ha processo em andamento quando
 * na verdade o servidor esta fora.
 */
interface ErrorStateProps {
  titulo?: string;
  mensagem: string;
  onTentarNovamente?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  titulo = 'Não foi possível carregar',
  mensagem,
  onTentarNovamente,
}) => (
  <div className="py-14 px-5 text-center" role="alert">
    <div className="w-11 h-11 rounded-xl bg-erro-fundo text-erro grid place-items-center mx-auto mb-3.5">
      <AlertTriangle className="w-5 h-5" aria-hidden="true" />
    </div>
    <p className="text-[13px] font-semibold text-texto">{titulo}</p>
    <p className="max-w-md mx-auto mt-1.5 text-[11px] leading-relaxed text-texto-suave">
      {mensagem}
    </p>
    {onTentarNovamente && (
      <div className="mt-4 flex justify-center">
        <Botao variante="secundario" tamanho="sm" icone={RefreshCw} onClick={onTentarNovamente}>
          Tentar novamente
        </Botao>
      </div>
    )}
  </div>
);
