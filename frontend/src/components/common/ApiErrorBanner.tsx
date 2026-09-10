import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, ShieldAlert, WifiOff } from 'lucide-react';
import { EVENTO_ERRO_API, DetalheErroApi } from '../../services/http';

/**
 * Superficie global de erro de API.
 *
 * Por que existe: as paginas tratam falha com `catch (err) { console.error(err) }`.
 * Isso significa que, sem este componente, uma API fora do ar continuaria
 * produzindo tela vazia sem aviso - exatamente o comportamento que o
 * fallback silencioso do api.ts antigo causava.
 *
 * Toda falha de requisicao publica um evento; este banner escuta e mostra ao
 * usuario, seja qual for a pagina.
 */

interface ErroVisivel extends DetalheErroApi {
  id: number;
  quantidade: number;
}

const LIMITE_VISIVEL = 3;

export function ApiErrorBanner() {
  const [erros, setErros] = useState<ErroVisivel[]>([]);

  useEffect(() => {
    let contador = 0;

    function aoErro(evento: Event) {
      const detalhe = (evento as CustomEvent<DetalheErroApi>).detail;
      if (!detalhe) return;

      setErros((atuais) => {
        // Agrupa repeticao do mesmo erro em vez de empilhar dezenas de cards.
        const existente = atuais.find(
          (e) => e.mensagem === detalhe.mensagem && e.endpoint === detalhe.endpoint
        );
        if (existente) {
          return atuais.map((e) =>
            e.id === existente.id ? { ...e, quantidade: e.quantidade + 1 } : e
          );
        }
        contador += 1;
        return [{ ...detalhe, id: contador, quantidade: 1 }, ...atuais].slice(0, LIMITE_VISIVEL);
      });
    }

    window.addEventListener(EVENTO_ERRO_API, aoErro);
    return () => window.removeEventListener(EVENTO_ERRO_API, aoErro);
  }, []);

  if (erros.length === 0) return null;

  const fechar = (id: number) => setErros((atuais) => atuais.filter((e) => e.id !== id));

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm"
      role="region"
      aria-label="Avisos de falha de comunicacao"
    >
      {erros.map((erro) => {
        const ehRede = erro.codigo === 'REDE';
        const ehPermissao = erro.status === 403;

        const Icone = ehRede ? WifiOff : ehPermissao ? ShieldAlert : AlertTriangle;
        const cor = ehPermissao
          ? 'bg-amber-950/95 border-amber-600/50 text-amber-100'
          : 'bg-red-950/95 border-red-600/50 text-red-100';
        const corIcone = ehPermissao ? 'text-amber-400' : 'text-red-400';

        const titulo = ehRede
          ? 'Sem conexao com o servidor'
          : ehPermissao
            ? 'Sem permissao para esta operacao'
            : `Falha na requisicao${erro.status ? ` (HTTP ${erro.status})` : ''}`;

        return (
          <div
            key={erro.id}
            role="alert"
            className={`${cor} border rounded-xl p-3 shadow-2xl backdrop-blur-sm flex items-start gap-2.5`}
          >
            <Icone className={`w-4 h-4 mt-0.5 shrink-0 ${corIcone}`} aria-hidden="true" />

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                {titulo}
                {erro.quantidade > 1 && (
                  <span className="text-[10px] font-normal opacity-70">
                    ({erro.quantidade}x)
                  </span>
                )}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5 break-words">{erro.mensagem}</p>
              <p className="text-[10px] font-mono opacity-50 mt-1 truncate">{erro.endpoint}</p>
            </div>

            <button
              type="button"
              onClick={() => fechar(erro.id)}
              aria-label="Fechar aviso"
              className="p-1 rounded-lg hover:bg-white/10 shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
