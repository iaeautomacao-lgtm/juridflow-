import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Users,
  DollarSign,
  FileText,
  Sparkles,
  Settings,
  ChevronRight,
  LogOut,
  KeyRound,
  Scale,
} from 'lucide-react';
import { useAuth, Cargo } from '../../context/AuthContext';
import { cx } from '../ui';

/**
 * Navegacao lateral.
 *
 * O que mudou em relacao a versao anterior:
 *
 *   - Item ativo deixou de ser pilula azul solida com sombra colorida. Agora
 *     e fundo sutil mais barra de 3px na borda esquerda. A pilula tinha o
 *     mesmo peso visual de um botao de acao primaria, entao a sidebar
 *     competia com o conteudo da pagina.
 *   - Modulos agrupados em secoes com rotulo. Onze itens em lista corrida
 *     nao tinham hierarquia nenhuma.
 *   - O botao Flow perdeu o gradiente azul-indigo-roxo, o Sparkles pulsante e
 *     a pilula "NOVIDADE". Era o elemento mais chamativo da tela inteira, e o
 *     que mais destoava de software juridico.
 *   - Colapsa para 72px abaixo de 860px de largura. Antes eram 256px fixos,
 *     que em tablet comiam metade da area util.
 *
 * O que NAO mudou, e nao pode mudar: o filtro por cargo. Financeiro some do
 * menu para advogado e estagiario porque o backend responde 403 nessas rotas
 * (requireCargo). Esconder aqui e conveniencia; quem protege o dado e o
 * servidor. Mas remover o filtro numa reescrita de layout reexpõe o menu.
 */

interface SubItem {
  id: string;
  label: string;
  badge?: string;
  cargos?: Cargo[];
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  /** Quando presente, o item so aparece para estes cargos. */
  cargos?: Cargo[];
  subItems?: SubItem[];
}

interface Secao {
  titulo: string;
  itens: MenuItem[];
}

const SECOES: Secao[] = [
  {
    titulo: 'Visão geral',
    itens: [
      { id: 'dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
      { id: 'atividades', label: 'Atividades & Kanban', icon: CheckSquare },
    ],
  },
  {
    titulo: 'Contencioso',
    itens: [
      {
        id: 'contencioso',
        label: 'Processos',
        icon: Briefcase,
        subItems: [
          { id: 'processos', label: 'Processos' },
          { id: 'intimacoes', label: 'Intimações DJEN' },
          { id: 'central-captura', label: 'Central de Captura' },
          { id: 'andamentos', label: 'Andamentos Processuais' },
        ],
      },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      {
        id: 'gestao',
        label: 'Clientes & CRM',
        icon: Users,
        subItems: [
          { id: 'pessoas', label: 'Pessoas & Clientes' },
          { id: 'crm', label: 'Atendimento CRM' },
        ],
      },
      {
        id: 'financeiro',
        label: 'Financeiro',
        icon: DollarSign,
        cargos: ['socio', 'financeiro'],
        subItems: [
          { id: 'financeiro-extrato', label: 'Receitas & Despesas' },
          { id: 'contratos', label: 'Contratos de Honorários' },
        ],
      },
      {
        id: 'documentos',
        label: 'Documentos',
        icon: FileText,
        subItems: [
          { id: 'arquivos', label: 'Gerenciador de Arquivos' },
          { id: 'modelos', label: 'Gerador de Peças' },
        ],
      },
    ],
  },
  {
    titulo: 'Sistema',
    itens: [
      {
        id: 'configuracoes',
        label: 'Configurações',
        icon: Settings,
        subItems: [
          { id: 'configuracoes', label: 'Painel Geral' },
          // Rotulo alinhado ao que o modulo faz: controle de vencimento de
          // certificado. Nao ha cofre de credencial - ver RELATORIO_ARQUITETURA.md.
          { id: 'presto', label: 'Certificados & Auditoria' },
        ],
      },
    ],
  },
];

const ROTULO_CARGO: Record<Cargo, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
  financeiro: 'Financeiro',
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenIA: () => void;
}

