import {
  Processo,
  Intimacao,
  Andamento,
  Tarefa,
  Pessoa,
  CRMAtendimento,
  TransacaoFinanceira,
  ContratoHonorarios,
  DocumentoModel,
  ModeloPeca,
  CentralCaptura,
} from '../types';
import { request, lista, sessao, UsuarioSessao } from './http';

/**
 * Cliente de API do JuridFlow.
 *
 * Esta camada tambem traduz os nomes de campo entre backend e frontend
 * (vencimento <-> dataLimite, 'a_fazer' <-> 'A Fazer', e assim por diante).
 * A traducao existe porque frontend/src/types/index.ts e uma definicao
 * paralela a do backend, mantida a mao.
 *
 * Isso e divida tecnica conhecida: foi o que produziu as cinco rotas que o
 * frontend chamava e o backend nao tinha. As rotas foram alinhadas, mas
 * unificar os tipos num pacote compartilhado ainda esta em aberto.
 */

// ---------------------------------------------------------------------------
// Tradutores
// ---------------------------------------------------------------------------

function parteComPapel(partes: any[], papeis: string[]): string {
  const achado = (partes ?? []).find((p) =>
    papeis.some((papel) => String(p?.papel ?? '').toLowerCase().includes(papel))
  );
  return String(achado?.nome ?? '');
}

const STATUS_PROCESSO: Record<string, Processo['status']> = {
  'Em Andamento': 'Ativo',
  Ativo: 'Ativo',
  Suspenso: 'Suspenso',
  Arquivado: 'Arquivado',
  Concluso: 'Arquivado',
  'Em Recurso': 'Em Recurso',
};

function paraProcesso(p: any): Processo {
  const partes = Array.isArray(p?.partes) ? p.partes : [];
  return {
    id: String(p?.id ?? ''),
    cnj: String(p?.cnj ?? ''),
    titulo: String(p?.titulo ?? ''),
    autor: parteComPapel(partes, ['autor', 'requerente', 'exequente']) || String(p?.cliente ?? ''),
    reu: parteComPapel(partes, ['reu', 'ré', 'requerido', 'executado']),
    tribunal: String(p?.orgao ?? ''),
    comarca: String(p?.comarca ?? ''),
    vara: String(p?.vara ?? ''),
    status: STATUS_PROCESSO[String(p?.status)] ?? 'Ativo',
    dataDistribuicao: String(p?.data_distribuicao ?? ''),
    valorCausa: Number(p?.valor_causa ?? 0),
    fase: String(p?.instancia ?? ''),
    advogadoResponsavel: '',
    clienteId: String(p?.cliente ?? ''),
    tags: [],
  };
}

const STATUS_INTIMACAO: Record<string, Intimacao['status']> = {
  pendente: 'Pendente',
  processo_nao_localizado: 'Processo não localizado',
  arquivado: 'Arquivada',
  vinculado: 'Atendida',
};

function paraIntimacao(i: any): Intimacao {
  return {
    id: String(i?.id ?? ''),
    cnj: String(i?.cnj ?? ''),
    dataPublicacao: String(i?.publicacao ?? i?.disponibilizacao ?? ''),
    orgao: String(i?.orgao ?? ''),
    teor: String(i?.descricao ?? ''),
    status: STATUS_INTIMACAO[String(i?.status)] ?? 'Pendente',
    lida: String(i?.status) !== 'pendente',
    advogadoNotificado: String(i?.oab_uf ?? ''),
  };
}

const STATUS_TAREFA_BACK: Record<string, Tarefa['status']> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
};
const STATUS_TAREFA_FRONT: Record<string, string> = {
  'A Fazer': 'a_fazer',
  'Em Andamento': 'em_andamento',
  Aguardando: 'a_fazer',
  Concluído: 'concluido',
};
const PRIORIDADE_BACK: Record<string, Tarefa['prioridade']> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};
const PRIORIDADE_FRONT: Record<string, string> = { Alta: 'alta', Média: 'media', Baixa: 'baixa' };

