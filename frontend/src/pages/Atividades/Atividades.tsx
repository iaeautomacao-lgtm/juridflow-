import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  List, 
  Kanban as KanbanIcon, 
  Clock, 
  User, 
  AlertCircle, 
  X, 
  Sparkles,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { Tarefa } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

interface AtividadesProps {
  onOpenIA: () => void;
  quickActionActive?: boolean;
}

export const Atividades: React.FC<AtividadesProps> = ({ onOpenIA, quickActionActive }) => {
  const [modoView, setModoView] = useState<'kanban' | 'lista'>('kanban');
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Nova Tarefa
  const [showModal, setShowModal] = useState(quickActionActive || false);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cnj, setCnj] = useState('');
  const [dataLimite, setDataLimite] = useState('2026-09-25');
  const [prioridade, setPrioridade] = useState<Tarefa['prioridade']>('Alta');
  const [tipo, setTipo] = useState<Tarefa['tipo']>('Elaboração de Peça');
  const [status, setStatus] = useState<Tarefa['status']>('A Fazer');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getTarefas();
        setTarefas(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSalvarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo) return;

    try {
      const nova = await api.createTarefa({
        titulo,
        descricao,
        processoCnj: cnj,
        dataLimite,
        prioridade,
        tipo,
        status
      });
      setTarefas((prev) => [nova, ...prev]);
      setShowModal(false);
      // Reset
      setTitulo('');
      setDescricao('');
      setCnj('');
    } catch (err) {
      console.error(err);
    }
  };

  const moverStatus = async (id: string, novoStatus: Tarefa['status']) => {
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: novoStatus } : t))
    );
    await api.updateTarefaStatus(id, novoStatus);
  };

  const colunas: Tarefa['status'][] = ['A Fazer', 'Em Andamento', 'Aguardando', 'Concluído'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-600" /> Gestão de Atividades & Prazos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize os fluxos de trabalho do escritório com visão Kanban interativa e lista de tarefas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Kanban / Lista */}
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold border border-slate-200">
            <button
              onClick={() => setModoView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                modoView === 'kanban' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setModoView('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                modoView === 'lista' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Tarefa</span>
          </button>
        </div>
      </div>

      {/* Visão Kanban */}
      {modoView === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {colunas.map((coluna) => {
            const tarefasColuna = tarefas.filter((t) => t.status === coluna);

            return (
              <div key={coluna} className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200 space-y-3 min-h-[500px]">
                {/* Header da Coluna */}
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      coluna === 'A Fazer' ? 'bg-slate-400' :
                      coluna === 'Em Andamento' ? 'bg-blue-500' :
                      coluna === 'Aguardando' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    {coluna}
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {tarefasColuna.length}
                  </span>
                </div>

                {/* Cards da Coluna */}
                <div className="space-y-3">
                  {loading ? (
                    <Skeleton count={2} className="h-28 rounded-xl" />
                  ) : tarefasColuna.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      Sem tarefas nesta etapa
                    </div>
                  ) : (
                    tarefasColuna.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-card hover:shadow-card-hover transition-all space-y-2 group cursor-pointer"
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            item.prioridade === 'Alta' ? 'bg-red-50 text-red-700 border border-red-200' :
                            item.prioridade === 'Média' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {item.prioridade}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">{item.tipo}</span>
                        </div>

                        <h4 className="font-semibold text-xs text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">
                          {item.titulo}
                        </h4>

                        {item.descricao && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">{item.descricao}</p>
                        )}

                        {item.processoCnj && (
                          <span className="text-[10px] font-mono text-blue-600 font-semibold block truncate">
                            CNJ: {item.processoCnj}
                          </span>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" /> {item.dataLimite}
                          </span>
                          <span className="font-semibold text-slate-700">{item.responsavel.split(' ')[0]}</span>
                        </div>

                        {/* Mover Status Rápido */}
                        <div className="pt-2 flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          {colunas.filter(c => c !== item.status).map((prox) => (
                            <button
                              key={prox}
                              onClick={() => moverStatus(item.id, prox)}
                              className="text-[9px] bg-slate-100 hover:bg-blue-50 hover:text-blue-600 px-1.5 py-0.5 rounded font-medium text-slate-600"
                            >
                              → {prox}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Visão Lista */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Tarefa & Processo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Data Limite</th>
                <th className="py-3 px-4">Prioridade</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tarefas.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-800">{t.titulo}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{t.processoCnj || 'Sem processo vinculado'}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{t.tipo}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{t.dataLimite}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800">
                      {t.prioridade}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">{t.responsavel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova Tarefa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" /> Cadastrar Nova Tarefa / Prazo
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarTarefa} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Tarefa *</label>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Protocolar Agravo de Instrumento"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número CNJ (Opcional)</label>
                <input
                  type="text"
                  value={cnj}
                  onChange={(e) => setCnj(e.target.value)}
                  placeholder="1002345-89.2024.8.26.0100"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Data Limite *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const novaData = prompt('Digite os dias úteis CPC (ex: 15):', '15');
                        if (novaData) {
                          const hoje = new Date();
                          hoje.setDate(hoje.getDate() + (parseInt(novaData) * 1.4));
                          setDataLimite(hoje.toISOString().split('T')[0]);
                        }
                      }}
                      className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Calc. CPC
                    </button>
                  </div>
                  <input
                    type="date"
                    value={dataLimite}
                    onChange={(e) => setDataLimite(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-medium"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição / Instruções</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Observações complementares..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 h-20"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
                >
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

