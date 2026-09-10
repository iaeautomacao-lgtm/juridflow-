import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  User, 
  ChevronDown, 
  Building2, 
  UserCheck, 
  CheckCircle2, 
  DollarSign, 
  Briefcase 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface Aviso {
  cor: string;
  titulo: string;
  detalhe: string;
}

const ROTULO_CARGO: Record<string, string> = {
  socio: 'Socio',
  advogado: 'Advogado',
  estagiario: 'Estagiario',
  financeiro: 'Financeiro',
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

interface TopbarProps {
  onOpenIA: () => void;
  onQuickAction: (action: string) => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onQuickAction }) => {
  const [modo, setModo] = useState<'escritorio' | 'pessoal'>('escritorio');
  const [busca, setBusca] = useState('');
  const [showNovoMenu, setShowNovoMenu] = useState(false);
  const [showNotificacoes, setShowNotificacoes] = useState(false);
  const { usuario } = useAuth();

  // Avisos derivados de contagem real no banco.
  //
  // Antes esta area tinha duas notificacoes fixas no codigo - "Nova intimacao
  // DJEN / Processo 1002345-89.2024.8.26.0100 / Ha 15 minutos" e "Prazo fatal
  // amanha / Audiencia de Conciliacao - TRT2" - com o ponto vermelho sempre
  // aceso. Elas apareciam num sistema recem-instalado, sem um unico processo.
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const kpis = await api.getDashboardKpis();
        if (!ativo) return;

        const lista: Aviso[] = [];

        if (kpis?.intimacoes?.pendentes > 0) {
          lista.push({
            cor: 'bg-blue-500',
            titulo: `${kpis.intimacoes.pendentes} intimacao(oes) pendente(s)`,
            detalhe: 'Vincular ao processo e abrir o prazo',
          });
        }
        if (kpis?.intimacoes?.sem_processo > 0) {
          lista.push({
            cor: 'bg-indigo-500',
            titulo: `${kpis.intimacoes.sem_processo} intimacao(oes) sem processo cadastrado`,
            detalhe: 'Cadastrar o processo para poder vincular',
          });
        }
        if (kpis?.tarefas?.atrasadas > 0) {
          lista.push({
            cor: 'bg-red-500',
            titulo: `${kpis.tarefas.atrasadas} tarefa(s) em atraso`,
            detalhe: 'O vencimento ja passou',
          });
        }
        if (kpis?.andamentos?.nao_lidos > 0) {
          lista.push({
            cor: 'bg-amber-500',
            titulo: `${kpis.andamentos.nao_lidos} andamento(s) nao lido(s)`,
            detalhe: 'Capturados do DataJud',
          });
        }
        if (kpis?.certificados?.vencendo_em_30_dias > 0) {
          lista.push({
            cor: 'bg-orange-500',
            titulo: `${kpis.certificados.vencendo_em_30_dias} certificado(s) vencendo`,
            detalhe: 'Nos proximos 30 dias',
          });
        }

        setAvisos(lista);
      } catch {
        // Falha aqui nao merece tratamento proprio: o ApiErrorBanner ja
        // mostrou o erro da requisicao, e o sino fica sem avisos.
        if (ativo) setAvisos([]);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-10 shadow-xs">
      {/* Esquerda: Toggle Modo + Busca Global */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {/* Toggle Pessoal / Escritório */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setModo('escritorio')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              modo === 'escritorio'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Escritório</span>
          </button>

          <button
            onClick={() => setModo('pessoal')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              modo === 'pessoal'
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Pessoal</span>
          </button>
        </div>

        {/* Busca Global */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar processos, intimações, clientes ou tarefas... (Ctrl+K)"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Direita: Novo, Notificações, Perfil */}
      <div className="flex items-center gap-3">
        {/* Botão + Novo Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNovoMenu(!showNovoMenu)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          {showNovoMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={() => { setShowNovoMenu(false); onQuickAction('novo-processo'); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span>Novo Processo</span>
              </button>
              <button
                onClick={() => { setShowNovoMenu(false); onQuickAction('nova-tarefa'); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Nova Tarefa / Prazo</span>
              </button>
              <button
                onClick={() => { setShowNovoMenu(false); onQuickAction('novo-atendimento'); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <User className="w-4 h-4 text-indigo-600" />
                <span>Novo Atendimento CRM</span>
              </button>
              <button
                onClick={() => { setShowNovoMenu(false); onQuickAction('novo-financeiro'); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
              >
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span>Lançamento Financeiro</span>
              </button>
            </div>
          )}
        </div>

        {/* Sininho de Notificações */}
        <div className="relative">
          <button
            onClick={() => setShowNotificacoes(!showNotificacoes)}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {avisos.length > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full absolute top-2 right-2 border-2 border-white"></span>
            )}
          </button>

          {showNotificacoes && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-30">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="font-semibold text-xs text-slate-800">O que precisa de atencao</h4>
              </div>
              <div className="mt-2 space-y-3">
                {avisos.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2">
                    Nada pendente: worklist limpa e nenhuma tarefa em atraso.
                  </p>
                ) : (
                  avisos.map((aviso, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <div className={`w-2 h-2 rounded-full ${aviso.cor} mt-1.5 shrink-0`}></div>
                      <div>
                        <p className="font-semibold text-slate-800">{aviso.titulo}</p>
                        <p className="text-slate-500 text-[11px]">{aviso.detalhe}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Perfil do Usuário */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          {/* Usuario da sessao. Antes eram tres valores fixos no codigo -
              'GO', 'Dra. Gisele Oliveira' e 'OAB/SP 432.109' - exibidos
              independentemente de quem estivesse logado. */}
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            {usuario ? iniciais(usuario.nome) : '?'}
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {usuario?.nome ?? ''}
            </p>
            <p className="text-[10px] text-slate-500">
              {usuario?.oab ? `OAB ${usuario.oab}` : usuario ? ROTULO_CARGO[usuario.cargo] : ''}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