/** Some abaixo de 860px, onde a barra fica so com icones. */
const SO_EXPANDIDA = 'max-[860px]:hidden';

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onOpenIA }) => {
  const { usuario, sair, podeAcessar } = useAuth();

  // Filtro por cargo - ver comentario do topo do arquivo.
  const secoes = SECOES.map((secao) => ({
    ...secao,
    itens: secao.itens
      .filter((item) => !item.cargos || podeAcessar(...item.cargos))
      .map((item) => ({
        ...item,
        subItems: item.subItems?.filter((sub) => !sub.cargos || podeAcessar(...sub.cargos)),
      })),
  })).filter((secao) => secao.itens.length > 0);

  return (
    <aside
      className="w-[250px] max-[860px]:w-[72px] shrink-0 bg-nav flex flex-col h-screen sticky top-0 z-20 select-none"
      aria-label="Navegação principal"
    >
      {/* Marca */}
      <div className="h-16 shrink-0 flex items-center gap-2.5 px-[18px] max-[860px]:px-0 max-[860px]:justify-center border-b border-white/[0.07]">
        <div className="w-[34px] h-[34px] shrink-0 rounded-lg bg-marca grid place-items-center text-white">
          <Scale className="w-[18px] h-[18px]" aria-hidden="true" />
        </div>
        <div className={cx('min-w-0', SO_EXPANDIDA)}>
          <p className="font-display font-bold text-[15px] text-white leading-tight tracking-wide">
            JuridFlow
          </p>
          <p className="text-[10px] text-nav-texto-fraco leading-tight mt-0.5">Gestão Jurídica</p>
        </div>
      </div>

      {/* Assistente. Nao e navegacao - abre uma gaveta - mas mora aqui porque
          e por onde se chega a ele. Tratado como item de menu, com o icone em
          ouro da marca: presente, sem gritar. */}
      <div className="px-2.5 pt-3">
        <button
          type="button"
          onClick={onOpenIA}
          className="w-full min-h-10 flex items-center gap-2.5 px-3 max-[860px]:px-0 max-[860px]:justify-center rounded-lg text-nav-texto hover:bg-nav-alta hover:text-white transition-colors"
        >
          <Sparkles className="w-[18px] h-[18px] shrink-0 text-ouro" aria-hidden="true" />
          <span className={cx('text-[13px] font-medium', SO_EXPANDIDA)}>Assistente Flow</span>
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {secoes.map((secao) => (
          <div key={secao.titulo}>
            <p
              className={cx(
                'px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-nav-texto-fraco',
                SO_EXPANDIDA
              )}
            >
              {secao.titulo}
            </p>

            <div className="space-y-0.5">
              {secao.itens.map((item) => {
                const Icone = item.icon;
                const ativo =
                  currentTab === item.id ||
                  Boolean(item.subItems?.some((sub) => sub.id === currentTab));

                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentTab(
                          item.subItems && item.subItems.length > 0 ? item.subItems[0].id : item.id
                        )
                      }
                      aria-current={ativo ? 'page' : undefined}
                      title={item.label}
                      className={cx(
                        'relative w-full min-h-10 flex items-center gap-2.5 px-3 rounded-lg transition-colors',
                        'max-[860px]:px-0 max-[860px]:justify-center',
                        ativo
                          ? 'bg-marca/[0.14] text-white'
                          : 'text-nav-texto hover:bg-nav-alta hover:text-white'
                      )}
                    >
                      {/* Barra do item ativo. Substitui a pilula solida. */}
                      {ativo && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[22px] rounded-r bg-marca-clara"
                        />
                      )}

                      <Icone
                        className={cx(
                          'w-[18px] h-[18px] shrink-0',
                          ativo ? 'text-marca-clara' : 'text-nav-texto-fraco'
                        )}
                        aria-hidden="true"
                      />

                      <span className={cx('flex-1 text-left text-[13px] font-medium', SO_EXPANDIDA)}>
                        {item.label}
                      </span>

                      {item.subItems && (
                        <ChevronRight
                          className={cx(
                            'w-3 h-3 shrink-0 text-nav-texto-fraco transition-transform',
                            ativo && 'rotate-90',
                            SO_EXPANDIDA
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </button>

                    {item.subItems && ativo && (
                      <div className={cx('mt-1 ml-[30px] space-y-0.5', SO_EXPANDIDA)}>
                        {item.subItems.map((sub) => {
                          const subAtivo = currentTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => setCurrentTab(sub.id)}
                              aria-current={subAtivo ? 'page' : undefined}
                              className={cx(
                                'w-full flex items-center justify-between gap-2 py-2 px-2.5 rounded-lg text-left text-xs transition-colors',
                                subAtivo
                                  ? 'text-marca-clara bg-marca/10 font-semibold'
                                  : 'text-nav-texto-fraco hover:text-white'
                              )}
                            >
                              <span>{sub.label}</span>
                              {sub.badge && (
                                <span className="text-[9px] font-bold uppercase text-ouro">
                                  {sub.badge}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sessao. Os dados vem de useAuth - nunca literais no codigo: este
          rodape ja exibiu 'Dra. Gisele Oliveira / OAB SP 432.109' para
          qualquer pessoa logada. */}
      <div className="shrink-0 p-2.5 border-t border-white/[0.07]">
        <div className="flex items-center gap-2.5 p-2.5 max-[860px]:p-0 max-[860px]:flex-col max-[860px]:gap-2 rounded-lg bg-white/[0.05] max-[860px]:bg-transparent">
          <div className="w-[34px] h-[34px] shrink-0 rounded-lg bg-marca-escura text-white grid place-items-center text-[11px] font-bold">
            {usuario ? iniciais(usuario.nome) : '?'}
          </div>

          <div className={cx('flex-1 min-w-0', SO_EXPANDIDA)}>
            <p className="text-[12px] font-semibold text-white truncate">
              {usuario?.nome ?? 'Sessão'}
            </p>
            <p className="text-[10px] text-nav-texto-fraco truncate">
              {usuario ? ROTULO_CARGO[usuario.cargo] : ''}
              {usuario?.tenant.nome ? ` · ${usuario.tenant.nome}` : ''}
            </p>
          </div>

          <div className="flex max-[860px]:flex-col items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCurrentTab('minha-conta')}
              aria-label="Minha conta e senha"
              title="Minha conta e senha"
              className={cx(
                'p-1.5 rounded-lg transition-colors',
                currentTab === 'minha-conta'
                  ? 'text-marca-clara bg-marca/10'
                  : 'text-nav-texto-fraco hover:text-white hover:bg-nav-alta'
              )}
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={sair}
              aria-label="Sair do sistema"
              title="Sair"
              className="p-1.5 rounded-lg text-nav-texto-fraco hover:text-erro hover:bg-erro/10 transition-colors"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
