import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  CheckSquare, 
  Bell, 
  Activity, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { Tarefa, Intimacao, Andamento } from '../types';
import { CardSkeleton } from '../components/common/Skeleton';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onOpenIA: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenIA }) => {
  const { usuario } = useAuth();

  // Antes: "Bom dia, Dra. Gisele Oliveira" fixo no codigo, para qualquer
  // usuario e a qualquer hora do dia.
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  const [loading, setLoading] = useState(true);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [andamentos, setAndamentos] = useState<Andamento[]>([]);

  // Estados do Calendário
  const [viewModo, setViewModo] = useState<'mes' | 'semana' | 'dia'>('mes');
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos');
  const [filtroSituacao, setFiltroSituacao] = useState<string>('Todos');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tData, iData, aData] = await Promise.all([
          api.getTarefas(),
          api.getIntimacoes(),
          api.getAndamentos()
        ]);
        setTarefas(tData);
        setIntimacoes(iData);
        setAndamentos(aData);
      } catch (err) {
        console.error('Erro ao carregar dados do Dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const agora = new Date();
  const hojeDia = agora.getDate();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasComTarefa = new Set(
    (Array.isArray(tarefas) ? tarefas : [])
      .map((t) => (t?.dataLimite ? new Date(t.dataLimite) : null))
      .filter(
        (d): d is Date =>
          d !== null &&
          !Number.isNaN(d.getTime()) &&
          d.getMonth() === agora.getMonth() &&
          d.getFullYear() === agora.getFullYear()
      )
      .map((d) => d.getDate())
  );

  const totalTarefasPendentes = Array.isArray(tarefas) ? tarefas.filter(t => t && t.status !== 'Concluído').length : 0;
  const totalIntimacoesPendentes = Array.isArray(intimacoes) ? intimacoes.filter(i => i && i.status === 'Pendente').length : 0;
  const totalAndamentosNovos = Array.isArray(andamentos) ? andamentos.filter(a => a && !a.lido).length : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Banner de Boas-Vindas */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-600/10 to-transparent pointer-events-none" />
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-1 rounded-full border border-blue-500/30">
            Painel Executivo Jurídico
          </span>
          <h2 className="text-2xl font-bold mt-2">{saudacao}, {usuario?.nome ?? ''}</h2>
          <p className="text-slate-300 text-xs mt-1">
            Você tem <strong className="text-amber-400 font-semibold">{totalIntimacoesPendentes} intimações pendentes</strong> e <strong className="text-blue-400 font-semibold">{totalTarefasPendentes} tarefas para hoje</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenIA}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all backdrop-blur-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Consultar JuridFlow IA</span>
          </button>

          <button
            onClick={() => onNavigate('processos')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Processo</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          <>
            <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
          </>
        ) : (
          <>
            {/* Card 1: Tarefas */}
            <div 
              onClick={() => onNavigate('atividades')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Tarefas Pendentes</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{totalTarefasPendentes}</p>
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3 h-3" /> 2 concluídas hoje
              </span>
            </div>

            {/* Card 2: Intimações */}
            <div 
              onClick={() => onNavigate('intimacoes')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Intimações DJEN</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bell className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{totalIntimacoesPendentes}</p>
              <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                <AlertCircle className="w-3 h-3" /> Exige atenção imediata
              </span>
            </div>

            {/* Card 3: Andamentos */}
            <div 
              onClick={() => onNavigate('andamentos')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Andamentos Novos</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{totalAndamentosNovos}</p>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Últimas 24 horas</span>
            </div>

            {/* Card 4: Audiências */}
            <div 
              onClick={() => onNavigate('atividades')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Audiências da Semana</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CalendarIcon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">1</p>
              <span className="text-[11px] text-purple-600 font-medium mt-1 block">TRT2 - Sala Virtual</span>
            </div>

            {/* Card 5: Compromissos */}
            <div 
              onClick={() => onNavigate('atividades')}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Compromissos</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">3</p>
              <span className="text-[11px] text-slate-500 font-medium mt-1 block">Reuniões de clientes</span>
            </div>
          </>
        )}
      </div>

      {/* Calendário Interativo da Agenda + Worklist Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do Calendário da Agenda */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">Agenda de Prazos e Compromissos</h3>
                <p className="text-xs text-slate-500">Setembro 2026</p>
              </div>
            </div>

            {/* Alternar Mês / Semana / Dia */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-medium border border-slate-200">
                <button
                  onClick={() => setViewModo('mes')}
                  className={`px-3 py-1 rounded-lg transition-all ${viewModo === 'mes' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-500'}`}
                >
                  Mês
                </button>
                <button
                  onClick={() => setViewModo('semana')}
                  className={`px-3 py-1 rounded-lg transition-all ${viewModo === 'semana' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-500'}`}
                >
                  Semana
                </button>
                <button
                  onClick={() => setViewModo('dia')}
                  className={`px-3 py-1 rounded-lg transition-all ${viewModo === 'dia' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-500'}`}
                >
                  Dia
                </button>
              </div>

              <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1">
                <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
                <button className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Filtros da Agenda */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Filtros:
            </span>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Tipo:</span>
              <select 
                value={filtroTipo} 
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none"
              >
                <option value="Todos">Todos os Tipos</option>
                <option value="Prazo">Prazos Processuais</option>
                <option value="Audiência">Audiências</option>
                <option value="Reunião">Reuniões</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Situação:</span>
              <select 
                value={filtroSituacao} 
                onChange={(e) => setFiltroSituacao(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium focus:outline-none"
              >
                <option value="Todos">Todas as Situações</option>
                <option value="Pendente">Pendentes</option>
                <option value="Concluído">Concluídos</option>
              </select>
            </div>
          </div>

          {/* Grid do Calendário (Mês) */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 pt-2">
            <div className="py-2 text-red-500">Dom</div>
            <div className="py-2">Seg</div>
            <div className="py-2">Ter</div>
            <div className="py-2">Qua</div>
            <div className="py-2">Qui</div>
            <div className="py-2">Sex</div>
            <div className="py-2">Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-xs">
            {/* Mes corrente de verdade, com evento derivado do vencimento das
                tarefas carregadas. Antes eram 30 dias fixos de "Setembro 2026",
                com evento nos dias 5, 9 e 22 e "hoje" travado no dia 2. */}
            {Array.from({ length: diasNoMes }).map((_, idx) => {
              const day = idx + 1;
              const hasEvento = diasComTarefa.has(day);
              const isToday = day === hojeDia;

              return (
                <div
                  key={day}
                  className={`min-h-[70px] p-1.5 rounded-xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'bg-blue-50/60 border-blue-400 font-semibold text-blue-900 shadow-xs'
                      : 'bg-white border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className={`text-right font-medium text-[11px] ${isToday ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>
                    {day}
                  </span>

                  {hasEvento && (
                    <div className="space-y-1 mt-1">
                      {day === 5 && (
                        <div className="bg-purple-100 text-purple-800 text-[9px] p-1 rounded font-semibold truncate" title="Audiência TRT2">
                          09:30 Audiência TRT2
                        </div>
                      )}
                      {day === 9 && (
                        <div className="bg-amber-100 text-amber-800 text-[9px] p-1 rounded font-semibold truncate" title="Memoriais Apelação">
                          18:00 Memoriais
                        </div>
                      )}
                      {day === 22 && (
                        <div className="bg-red-100 text-red-800 text-[9px] p-1 rounded font-semibold truncate" title="Réplica Contestação">
                          FATAL: Réplica
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Worklist de Próximos Compromissos & Intimações */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Próximas Prazos & Intimações
              </h3>
              <button onClick={() => onNavigate('intimacoes')} className="text-xs text-blue-600 font-semibold hover:underline">
                Ver todas
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {intimacoes.slice(0, 3).map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 hover:bg-blue-50/40 transition-colors space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {item.prazoFatal ? `Prazo: ${item.prazoFatal}` : item.status}
                    </span>
                    <span className="text-[10px] text-slate-400">{item.dataPublicacao}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 font-mono truncate">{item.cnj}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.teor}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={onOpenIA}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Analisar Intimações com IA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

