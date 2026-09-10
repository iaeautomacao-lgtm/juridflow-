export const CARGOS = ['socio', 'advogado', 'estagiario', 'financeiro'] as const;

export type Cargo = (typeof CARGOS)[number];

export function isCargo(valor: unknown): valor is Cargo {
  return typeof valor === 'string' && (CARGOS as readonly string[]).includes(valor);
}

export const ROTULO_CARGO: Record<Cargo, string> = {
  socio: 'Socio',
  advogado: 'Advogado',
  estagiario: 'Estagiario',
  financeiro: 'Financeiro',
};
