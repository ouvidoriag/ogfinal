/**
 * Rotas de ESIC (e-SIC)
 * Endpoints para dados de e-SIC
 * 
 * Endpoints:
 * - GET /api/esic/summary - Resumo geral
 * - GET /api/esic/count-by - Contagem por campo
 * - GET /api/esic/by-month - Agregação por mês
 * - GET /api/esic/time-series - Série temporal
 * - GET /api/esic/records - Lista de registros
 * - GET /api/esic/stats - Estatísticas gerais
 * - GET /api/esic/by-status-month - Status por mês
 * - GET /api/esic/by-tipo-responsavel - Tipo de Informação por Responsável
 * - GET /api/esic/by-canal-unidade - Canal por Unidade
 * - GET /api/esic/categorias-por-assunto - Categoriza tipos de informação por assuntos
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as esicController from '../controllers/esicController.js';

export default function esicRoutes() {
  const router = express.Router();

  /**
   * GET /api/esic/summary
   * Resumo geral de dados de ESIC
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/summary', (req, res) => esicController.summary(req, res));

  /**
   * GET /api/esic/count-by
   * Contagem por campo
   * Query params: field (status, tipoInformacao, responsavel, etc.)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/count-by', (req, res) => esicController.countBy(req, res));

  /**
   * GET /api/esic/by-month
   * Agregação por mês
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/by-month', (req, res) => esicController.byMonth(req, res));

  /**
   * GET /api/esic/time-series
   * Série temporal
   * Query params: startDate, endDate (opcional)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/time-series', (req, res) => esicController.timeSeries(req, res));

  /**
   * GET /api/esic/records
   * Lista de registros com paginação
   * Query params: page, limit, status, tipoInformacao, responsavel, unidadeContato
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/records', (req, res) => esicController.records(req, res));

  /**
   * GET /api/esic/stats
   * Estatísticas gerais
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/stats', (req, res) => esicController.stats(req, res));

  /**
   * GET /api/esic/sla
   * Dashboard SLA (prazo)
   */
  router.get('/sla', (req, res) => esicController.sla(req, res));

  /**
   * GET /api/esic/by-status-month
   * Status por mês
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/by-status-month', (req, res) => esicController.byStatusMonth(req, res));

  /**
   * GET /api/esic/by-tipo-responsavel
   * Tipo de Informação por Responsável
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/by-tipo-responsavel', (req, res) => esicController.byTipoResponsavel(req, res));

  /**
   * GET /api/esic/by-canal-unidade
   * Canal por Unidade
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/by-canal-unidade', (req, res) => esicController.byCanalUnidade(req, res));

  /**
   * GET /api/esic/categorias-por-assunto
   * Categoriza tipos de pedidos de informação com base nos assuntos
   * Query params: limit (padrão: 50), tipoInformacao (opcional)
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/categorias-por-assunto', (req, res) => esicController.categoriasPorAssunto(req, res));

  return router;
}

