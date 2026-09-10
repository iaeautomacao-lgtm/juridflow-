import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  Database, 
  ShieldCheck,
  Server
} from 'lucide-react';
import { api } from '../../services/api';
import { CentralCaptura as CentralCapturaType } from '../../types';
import { CardSkeleton } from '../../components/common/Skeleton';

export const CentralCaptura: React.FC = () => {
  const [status, setStatus] = useState<CentralCapturaType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getCentralCapturaStatus();
        setStatus(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleCadastroAuto = () => {
    if (status) {
      setStatus({ ...status, cadastroAutomatico: !status.cadastroAutomatico });
    }
  };

  const toggleCapturaDocs = () => {
    if (status) {
      setStatus({ ...status, capturaDocumentosAuto: !status.capturaDocumentosAuto });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-600" /> Central de Captura & Robô Push CNJ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie as conexões de varredura automática nos tribunais de justiça e Diários Oficiais.
          </p>
        </div>

        <button
          onClick={async () => {
            setLoading(true);
            try {
              const res = await api.sincronizarDjen();
              alert(res.message);
              const statusAtualizado = await api.getCentralCapturaStatus();
              setStatus(statusAtualizado);
            } catch (err: any) {
              alert('Erro na varredura DJEN: ' + err.message);
            } finally {
              setLoading(false);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Forçar Varredura DJEN Agora</span>
        </button>
      </div>

      {loading || !status ? (
        <CardSkeleton />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card Status da Conexão */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">Status dos Webhooks</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono">{status.oabLote}</p>
            <p className="text-xs text-slate-500">Monitorando <strong>{status.totalProcessosMonitorados} processos</strong> em tempo real.</p>
          </div>

          {/* Card Franquia */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">Franquia de Captura</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                Ativa
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900 font-mono">{status.creditosRestantes} <span className="text-xs font-normal text-slate-500">consultas</span></p>
            <p className="text-xs text-slate-500">Renovação em: <strong>01/10/2026</strong></p>
          </div>

          {/* Card Servidores */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-slate-500">Integração CNJ DataJud</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Operacional
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-900">100% On-line</p>
            <p className="text-xs text-slate-500">Última checagem: Há 3 minutos</p>
          </div>
        </div>
      )}

      {/* Painel de Automações e Toggles */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-6">
        <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Settings2 className="w-4 h-4 text-blue-600" /> Parâmetros de Automação de Captura
        </h3>

        <div className="space-y-4 text-xs">
          {/* Toggle 1: Cadastro Automático de Novos Processos */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <div>
              <p className="font-bold text-slate-800">Cadastro Automático de Novos Processos</p>
              <p className="text-slate-500 mt-0.5">
                Ao identificar uma nova distribuição no diário com sua OAB, cadastra automaticamente a pasta do processo na plataforma.
              </p>
            </div>
            <button
              onClick={toggleCadastroAuto}
              className={`w-12 h-6 rounded-full p-1 transition-colors relative ${
                status?.cadastroAutomatico ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                status?.cadastroAutomatico ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Toggle 2: Captura Automática de PDFs dos Autos */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <div>
              <p className="font-bold text-slate-800">Download Automático de Peças e Anexos (PDF)</p>
              <p className="text-slate-500 mt-0.5">
                Baixa os PDFs anexados às intimações diretamente para o gerenciador de documentos dos autos.
              </p>
            </div>
            <button
              onClick={toggleCapturaDocs}
              className={`w-12 h-6 rounded-full p-1 transition-colors relative ${
                status?.capturaDocumentosAuto ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${
                status?.capturaDocumentosAuto ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

