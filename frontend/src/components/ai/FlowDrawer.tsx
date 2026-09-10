import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Sparkles, 
  X, 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  Calendar, 
  Plus, 
  FileText, 
  Calculator,
  ExternalLink,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { api } from '../../services/api';

export interface MensagemFlow {
  id: string;
  remetente: 'user' | 'acordito';
  texto: string;
  timestamp: string;
  linksRelacionados?: Array<{
    id: string;
    label: string;
    subtext: string;
    tabTarget: string;
  }>;
  sugestaoPrazo?: {
    diasUteis: number;
    fundamento: string;
    dataCalculada: string;
  };
}

interface FlowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  onAdicionarTarefa: (titulo: string, dataLimite: string, descricao: string) => void;
}

export const FlowDrawer: React.FC<FlowDrawerProps> = ({ 
  isOpen, 
  onClose, 
  onNavigate, 
  onAdicionarTarefa 
}) => {
  const [mensagens, setMensagens] = useState<MensagemFlow[]>([
    {
      id: 'm1',
      remetente: 'acordito',
      // Antes: "Ola, Dra. Gisele!" com timestamp fixo '14:30', e o texto
      // dizia "assistente conversacional de IA". O Flow responde por
      // regras sobre o banco do escritorio - nao ha modelo de linguagem.
      texto:
        'Sou o Flow. Consulto o banco do escritorio e respondo com regra do CPC. ' +
        'Posso: resumir um processo (cole o numero CNJ), calcular prazo em dias uteis ' +
        'pelo calendario forense, dizer quantas intimacoes estao pendentes, listar ' +
        'tarefas em atraso e listar os modelos de peca cadastrados.',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [arquivoAnexado, setArquivoAnexado] = useState<string | null>(null);

  // Perguntas Frequentes / Chips Rápidos
  const perguntasFrequentes = [
    'Quais contratos vencem nos próximos 30 dias com renovação automática?',
    'Prazos críticos desta semana',
    'Processos com risco alto',
    'Resumir requisição #847',
    'SLA em aberto hoje'
  ];

  if (!isOpen) return null;

  const handlePerguntar = async (perguntaTexto: string) => {
    const userMsg: MensagemFlow = {
      id: `u-${Date.now()}`,
      remetente: 'user',
      texto: perguntaTexto,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMensagens((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      if (perguntaTexto.toLowerCase().includes('contratos') || perguntaTexto.toLowerCase().includes('vencem')) {
        setTimeout(() => {
          const flowMsg: MensagemFlow = {
            id: `ac-${Date.now()}`,
            remetente: 'acordito',
            texto: 'Encontrei 3 contratos com vencimento nos próximos 30 dias. Destes, 2 possuem renovação automática ativa:',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            linksRelacionados: [
              { id: 'ct-1', label: '#1.847 · Contrato Fornecedor Alfa', subtext: 'R$ 240k · vence 12/08 · Renovação Automática Ativa', tabTarget: 'contratos' },
              { id: 'ct-2', label: '#2.290 · Contrato Indústria Paulista', subtext: 'R$ 312k · vence 28/08 · Renovação Automática Ativa', tabTarget: 'contratos' }
            ]
          };
          setMensagens((prev) => [...prev, flowMsg]);
          setLoading(false);
        }, 600);
        return;
      }

      if (perguntaTexto.toLowerCase().includes('prazos') || perguntaTexto.toLowerCase().includes('semana')) {
        setTimeout(() => {
          const flowMsg: MensagemFlow = {
            id: `ac-${Date.now()}`,
            remetente: 'acordito',
            texto: 'Identifiquei 2 prazos fatais com vencimento nesta semana:',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            linksRelacionados: [
              { id: 'tar-1', label: 'Réplica à Contestação - TJSP', subtext: 'Vencimento: 22/09/2026 · Prioridade Alta', tabTarget: 'atividades' },
              { id: 'tar-2', label: 'Audiência Conciliação - TRT2', subtext: 'Vencimento: 05/09/2026 · Sala Virtual', tabTarget: 'atividades' }
            ]
          };
          setMensagens((prev) => [...prev, flowMsg]);
          setLoading(false);
        }, 600);
        return;
      }

      const res = await api.chatIA(perguntaTexto);
      const flowMsg: MensagemFlow = {
        id: `ac-${Date.now()}`,
        remetente: 'acordito',
        texto: res.resposta,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMensagens((prev) => [...prev, flowMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnviar = () => {
    if (!input.trim()) return;
    const txt = input;
    setInput('');
    handlePerguntar(txt);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setArquivoAnexado(e.target.files[0].name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200">
        
        {/* Header Drawer Flow */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white tracking-wide">Flow</h3>
                <span className="text-[9px] bg-blue-500/30 text-blue-300 border border-blue-400/40 px-1.5 py-0.2 rounded-full font-bold uppercase">
                  NOVIDADE
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Online
                </span>
              </div>
              <p className="text-[11px] text-slate-300">Contratos · Requisições · Processos · Prazos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat / Mensagens */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.remetente === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.remetente === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-amber-300 border border-slate-700'
              }`}>
                {msg.remetente === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                msg.remetente === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-blue-50/60 border border-blue-100 text-slate-800 rounded-tl-none shadow-xs'
              }`}>
                {msg.remetente === 'acordito' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
                    Flow IA
                  </span>
                )}
                <p className="whitespace-pre-line">{msg.texto}</p>

                {/* Cards com Links Diretos */}
                {msg.linksRelacionados && (
                  <div className="mt-3 space-y-2">
                    {msg.linksRelacionados.map((link) => (
                      <div
                        key={link.id}
                        onClick={() => { onNavigate(link.tabTarget); onClose(); }}
                        className="bg-white p-2.5 rounded-xl border border-blue-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group flex justify-between items-center"
                      >
                        <div>
                          <p className="font-bold text-blue-700 group-hover:underline flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-blue-600" />
                            {link.label}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{link.subtext}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform ml-2 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                <span className={`block text-[9px] mt-1.5 text-right ${msg.remetente === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center border border-slate-700">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-blue-50/80 p-3 rounded-2xl text-xs text-blue-900 border border-blue-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                <span>Flow está buscando dados no sistema...</span>
              </div>
            </div>
          )}
        </div>

        {/* Chips de Perguntas Frequentes */}
        <div className="bg-slate-50 p-3 border-t border-b border-slate-200/80 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-400" /> Perguntas Frequentes
          </span>
          <div className="flex flex-wrap gap-1.5">
            {perguntasFrequentes.map((pf, idx) => (
              <button
                key={idx}
                onClick={() => handlePerguntar(pf)}
                className="bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-[11px] font-medium px-2.5 py-1 rounded-full shadow-2xs transition-all text-left"
              >
                {pf}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Input */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-2">
          {arquivoAnexado && (
            <div className="flex items-center justify-between bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200">
              <span className="flex items-center gap-1.5 truncate">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{arquivoAnexado}</span>
              </span>
              <button onClick={() => setArquivoAnexado(null)} className="text-blue-500 hover:text-blue-900 font-bold ml-2">
                &times;
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
            <label className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer transition-colors" title="Anexar contrato ou documento">
              <Paperclip className="w-4 h-4" />
              <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileUpload} className="hidden" />
            </label>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviar()}
              placeholder="Escreva sua pergunta para o Flow..."
              className="flex-1 bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />

            <button
              onClick={handleEnviar}
              disabled={!input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
