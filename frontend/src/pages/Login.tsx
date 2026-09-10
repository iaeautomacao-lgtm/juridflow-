import React, { useState } from 'react';
import { Scale, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/http';

/**
 * Tela de login.
 *
 * Nao existia. Como o backend passou a exigir token em toda rota, sem esta
 * tela o sistema fica inacessivel.
 */
export function Login() {
  const { entrar, mensagemSessao } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aoEnviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);

    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }

    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (err) {
      if (err instanceof ApiError) {
        setErro(
          err.status === null
            ? 'Servidor do JuridFlow indisponivel. Verifique se o backend esta no ar.'
            : err.message
        );
      } else {
        setErro('Nao foi possivel entrar. Tente novamente.');
      }
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <Scale className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">JuridFlow</h1>
            <p className="text-xs text-slate-400">Gestao juridica</p>
          </div>
        </div>

        <form
          onSubmit={aoEnviar}
          className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">Entrar</h2>
            <p className="text-xs text-slate-400 mt-1">
              Use as credenciais fornecidas pelo socio administrador.
            </p>
          </div>

          {mensagemSessao && !erro && (
            <div
              role="status"
              className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-xl p-3"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-amber-200">{mensagemSessao}</p>
            </div>
          )}

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-red-500/10 border border-red-500/40 rounded-xl p-3"
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-red-200">{erro}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium text-slate-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
              placeholder="voce@escritorio.com.br"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="senha" className="block text-xs font-medium text-slate-300">
              Senha
            </label>
            <div className="relative">
              <input
                id="senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                disabled={enviando}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                {mostrarSenha ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-6">
          Acesso registrado na trilha de auditoria do escritorio.
        </p>
      </div>
    </div>
  );
}
