import React, { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { FlowDrawer } from './components/ai/FlowDrawer';
import { ApiErrorBanner } from './components/common/ApiErrorBanner';
import { EmptyState } from './components/ui';

import { Login } from './pages/Login';
import { TrocarSenha } from './pages/TrocarSenha';
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
import { MinhaConta } from './pages/MinhaConta';

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

const ROTULO_CARGO: Record<string, string> = {
  socio: 'sócio',
  advogado: 'advogado',
  estagiario: 'estagiário',
  financeiro: 'financeiro',
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
    <div className="flex h-screen bg-superficie text-texto overflow-hidden">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} onOpenIA={handleOpenIA} />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto min-w-0">
        <Topbar onOpenIA={handleOpenIA} onQuickAction={handleQuickAction} />

        {/*
          Largura util limitada a 1440px e centrada. Antes o conteudo se
          esticava ate a borda do monitor: numa tela de 27", a linha de texto
          passava de 200 caracteres e a coluna de acao ficava a meio metro do
          titulo da linha. O espaco vertical (28px) e o horizontal (34px) sao
          os mesmos em toda tela - por isso moram aqui, e nao em cada pagina.
        */}
        <main className="flex-1 w-full max-w-[1440px] mx-auto px-[34px] max-[860px]:px-5 py-7 pb-14">
          {abaBloqueada ? (
            <div className="bg-superficie-alta border border-borda rounded-xl shadow-card">
              <EmptyState
                icone={ShieldAlert}
                titulo="Seu perfil não tem acesso a esta área"
                descricao={`Esta tela é restrita aos perfis ${cargosNecessarios
                  ?.map((c) => ROTULO_CARGO[c] ?? c)
                  .join(' e ')}. Fale com o sócio administrador do escritório se precisar de acesso.`}
              />
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

              {currentTab === 'minha-conta' && <MinhaConta />}
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
      <div className="min-h-screen bg-nav flex items-center justify-center">
        <div className="flex items-center gap-3 text-nav-texto">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span className="text-sm">Carregando JuridFlow...</span>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  // Senha definida por outra pessoa - pelo seed, ou redefinida pelo socio.
  // O backend recusa toda rota exceto a de troca, entao mostrar o sistema
  // aqui renderizaria telas que so dariam 403.
  if (usuario.senha_provisoria) {
    return <TrocarSenha obrigatoria />;
  }

  return <AreaLogada />;
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
