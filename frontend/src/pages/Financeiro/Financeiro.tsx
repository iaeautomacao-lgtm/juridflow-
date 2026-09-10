import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  FileText,
  Search,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { TransacaoFinanceira, ContratoHonorarios } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

export const Financeiro: React.FC = () => {
  const [aba, setAba] = useState<'extrato' | 'contratos'>('extrato');
  const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
  const [contratos, setContratos] = useState<ContratoHonorarios[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Novo Lançamento
  const [showModal, setShowModal] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [clienteOuFornecedor, setClienteOuFornecedor] = useState('');
  const [categoria, setCategoria] = useState('Honorários Pro Labore');
  const [tipo, setTipo] = useState<'Receita' | 'Despesa'>('Receita');
  const [valor, setValor] = useState('2500');
  const [vencimento, setVencimento] = useState('2026-09-30');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tData, cData] = await Promise.all([
          api.getTransacoes(),
          api.getContratosHonorarios()
        ]);
        setTransacoes(tData);
        setContratos(cData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSalvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao) return;

    const nova: TransacaoFinanceira = {
      id: 't-' + Date.now(),
      descricao,
      clienteOuFornecedor: clienteOuFornecedor || 'Cliente / Fornecedor',
      categoria,
      tipo,
      valor: Number(valor),
      vencimento,
      status: 'Pendente'
    };

    setTransacoes((prev) => [nova, ...prev]);
    setShowModal(false);
    // Reset
    setDescricao('');
    setClienteOuFornecedor('');
  };

  const totalReceitas = transacoes.filter(t => t.tipo === 'Receita').reduce((acc, curr) => acc + curr.valor, 0);
  const totalDespesas = transacoes.filter(t => t.tipo === 'Despesa').reduce((acc, curr) => acc + curr.valor, 0);
  const saldoCaixa = totalReceitas - totalDespesas;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Gestão Financeira Jurídica
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle total sobre honorários pro labore, sucumbenciais, reembolso de custas e fluxo de caixa.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Lançamento</span>
        </button>
      </div>

      {/* KPI Cards Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-2">
          <span className="text-xs text-slate-500 font-medium">Saldo do Caixa em Conta</span>
          <p className="text-2xl font-bold text-slate-900 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoCaixa)}
          </p>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
            Fluxo Positivo
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-2">
          <span className="text-xs text-slate-500 font-medium">Total de Receitas Previstas</span>
          <p className="text-2xl font-bold text-emerald-600 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceitas)}
          </p>
          <span className="text-[10px] text-slate-400">Setembro 2026</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-2">
          <span className="text-xs text-slate-500 font-medium">Total de Despesas do Mês</span>
          <p className="text-2xl font-bold text-red-600 font-mono">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDespesas)}
          </p>
          <span className="text-[10px] text-slate-400">Contas fixas e variáveis</span>
        </div>
      </div>

      {/* Abas */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold">
        <button
          onClick={() => setAba('extrato')}
          className={`pb-3 border-b-2 transition-colors ${
            aba === 'extrato' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500'
          }`}
        >
          Extrato & Lançamentos
        </button>
        <button
          onClick={() => setAba('contratos')}
          className={`pb-3 border-b-2 transition-colors ${
            aba === 'contratos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500'
          }`}
        >
          Contratos de Honorários
        </button>
      </div>

      {aba === 'extrato' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Descrição & Cliente</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Vencimento</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-4"><Skeleton count={3} className="h-10 my-1" /></td>
                </tr>
              ) : (
                transacoes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800">{t.descricao}</p>
                      <p className="text-[10px] text-slate-500">{t.clienteOuFornecedor}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{t.categoria}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">{t.vencimento}</td>
                    <td className={`py-3.5 px-4 font-mono font-bold ${
                      t.tipo === 'Receita' ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      {t.tipo === 'Receita' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === 'Pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contratos.map((c) => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-sm text-slate-900">{c.titulo}</h3>
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                  {c.status}
                </span>
              </div>
              <p className="text-xs text-slate-600">Cliente: <strong>{c.clienteNome}</strong></p>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs font-mono">
                <span className="text-slate-500">{c.formaPagamento}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valorTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Lançamento Financeiro */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Novo Lançamento Financeiro
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarLancamento} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Recebimento de Honorários Sucumbenciais"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cliente / Fornecedor</label>
                <input
                  type="text"
                  value={clienteOuFornecedor}
                  onChange={(e) => setClienteOuFornecedor(e.target.value)}
                  placeholder="Nome do pagador ou favorecido"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Lançamento</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-medium"
                  >
                    <option value="Receita">Receita (Entrada)</option>
                    <option value="Despesa">Despesa (Saída)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-medium"
                  >
                    <option value="Honorários Pro Labore">Honorários Pro Labore</option>
                    <option value="Honorários Sucumbenciais">Honorários Sucumbenciais</option>
                    <option value="Reembolso de Custas">Reembolso de Custas</option>
                    <option value="Despesas Operacionais">Despesas Operacionais</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data Vencimento *</label>
                  <input
                    type="date"
                    value={vencimento}
                    onChange={(e) => setVencimento(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-800"
                    required
                  />
                </div>
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
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