function paraTarefa(t: any): Tarefa {
  return {
    id: String(t?.id ?? ''),
    titulo: String(t?.titulo ?? ''),
    descricao: t?.descricao ? String(t.descricao) : undefined,
    processoCnj: t?.processo?.cnj ? String(t.processo.cnj) : undefined,
    dataLimite: String(t?.vencimento ?? ''),
    prioridade: PRIORIDADE_BACK[String(t?.prioridade)] ?? 'Média',
    status: STATUS_TAREFA_BACK[String(t?.status)] ?? 'A Fazer',
    responsavel: String(t?.responsavel_nome ?? ''),
    tipo: (String(t?.tipo ?? 'Prazo') as Tarefa['tipo']) ?? 'Prazo',
  };
}

function paraAndamento(a: any): Andamento {
  const fonte = String(a?.fonte ?? 'manual');
  return {
    id: String(a?.id ?? ''),
    processoId: String(a?.codigo_registro_vinculo ?? ''),
    cnj: String(a?.cnj ?? a?.processo?.cnj ?? ''),
    dataHora: String(a?.data ?? ''),
    descricao: String(a?.descricao ?? ''),
    origem: fonte === 'djen' ? 'DJEN' : fonte === 'datajud' ? 'Captura Push' : 'TJSP',
    lido: Boolean(a?.lido),
    temIntimacao: fonte === 'djen',
  };
}

const TIPO_PESSOA: Record<string, Pessoa['tipo']> = {
  cliente: 'Cliente',
  parte_contraria: 'Parte Contraria',
  testemunha: 'Testemunha',
  perito: 'Perito',
  terceiro: 'Parte Contraria',
};

const TIPO_PESSOA_FRONT: Record<string, string> = {
  Cliente: 'cliente',
  'Parte Contraria': 'parte_contraria',
  Testemunha: 'testemunha',
  Perito: 'perito',
};

function paraPessoa(p: any): Pessoa {
  return {
    id: String(p?.id ?? ''),
    nome: String(p?.nome ?? ''),
    cpfCnpj: String(p?.cpf_cnpj ?? ''),
    tipo: TIPO_PESSOA[String(p?.tipo_cliente)] ?? 'Cliente',
    email: String(p?.email ?? ''),
    telefone: String(p?.telefone ?? ''),
    cidadeUf: String(p?.cidade_uf ?? ''),
    status: p?.ativo === false ? 'Inativo' : 'Ativo',
    quantidadeProcessos: Number(p?.total_tarefas ?? 0),
  };
}

const FASE_CRM_BACK: Record<string, CRMAtendimento['fase']> = {
  primeiro_contato: 'Primeiro Contato',
  analise_viabilidade: 'Análise de Viabilidade',
  proposta_enviada: 'Proposta Enviada',
  contrato_assinado: 'Contrato Assinado',
  perdido: 'Primeiro Contato',
};
const FASE_CRM_FRONT: Record<string, string> = {
  'Primeiro Contato': 'primeiro_contato',
  'Análise de Viabilidade': 'analise_viabilidade',
  'Proposta Enviada': 'proposta_enviada',
  'Contrato Assinado': 'contrato_assinado',
};

function paraAtendimento(a: any): CRMAtendimento {
  return {
    id: String(a?.id ?? ''),
    clienteNome: String(a?.cliente_nome ?? ''),
    telefone: String(a?.telefone ?? ''),
    assunto: String(a?.assunto ?? ''),
    fase: FASE_CRM_BACK[String(a?.fase)] ?? 'Primeiro Contato',
    valorEstimado: Number(a?.valor_estimado ?? 0),
    dataInicio: String(a?.data_inicio ?? ''),
    origem: String(a?.origem ?? ''),
  };
}

function paraTransacao(t: any): TransacaoFinanceira {
  const pago = Boolean(t?.status_pago);
  const vencimento = String(t?.data_vencimento ?? '');
  const atrasado = !pago && vencimento !== '' && new Date(vencimento).getTime() < Date.now();

  return {
    id: String(t?.id ?? ''),
    descricao: String(t?.descricao ?? ''),
    tipo: String(t?.tipo_receita_despesa) === 'receita' ? 'Receita' : 'Despesa',
    categoria: String(t?.categoria ?? ''),
    valor: Number(t?.valor ?? 0),
    vencimento,
    status: pago ? 'Pago' : atrasado ? 'Atrasado' : 'Pendente',
    clienteOuFornecedor: String(t?.cliente ?? ''),
    processoCnj: undefined,
  };
}

