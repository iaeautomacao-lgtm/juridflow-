export interface Processo {
  id: string;
  cnj: string;
  titulo: string;
  autor: string;
  reu: string;
  tribunal: string;
  comarca: string;
  vara: string;
  status: 'Ativo' | 'Suspenso' | 'Arquivado' | 'Em Recurso';
  dataDistribuicao: string;
  valorCausa: number;
  fase: string;
  advogadoResponsavel: string;
  clienteId?: string;
  tags: string[];
}

export interface Intimacao {
  id: string;
  cnj: string;
  dataPublicacao: string;
  orgao: string;
  teor: string;
  status: 'Pendente' | 'Processo não localizado' | 'Arquivada' | 'Atendida';
  prazoFatal?: string;
  lida: boolean;
  advogadoNotificado: string;
}

/**
 * Movimentacao processual.
 *
 * O campo `origem` foi removido. Ele era um literal
 * 'DJEN' | 'TJSP' | 'TRF3' | 'STJ' | 'Captura Push' preenchido por um
 * ternario no mapeador, que rotulava TODO andamento manual como "TJSP" -
 * inclusive um lançado à mão num processo do TRT. O tribunal agora sai do
 * proprio numero CNJ (ver lib/cnj.ts) e `fonte` diz apenas de onde o registro
 * veio, que e o que o banco de fato guarda.
 */
export interface Andamento {
  id: string;
  /** Registro vinculado (sem FK: par chave_modulo + codigo). */
  processoId: string;
  chaveModulo: string;
  cnj: string;
  dataHora: string;
  /** Tipo do movimento, ex.: "Juntada de peticao". */
  tipo: string;
  descricao: string;
  /** Vara / orgao julgador. */
  orgao: string;
  cliente: string;
  fonte: 'manual' | 'datajud' | 'djen';
  lido: boolean;
  temIntimacao: boolean;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  processoCnj?: string;
  dataLimite: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  status: 'A Fazer' | 'Em Andamento' | 'Aguardando' | 'Concluído';
  responsavel: string;
  tipo: 'Prazo' | 'Audiência' | 'Diligência' | 'Reunião' | 'Elaboração de Peça';
}

export interface Pessoa {
  id: string;
  nome: string;
  cpfCnpj: string;
  tipo: 'Cliente' | 'Parte Contraria' | 'Testemunha' | 'Perito';
  email: string;
  telefone: string;
  cidadeUf: string;
  status: 'Ativo' | 'Inativo';
  quantidadeProcessos: number;
}

export interface CRMAtendimento {
  id: string;
  clienteNome: string;
  telefone: string;
  assunto: string;
  fase: 'Primeiro Contato' | 'Análise de Viabilidade' | 'Proposta Enviada' | 'Contrato Assinado';
  valorEstimado: number;
  dataInicio: string;
  origem: string;
}

export interface TransacaoFinanceira {
  id: string;
  descricao: string;
  tipo: 'Receita' | 'Despesa';
  categoria: string;
  valor: number;
  vencimento: string;
  status: 'Pago' | 'Pendente' | 'Atrasado';
  clienteOuFornecedor: string;
  processoCnj?: string;
}

export interface ContratoHonorarios {
  id: string;
  clienteNome: string;
  titulo: string;
  valorTotal: number;
  formaPagamento: string;
  status: 'Vigente' | 'Encerrado' | 'Em Inadimplência';
  dataInicio: string;
}

export interface DocumentoModel {
  id: string;
  nome: string;
  categoria: string;
  tamanho: string;
  dataModificacao: string;
  processoCnj?: string;
  url?: string;
}

export interface ModeloPeca {
  id: string;
  titulo: string;
  categoria: string;
  conteudoComVariaveis: string;
  descricao: string;
}

export interface MensagemIA {
  id: string;
  remetente: 'user' | 'assistant';
  texto: string;
  timestamp: string;
  sugestaoPrazo?: {
    diasUteis: number;
    fundamento: string;
    dataCalculada: string;
  };
}

export interface CentralCaptura {
  oabLote: string;
  ufOab: string;
  statusConexao: 'Conectado' | 'Reconectando' | 'Erro';
  totalProcessosMonitorados: number;
  cadastroAutomatico: boolean;
  capturaDocumentosAuto: boolean;
  franquiaCapturaAtiva: boolean;
  creditosRestantes: number;
}

