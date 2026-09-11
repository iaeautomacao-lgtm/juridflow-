import React, { useEffect, useState } from 'react';
import {
  Users, UserPlus, KeyRound, Pencil, Check, X,
  ShieldCheck, AlertCircle, Loader2, Power,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/**
 * Perfis e permissoes do escritorio.
 *
 * Restrito ao socio: o backend recusa estas rotas com 403 para os demais
 * cargos, e o menu ja esconde a aba. A checagem que vale e a do servidor -
 * esta tela so evita que o usuario bata no erro.
 */

interface Usuario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  oab?: string | null;
  ativo: boolean;
}

const ROTULO_CARGO: Record<string, string> = {
  socio: 'Sócio',
  advogado: 'Advogado',
  estagiario: 'Estagiário',
  financeiro: 'Financeiro',
};

const DESCRICAO_CARGO: Record<string, string> = {
  socio: 'Acesso total, incluindo financeiro, auditoria e gestão da equipe.',
  advogado: 'Processos, prazos, captura e documentos. Sem financeiro nem administração.',
  estagiario: 'Consulta, tarefas e andamentos. Não cria processo nem exclui.',
  financeiro: 'Módulo financeiro e consultas gerais.',
};

const CORES_CARGO: Record<string, string> = {
  socio: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  advogado: 'bg-blue-50 text-blue-700 border-blue-200',
  estagiario: 'bg-slate-100 text-slate-600 border-slate-200',
  financeiro: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const GestaoUsuarios: React.FC = () => {
  const { usuario: eu } = useAuth();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{ nome: string; cargo: string; oab: string }>({
    nome: '', cargo: '', oab: '',
  });

  const [redefinindo, setRedefinindo] = useState<string | null>(null);
  const [senhaNova, setSenhaNova] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ nome: '', email: '', senha: '', cargo: 'advogado', oab: '' });

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await api.getUsuarios();
      setUsuarios(dados.usuarios ?? []);
      setCargos(dados.cargos_disponiveis ?? []);
    } catch (e: any) {
      setErro(e?.message ?? 'Não foi possível carregar os usuários.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  function limpar() {
    setEditando(null);
    setRedefinindo(null);
    setSenhaNova('');
    setCriando(false);
    setErro(null);
  }

  async function agir(acao: () => Promise<string>) {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      setAviso(await acao());
      limpar();
      await carregar();
    } catch (e: any) {
      setErro(e?.message ?? 'Operação não concluída.');
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    'w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" /> Perfis &amp; Permissões
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            O cargo define o que cada pessoa acessa. A verificação é feita no servidor a cada
            requisição.
          </p>
        </div>
        <button
          onClick={() => { limpar(); setCriando(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold
                     px-3 py-2 rounded-xl flex items-center gap-1.5 shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" /> Novo usuário
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2.5" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 leading-relaxed">{erro}</p>
        </div>
      )}

      {aviso && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2.5" role="status">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 leading-relaxed">{aviso}</p>
        </div>
      )}

      {criando && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Novo usuário</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={campo} placeholder="Nome completo" value={novo.nome}
              onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
            <input className={campo} placeholder="e-mail" type="email" value={novo.email}
              onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
            <input className={campo} placeholder="Senha provisória (mín. 10)" type="text" value={novo.senha}
              onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
            <select className={campo} value={novo.cargo}
              onChange={(e) => setNovo({ ...novo, cargo: e.target.value })}>
              {(cargos.length ? cargos : Object.keys(ROTULO_CARGO)).map((c) => (
                <option key={c} value={c}>{ROTULO_CARGO[c] ?? c}</option>
              ))}
            </select>
            <input className={campo} placeholder="OAB (opcional)" value={novo.oab}
              onChange={(e) => setNovo({ ...novo, oab: e.target.value })} />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            A senha nasce <strong>provisória</strong>: a pessoa será obrigada a definir a dela no
            primeiro acesso. Até lá, nenhuma outra tela do sistema abre para ela.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={limpar} className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5">
              Cancelar
            </button>
            <button
              disabled={salvando || !novo.nome || !novo.email || novo.senha.length < 10}
              onClick={() => agir(async () => {
                await api.createUsuario({
                  nome: novo.nome, email: novo.email, senha: novo.senha,
                  cargo: novo.cargo, oab: novo.oab || undefined,
                });
                setNovo({ nome: '', email: '', senha: '', cargo: 'advogado', oab: '' });
                return `${novo.email} cadastrado com senha provisória.`;
              })}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white
                         text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              Cadastrar
            </button>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando equipe...
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => {
            const souEu = u.id === eu?.id;
            return (
              <div key={u.id}
                className={`bg-white border rounded-2xl p-4 ${u.ativo ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>

                {editando === u.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input className={campo} value={rascunho.nome}
                        onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} />
                      <select className={campo} value={rascunho.cargo} disabled={souEu}
                        onChange={(e) => setRascunho({ ...rascunho, cargo: e.target.value })}>
                        {(cargos.length ? cargos : Object.keys(ROTULO_CARGO)).map((c) => (
                          <option key={c} value={c}>{ROTULO_CARGO[c] ?? c}</option>
                        ))}
                      </select>
                      <input className={campo} placeholder="OAB" value={rascunho.oab}
                        onChange={(e) => setRascunho({ ...rascunho, oab: e.target.value })} />
                    </div>
                    {souEu && (
                      <p className="text-[11px] text-amber-700">
                        Você não pode alterar o próprio cargo. Peça a outro sócio.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500">
                      Mudar o cargo encerra as sessões abertas dessa pessoa.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={limpar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
                      <button
                        disabled={salvando}
                        onClick={() => agir(async () => {
                          await api.updateUsuario(u.id, {
                            nome: rascunho.nome,
                            ...(souEu ? {} : { cargo: rascunho.cargo }),
                            oab: rascunho.oab || null,
                          });
                          return `${u.email} atualizado.`;
                        })}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white
                                   text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Salvar
                      </button>
                    </div>
                  </div>
                ) : redefinindo === u.id ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Redefinir senha de {u.nome}
                    </h4>
                    <input className={campo} type="text" placeholder="Nova senha provisória (mín. 10)"
                      value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)} />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      A senha nasce provisória e <strong>encerra as sessões abertas</strong> dessa
                      pessoa. Ela será obrigada a definir a própria senha no próximo acesso —
                      assim você não fica sabendo a senha de acesso dela, e a trilha de auditoria
                      continua identificando quem fez o quê.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={limpar} className="text-xs text-slate-500 px-3 py-1.5">Cancelar</button>
                      <button
                        disabled={salvando || senhaNova.length < 10}
                        onClick={() => agir(async () => {
                          const r = await api.redefinirSenhaUsuario(u.id, senhaNova);
                          return r.message;
                        })}
                        className="bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 text-white
                                   text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        Redefinir
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{u.nome}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CORES_CARGO[u.cargo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {ROTULO_CARGO[u.cargo] ?? u.cargo}
                        </span>
                        {souEu && (
                          <span className="text-[10px] text-slate-400 border border-slate-200 px-2 py-0.5 rounded-full">
                            você
                          </span>
                        )}
                        {!u.ativo && (
                          <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            inativo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {u.email}{u.oab ? ` · OAB ${u.oab}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{DESCRICAO_CARGO[u.cargo]}</p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        title="Editar nome, cargo e OAB"
                        onClick={() => {
                          limpar();
                          setEditando(u.id);
                          setRascunho({ nome: u.nome, cargo: u.cargo, oab: u.oab ?? '' });
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        title="Redefinir senha"
                        onClick={() => { limpar(); setRedefinindo(u.id); }}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        title={souEu ? 'Você não pode desativar a si mesmo' : u.ativo ? 'Desativar' : 'Reativar'}
                        disabled={souEu || salvando}
                        onClick={() => agir(async () => {
                          await api.setUsuarioAtivo(u.id, !u.ativo);
                          return u.ativo
                            ? `${u.email} desativado. As sessões dele foram encerradas.`
                            : `${u.email} reativado.`;
                        })}
                        className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${
                          u.ativo
                            ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {u.ativo ? <Power className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {usuarios.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Nenhum usuário cadastrado.</p>
          )}
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
        <h4 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> O que acontece ao desativar
        </h4>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          A sessão da pessoa cai <strong>na requisição seguinte</strong>, não quando o token
          expirar. Isso vale também ao redefinir a senha ou mudar o cargo. Todas essas ações
          ficam registradas na trilha de auditoria, com autor, data e IP.
        </p>
      </div>
    </div>
  );
};
