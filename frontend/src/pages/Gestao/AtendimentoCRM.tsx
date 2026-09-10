import React, { useState, useEffect } from 'react';
import { User, Plus, Phone, DollarSign, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { CRMAtendimento } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

export const AtendimentoCRM: React.FC = () => {
  const [atendimentos, setAtendimentos] = useState<CRMAtendimento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getCRMAtendimentos();
        setAtendimentos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fases = ['Primeiro Contato', 'Análise de Viabilidade', 'Proposta Enviada', 'Contrato Assinado'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" /> Atendimento Pré-Processual (CRM)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Funil de captação de clientes, qualificação de leads e conversão em contratos de honorários.
          </p>
        </div>

        <button
          onClick={() => alert('Novo Atendimento CRM')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Atendimento</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
        {fases.map((fase) => {
          const itens = atendimentos.filter(a => a.fase === fase);
          return (
            <div key={fase} className="bg-slate-100/70 p-4 rounded-2xl border border-slate-200 space-y-3 min-h-[400px]">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <h3 className="font-bold text-xs text-slate-700">{fase}</h3>
                <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full text-slate-600 border border-slate-200">
                  {itens.length}
                </span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <Skeleton count={2} className="h-24 rounded-xl" />
                ) : itens.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-4">Sem leads nesta fase</p>
                ) : (
                  itens.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-card space-y-2">
                      <h4 className="font-bold text-xs text-slate-900">{item.clienteNome}</h4>
                      <p className="text-[11px] text-slate-600">{item.assunto}</p>
                      <div className="flex justify-between items-center text-[10px] pt-2 border-t border-slate-100 font-mono">
                        <span className="text-slate-400">{item.telefone}</span>
                        <span className="font-bold text-emerald-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorEstimado)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

