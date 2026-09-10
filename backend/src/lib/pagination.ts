import { Request } from 'express';

export const LIMITE_PADRAO = 50;
export const LIMITE_MAXIMO = 200;

export interface Paginacao {
  take: number;
  skip: number;
  limit: number;
  offset: number;
}

/**
 * Le limit/offset da query string com teto rigido.
 *
 * Todo findMany de listagem passa por aqui. Sem isso, um GET /processos num
 * escritorio com 20 mil processos carrega a tabela inteira em memoria e
 * derruba o processo Node.
 */
export function lerPaginacao(req: Request): Paginacao {
  const limitBruto = Number.parseInt(String(req.query.limit ?? ''), 10);
  const offsetBruto = Number.parseInt(String(req.query.offset ?? ''), 10);

  const limit = Number.isFinite(limitBruto) && limitBruto > 0
    ? Math.min(limitBruto, LIMITE_MAXIMO)
    : LIMITE_PADRAO;

  const offset = Number.isFinite(offsetBruto) && offsetBruto > 0 ? offsetBruto : 0;

  return { take: limit, skip: offset, limit, offset };
}

export interface MetaPaginacao {
  total: number;
  limit: number;
  offset: number;
  tem_mais: boolean;
}

/**
 * Monta o envelope de paginacao sob a chave nomeada que o front espera.
 *
 * `total` e a contagem no banco, nao o tamanho da pagina - e assim que o front
 * sabe se ha mais registros para buscar.
 *
 *   envelope('processos', itens, 1240, p)
 *   -> { processos: [...], total: 1240, limit: 50, offset: 0, tem_mais: true }
 */
export function envelope<T>(
  chave: string,
  itens: T[],
  total: number,
  p: Paginacao
): Record<string, unknown> & MetaPaginacao {
  return {
    [chave]: itens,
    total,
    limit: p.limit,
    offset: p.offset,
    tem_mais: p.offset + itens.length < total,
  } as Record<string, unknown> & MetaPaginacao;
}