const STATUS_CONTRATO: Record<string, ContratoHonorarios['status']> = {
  vigente: 'Vigente',
  encerrado: 'Encerrado',
  inadimplente: 'Em Inadimplência',
};

function paraContrato(c: any): ContratoHonorarios {
  return {
    id: String(c?.id ?? ''),
    clienteNome: String(c?.cliente_nome ?? ''),
    titulo: String(c?.titulo ?? ''),
    valorTotal: Number(c?.valor_total ?? 0),
    formaPagamento: String(c?.forma_pagamento ?? ''),
    status: STATUS_CONTRATO[String(c?.status)] ?? 'Vigente',
    dataInicio: String(c?.data_inicio ?? ''),
  };
}

function formatarTamanho(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(i === 0 ? 0 : 1)} ${unidades[i]}`;
}

function paraDocumento(d: any): DocumentoModel {
  return {
    id: String(d?.id ?? ''),
    nome: String(d?.titulo ?? ''),
    categoria: String(d?.categoria ?? ''),
    tamanho: formatarTamanho(Number(d?.tamanho_bytes ?? 0)),
    dataModificacao: String(d?.criado_em ?? ''),
    processoCnj: undefined,
    url: d?.url ? String(d.url) : undefined,
  };
}

function paraModeloPeca(m: any): ModeloPeca {
  return {
    id: String(m?.id ?? ''),
    titulo: String(m?.titulo ?? ''),
    categoria: String(m?.categoria ?? ''),
    conteudoComVariaveis: String(m?.conteudo_template_com_variaveis ?? ''),
    descricao: String(m?.categoria ?? ''),
  };
}

// ---------------------------------------------------------------------------
// Tipos das rotas novas
// ---------------------------------------------------------------------------

export interface EtapaPrazo {
  rotulo: string;
  data: string;
  fundamento: string;
}

export interface ResultadoPrazo {
  disponibilizacao: string | null;
  publicacao: string;
  inicio_contagem: string;
  vencimento: string;
  dias: number;
  tipo_dias: 'uteis' | 'corridos';
  dias_nao_uteis_pulados: Array<{ data: string; motivo: string }>;
  etapas: EtapaPrazo[];
  fundamento_legal: string[];
}

export interface RespostaCalculoPrazo {
  prazo: ResultadoPrazo;
  aviso: string | null;
  calendario: { tem_feriado_local: boolean; feriados_cadastrados_no_ano: number };
}

export interface RespostaChat {
  resposta: string;
  fundamento?: string[];
  fundamentoCPC?: string;
  acao_sugerida?: { tipo: string; rotulo: string; payload?: Record<string, unknown> };
  modo: string;
}

export interface Feriado {
  id: string;
  nome: string;
  data: string;
  abrangencia: string;
  uf?: string | null;
  municipio?: string | null;
  orgao?: string | null;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  // -- Autenticacao --------------------------------------------------------

  login: async (email: string, senha: string): Promise<UsuarioSessao> => {
    const res = await request<{ token: string; user: UsuarioSessao }>('/auth/login', {
      method: 'POST',
      body: { email, senha },
      silencioso: true, // a tela de login mostra o erro no proprio formulario
    });
    sessao.salvar(res.token, res.user);
    return res.user;
  },

  logout: (): void => sessao.limpar(),

  getMe: async (): Promise<UsuarioSessao> => {
    const res = await request<{ user: UsuarioSessao }>('/auth/me', { silencioso: true });
    return res.user;
  },

  // -- Processos -----------------------------------------------------------

  getProcessos: async (): Promise<Processo[]> => {
    const data = await request<any>('/processos?limit=200');
    return lista<any>(data, 'processos').map(paraProcesso);
  },

  createProcesso: async (novo: Partial<Processo>): Promise<Processo> => {
    const partes = [
      ...(novo.autor ? [{ nome: novo.autor, papel: 'Autor' }] : []),
      ...(novo.reu ? [{ nome: novo.reu, papel: 'Reu' }] : []),
    ];
    const res = await request<any>('/processos', {
      method: 'POST',
      body: {
        cnj: novo.cnj ?? '',
        titulo: novo.titulo ?? '',
        cliente: novo.autor || novo.clienteId || '',
        orgao: novo.tribunal ?? '',
        instancia: novo.fase ?? '',
        vara: novo.vara ?? '',
        comarca: novo.comarca ?? '',
        status: 'Em Andamento',
        valor_causa: novo.valorCausa ?? 0,
        partes,
      },
    });
    return paraProcesso(res.processo ?? res);
  },

  /** Pre-preenchimento pelo DataJud. Nao grava nada. */
  consultarCnj: async (
    cnj: string
  ): Promise<{
    cnj: string;
    tribunal: { sigla: string; uf: string | null; segmento: string };
    sugestao: {
      titulo: string;
      orgao: string;
      vara: string;
      sistema: string;
      data_distribuicao: string | null;
    };
    total_movimentos: number;
  }> =>
    request(`/processos/consultar-cnj?cnj=${encodeURIComponent(cnj)}`, { silencioso: true }),

  getProcessoDetalhe: async (id: string): Promise<any> => {
    const res = await request<any>(`/processos/${encodeURIComponent(id)}`);
    return res.processo;
  },

  getLinhaDoTempo: async (id: string): Promise<any[]> => {
    const res = await request<any>(`/processos/${encodeURIComponent(id)}/linha-do-tempo`);
    return Array.isArray(res?.eventos) ? res.eventos : [];
  },

  // -- Intimacoes ----------------------------------------------------------

  getIntimacoes: async (): Promise<Intimacao[]> => {
    const data = await request<any>('/intimacoes?limit=200');
    return lista<any>(data, 'intimacoes').map(paraIntimacao);
  },

  vincularIntimacao: async (
    id: string,
    opcoes: {
      processo_id?: string;
      criar_tarefa?: boolean;
      titulo_tarefa?: string;
      dias_prazo?: number;
      tipo_dias?: 'uteis' | 'corridos';
    }
  ): Promise<{ prazo: ResultadoPrazo | null; aviso_calendario: string | null; tarefa: any }> =>
    request(`/intimacoes/${encodeURIComponent(id)}/vincular`, { method: 'POST', body: opcoes }),

  arquivarIntimacao: async (id: string): Promise<void> => {
    await request(`/intimacoes/${encodeURIComponent(id)}/arquivar`, { method: 'PATCH' });
  },

  // -- Tarefas / Kanban ----------------------------------------------------

  getTarefas: async (): Promise<Tarefa[]> => {
    const data = await request<any>('/atividades?limit=200');
    return lista<any>(data, 'tarefas').map(paraTarefa);
  },

  createTarefa: async (tarefa: Partial<Tarefa>): Promise<Tarefa> => {
    const res = await request<any>('/atividades', {
      method: 'POST',
      body: {
        titulo: tarefa.titulo ?? '',
        descricao: tarefa.descricao ?? '',
        tipo: tarefa.tipo ?? 'Prazo',
        vencimento: tarefa.dataLimite ?? new Date().toISOString().slice(0, 10),
        prioridade: PRIORIDADE_FRONT[String(tarefa.prioridade)] ?? 'media',
        status: STATUS_TAREFA_FRONT[String(tarefa.status)] ?? 'a_fazer',
      },
    });
    return paraTarefa(res.tarefa ?? res);
  },

  updateTarefaStatus: async (id: string, status: Tarefa['status']): Promise<{ success: boolean }> => {
    await request(`/atividades/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status: STATUS_TAREFA_FRONT[String(status)] ?? 'a_fazer' },
    });
    return { success: true };
  },

  // -- Andamentos ----------------------------------------------------------

  getAndamentos: async (): Promise<Andamento[]> => {
    const data = await request<any>('/andamentos?limit=200');
    return lista<any>(data, 'andamentos').map(paraAndamento);
  },

  marcarAndamentoLido: async (id: string): Promise<void> => {
    await request(`/andamentos/${encodeURIComponent(id)}/lido`, {
      method: 'PATCH',
      body: { lido: true },
    });
  },

  // -- Pessoas e CRM -------------------------------------------------------

  getPessoas: async (): Promise<Pessoa[]> => {
    const data = await request<any>('/pessoas?limit=200');
    return lista<any>(data, 'pessoas').map(paraPessoa);
  },

  createPessoa: async (dados: Partial<Pessoa>): Promise<Pessoa> => {
    const res = await request<any>('/pessoas', {
      method: 'POST',
      body: {
        nome: dados.nome ?? '',
        cpf_cnpj: dados.cpfCnpj ?? '',
        tipo_cliente: TIPO_PESSOA_FRONT[String(dados.tipo)] ?? 'cliente',
        email: dados.email ?? '',
        telefone: dados.telefone ?? '',
        cidade_uf: dados.cidadeUf ?? '',
      },
      silencioso: true, // o modal mostra o erro no proprio formulario
    });
    return paraPessoa(res.pessoa ?? res);
  },

  getCRMAtendimentos: async (): Promise<CRMAtendimento[]> => {
    const data = await request<any>('/crm?limit=200');
    return lista<any>(data, 'atendimentos').map(paraAtendimento);
  },

  createCRMAtendimento: async (dados: Partial<CRMAtendimento>): Promise<CRMAtendimento> => {
    const res = await request<any>('/crm', {
      method: 'POST',
      body: {
        cliente_nome: dados.clienteNome ?? '',
        telefone: dados.telefone ?? '',
        assunto: dados.assunto ?? '',
        fase: FASE_CRM_FRONT[String(dados.fase)] ?? 'primeiro_contato',
        valor_estimado: dados.valorEstimado ?? 0,
        origem: dados.origem ?? '',
      },
    });
    return paraAtendimento(res.atendimento ?? res);
  },

  // -- Financeiro (restrito a socio e financeiro) --------------------------

  getTransacoes: async (): Promise<TransacaoFinanceira[]> => {
    const data = await request<any>('/financeiro/transacoes?limit=200');
    return lista<any>(data, 'transacoes').map(paraTransacao);
  },

  getContratosHonorarios: async (): Promise<ContratoHonorarios[]> => {
    const data = await request<any>('/financeiro/contratos?limit=200');
    return lista<any>(data, 'contratos').map(paraContrato);
  },

  getResumoFinanceiro: async (): Promise<Record<string, number>> => {
    const res = await request<any>('/financeiro/resumo');
    return res?.resumo ?? {};
  },

  // -- Documentos ----------------------------------------------------------

  getDocumentos: async (): Promise<DocumentoModel[]> => {
    const data = await request<any>('/documentos?limit=200');
    return lista<any>(data, 'documentos').map(paraDocumento);
  },

  getModelosPeca: async (): Promise<ModeloPeca[]> => {
    const data = await request<any>('/documentos/modelos?limit=200');
    return lista<any>(data, 'modelos').map(paraModeloPeca);
  },

  gerarPeca: async (
    modeloId: string,
    processoId?: string
  ): Promise<{
    conteudo: string;
    tags_nao_reconhecidas: string[];
    tags_sem_valor: string[];
  }> =>
    request('/documentos/gerar-peca', {
      method: 'POST',
      body: { modelo_id: modeloId, processo_id: processoId },
    }),

  // -- Central de captura --------------------------------------------------

  getCentralCapturaStatus: async (): Promise<CentralCaptura> => {
    const res = await request<any>('/captura/status');
    const s = res?.status ?? {};

    // Sem franquia cadastrada o backend devolve configurado: false. A tela
    // precisa distinguir "nao configurado" de "conectado" - antes o cliente
    // preenchia 'Conectado' por padrao mesmo sem nada cadastrado.
    return {
      oabLote: s.oab_lote ?? '',
      ufOab: s.uf_oab ?? '',
      statusConexao: s.configurado
        ? s.monitoramentos_com_erro > 0
          ? 'Erro'
          : 'Conectado'
        : 'Reconectando',
      totalProcessosMonitorados: Number(s.total_processos_monitorados ?? 0),
      cadastroAutomatico: true,
      capturaDocumentosAuto: true,
      franquiaCapturaAtiva: Boolean(s.franquia_ativa),
      creditosRestantes: Number(s.creditos_restantes ?? 0),
    };
  },

  sincronizarDjen: async (
    oab_uf?: string
  ): Promise<{
    message: string;
    capturadas: number;
    novas: number;
    vinculadas: number;
    sem_processo: number;
  }> => request('/captura/sincronizar-djen', { method: 'POST', body: { oab_uf } }),

  sincronizarDatajud: async (
    cnj: string
  ): Promise<{
    message: string;
    processoId: string;
    movimentosNovos: number;
    movimentosRecebidos: number;
    tribunal: string;
  }> => request('/captura/sincronizar-cnj', { method: 'POST', body: { cnj } }),

  salvarFranquia: async (dados: {
    termo_oab: string;
    nome_pesquisado?: string;
    ufs?: string;
    contratadas?: number;
  }): Promise<any> => request('/captura/franquia', { method: 'PUT', body: dados }),

  // -- Flow ------------------------------------------------------------

  chatIA: async (prompt: string, contextoProcessoId?: string): Promise<RespostaChat> => {
    const res = await request<RespostaChat>('/assistente/chat', {
      method: 'POST',
      body: { prompt, contexto_processo_id: contextoProcessoId },
    });
    return {
      ...res,
      fundamentoCPC: Array.isArray(res.fundamento) ? res.fundamento.join(' | ') : undefined,
    };
  },

  calcularPrazo: async (dados: {
    data_disponibilizacao?: string;
    data_publicacao?: string;
    dias_prazo: number;
    tipo_dias?: 'uteis' | 'corridos';
    uf?: string;
    municipio?: string;
  }): Promise<RespostaCalculoPrazo> =>
    request('/assistente/calcular-prazo', { method: 'POST', body: dados }),

  // -- Calendario forense --------------------------------------------------

  getFeriados: async (
    ano: number
  ): Promise<{
    feriados: Feriado[];
    nacionais: Array<{ data: string; nome: string; movel: boolean }>;
    recesso_forense: { inicio: string; fim: string; fundamento: string };
  }> => {
    const res = await request<any>(`/feriados?ano=${ano}&limit=200`);
    return {
      feriados: lista<Feriado>(res, 'feriados'),
      nacionais: Array.isArray(res?.nacionais) ? res.nacionais : [],
      recesso_forense: res?.recesso_forense ?? { inicio: '', fim: '', fundamento: '' },
    };
  },

  createFeriado: async (dados: {
    nome: string;
    data: string;
    abrangencia: 'estadual' | 'municipal' | 'forense';
    uf?: string;
    municipio?: string;
    orgao?: string;
  }): Promise<Feriado> => {
    const res = await request<any>('/feriados', { method: 'POST', body: dados });
    return res.feriado;
  },

  deleteFeriado: async (id: string): Promise<void> => {
    await request(`/feriados/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  verificarDiaUtil: async (
    data: string,
    uf?: string
  ): Promise<{ data: string; dia_util: boolean; motivo: string | null; proximo_dia_util: string }> =>
    request(
      `/feriados/verificar-dia?data=${encodeURIComponent(data)}${uf ? `&uf=${uf}` : ''}`,
      { silencioso: true }
    ),

  // -- Configuracoes -------------------------------------------------------

  getAuditLogs: async (): Promise<any[]> => {
    const data = await request<any>('/configuracoes/audit-logs?limit=100');
    return lista<any>(data, 'logs');
  },

  getCertificados: async (): Promise<{
    certificados: any[];
    expirando: number;
    expirados: number;
    aviso_escopo: string;
  }> => request('/configuracoes/certificados'),

  addCertificado: async (dados: {
    advogado_nome: string;
    oab: string;
    validade: string;
  }): Promise<any> => request('/configuracoes/certificados', { method: 'POST', body: dados }),

  getUsuarios: async (): Promise<{ usuarios: any[]; cargos_disponiveis: string[] }> =>
    request('/configuracoes/usuarios'),

  createUsuario: async (dados: {
    nome: string;
    email: string;
    senha: string;
    cargo: string;
    oab?: string;
  }): Promise<any> => request('/configuracoes/usuarios', { method: 'POST', body: dados }),

  // -- Dashboard -----------------------------------------------------------

  getDashboardKpis: async (): Promise<any> => request('/dashboard/kpis'),
  getDashboardAgenda: async (): Promise<any> => request('/dashboard/agenda'),
};
