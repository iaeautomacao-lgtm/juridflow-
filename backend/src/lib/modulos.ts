/**
 * Chaves de modulo do JuridFlow.
 *
 * Recursos transversais (andamento, tarefa, documento, lancamento financeiro)
 * se vinculam a qualquer modulo pelo par (chave_modulo, codigo_registro_vinculo),
 * em vez de FK dedicada. Adicionar um modulo novo aqui nao exige migration.
 */
export const CHAVES_MODULO = ['processo', 'atendimento', 'contrato', 'pessoa'] as const;

export type ChaveModulo = (typeof CHAVES_MODULO)[number];

export function isChaveModulo(valor: unknown): valor is ChaveModulo {
  return typeof valor === 'string' && (CHAVES_MODULO as readonly string[]).includes(valor);
}

/**
 * Valida o par de vinculo vindo de rota ou body.
 * Retorna null quando o vinculo e opcional e nao foi informado.
 */
export function parseVinculo(
  chaveModulo: unknown,
  codigoRegistro: unknown
): { chave_modulo: ChaveModulo; codigo_registro_vinculo: string } | null {
  if (chaveModulo === undefined || chaveModulo === null || chaveModulo === '') {
    return null;
  }
  if (!isChaveModulo(chaveModulo)) {
    throw new VinculoInvalidoError(
      `chave_modulo invalida: "${String(chaveModulo)}". Valores aceitos: ${CHAVES_MODULO.join(', ')}.`
    );
  }
  if (typeof codigoRegistro !== 'string' || codigoRegistro.trim() === '') {
    throw new VinculoInvalidoError(
      'codigo_registro_vinculo e obrigatorio quando chave_modulo e informada.'
    );
  }
  return { chave_modulo: chaveModulo, codigo_registro_vinculo: codigoRegistro.trim() };
}

export class VinculoInvalidoError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'VinculoInvalidoError';
  }
}

/**
 * Confirma que o registro dono existe e pertence ao tenant.
 * Sem FK no banco, esta checagem e a unica barreira contra vinculo orfao
 * ou vinculo cruzado entre tenants.
 */
export async function assertVinculoExiste(
  prisma: import('@prisma/client').PrismaClient,
  tenantId: string,
  chaveModulo: ChaveModulo,
  codigoRegistro: string
): Promise<void> {
  const where = { id: codigoRegistro, tenant_id: tenantId };

  const encontrado = await (async () => {
    switch (chaveModulo) {
      case 'processo':
        return prisma.processo.findFirst({ where, select: { id: true } });
      case 'atendimento':
        return prisma.atendimento.findFirst({ where, select: { id: true } });
      case 'contrato':
        return prisma.contratoHonorarios.findFirst({ where, select: { id: true } });
      case 'pessoa':
        return prisma.pessoa.findFirst({ where, select: { id: true } });
    }
  })();

  if (!encontrado) {
    throw new VinculoInvalidoError(
      `Nenhum registro do modulo "${chaveModulo}" com id "${codigoRegistro}" neste tenant.`
    );
  }
}
