import { Router } from 'express';
import { authMiddleware, requireCargo } from '../middleware/auth';
import { logUserAction } from '../middleware/auditLogger';

import * as authController from '../controllers/authController';
import * as dashboardController from '../controllers/dashboardController';
import * as processosController from '../controllers/processosController';
import * as intimacoesController from '../controllers/intimacoesController';
import * as capturaController from '../controllers/capturaController';
import * as andamentosController from '../controllers/andamentosController';
import * as atividadesController from '../controllers/atividadesController';
import * as pessoasController from '../controllers/pessoasController';
import * as atendimentosController from '../controllers/atendimentosController';
import * as financeiroController from '../controllers/financeiroController';
import * as documentosController from '../controllers/documentosController';
import * as assistenteController from '../controllers/assistenteController';
import * as configuracoesController from '../controllers/configuracoesController';
import * as feriadosController from '../controllers/feriadosController';

const router = Router();

/**
 * Roteador da API do JuridFlow.
 *
 * Convencoes desta versao:
 *   - authMiddleware em tudo, exceto POST /auth/login
 *   - requireCargo nas rotas de financeiro e de administracao
 *   - logUserAction em toda rota que grava, e nas leituras de dado sensivel
 *     (trilha de auditoria e certificados)
 *   - nome de rota alinhado ao que o frontend chama, sem apelido duplicado
 */

// --------------------------------------------------------------------------
// Autenticacao
// --------------------------------------------------------------------------
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getMe);

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------
router.get('/dashboard/kpis', authMiddleware, dashboardController.getDashboardKpis);
router.get('/dashboard/agenda', authMiddleware, dashboardController.getDashboardAgenda);

// --------------------------------------------------------------------------
// Processos
// --------------------------------------------------------------------------
router.get('/processos', authMiddleware, processosController.getProcessos);
router.post(
  '/processos',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('CREATE', 'processo'),
  processosController.createProcesso
);
router.get('/processos/consultar-cnj', authMiddleware, processosController.consultarCnjParaCadastro);
router.get('/processos/:id', authMiddleware, processosController.getProcessoById);
router.get('/processos/:id/linha-do-tempo', authMiddleware, processosController.getLinhaDoTempo);

// --------------------------------------------------------------------------
// Intimacoes
// --------------------------------------------------------------------------
router.get('/intimacoes', authMiddleware, intimacoesController.getIntimacoes);
router.get('/intimacoes/franquia', authMiddleware, intimacoesController.getFranquiaIntimacoes);
router.post(
  '/intimacoes/:id/vincular',
  authMiddleware,
  requireCargo('socio', 'advogado', 'estagiario'),
  logUserAction('UPDATE', 'intimacao'),
  intimacoesController.vincularIntimacao
);
router.patch(
  '/intimacoes/:id/arquivar',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('UPDATE', 'intimacao'),
  intimacoesController.arquivarIntimacao
);

// --------------------------------------------------------------------------
// Central de captura (DJEN + DataJud)
// --------------------------------------------------------------------------
router.get('/captura', authMiddleware, capturaController.getCapturas);
router.get('/captura/status', authMiddleware, capturaController.getStatusCaptura);
router.post(
  '/captura',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('CREATE', 'captura'),
  capturaController.createCaptura
);
router.post(
  '/captura/sincronizar-djen',
  authMiddleware,
  requireCargo('socio', 'advogado', 'estagiario'),
  logUserAction('SYNC', 'captura_djen'),
  capturaController.sincronizarDjen
);
router.post(
  '/captura/sincronizar-cnj',
  authMiddleware,
  requireCargo('socio', 'advogado', 'estagiario'),
  logUserAction('SYNC', 'captura_datajud'),
  capturaController.sincronizarDatajud
);
router.put(
  '/captura/franquia',
  authMiddleware,
  requireCargo('socio'),
  logUserAction('UPDATE', 'franquia_captura'),
  capturaController.upsertFranquia
);

// --------------------------------------------------------------------------
// Andamentos
// --------------------------------------------------------------------------
router.get('/andamentos', authMiddleware, andamentosController.getAndamentos);
router.post(
  '/andamentos',
  authMiddleware,
  requireCargo('socio', 'advogado', 'estagiario'),
  logUserAction('CREATE', 'andamento'),
  andamentosController.createAndamento
);
router.patch(
  '/andamentos/:id/lido',
  authMiddleware,
  andamentosController.marcarComoLido
);

// --------------------------------------------------------------------------
// Atividades / Kanban
// --------------------------------------------------------------------------
router.get('/atividades', authMiddleware, atividadesController.getAtividades);
router.post(
  '/atividades',
  authMiddleware,
  logUserAction('CREATE', 'tarefa'),
  atividadesController.createAtividade
);
router.patch(
  '/atividades/:id/status',
  authMiddleware,
  logUserAction('UPDATE', 'tarefa'),
  atividadesController.updateStatusAtividade
);
router.delete(
  '/atividades/:id',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('DELETE', 'tarefa'),
  atividadesController.deleteAtividade
);

