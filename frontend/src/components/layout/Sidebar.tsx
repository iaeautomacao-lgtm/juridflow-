import React from 'react';
import { useAuth, Cargo } from '../../context/AuthContext';
import { LogOut, KeyRound } from 'lucide-react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Briefcase, 
  Users, 
  DollarSign, 
  FileText, 
  Sparkles, 
  Settings, 
  ShieldCheck, 
  ChevronRight,
  Headphones,
  Bell,
  Scale
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenIA: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  /** Quando presente, o item so aparece para estes cargos. */
  cargos?: Cargo[];
  subItems?: Array<{ id: string; label: string; badge?: string; cargos?: Cargo[] }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, onOpenIA }) => {
  const { usuario, sair, podeAcessar } = useAuth();

  const todosItens: MenuItem[] = [
    { id: 'dashboard', label: 'Painel de Controle', icon: LayoutDashboard },
    { id: 'atividades', label: 'Atividades & Kanban', icon: CheckSquare },
    { 
      id: 'contencioso', 
      label: 'Contencioso', 
      icon: Briefcase,
      subItems: [
        { id: 'processos', label: 'Processos' },
        { id: 'intimacoes', label: 'Intimações DJEN', badge: 'Novo' },
        { id: 'central-captura', label: 'Central de Captura / Push' },
        { id: 'andamentos', label: 'Andamentos Processuais' },
      ]
    },
    { 
      id: 'gestao', 
      label: 'Gestão & CRM', 
      icon: Users,
      subItems: [
        { id: 'pessoas', label: 'Pessoas & Clientes' },
        { id: 'crm', label: 'Atendimento CRM' },
      ]
    },
    { 
      id: 'financeiro', 
      label: 'Financeiro', 
      icon: DollarSign,
      // O backend recusa estas rotas com 403 para advogado e estagiario
      // (requireCargo). Esconder aqui evita o usuario bater no erro.
      cargos: ['socio', 'financeiro'],
      subItems: [
        { id: 'financeiro-extrato', label: 'Receitas & Despesas' },
        { id: 'contratos', label: 'Contratos de Honorários' },
      ]
    },
    { 
      id: 'documentos', 
      label: 'Documentos & Modelos', 
      icon: FileText,
      subItems: [
        { id: 'arquivos', label: 'Gerenciador de Arquivos' },
        { id: 'modelos', label: 'Gerador de Peças' },
      ]
    },
    { 
      id: 'configuracoes', 
      label: 'Configurações', 
      icon: Settings,
      subItems: [
        { id: 'configuracoes', label: 'Painel Geral' },
        // Rotulo alinhado ao que o modulo faz: controle de vencimento de
        // certificado. Nao ha cofre de credencial - ver RELATORIO_ARQUITETURA.md.
        { id: 'presto', label: 'Certificados & Auditoria' },
      ]
    },
  ];

  const menuItems = todosItens
    .filter((item) => !item.cargos || podeAcessar(...item.cargos))
    .map((item) => ({
      ...item,
      subItems: item.subItems?.filter((sub) => !sub.cargos || podeAcessar(...sub.cargos)),
    }));

  const ROTULO_CARGO: Record<Cargo, string> = {
    socio: 'Socio',
    advogado: 'Advogado',
    estagiario: 'Estagiario',
    financeiro: 'Financeiro',
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between h-screen sticky top-0 shadow-2xl z-20 select-none border-r border-slate-800">
      <div>
        {/* Header / Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-wide flex items-center gap-1.5">
              JuridFlow <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">PRO</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Plataforma Jurídica IA</p>
          </div>
        </div>

        {/* Botão de Destaque da IA Flow */}
        <div className="px-4 mt-4 mb-2">
          <button 
            onClick={onOpenIA}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium py-2.5 px-3 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-between transition-all group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span className="text-sm font-semibold">Flow</span>
            </div>
            <span className="text-[9px] bg-blue-400/30 text-blue-200 border border-blue-300/30 px-2 py-0.5 rounded-full font-bold group-hover:scale-105 transition-transform">
              NOVIDADE
            </span>
          </button>
        </div>

        {/* Lista de Menus */}
        <nav className="px-3 py-2 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id || (item.subItems && item.subItems.some(sub => sub.id === currentTab));

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (item.subItems && item.subItems.length > 0) {
                      setCurrentTab(item.subItems[0].id);
                    } else {
                      setCurrentTab(item.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}

                  {item.subItems && (
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'rotate-90 text-white' : 'text-slate-500'}`} />
                  )}
                </button>

                {/* Sub-itens expandidos se estiver ativo */}
                {item.subItems && isActive && (
                  <div className="pl-9 pr-2 space-y-1 py-1">
                    {item.subItems.map((sub) => {
                      const isSubActive = currentTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setCurrentTab(sub.id)}
                          className={`w-full flex items-center justify-between text-xs font-medium py-1.5 px-2.5 rounded-lg transition-colors ${
                            isSubActive
                              ? 'text-blue-400 bg-blue-500/10 font-semibold'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <span>{sub.label}</span>
                          {sub.badge && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
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
        </nav>
      </div>

      {/* Footer / Card de Suporte / Perfil do Escritório */}
      <div className="p-3 border-t border-slate-800/80 space-y-3">
        <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {usuario?.tenant.nome ?? 'Escritorio'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {usuario ? `${usuario.nome} - ${ROTULO_CARGO[usuario.cargo]}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('minha-conta')}
            aria-label="Minha conta"
            title="Minha conta e senha"
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              currentTab === 'minha-conta'
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/50'
            }`}
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={sair}
            aria-label="Sair do sistema"
            title="Sair"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </div>
    </aside>
  );
};

