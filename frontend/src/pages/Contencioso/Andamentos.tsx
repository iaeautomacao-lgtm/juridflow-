import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Check, 
  Calendar, 
  Sparkles, 
  Filter,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { Andamento } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

interface AndamentosProps {
  onOpenIA: () => void;
}

export const Andamentos: React.FC<AndamentosProps> = ({ onOpenIA }) => {
  const [andamentos, setAndamentos] = useState<Andamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroLido, setFiltroLido] = useState('Todos');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getAndamentos();
        setAndamentos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleMarcarLido = (id: string) => {
    setAndamentos((prev) =>
      prev.map((a) => (a.id === id ? { ...a, lido: true } : a))
    );
  };

  const andamentosFiltrados = andamentos.filter((a) => {
    const matchBusca = a.cnj.toLowerCase().includes(busca.toLowerCase()) || a.descricao.toLowerCase().includes(busca.toLowerCase());
    const matchLido = filtroLido === 'Todos' || (filtroLido === 'NaoLidos' && !a.lido) || (filtroLido === 'Lidos' && a.lido);
    return matchBusca && matchLido;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" /> Andamentos Processuais
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Eventos capturados dos sistemas processuais eletrônicos (e-SAJ, PJe, Projudi, Eproc).
          </p>
        </div>

        <button
          onClick={() => setAndamentos((prev) => prev.map((a) => ({ ...a, lido: true })))}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border border-slate-200 transition-all"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Marcar Todos como Lidos</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por CNJ ou termo no andamento..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filtroLido}
            onChange={(e) => setFiltroLido(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
          >
            <option value="Todos">Todos os Andamentos</option>
            <option value="NaoLidos">Apenas Não Lidos</option>
            <option value="Lidos">Apenas Lidos</option>
          </select>
        </div>
      </div>

      {/* Lista de Eventos */}
      <div className="space-y-3">
        {loading ? (
          <Skeleton count={4} className="h-20 rounded-2xl" />
        ) : andamentosFiltrados.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            Nenhum andamento processual encontrado.
          </div>
        ) : (
          andamentosFiltrados.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                !item.lido
                  ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                  : 'bg-white border-slate-200/80'
              }`}
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-blue-600">{item.cnj}</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-600">
                    {item.origem}
                  </span>
                  {!item.lido && (
                    <span className="text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                      NOVO
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-800 font-medium">{item.descricao}</p>
                <span className="text-[10px] text-slate-400 block">{item.dataHora}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenIA}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Analisar IA</span>
                </button>

                {!item.lido && (
                  <button
                    onClick={() => handleMarcarLido(item.id)}
                    className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors"
                    title="Marcar como lido"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

