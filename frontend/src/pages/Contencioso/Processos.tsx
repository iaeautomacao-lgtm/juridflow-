import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Filter, 
  ChevronRight, 
  Eye, 
  X, 
  FileText, 
  UserCheck, 
  Building2, 
  Calendar,
  DollarSign,
  Tag,
  Zap,
  Clock,
  ShieldAlert,
  Sparkles,
  Paperclip,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { Processo } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

interface ProcessosProps {
  onOpenIA: () => void;
}

export const Processos: React.FC<ProcessosProps> = ({ onOpenIA }) => {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  // Modais
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [processoSelecionado, setProcessoSelecionado] = useState<Processo | null>(null);
  const [abaDetalhe, setAbaDetalhe] = useState<'capa' | 'andamentos' | 'tarefas' | 'documentos'>('capa');

  // Conteudo real da ficha dos autos.
  //
  // As quatro abas eram texto fixo no codigo: "Juntada de Contestacao / Ontem
  // 16:30", a tarefa "Elaborar Treplica ... Responsavel: Dra. Gisele", o
  // arquivo "Peticao_Inicial_Assinada.pdf 2.4 MB" e um prognostico de
  // "75% Favoravel". Nada disso vinha do processo aberto - apareciam iguais
  // para qualquer processo, inclusive num sistema vazio.
  const [detalhe, setDetalhe] = useState<any | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  useEffect(() => {
    if (!processoSelecionado) {
      setDetalhe(null);
      return;
    }
    let ativo = true;
    setLoadingDetalhe(true);
    api
      .getProcessoDetalhe(processoSelecionado.id)
      .then((d) => {
        if (ativo) setDetalhe(d);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (ativo) setLoadingDetalhe(false);
      });
    return () => {
      ativo = false;
    };
  }, [processoSelecionado]);

  // Form Novo Processo
  const [formCnj, setFormCnj] = useState('');
  const [formTitulo, setFormTitulo] = useState('');
  const [formAutor, setFormAutor] = useState('');
  const [formReu, setFormReu] = useState('');
  const [formTribunal, setFormTribunal] = useState('TJSP');
  const [formValor, setFormValor] = useState('50000');
  const [consultandoDatajud, setConsultandoDatajud] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getProcessos();
        setProcessos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Consulta automática no DataJud CNJ ao informar o CNJ
  const handleConsultarDatajudCnj = async () => {
    if (!formCnj) {
      alert('Digite o número CNJ do processo.');
      return;
    }
    setConsultandoDatajud(true);
    try {
      const res = await api.sincronizarDatajud(formCnj);
      alert(res.message);
      setFormTitulo(`Procedimento Comum Cível - CNJ ${formCnj}`);
      setFormAutor('Empresa Autora S/A');
      setFormReu('Banco Requerido S/A');
      setFormTribunal('TJSP');
    } catch (err: any) {
      alert('Erro ao consultar DataJud: ' + err.message);
    } finally {
      setConsultandoDatajud(false);
    }
  };

  const handleCriarProcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCnj || !formTitulo) return;

    try {
      const novo = await api.createProcesso({
        cnj: formCnj,
        titulo: formTitulo,
        autor: formAutor,
        reu: formReu,
        tribunal: formTribunal,
        valorCausa: Number(formValor)
      });
      setProcessos((prev) => [novo, ...prev]);
      setShowNovoModal(false);
      // Reset form
      setFormCnj('');
      setFormTitulo('');
      setFormAutor('');
      setFormReu('');
    } catch (err) {
      console.error(err);
    }
  };

  const processosFiltrados = processos.filter((p) => {
    const matchBusca = p.cnj.toLowerCase().includes(busca.toLowerCase()) || 
                       p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                       p.autor.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'Todos' || p.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header da Tela */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-600" /> Gestão de Processos & Contencioso
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o ciclo de vida dos autos integrados via DataJud CNJ e DJEN.
          </p>
        </div>

        <button
          onClick={() => setShowNovoModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Processo</span>
        </button>
      </div>

      {/* Barra de Filtros e Pesquisa */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número CNJ, título da ação, autor ou réu..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativos</option>
              <option value="Em Recurso">Em Recurso</option>
              <option value="Suspenso">Suspensos</option>
              <option value="Arquivado">Arquivados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Processos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Número CNJ & Ação</th>
                <th className="py-3.5 px-4">Partes (Autor x Réu)</th>
                <th className="py-3.5 px-4">Tribunal / Vara</th>
                <th className="py-3.5 px-4">Valor da Causa</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4">
                    <Skeleton count={4} className="h-10 my-2" />
                  </td>
                </tr>
              ) : processosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum processo encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                processosFiltrados.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-bold text-blue-600">{item.cnj}</p>
                      <p className="font-semibold text-slate-800 line-clamp-1">{item.titulo}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <p className="font-medium">{item.autor}</p>
                      <p className="text-[11px] text-slate-400">vs {item.reu}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-700 mr-1">{item.tribunal}</span>
                      <span className="text-[11px]">{item.vara}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valorCausa)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.status === 'Em Recurso' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => { setProcessoSelecionado(item); setAbaDetalhe('capa'); }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-colors"
                        title="Ver Ficha Completa dos Autos"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Paginação */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Exibindo <strong>{processosFiltrados.length}</strong> de <strong>{processos.length}</strong> processos</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-medium">Anterior</button>
            <button className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-medium">Próximo</button>
          </div>
        </div>
      </div>

      {/* Modal Novo Processo com Auto-Consulta DataJud CNJ */}
      {showNovoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" /> Novo Processo Judicial (DataJud CNJ)
              </h3>
              <button onClick={() => setShowNovoModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarProcesso} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número CNJ *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formCnj}
                    onChange={(e) => setFormCnj(e.target.value)}
                    placeholder="Ex: 1002345-89.2024.8.26.0100"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleConsultarDatajudCnj}
                    disabled={consultandoDatajud}
                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span>{consultandoDatajud ? 'Buscando...' : 'Puxar do DataJud'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título da Ação *</label>
                <input
                  type="text"
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ex: Ação de Cobrança c/c Perdas e Danos"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Autor / Requerente</label>
                  <input
                    type="text"
                    value={formAutor}
                    onChange={(e) => setFormAutor(e.target.value)}
                    placeholder="Nome do cliente/autor"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Réu / Requerido</label>
                  <input
                    type="text"
                    value={formReu}
                    onChange={(e) => setFormReu(e.target.value)}
                    placeholder="Parte contrária"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tribunal</label>
                  <select
                    value={formTribunal}
                    onChange={(e) => setFormTribunal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-medium"
                  >
                    <option value="TJSP">TJSP - São Paulo</option>
                    <option value="TRF3">TRF3 - 3ª Região</option>
                    <option value="TRT2">TRT2 - Trabalho SP</option>
                    <option value="STJ">STJ - Superior Tribunal</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor da Causa (R$)</label>
                  <input
                    type="number"
                    value={formValor}
                    onChange={(e) => setFormValor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm"
                >
                  Salvar Processo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha Completa dos Autos (Inspirado no Projuris ADV) */}
      {processoSelecionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header da Ficha */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                    CNJ: {processoSelecionado.cnj}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    {processoSelecionado.status}
                  </span>
                </div>
                <h3 className="font-bold text-lg text-slate-900">{processoSelecionado.titulo}</h3>
              </div>
              <button onClick={() => setProcessoSelecionado(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navegação por Abas da Ficha do Processo */}
            <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
              <button
                onClick={() => setAbaDetalhe('capa')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  abaDetalhe === 'capa' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" /> Capa & Dados Gerais
              </button>
              <button
                onClick={() => setAbaDetalhe('andamentos')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  abaDetalhe === 'andamentos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Linha do Tempo de Andamentos
              </button>
              <button
                onClick={() => setAbaDetalhe('tarefas')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  abaDetalhe === 'tarefas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Prazos & Tarefas
              </button>
              <button
                onClick={() => setAbaDetalhe('documentos')}
                className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                  abaDetalhe === 'documentos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" /> Documentos dos Autos
              </button>
            </div>

            {/* Conteúdo da Aba */}
            {loadingDetalhe ? (
              <p className="text-xs text-slate-400 py-6 text-center">Carregando os autos...</p>
            ) : abaDetalhe === 'capa' ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Polo Ativo (Autor)</span>
                    <p className="font-semibold text-slate-800">{processoSelecionado.autor || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Polo Passivo (Réu)</span>
                    <p className="font-semibold text-slate-800">{processoSelecionado.reu || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Juízo / Vara</span>
                    <p className="font-semibold text-slate-800">
                      {processoSelecionado.vara || '-'}
                      {detalhe?.tribunal?.sigla ? ` (${detalhe.tribunal.sigla})` : ''}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                    <span className="text-slate-400 text-[10px] font-semibold uppercase">Valor da Causa</span>
                    <p className="font-mono font-bold text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processoSelecionado.valorCausa)}
                    </p>
                  </div>
                </div>

                {detalhe?.tribunal && (
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200/80 text-[11px] text-blue-900">
                    <p className="font-bold">{detalhe.tribunal.segmento}</p>
                    <p className="text-blue-700">
                      Tribunal {detalhe.tribunal.sigla}
                      {detalhe.tribunal.uf ? ` (${detalhe.tribunal.uf})` : ''} &bull; resolvido pelo
                      numero CNJ
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ['Andamentos', detalhe?.andamentos?.length ?? 0],
                    ['Intimações', detalhe?.intimacoes?.length ?? 0],
                    ['Prazos', detalhe?.tarefas?.length ?? 0],
                    ['Documentos', detalhe?.documentos?.length ?? 0],
                  ].map(([rotulo, n]) => (
                    <div key={String(rotulo)} className="bg-slate-50 p-2.5 rounded-xl">
                      <p className="font-bold text-base text-slate-800">{n as number}</p>
                      <p className="text-[10px] text-slate-500">{rotulo as string}</p>
                    </div>
                  ))}
                </div>

                {/* O prognostico de risco que ficava aqui ("75% Favoravel",
                    "Provavel Exito") era numero fixo no codigo, igual para
                    todo processo. Nao existe modelo de prognostico no sistema:
                    o bloco foi removido em vez de exibir um numero inventado
                    sobre a chance de exito de um caso real. */}
              </div>
            ) : abaDetalhe === 'andamentos' ? (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 text-xs">
                {(detalhe?.andamentos ?? []).length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">
                    Nenhum andamento registrado. Use a Central de Captura para consultar o DataJud.
                  </p>
                ) : (
                  detalhe.andamentos.map((a: any) => (
                    <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex justify-between items-center text-[11px] gap-2">
                        <span className="font-bold text-blue-600">{a.tipo}</span>
                        <span className="text-slate-400 shrink-0">
                          {new Date(a.data).toLocaleDateString('pt-BR')}
                          {a.fonte !== 'manual' ? ` • ${a.fonte}` : ''}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium">{a.descricao}</p>
                    </div>
                  ))
                )}
              </div>
            ) : abaDetalhe === 'tarefas' ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                {(detalhe?.tarefas ?? []).length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">
                    Nenhum prazo vinculado a este processo.
                  </p>
                ) : (
                  detalhe.tarefas.map((t: any) => (
                    <div key={t.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{t.titulo}</p>
                        <p className="text-slate-500 text-[11px]">
                          Vencimento: {new Date(t.vencimento).toLocaleDateString('pt-BR')}
                          {t.responsavel_nome ? ` • ${t.responsavel_nome}` : ''}
                        </p>
                      </div>
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded shrink-0">
                        {t.status === 'a_fazer'
                          ? 'A Fazer'
                          : t.status === 'em_andamento'
                            ? 'Em Andamento'
                            : 'Concluído'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
                {(detalhe?.documentos ?? []).length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">
                    Nenhum documento anexado a este processo.
                  </p>
                ) : (
                  detalhe.documentos.map((d: any) => (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{d.titulo}</p>
                          <p className="text-slate-400 text-[11px]">
                            {d.categoria} • {new Date(d.criado_em).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-semibold hover:underline shrink-0"
                        >
                          Abrir
                        </a>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Footer do Modal */}
            <div className="pt-3 flex justify-between items-center border-t border-slate-100">
              <button
                onClick={() => { setProcessoSelecionado(null); onOpenIA(); }}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-xs px-4 py-2 rounded-xl font-semibold flex items-center gap-1.5 shadow-md hover:opacity-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>Analisar Autos com ACORDITO</span>
              </button>

              <button
                onClick={() => setProcessoSelecionado(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
