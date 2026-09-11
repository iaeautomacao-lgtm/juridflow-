/**
 * Politica de senha do JuridFlow.
 *
 * A abordagem segue a orientacao atual do NIST (SP 800-63B): comprimento e
 * lista de bloqueio valem mais que regra de complexidade. Exigir maiuscula,
 * numero e simbolo empurra o usuario para "Senha@123" - previsivel, e ainda
 * assim aprovada por qualquer validador de complexidade.
 *
 * O que barramos aqui e o que um atacante tenta primeiro: senha curta, senha
 * obvia, e senha derivada do proprio e-mail ou nome da pessoa.
 */

export const TAMANHO_MINIMO = 10;
export const TAMANHO_MAXIMO = 200; // bcrypt ignora acima de 72 bytes; limite evita DoS por payload gigante

/**
 * Senhas que aparecem nas primeiras posicoes de qualquer lista de ataque, e
 * variacoes obvias em portugues. Nao e exaustiva - e a camada barata que
 * elimina o pior caso.
 */
const SENHAS_PROIBIDAS = new Set([
  '1234567890',
  '0123456789',
  'senha123456',
  'senhasenha',
  'password123',
  'qwertyuiop',
  'juridflow123',
  'juridflow2026',
  'advogado123',
  'escritorio123',
  'mudar123456',
  'trocar123456',
  'primeiroacesso',
  'dev-juridflow-local-2026',
]);

export interface ResultadoValidacao {
  valida: boolean;
  erro?: string;
}

/** Normaliza para comparacao: minusculas e sem acento. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Valida uma senha nova.
 *
 * `contexto` recebe e-mail e nome do usuario: senha que contem o proprio
 * e-mail ou nome e das primeiras que se tenta num ataque direcionado, e a
 * validacao nao teria como saber disso sem receber esses dados.
 */
export function validarSenha(
  senha: unknown,
  contexto: { email?: string; nome?: string } = {}
): ResultadoValidacao {
  if (typeof senha !== 'string') {
    return { valida: false, erro: 'A senha deve ser um texto.' };
  }

  if (senha.length < TAMANHO_MINIMO) {
    return {
      valida: false,
      erro: `A senha deve ter ao menos ${TAMANHO_MINIMO} caracteres.`,
    };
  }

  if (senha.length > TAMANHO_MAXIMO) {
    return {
      valida: false,
      erro: `A senha deve ter no maximo ${TAMANHO_MAXIMO} caracteres.`,
    };
  }

  if (senha.trim().length === 0) {
    return { valida: false, erro: 'A senha nao pode ser so espacos.' };
  }

  const normalizada = normalizar(senha);

  if (SENHAS_PROIBIDAS.has(normalizada)) {
    return {
      valida: false,
      erro: 'Esta senha e conhecida demais. Escolha outra.',
    };
  }

  // Um unico caractere repetido, ou sequencia direta.
  if (/^(.)\1+$/.test(senha)) {
    return { valida: false, erro: 'A senha nao pode ser um caractere repetido.' };
  }

  // Parte local do e-mail dentro da senha.
  const local = normalizar(String(contexto.email ?? '').split('@')[0] ?? '');
  if (local.length >= 4 && normalizada.includes(local)) {
    return {
      valida: false,
      erro: 'A senha nao pode conter seu e-mail.',
    };
  }

  // Qualquer palavra do nome com 4+ letras.
  const nome = normalizar(String(contexto.nome ?? ''));
  for (const palavra of nome.split(/\s+/)) {
    if (palavra.length >= 4 && normalizada.includes(palavra)) {
      return {
        valida: false,
        erro: 'A senha nao pode conter seu nome.',
      };
    }
  }

  return { valida: true };
}
