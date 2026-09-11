/**
 * Primitivos da interface do JuridFlow.
 *
 * Toda tela monta a partir daqui. Se uma tela precisa de algo que nao existe
 * neste diretorio, o caminho e acrescentar o primitivo - nao escrever classe
 * de cor solta no JSX, que foi como a interface chegou a ~1.200 pontos de cor
 * espalhados e sem tema escuro possivel.
 */
export { cx } from './cx';
export { Badge } from './Badge';
export type { TomBadge } from './Badge';
export { Botao } from './Button';
export type { VarianteBotao } from './Button';
export { Card } from './Card';
export { EmptyState, ErrorState } from './EmptyState';
export { FilterBar, CampoBusca, Seletor } from './FilterBar';
export { PageHeader } from './PageHeader';
export { StatCard, StatGrid } from './StatCard';
export { Painel, PainelCabecalho, GrupoData, LinhaLista } from './DataList';
