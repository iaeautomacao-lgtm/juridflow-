import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Archive, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  CreditCard,
  ShieldCheck,
  Calendar,
  Layers,
  Plus
} from 'lucide-react';
import { api } from '../../services/api';
import { Intimacao } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

interface IntimacoesProps {
  onOpenIA: () => void;
  onAdicionarTarefa: () => void;
}

export const Intimacoes: React.FC<IntimacoesProps> = ({ onOpenIA, onAdicionarTarefa }) => {
  const [abaAtiva, setAbaAtiva] = useState<'pendentes' | 'descartadas' | 'captura'>('pendentes');
  const [intimacoes, setIntimacoes] = useState<Intimacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [showFranquiaModal, setShowFranquiaModal] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getIntimacoes();
        setIntimacoes(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const [processando, setProcessando] = useState<string | null>(null);

  // Antes so alterava o state local: a intimacao "voltava" arquivada na tela
  // e reaparecia pendente no proximo F5.
  const handleArquivar = async (id: string) => {
    setProcessando(id);
    try {
      await api.arquivarIntimacao(id);
      setIntimacoes((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'Arquivada' } : item))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setProcessando(null);
    }
  };

  /**
   * Abre a tarefa de prazo a partir da intimacao.
   *
   * O vencimento e calculado no backend pelo calendario forense (art. 219,
   * 220 e 224 do CPC) a partir da data de disponibilizacao da propria
   * intimacao - nao no navegador, e nao por "+5 dias".
   */
  const handleGerarTarefa = async (item: Intimacao) => {
    const entrada = window.prompt(
      `Prazo em dias uteis para "${item.cnj || 'esta intimacao'}":

` +
        'Contestacao / apelacao: 15    Embargos de declaracao: 5',
      '15'
    );
    if (entrada === null) return;

    const dias = Number.parseInt(entrada, 10);
    if (!Number.isInteger(dias) || dias <= 0) {
      alert('Informe um numero inteiro de dias maior que zero.');
      return;
    }

    setProcessando(item.id);
    try {
      const res = await api.vincularIntimacao(item.id, {
        criar_tarefa: true,
        dias_prazo: dias,
        tipo_dias: 'uteis',
        titulo_tarefa: `Cumprir intimacao - ${item.cnj}`,
      });

      const p = res.prazo;
      if (p) {
        const pulados = p.dias_nao_uteis_pulados.length;
        alert(
          `Tarefa criada.

` +
            `Publicacao: ${p.publicacao}
` +
            `Inicio da contagem: ${p.inicio_contagem}
` +
            `Vencimento: ${p.vencimento}
` +
            `Dias nao uteis pulados: ${pulados}` +
            (res.aviso_calendario ? `

ATENCAO: ${res.aviso_calendario}` : '')
        );
      }

      const data = await api.getIntimacoes();
      setIntimacoes(data);
      onAdicionarTarefa();
    } catch (err: any) {
      alert(err?.message ?? 'Nao foi possivel gerar a tarefa.');
    } finally {
      setProcessando(null);
    }
  };

  const pendentesList = intimacoes.filter((i) => i.status === 'Pendente' || i.status === 'Processo não localizado');
  const descartadasList = intimacoes.filter((i) => i.status === 'Arquivada' || i.status === 'Atendida');

  const listaAtual = abaAtiva === 'pendentes' ? pendentesList : descartadasList;
  const listaFiltrada = listaAtual.filter((i) =>
    i.cnj.toLowerCase().includes(busca.toLowerCase()) || i.teor.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" /> Intimações Eletrônicas & DJEN
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento automatizado do Diário de Justiça Eletrônico Nacional em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await api.sincronizarDjen();
                alert(res.message);
                const data = await api.getIntimacoes();
                setIntimacoes(data);
              } catch (err: any) {
                alert('Erro ao sincronizar DJEN: ' + err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <Zap className="w-4 h-4 text-amber-300 animate-bounce" />
            <span>Disparar Captura DJEN Agora</span>
          </button>

          <button
            onClick={() => setShowFranquiaModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
          >
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>Franquias OAB</span>
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setAbaAtiva('pendentes')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            abaAtiva === 'pendentes'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Intimações Pendentes</span>
          <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
            {pendentesList.length}
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva('descartadas')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            abaAtiva === 'descartadas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Descartadas & Arquivadas</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">
            {descartadasList.length}
          </span>
        </button>

        <button
          onClick={() => setAbaAtiva('captura')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
            abaAtiva === 'captura'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-500" />
          <span>Status da Captura Automática</span>
        </button>
      </div>

      {/* Conteúdo Aba Captura */}
      {abaAtiva === 'captura' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">Franquia de Captura DJEN Nacional Ativa</h3>
              <p className="text-xs text-slate-500">Monitorando OAB/SP 432.109 em 27 Tribunais do Brasil</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium">Lote OAB Monitorado</span>
              <p className="text-base font-bold text-slate-800 mt-1 font-mono">432109 / SP</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium">Periodicidade de Varredura</span>
              <p className="text-base font-bold text-emerald-600 mt-1">A cada 30 minutos (24/7)</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-slate-400 font-medium">Valor Mensal da Franquia</span>
              <p className="text-base font-bold text-slate-800 mt-1">R$ 37,00 / mês</p>
            </div>
          </div>
        </div>
      ) : (
        /* Worklist de Intimações */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar intimação por CNJ ou palavra-chave no teor..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              <Skeleton count={3} className="h-24 rounded-2xl" />
            ) : listaFiltrada.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                Nenhuma intimação nesta aba no momento.
              </div>
            ) : (
              listaFiltrada.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {item.cnj}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">{item.orgao}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.prazoFatal && (
                        <span className="text-[11px] font-bold bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Fatal: {item.prazoFatal}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'Pendente' ? 'bg-amber-100 text-amber-800' :
                        item.status === 'Processo não localizado' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-sans bg-slate-50 p-3 rounded-xl border border-slate-100">
                    "{item.teor}"
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Publicado em: <strong>{item.dataPublicacao}</strong> • Notificado a: {item.advogadoNotificado}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onOpenIA}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Resumir com IA</span>
                      </button>

                      <button
                        onClick={() => handleGerarTarefa(item)}
                        disabled={processando === item.id}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{processando === item.id ? 'Calculando...' : 'Gerar Tarefa'}</span>
                      </button>

                      {abaAtiva === 'pendentes' && (
                        <button
                          onClick={() => handleArquivar(item.id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                          title="Arquivar Intimação"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de Contratação de Franquia */}
      {showFranquiaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" /> Franquia de Captura DJEN
              </h3>
              <button onClick={() => setShowFranquiaModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 rounded-xl text-white space-y-2 shadow-md">
              <span className="text-[10px] font-bold uppercase bg-white/20 px-2 py-0.5 rounded-full">Plano Ilimitado DJEN</span>
              <h4 className="text-2xl font-bold">R$ 37,00 <span className="text-xs font-normal">/ mês por OAB</span></h4>
              <p className="text-xs text-emerald-100">Captura automática de diários do Brasil todo diretamente no seu painel.</p>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <label className="block font-semibold">Número da OAB / UF</label>
              {/* Sem valor padrao: a OAB '432109/SP' que ficava aqui nao existe,
                  e disparar a captura com ela nao traz intimacao do escritorio. */}
              <input
                type="text"
                placeholder="123456/SP"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono text-slate-800 focus:outline-none"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setShowFranquiaModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => { alert('Franquia de captura ativada com sucesso!'); setShowFranquiaModal(false); }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 text-xs shadow-md"
              >
                Confirmar Assinatura (R$ 37,00)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

