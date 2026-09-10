import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  ShieldCheck, 
  Users, 
  Zap, 
  Lock, 
  Upload, 
  CheckCircle2, 
  Server,
  Globe,
  FileSpreadsheet,
  Clock,
  Eye,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';

export const Configuracoes: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<'presto' | 'auditoria' | 'franquias' | 'usuarios'>('presto');

  // Certificados vindos da API. Antes eram duas constantes no codigo -
  // 'cert_gisele_2026.pfx' e validade '2027-05-15' - exibidas como
  // "Certificado A1 Ativo no Cofre" mesmo sem nada cadastrado.
  const [certificados, setCertificados] = useState<any[]>([]);
  const [avisoEscopo, setAvisoEscopo] = useState<string>('');
  const [loadingCert, setLoadingCert] = useState(false);

  // Usuarios do escritorio, da API. Antes eram dois blocos fixos no JSX -
  // "Dra. Gisele Oliveira" e "Dr. Roberto Santos" - com e-mail e perfil.
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // Logs de Auditoria LGPD
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (abaAtiva === 'auditoria') {
      async function loadLogs() {
        setLoadingLogs(true);
        try {
          const data = await api.getAuditLogs();
          setLogs(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingLogs(false);
        }
      }
      loadLogs();
    }

    if (abaAtiva === 'presto') {
      async function loadCertificados() {
        setLoadingCert(true);
        try {
          const data = await api.getCertificados();
          setCertificados(data.certificados ?? []);
          setAvisoEscopo(data.aviso_escopo ?? '');
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingCert(false);
        }
      }
      loadCertificados();
    }

    if (abaAtiva === 'usuarios') {
      async function loadUsuarios() {
        setLoadingUsuarios(true);
        try {
          const data = await api.getUsuarios();
          setUsuarios(data.usuarios ?? []);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingUsuarios(false);
        }
      }
      loadUsuarios();
    }
  }, [abaAtiva]);

  // A lista de credenciais de tribunal e o fallback de logs de auditoria que
  // ficavam aqui foram removidos.
  //
  // A lista mostrava quatro tribunais como "Conectado (A1)" com o usuario
  // 432109/SP - nenhum deles existia. E o fallback de auditoria, quando o
  // backend devolvia lista vazia, exibia quatro entradas inventadas com nome
  // de advogado, IP e horario. Trilha de auditoria com registro fabricado e o
  // pior lugar possivel para dado ficticio: e o unico artefato do sistema que
  // precisa ser confiavel para valer sob a LGPD.

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" /> Configurações, Segurança & Auditoria LGPD
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Controle de validade de certificados digitais, trilha de auditoria LGPD, franquias de captura e perfis de acesso.
        </p>
      </div>

      {/* Abas */}
      <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setAbaAtiva('presto')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            abaAtiva === 'presto' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          <Key className="w-4 h-4" /> Certificados Digitais
        </button>

        <button
          onClick={() => setAbaAtiva('auditoria')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            abaAtiva === 'auditoria' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Trilha de Auditoria & Logs LGPD
        </button>

        <button
          onClick={() => setAbaAtiva('franquias')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            abaAtiva === 'franquias' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          <Zap className="w-4 h-4" /> Franquias de Captura
        </button>

        <button
          onClick={() => setAbaAtiva('usuarios')}
          className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
            abaAtiva === 'usuarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
          }`}
        >
          <Users className="w-4 h-4" /> Perfis & Permissões
        </button>
      </div>

      {abaAtiva === 'presto' ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-5 text-white shadow-lg flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                Certificados
              </span>
              <h3 className="text-base font-bold">Controle de Validade de Certificados Digitais</h3>
              <p className="text-xs text-slate-300">
                Cadastro de titular, OAB e data de vencimento, para o sistema avisar antes de expirar.
              </p>
            </div>
            <Clock className="w-10 h-10 text-blue-400 shrink-0 hidden sm:block" />
          </div>

          {/* Escopo real do modulo, dito de forma explicita */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
            <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> O que este modulo nao faz
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed">
              O JuridFlow <strong>nao armazena</strong> arquivo de certificado (.pfx) nem senha de
              portal de tribunal. Este cadastro guarda apenas metadado nao sigiloso, para controle
              de vencimento.
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Guardar credencial de tribunal exige cifra com chave fora do banco, auditoria de cada
              decifragem e servidor dedicado &mdash; nao hospedagem compartilhada. Enquanto isso nao
              existir, <strong>nao cadastre senha de PJe ou e-SAJ em nenhum campo do sistema</strong>.
              As integracoes ativas (DJEN e DataJud) sao APIs publicas do CNJ e nao pedem credencial
              do escritorio.
            </p>
            <p className="text-xs text-amber-800">
              Certificado A3 fica em token fisico ou smartcard e nao pode ser usado por um servidor:
              somente A1 e viavel, e apenas na fase 2 do projeto.
            </p>
          </div>

          {/* Certificados cadastrados - dados reais da API */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-800">Certificados cadastrados</h4>
                <p className="text-xs text-slate-500">
                  {avisoEscopo || 'Controle de vencimento por advogado.'}
                </p>
              </div>
            </div>

            {loadingCert ? (
              <p className="text-xs text-slate-500 py-4">Carregando...</p>
            ) : certificados.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center space-y-1 bg-slate-50">
                <Clock className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="font-bold text-xs text-slate-700">Nenhum certificado cadastrado</p>
                <p className="text-[11px] text-slate-400">
                  Cadastre titular, OAB e validade para receber aviso antes do vencimento.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs">
                {certificados.map((c) => {
                  const cor =
                    c.status === 'expirado'
                      ? 'bg-red-100 text-red-800'
                      : c.status === 'expirando'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800';
                  const rotulo =
                    c.status === 'expirado'
                      ? 'Expirado'
                      : c.status === 'expirando'
                        ? String(c.dias_para_vencer) + ' dia(s)'
                        : 'Valido';
                  return (
                    <div
                      key={c.id}
                      className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200/80"
                    >
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="font-bold text-slate-800">{c.advogado_nome}</p>
                          <p className="text-slate-500 text-[11px]">
                            OAB {c.oab} &bull; tipo {c.tipo} &bull; vence em{' '}
                            {new Date(c.validade).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <span className={'px-2.5 py-0.5 rounded-full font-bold text-[10px] ' + cor}>
                        {rotulo}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : abaAtiva === 'auditoria' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" /> Trilha de Auditoria LGPD em Tempo Real
              </h3>
              <p className="text-xs text-slate-500">Registro imutável de visualizações, alterações e acessos por usuário.</p>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold">
              Auditoria Ativa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Detalhe / O que viu ou alterou</th>
                  <th className="p-3">IP de Origem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">Carregando trilha de auditoria...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Nenhum registro na trilha de auditoria ainda. Cada visualizacao, criacao,
                      alteracao e exclusao passa a ser registrada aqui a partir do uso do sistema.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {/* Log sem usuario associado (usuario excluido) mostra isso
                            explicitamente. Antes cai num nome real por padrao, o que
                            atribuiria a acao a uma pessoa que nao a praticou. */}
                        <p className="font-bold text-slate-800">
                          {item.usuario?.nome || '(usuario removido)'}
                        </p>
                        <p className="text-[10px] text-slate-400">{item.usuario?.email || '-'}</p>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.acao.includes('VIEW') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          item.acao.includes('UPDATE') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.acao}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700 max-w-md truncate" title={item.detalhe}>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {item.detalhe}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{item.ip || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : abaAtiva === 'franquias' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <h3 className="font-bold text-sm text-slate-800">Gestão de Franquias DJEN</h3>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <div>
              <p className="font-bold text-slate-800">Assinatura DJEN Nacional (OAB/SP 432109)</p>
              <p className="text-slate-500">R$ 37,00/mês • Renovação automática em 01/10/2026</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">Ativa</span>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-card space-y-4">
          <h3 className="font-bold text-sm text-slate-800">Usuários & Perfis de Acesso</h3>
          <p className="text-[11px] text-slate-500">
            O perfil define o que o backend autoriza. Financeiro e trilha de auditoria sao
            restritos: advogado e estagiario recebem 403 nessas rotas.
          </p>
          <div className="space-y-2 text-xs">
            {loadingUsuarios ? (
              <p className="text-slate-400 py-4">Carregando...</p>
            ) : usuarios.length === 0 ? (
              <p className="text-slate-400 py-4">
                Nenhum usuário cadastrado além do seu. Cadastre a equipe do escritório.
              </p>
            ) : (
              usuarios.map((u) => (
                <div
                  key={u.id}
                  className="flex justify-between items-center p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{u.nome}</p>
                    <p className="text-slate-500 truncate">
                      {u.email}
                      {u.oab ? ` • OAB ${u.oab}` : ''}
                      {u.ativo ? '' : ' • inativo'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                      u.cargo === 'socio'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {u.cargo}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