// --------------------------------------------------------------------------
// Pessoas
// --------------------------------------------------------------------------
router.get('/pessoas', authMiddleware, pessoasController.getPessoas);
router.post(
  '/pessoas',
  authMiddleware,
  logUserAction('CREATE', 'pessoa'),
  pessoasController.createPessoa
);
router.get('/pessoas/:id', authMiddleware, pessoasController.getPessoaById);

// --------------------------------------------------------------------------
// CRM / Atendimentos
// --------------------------------------------------------------------------
router.get('/crm', authMiddleware, atendimentosController.getAtendimentos);
router.post(
  '/crm',
  authMiddleware,
  logUserAction('CREATE', 'atendimento'),
  atendimentosController.createAtendimento
);
router.patch(
  '/crm/:id/fase',
  authMiddleware,
  logUserAction('UPDATE', 'atendimento'),
  atendimentosController.updateFase
);
router.post(
  '/crm/:id/converter-processo',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('CREATE', 'processo'),
  atendimentosController.converterEmProcesso
);

// --------------------------------------------------------------------------
// Financeiro - restrito a socio e financeiro
// --------------------------------------------------------------------------
router.get(
  '/financeiro/transacoes',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  financeiroController.getTransacoes
);
router.post(
  '/financeiro/transacoes',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  logUserAction('CREATE', 'financeiro'),
  financeiroController.createTransacao
);
router.patch(
  '/financeiro/transacoes/:id/baixa',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  logUserAction('UPDATE', 'financeiro'),
  financeiroController.baixarTransacao
);
router.get(
  '/financeiro/resumo',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  financeiroController.getResumo
);
router.get(
  '/financeiro/contratos',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  financeiroController.getContratos
);
router.post(
  '/financeiro/contratos',
  authMiddleware,
  requireCargo('socio', 'financeiro'),
  logUserAction('CREATE', 'contrato'),
  financeiroController.createContrato
);

// --------------------------------------------------------------------------
// Documentos e modelos
// --------------------------------------------------------------------------
router.get('/documentos', authMiddleware, documentosController.getDocumentos);
router.post(
  '/documentos',
  authMiddleware,
  logUserAction('CREATE', 'documento'),
  documentosController.createDocumento
);
router.get('/documentos/modelos', authMiddleware, documentosController.getModelosDocumento);
router.post(
  '/documentos/gerar-peca',
  authMiddleware,
  requireCargo('socio', 'advogado', 'estagiario'),
  logUserAction('CREATE', 'peca'),
  documentosController.gerarPeca
);

// --------------------------------------------------------------------------
// Flow
// --------------------------------------------------------------------------
router.post('/assistente/chat', authMiddleware, assistenteController.chatAssistente);
router.post('/assistente/calcular-prazo', authMiddleware, assistenteController.calcularPrazoAssistente);

// --------------------------------------------------------------------------
// Calendario forense
// --------------------------------------------------------------------------
router.get('/feriados', authMiddleware, feriadosController.getFeriados);
router.get('/feriados/verificar-dia', authMiddleware, feriadosController.verificarDia);
router.post(
  '/feriados',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('CREATE', 'feriado'),
  feriadosController.createFeriado
);
router.delete(
  '/feriados/:id',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('DELETE', 'feriado'),
  feriadosController.deleteFeriado
);

// --------------------------------------------------------------------------
// Configuracoes, usuarios e auditoria
// --------------------------------------------------------------------------
router.get(
  '/configuracoes/certificados',
  authMiddleware,
  logUserAction('VIEW', 'certificado'),
  configuracoesController.getCertificados
);
router.post(
  '/configuracoes/certificados',
  authMiddleware,
  requireCargo('socio', 'advogado'),
  logUserAction('CREATE', 'certificado'),
  configuracoesController.addCertificado
);
router.get(
  '/configuracoes/audit-logs',
  authMiddleware,
  requireCargo('socio'),
  logUserAction('VIEW', 'audit_log'),
  configuracoesController.getAuditLogs
);
router.get(
  '/configuracoes/usuarios',
  authMiddleware,
  requireCargo('socio'),
  configuracoesController.getUsuarios
);
router.post(
  '/configuracoes/usuarios',
  authMiddleware,
  requireCargo('socio'),
  logUserAction('CREATE', 'usuario'),
  configuracoesController.createUsuario
);
router.patch(
  '/configuracoes/usuarios/:id/ativo',
  authMiddleware,
  requireCargo('socio'),
  logUserAction('UPDATE', 'usuario'),
  configuracoesController.setUsuarioAtivo
);

export default router;
