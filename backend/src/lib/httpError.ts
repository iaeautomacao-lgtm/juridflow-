import { Response } from 'express';
import { config } from './config';

/**
 * Resposta de erro uniforme.
 *
 * Erros de dominio (VinculoInvalidoError, PrazoInvalidoError, CnjInvalidoError,
 * DjenIndisponivelError, DataJudIndisponivelError, ProcessoNaoEncontradoError)
 * carregam `statusCode` proprio e sao repassados com a mensagem original -
 * elas foram escritas para o usuario final ler.
 *
 * Erro inesperado devolve 500 com mensagem genERica. O stack vai para o log do
 * servidor, e para o corpo da resposta apenas fora de producao: stack em
 * resposta HTTP expoe caminho de arquivo e versao de dependencia.
 */
export function tratarErro(res: Response, erro: unknown, mensagemPadrao: string): Response {
  const statusCode =
    typeof (erro as any)?.statusCode === 'number' ? (erro as any).statusCode : 500;

  const nome = (erro as any)?.name ?? 'Error';
  const mensagem = (erro as any)?.message ?? String(erro);

  if (statusCode >= 500) {
    console.error(`[JuridFlow] ${mensagemPadrao}:`, erro);
  }

  if (statusCode < 500) {
    return res.status(statusCode).json({ message: mensagem, codigo: nome });
  }

  return res.status(500).json({
    message: mensagemPadrao,
    codigo: 'ERRO_INTERNO',
    ...(config.isProducao ? {} : { detalhe: mensagem }),
  });
}
