/**
 * Camada HTTP do JuridFlow.
 *
 * Tres coisas que mudaram em relacao a versao anterior:
 *
 * 1. A URL base vem de VITE_API_URL. Antes era a constante
 *    'http://localhost:3001/api' no codigo, o que em producao faz o navegador
 *    do cliente tentar o proprio localhost. O padrao agora e '/api', que em
 *    desenvolvimento cai no proxy do vite.config.ts.
 *
 * 2. Toda requisicao envia Authorization: Bearer. Antes nenhuma enviava, e o
 *    backend compensava autenticando qualquer chamada como o primeiro usuario
 *    do banco.
 *
 * 3. Falha nao e mais convertida em lista vazia. Antes o catch devolvia
 *    `defaultEmpty` e so registrava console.warn - a tela renderizava vazia e
 *    o usuario nao tinha como saber que a API estava fora. Agora o erro sobe
 *    e tambem e publicado em um evento global, para o banner de erro mostrar
 *    ao usuario independentemente do que a pagina faz no seu catch.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

const CHAVE_TOKEN = 'juridflow.token';
const CHAVE_USUARIO = 'juridflow.usuario';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  cargo: 'socio' | 'advogado' | 'estagiario' | 'financeiro';
  oab?: string | null;
  /**
   * Senha definida por outra pessoa - pelo seed, ou redefinida pelo socio.
   * Enquanto true, o backend recusa toda rota exceto a de troca de senha,
   * e o frontend manda direto para a tela de troca.
   */
  senha_provisoria?: boolean;
  tenant: { id: string; nome: string; cnpj?: string | null };
}

// ---------------------------------------------------------------------------
// Sessao
// ---------------------------------------------------------------------------

export const sessao = {
  getToken(): string | null {
    try {
      return localStorage.getItem(CHAVE_TOKEN);
    } catch {
      return null;
    }
  },

  getUsuario(): UsuarioSessao | null {
    try {
      const bruto = localStorage.getItem(CHAVE_USUARIO);
      return bruto ? (JSON.parse(bruto) as UsuarioSessao) : null;
    } catch {
      return null;
    }
  },

  salvar(token: string, usuario: UsuarioSessao): void {
    try {
      localStorage.setItem(CHAVE_TOKEN, token);
      localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
    } catch {
      // Navegador com armazenamento bloqueado: a sessao vale so para esta aba.
    }
  },

  limpar(): void {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
    } catch {
      /* ignora */
    }
  },
};

// ---------------------------------------------------------------------------
// Eventos globais
// ---------------------------------------------------------------------------

export const EVENTO_ERRO_API = 'juridflow:erro-api';
export const EVENTO_SESSAO_EXPIRADA = 'juridflow:sessao-expirada';

export interface DetalheErroApi {
  mensagem: string;
  status: number | null;
  endpoint: string;
  codigo?: string;
}

function publicarErro(detalhe: DetalheErroApi): void {
  window.dispatchEvent(new CustomEvent<DetalheErroApi>(EVENTO_ERRO_API, { detail: detalhe }));
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number | null;
  readonly codigo?: string;
  readonly endpoint: string;

  constructor(mensagem: string, status: number | null, endpoint: string, codigo?: string) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.endpoint = endpoint;
  }

  /** 403 do requireCargo: o usuario esta logado, mas o perfil nao permite. */
  get ehPermissao(): boolean {
    return this.status === 403;
  }
}

// ---------------------------------------------------------------------------
// Requisicao
// ---------------------------------------------------------------------------

interface OpcoesRequisicao extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Nao publica no banner global (util para erro tratado na propria tela). */
  silencioso?: boolean;
}

export async function request<T>(endpoint: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { body, silencioso, headers, ...resto } = opcoes;
  const token = sessao.getToken();

  const cabecalhos: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((headers as Record<string, string>) ?? {}),
  };

  let resposta: Response;
  try {
    resposta = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...resto,
      headers: cabecalhos,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    const erro = new ApiError(
      'Nao foi possivel falar com o servidor do JuridFlow. Verifique a conexao.',
      null,
      endpoint,
      'REDE'
    );
    if (!silencioso) publicarErro({ mensagem: erro.message, status: null, endpoint, codigo: 'REDE' });
    throw erro;
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  const texto = await resposta.text();
  let corpo: any = null;
  let respostaNaoEhJson = false;

  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      respostaNaoEhJson = true;

      // A resposta nao e JSON. A versao anterior usava os primeiros 300
      // caracteres do texto como mensagem de erro - quando o servidor
      // devolvia HTML, a tela de login exibia codigo-fonte da pagina no lugar
      // da mensagem. Alem de ilegivel, esconde a causa real.
      //
      // HTML aqui quase sempre significa uma coisa so: a API nao esta
      // respondendo, e o que voltou foi a propria pagina do frontend - pelo
      // catch-all da SPA no .htaccess, ou por uma ErrorDocument do servidor.
      const pareceHtml = /^\s*(<!doctype|<html|<\?xml)/i.test(texto);

      corpo = {
        message: pareceHtml
          ? `A API nao respondeu em ${API_BASE_URL} (HTTP ${resposta.status}): ` +
            'o servidor devolveu uma pagina web no lugar dos dados. ' +
            'Verifique se a aplicacao do backend esta no ar.'
          : `Resposta invalida do servidor (HTTP ${resposta.status}): ` +
            texto.slice(0, 120).replace(/\s+/g, ' ').trim(),
      };
    }
  }

  // Corpo nao-JSON com status de sucesso tambem e falha: quem chamou espera
  // dado tipado. Sem este ramo, a pagina recebia { message: ... } no lugar do
  // objeto esperado e quebrava depois, longe da causa.
  if (resposta.ok && respostaNaoEhJson) {
    const erro = new ApiError(corpo.message, resposta.status, endpoint, 'RESPOSTA_NAO_JSON');
    if (!silencioso) {
      publicarErro({ mensagem: corpo.message, status: resposta.status, endpoint, codigo: 'RESPOSTA_NAO_JSON' });
    }
    throw erro;
  }

  if (!resposta.ok) {
    const mensagem =
      corpo?.message ?? `Erro ${resposta.status} ao chamar ${endpoint}.`;
    const codigo = corpo?.codigo;

    // Sessao invalida ou expirada: limpa e avisa o app para voltar ao login.
    if (resposta.status === 401) {
      sessao.limpar();
      window.dispatchEvent(new CustomEvent(EVENTO_SESSAO_EXPIRADA, { detail: { mensagem } }));
      throw new ApiError(mensagem, 401, endpoint, codigo);
    }

    const erro = new ApiError(mensagem, resposta.status, endpoint, codigo);
    if (!silencioso) {
      publicarErro({ mensagem, status: resposta.status, endpoint, codigo });
    }
    throw erro;
  }

  return corpo as T;
}

/** Envelope paginado devolvido pelas listagens do backend. */
export interface Paginado {
  total: number;
  limit: number;
  offset: number;
  tem_mais: boolean;
}

/** Extrai a lista de um envelope `{ <chave>: [...], total, limit, ... }`. */
export function lista<T>(corpo: any, chave: string): T[] {
  if (Array.isArray(corpo)) return corpo as T[];
  if (corpo && Array.isArray(corpo[chave])) return corpo[chave] as T[];
  return [];
}
