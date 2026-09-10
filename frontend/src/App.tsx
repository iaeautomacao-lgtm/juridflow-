import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { FlowDrawer } from './components/ai/FlowDrawer';
import { ApiErrorBanner } from './components/common/ApiErrorBanner';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Processos } from './pages/Contencioso/Processos';
import { Intimacoes } from './pages/Contencioso/Intimacoes';
import { CentralCaptura } from './pages/Contencioso/CentralCaptura';
import { Andamentos } from './pages/Contencioso/Andamentos';
import { Atividades } from './pages/Atividades/Atividades';
import { Pessoas } from './pages/Gestao/Pessoas';
import { AtendimentoCRM } from './pages/Gestao/AtendimentoCRM';
import { Financeiro } from './pages/Financeiro/Financeiro';
import { Documentos } from './pages/Documentos/Documentos';
import { Configuracoes } from './pages/Configuracoes/Configuracoes';

/**
 * Abas restritas por cargo.
 *
 * Espelha o requireCargo do backend. A checagem que vale e a do servidor -
 * esta aqui evita que o usuario navegue para uma tela que so vai responder 403.
 */
const CARGOS_POR_ABA: Record<string, Array<'socio' | 'advogado' | 'estagiario' | 'financeiro'>> = {
  'financeiro-extrato': ['socio', 'financeiro'],
  contratos: ['socio', 'financeiro'],
};

function AreaLogada() {
  const { podeAcessar } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isIAOpen, setIsIAOpen] = useState<boolean>(false);
  const [quickActionTriggered, setQuickActionTriggered] = useState<boolean>(false);

  const handleOpenIA = () => setIsIAOpen(true);
  const handleCloseIA = () => setIsIAOpen(false);

  const handleQuickAction = (action: string) => {
    if (action === 'nova-tarefa') {
      setCurrentTab('atividades');
      setQuickActionTriggered(true);
      setTimeout(() => setQuickActionTriggered(false), 1200);
      return;
    }
    if (action === 'novo-processo') {
      setCurrentTab('processos');
      return;
    }
    if (action === 'captura') {
      setCurrentTab('central-captura');
    }
  };

  const handleAdicionarTarefaViaIA = () => {
    setCurrentTab('atividades');
    setQuickActionTriggered(true);
    setTimeout(() => setQuickActionTriggered(false), 1200);
  };

  const cargosNecessarios = CARGOS_POR_ABA[currentTab];
  const abaBloqueada = cargosNecessarios !== undefined && !podeAcessar(...cargosNecessarios);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} onOpenIA={handleOpenIA} />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Topbar onOpenIA={handleOpenIA} onQuickAction={handleQuickAction} />

        <main className="flex-1 pb-12">
          {abaBloqueada ? (
            <div className="p-8">
              <div className="max-w-lg bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <h2 className="text-base font-semibold text-amber-900">
                  Seu perfil nao tem acesso a esta area
                </h2>
                <p className="text-sm text-amber-800 mt-2">
                  Esta tela e restrita aos perfis: {cargosNecessarios?.join(', ')}. Fale com o
                  socio administrador do escritorio se precisar de acesso.
                </p>
              </div>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <Dashboard onNavigate={(tab) => setCurrentTab(tab)} onOpenIA={handleOpenIA} />
              )}

              {currentTab === 'processos' && <Processos onOpenIA={handleOpenIA} />}

              {currentTab === 'intimacoes' && (
                <Intimacoes
                  onOpenIA={handleOpenIA}
                  onAdicionarTarefa={handleAdicionarTarefaViaIA}
                />
              )}

              {currentTab === 'central-captura' && <CentralCaptura />}

              {currentTab === 'andamentos' && <Andamentos onOpenIA={handleOpenIA} />}

              {currentTab === 'atividades' && (
                <Atividades onOpenIA={handleOpenIA} quickActionActive={quickActionTriggered} />
              )}

              {currentTab === 'pessoas' && <Pessoas />}

              {currentTab === 'crm' && <AtendimentoCRM />}

              {(currentTab === 'financeiro-extrato' || currentTab === 'contratos') && <Financeiro />}

              {(currentTab === 'arquivos' || currentTab === 'modelos') && <Documentos />}

              {(currentTab === 'configuracoes' || currentTab === 'presto') && <Configuracoes />}
            </>
          )}
        </main>
      </div>

      <FlowDrawer
        isOpen={isIAOpen}
        onClose={handleCloseIA}
        onNavigate={(tab) => setCurrentTab(tab)}
        onAdicionarTarefa={handleAdicionarTarefaViaIA}
      />
    </div>
  );
}

function Portao() {
  const { usuario, carregando } = useAuth();

  // Enquanto o token guardado e revalidado contra /auth/me, evita piscar a
  // tela de login para quem ja esta logado.
  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Carregando JuridFlow...</span>
        </div>
      </div>
    );
  }

  return usuario ? <AreaLogada /> : <Login />;
}

export function App() {
  return (
    <AuthProvider>
      <Portao />
      <ApiErrorBanner />
    </AuthProvider>
  );
}

export default App;
