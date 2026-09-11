import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { sessao } from '../services/http';
import { useAuth } from '../context/AuthContext';

/**
 * Troca de senha.
 *
 * Serve a dois momentos:
 *
 *   obrigatoria  senha provisoria - definida pelo seed ou redefinida pelo
 *                socio. O backend recusa toda rota ate a troca, entao esta
 *                tela ocupa o lugar do sistema inteiro, sem menu nem saida.
 *
 *   voluntaria   o usuario querendo trocar. Fica dentro de Minha Conta.
 *
 * Nos dois casos o backend encerra as outras sessoes e devolve um token novo.
 */

const MINIMO = 10;

interface Props {
  /** true = senha provisoria: sem como sair, a troca e condicao de acesso. */
  obrigatoria?: boolean;
  onConcluido?: () => void;
}

export const TrocarSenha: React.FC<Props> = ({ obrigatoria = false, onConcluido }) => {
  const { usuario, sair, recarregarUsuario } = useAuth();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Checagens locais: dao retorno imediato. A validacao que vale e a do
  // servidor - o backend recusa senha curta, obvia ou derivada do nome e do
  // e-mail, e esta tela nao tenta replicar essas regras.
  const curta = senhaNova.length > 0 && senhaNova.length < MINIMO;
  const naoConfere = confirmacao.length > 0 && senhaNova !== confirmacao;
  const igualAtual = senhaNova.length > 0 && senhaNova === senhaAtual;
  const podeEnviar =
    senhaAtual.length > 0 &&
    senhaNova.length >= MINIMO &&
    senhaNova === confirmacao &&
    !igualAtual &&
    !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setEnviando(true);

    try {
      const r = await api.trocarSenha(senhaAtual, senhaNova);

      // Token novo: o backend revogou as sessoes anteriores, inclusive a
      // desta aba. Sem trocar o token guardado, a proxima requisicao daria
      // 401 e o usuario cairia no login logo apos trocar a senha.
      if (r.token && usuario) {
        sessao.salvar(r.token, { ...usuario, senha_provisoria: false });
      }

      setSucesso(r.message ?? 'Senha alterada.');
      setSenhaAtual('');
      setSenhaNova('');
      setConfirmacao('');

      await recarregarUsuario();
      onConcluido?.();
    } catch (e: any) {
      setErro(e?.message ?? 'Nao foi possivel trocar a senha.');
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  const formulario = (
    <form onSubmit={enviar} className="space-y-4">
      {obrigatoria && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Sua senha foi definida por outra pessoa.</strong> Para que a trilha de
            auditoria do escritório identifique com segurança quem fez cada ação, só você
            pode saber a sua senha. Defina uma nova para continuar.
          </div>
        </div>
      )}

      <div>
        <label htmlFor="senha-atual" className="block text-xs font-semibold text-slate-600 mb-1.5">
          Senha atual
        </label>
        <input
          id="senha-atual"
          type="password"
          autoComplete="current-password"
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          className={campo}
          required
        />
      </div>

      <div>
        <label htmlFor="senha-nova" className="block text-xs font-semibold text-slate-600 mb-1.5">
          Nova senha
        </label>
        <div className="relative">
          <input
            id="senha-nova"
            type={verSenha ? 'text' : 'password'}
            autoComplete="new-password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            className={campo + ' pr-10'}
            aria-describedby="dica-senha"
            required
          />
          <button
            type="button"
            onClick={() => setVerSenha((v) => !v)}
            aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {verSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p id="dica-senha" className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
          Mínimo de {MINIMO} caracteres. Não pode conter seu nome nem seu e-mail. Uma frase
          com quatro palavras é mais segura e mais fácil de lembrar que uma senha curta
          cheia de símbolos.
        </p>
        {curta && (
          <p className="text-[11px] text-red-600 mt-1">Faltam {MINIMO - senhaNova.length} caracteres.</p>
        )}
        {igualAtual && (
          <p className="text-[11px] text-red-600 mt-1">A nova senha precisa ser diferente da atual.</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmacao" className="block text-xs font-semibold text-slate-600 mb-1.5">
          Repita a nova senha
        </label>
        <input
          id="confirmacao"
          type={verSenha ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          className={campo}
          required
        />
        {naoConfere && <p className="text-[11px] text-red-600 mt-1">As senhas não conferem.</p>}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2.5" role="alert">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-red-800 leading-relaxed">{erro}</p>
        </div>
      )}

      {sucesso && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex gap-2.5" role="status">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-emerald-800 leading-relaxed">{sucesso}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!podeEnviar}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed
                   text-white text-sm font-semibold py-2.5 rounded-xl transition-colors
                   flex items-center justify-center gap-2"
      >
        {enviando ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Salvando...
          </>
        ) : (
          'Definir nova senha'
        )}
      </button>

      <p className="text-[11px] text-slate-500 text-center leading-relaxed">
        Ao trocar a senha, as sessões abertas em outros dispositivos são encerradas.
      </p>
    </form>
  );

  if (!obrigatoria) {
    return formulario;
  }

  // Modo obrigatorio: ocupa a tela toda. Nao ha menu nem navegacao - o
  // backend recusaria qualquer outra rota de qualquer forma, e oferecer
  // caminhos que vao dar 403 so confunde.
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto shadow-lg">
            <KeyRound className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-white">Defina sua senha</h1>
          <p className="text-xs text-slate-400">
            {usuario?.nome} · {usuario?.email}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">{formulario}</div>

        <button
          onClick={sair}
          className="w-full text-xs text-slate-400 hover:text-slate-200 transition-colors py-2"
        >
          Sair e entrar com outra conta
        </button>
      </div>
    </div>
  );
};
