import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Mail, Phone, MapPin, Briefcase, X } from 'lucide-react';
import { api } from '../../services/api';
import { Pessoa } from '../../types';
import { Skeleton } from '../../components/common/Skeleton';

export const Pessoas: React.FC = () => {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modal Cadastrar Pessoa
  const [showModal, setShowModal] = useState(false);
  const [nome, setNome] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [tipo, setTipo] = useState<Pessoa['tipo']>('Cliente');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidadeUf, setCidadeUf] = useState('São Paulo / SP');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getPessoas();
        setPessoas(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Antes este handler montava o objeto no state local com CPF
  // '000.000.000-00', e-mail 'contato@email.com' e telefone '(11) 99999-9999'
  // como padrao, e nunca chamava a API. O cadastro desaparecia no F5, e os
  // valores de exemplo pareciam dado do cliente.
  const handleSalvarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm(null);

    if (!nome.trim()) {
      setErroForm('Informe o nome.');
      return;
    }
    if (!cpfCnpj.trim()) {
      setErroForm('Informe o CPF ou CNPJ. O backend valida os digitos verificadores.');
      return;
    }

    setSalvando(true);
    try {
      const nova = await api.createPessoa({
        nome: nome.trim(),
        cpfCnpj: cpfCnpj.trim(),
        tipo,
        email: email.trim(),
        telefone: telefone.trim(),
        cidadeUf,
      });
      setPessoas((prev) => [nova, ...prev]);
      setShowModal(false);
      setNome('');
      setCpfCnpj('');
      setEmail('');
      setTelefone('');
    } catch (err: any) {
      setErroForm(err?.message ?? 'Nao foi possivel cadastrar a pessoa.');
    } finally {
      setSalvando(false);
    }
  };

  const pessoasFiltradas = pessoas.filter(p => 
    p.nome.toLowerCase().includes(busca.toLowerCase()) || p.cpfCnpj.includes(busca)
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" /> Pessoas & Clientes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastro unificado de partes, clientes, peritos e testemunhas.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Pessoa</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou CNPJ..."
          className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <Skeleton count={3} className="h-40 rounded-2xl" />
        ) : (
          pessoasFiltradas.map((p) => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover transition-all space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{p.nome}</h3>
                  <span className="text-[10px] font-mono text-slate-400">{p.cpfCnpj}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  p.tipo === 'Cliente' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {p.tipo}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {p.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {p.telefone}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {p.cidadeUf}
                </p>
              </div>

              <div className="pt-2 flex justify-between items-center text-[11px] text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" /> <strong>{p.quantidadeProcessos}</strong> processos
                </span>
                <span className="text-emerald-600 font-bold">Ativo</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Cadastrar Pessoa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Cadastrar Pessoa / Cliente
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarPessoa} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="123.456.789-00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Vínculo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800 font-medium"
                  >
                    <option value="Cliente">Cliente</option>
                    <option value="Parte Contraria">Parte Contrária</option>
                    <option value="Perito">Perito / Técnico</option>
                    <option value="Testemunha">Testemunha</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cidade / Estado</label>
                <input
                  type="text"
                  value={cidadeUf}
                  onChange={(e) => setCidadeUf(e.target.value)}
                  placeholder="São Paulo / SP"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-slate-800"
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
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
