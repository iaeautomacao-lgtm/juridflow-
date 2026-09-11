import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { sessao, UsuarioSessao, EVENTO_SESSAO_EXPIRADA } from '../services/http';

/**
 * Sessao do usuario.
 *
 * O backend nao tem mais caminho alternativo de autenticacao: sem token
 * valido, toda rota responde 401. Por isso o frontend precisa de tela de
 * login e de um lugar unico que saiba quem esta logado e com qual cargo -
 * antes nao havia nem armazenamento de token.
 */

export type Cargo = UsuarioSessao['cargo'];

interface AuthState {
  usuario: UsuarioSessao | null;
  carregando: boolean;
  mensagemSessao: string | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
  /** Verdadeiro se o cargo do usuario esta na lista. */
  podeAcessar: (...cargos: Cargo[]) => boolean;
  /**
   * Rele o usuario do backend.
   *
   * Usado depois de trocar a senha: o backend limpa senha_provisoria e o
   * frontend precisa saber disso para liberar o sistema, sem exigir novo
   * login.
   */
  recarregarUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSessao | null>(() => sessao.getUsuario());
  const [carregando, setCarregando] = useState(true);
  const [mensagemSessao, setMensagemSessao] = useState<string | null>(null);

  // Revalida o token guardado contra o backend. Token no localStorage pode
  // estar expirado ou assinado com um segredo antigo.
  useEffect(() => {
    let ativo = true;

    async function revalidar() {
      if (!sessao.getToken()) {
        if (ativo) {
          setUsuario(null);
          setCarregando(false);
        }
        return;
      }
      try {
        const atual = await api.getMe();
        if (ativo) setUsuario(atual);
      } catch {
        sessao.limpar();
        if (ativo) setUsuario(null);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void revalidar();
    return () => {
      ativo = false;
    };
  }, []);

  // Qualquer 401 em qualquer chamada derruba a sessao e explica o motivo.
  useEffect(() => {
    function aoExpirar(evento: Event) {
      const detalhe = (evento as CustomEvent<{ mensagem?: string }>).detail;
      setUsuario(null);
      setMensagemSessao(detalhe?.mensagem ?? 'Sessao encerrada. Faca login novamente.');
    }
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const logado = await api.login(email, senha);
    setUsuario(logado);
    setMensagemSessao(null);
  }, []);

  const sair = useCallback(() => {
    api.logout();
    setUsuario(null);
    setMensagemSessao(null);
  }, []);

  const recarregarUsuario = useCallback(async () => {
    if (!sessao.getToken()) return;
    try {
      setUsuario(await api.getMe());
    } catch {
      // 401 ja derruba a sessao pelo evento global; aqui nao ha o que fazer.
    }
  }, []);

  const podeAcessar = useCallback(
    (...cargos: Cargo[]) => (usuario ? cargos.includes(usuario.cargo) : false),
    [usuario]
  );

  const valor = useMemo<AuthState>(
    () => ({ usuario, carregando, mensagemSessao, entrar, sair, podeAcessar, recarregarUsuario }),
    [usuario, carregando, mensagemSessao, entrar, sair, podeAcessar, recarregarUsuario]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return contexto;
}
