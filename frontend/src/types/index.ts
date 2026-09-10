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

export interface Andamento {
  id: string;
  processoId: string;
  cnj: string;
  dataHora: string;
  descricao: string;
  origem: 'DJEN' | 'TJSP' | 'TRF3' | 'STJ' | 'Captura Push';
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

