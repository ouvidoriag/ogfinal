/**
 * Rotas de dados gerais
 * Endpoints principais para acesso a dados do sistema
 * 
 * Endpoints:
 * - GET /api/summary - Resumo geral com KPIs
 * - GET /api/dashboard-data - Dados completos para dashboard
 * - GET /api/records - Lista paginada de registros
 * - GET /api/distinct - Valores distintos de um campo
 * - GET /api/unit/:unitName - Dados de uma unidade específica
 * - GET /api/complaints-denunciations - Reclamações e denúncias
 * - GET /api/sla/summary - Resumo de SLA (concluídos, verde, amarelo, vermelho)
 * - POST /api/filter - Filtro dinâmico de registros
 * - GET /api/meta/aliases - Metadados e aliases de campos
 * - POST /api/chat/reindex - Reindexar contexto do chat
 * - GET /api/export/database - Exportar dados do banco
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import { getSummary } from '../controllers/summaryController.js';
import { getDashboardData } from '../controllers/dashboardController.js';
import { getRecords } from '../controllers/recordsController.js';
import { getDistinct } from '../controllers/distinctController.js';
import { getUnit } from '../controllers/unitController.js';
import { getComplaints } from '../controllers/complaintsController.js';
import { slaSummary } from '../controllers/slaController.js';
import { filterRecords, filterAndAggregate } from '../controllers/filterController.js';
import { getVencimento } from '../controllers/vencimentoController.js';
import { getSecretariasInfo, getSecretariaInfoById } from '../controllers/secretariaInfoController.js';
import { getNotificacoes, getNotificacoesStats, getUltimaExecucao, buscarVencimentos, enviarSelecionados, enviarEmailExtra, getMesesDisponiveis } from '../controllers/notificacoesController.js';
import { getMetaAliases, reindexChat, exportDatabase } from '../controllers/utilsController.js';

export default function dataRoutes(prisma, getMongoClient) {
  const router = express.Router();
  
  /**
   * GET /api/summary
   * Resumo geral com KPIs principais
   * Query params: servidor, unidadeCadastro
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/summary', (req, res) => getSummary(req, res));
  
  /**
   * GET /api/dashboard-data
   * Dados completos para dashboard (agregações otimizadas com MongoDB Native)
   * Query params: servidor, unidadeCadastro
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/dashboard-data', (req, res) => getDashboardData(req, res, getMongoClient));
  
  /**
   * GET /api/records
   * Lista paginada de registros
   * Query params: page, limit, servidor, unidadeCadastro
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/records', (req, res) => getRecords(req, res));
  
  /**
   * GET /api/distinct
   * Valores distintos de um campo
   * Query params: field, servidor, unidadeCadastro
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/distinct', (req, res) => getDistinct(req, res));
  
  /**
   * GET /api/unit/:unitName
   * Dados de uma unidade específica (UAC, Responsável, Órgãos, Unidade de Saúde)
   * Params: unitName - Nome da unidade
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/unit/:unitName', (req, res) => getUnit(req, res));
  
  /**
   * GET /api/complaints-denunciations
   * Reclamações e denúncias agregadas
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/complaints-denunciations', (req, res) => getComplaints(req, res));
  
  /**
   * GET /api/sla/summary
   * Resumo de SLA (concluídos, verde claro 0-30, amarelo 31-60, vermelho 61+)
   * Query params: servidor, unidadeCadastro, meses
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/sla/summary', (req, res) => slaSummary(req, res));
  
  /**
   * GET /api/vencimento
   * Protocolos próximos de vencer ou já vencidos
   * Query params: filtro (vencidos, 3, 7, 15, 30), servidor, unidadeCadastro
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/vencimento', (req, res) => getVencimento(req, res));
  
  /**
   * GET /api/secretarias-info
   * Lista informações de contato das secretarias (planilha Dados e emails.xlsx)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/secretarias-info', (req, res) => getSecretariasInfo(req, res));

  /**
   * GET /api/secretarias-info/:id
   * Detalhes de uma secretaria específica
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/secretarias-info/:id', (req, res) => getSecretariaInfoById(req, res));

  /**
   * GET /api/notificacoes
   * Lista notificações de email enviadas com filtros
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/notificacoes', (req, res) => getNotificacoes(req, res));

  /**
   * GET /api/notificacoes/meses-disponiveis
   * Lista meses únicos com notificações (para popular select)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/notificacoes/meses-disponiveis', (req, res) => getMesesDisponiveis(req, res));

  /**
   * GET /api/notificacoes/stats
   * Estatísticas de notificações
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/notificacoes/stats', (req, res) => getNotificacoesStats(req, res));

  /**
   * GET /api/notificacoes/ultima-execucao
   * Verifica última execução do cron
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/notificacoes/ultima-execucao', (req, res) => getUltimaExecucao(req, res));

  /**
   * GET /api/notificacoes/vencimentos
   * Busca vencimentos sem enviar (apenas visualização, otimizado)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/notificacoes/vencimentos', (req, res) => buscarVencimentos(req, res));

  /**
   * POST /api/notificacoes/enviar-selecionados
   * Envia emails para secretarias selecionadas
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.post('/notificacoes/enviar-selecionados', (req, res) => enviarSelecionados(req, res));
  
  /**
   * POST /api/notificacoes/enviar-extra
   * Envia email extra para emails informados manualmente
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.post('/notificacoes/enviar-extra', (req, res) => enviarEmailExtra(req, res));
  
  /**
   * POST /api/filter
   * Filtro dinâmico de registros
   * Body: { filters: [{ field, op, value }], originalUrl }
   */
  /**
   * POST /api/filter
   * Filtro dinâmico de registros (otimizado com MongoDB Native)
   * Query params opcionais: cursor, pageSize (para paginação)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.post('/filter', (req, res) => filterRecords(req, res, getMongoClient));
  
  /**
   * POST /api/filter/aggregated
   * Filtra registros e retorna dados agregados (solução definitiva)
   * Body: { filters: [{ field, op, value }] }
   * Retorna: { totalManifestations, manifestationsByStatus, manifestationsByTheme, ... }
   * SOLUÇÃO DEFINITIVA: Agregação no backend usando MongoDB aggregation pipeline
   */
  router.post('/filter/aggregated', (req, res) => filterAndAggregate(req, res, getMongoClient));
  
  /**
   * GET /api/meta/aliases
   * Metadados e aliases de campos do sistema
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/meta/aliases', (req, res) => getMetaAliases(req, res));
  
  /**
   * POST /api/chat/reindex
   * Reindexar contexto do chat para busca semântica
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.post('/chat/reindex', (req, res) => reindexChat(req, res));
  
  /**
   * GET /api/export/database
   * Exportar dados do banco de dados
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/export/database', (req, res) => exportDatabase(req, res));
  
  return router;
}

