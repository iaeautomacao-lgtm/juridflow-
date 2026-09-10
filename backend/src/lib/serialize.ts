import { Request, Response, NextFunction } from 'express';

/**
 * Normaliza tipos do Prisma que nao sobrevivem a JSON.stringify.
 *
 *   Decimal -> number   (valor_causa, valor, valor_total)
 *   BigInt  -> number   (tamanho_bytes); acima de Number.MAX_SAFE_INTEGER
 *                       cai para string, para nao perder precisao em silencio
 *   Date    -> string ISO (JSON.stringify ja faria isso; explicitado aqui)
 *
 * Sem isso, um GET em qualquer rota com campo BigInt lanca
 * "TypeError: Do not know how to serialize a BigInt" e devolve 500.
 */
function ehDecimalPrisma(valor: any): boolean {
  return (
    valor !== null &&
    typeof valor === 'object' &&
    typeof valor.toNumber === 'function' &&
    typeof valor.toFixed === 'function' &&
    valor.constructor?.name === 'Decimal'
  );
}

export function normalizarParaJson(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 12 || valor === null || valor === undefined) {
    return valor ?? null;
  }

  if (typeof valor === 'bigint') {
    return valor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valor) : valor.toString();
  }

  if (valor instanceof Date) {
    return valor.toISOString();
  }

  if (ehDecimalPrisma(valor)) {
    return (valor as any).toNumber();
  }

  if (Array.isArray(valor)) {
    return valor.map((v) => normalizarParaJson(v, profundidade + 1));
  }

  if (typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] = normalizarParaJson(v, profundidade + 1);
    }
    return saida;
  }

  return valor;
}

/**
 * Middleware global: envolve res.json para normalizar todo payload de saida.
 * Aplicado uma vez em server.ts, vale para todos os controllers.
 */
export function serializadorPrisma(_req: Request, res: Response, next: NextFunction): void {
  const jsonOriginal = res.json.bind(res);
  res.json = (corpo: unknown) => jsonOriginal(normalizarParaJson(corpo));
  next();
}
