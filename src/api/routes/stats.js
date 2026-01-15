/**
 * Rotas de estatísticas
 * Endpoints para análises estatísticas e métricas de tempo
 * 
 * Endpoints:
 * - GET /api/stats/average-time - Tempo médio de resolução
 * - GET /api/stats/average-time/by-day - Tempo médio por dia
 * - GET /api/stats/average-time/by-week - Tempo médio por semana
 * - GET /api/stats/average-time/by-month - Tempo médio por mês
 * - GET /api/stats/average-time/stats - Estatísticas de tempo (média, mediana, etc.)
 * - GET /api/stats/average-time/by-unit - Tempo médio por unidade
 * - GET /api/stats/average-time/by-month-unit - Tempo médio por mês e unidade
 * - GET /api/stats/status-overview - Visão geral de status
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as statsController from '../controllers/statsController.js';

export default function statsRoutes(prisma, getMongoClient) {
  const router = express.Router();
  
  /**
   * GET /api/stats/average-time
   * Tempo médio de resolução de manifestações
   * Query params: servidor, unidadeCadastro, meses, apenasConcluidos, incluirZero
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time', (req, res) => statsController.averageTime(req, res));
  
  /**
   * GET /api/stats/average-time/by-day
   * Tempo médio agrupado por dia
   * Query params: servidor, unidadeCadastro, startDate, endDate
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/by-day', (req, res) => statsController.averageTimeByDay(req, res));
  
  /**
   * GET /api/stats/average-time/by-week
   * Tempo médio agrupado por semana
   * Query params: servidor, unidadeCadastro, startDate, endDate
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/by-week', (req, res) => statsController.averageTimeByWeek(req, res));
  
  /**
   * GET /api/stats/average-time/by-month
   * Tempo médio agrupado por mês
   * Query params: servidor, unidadeCadastro, meses
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/by-month', (req, res) => statsController.averageTimeByMonth(req, res));
  
  /**
   * GET /api/stats/average-time/stats
   * Estatísticas completas de tempo (média, mediana, min, max, desvio padrão)
   * Query params: servidor, unidadeCadastro, meses, apenasConcluidos
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/stats', (req, res) => statsController.averageTimeStats(req, res));
  
  /**
   * GET /api/stats/average-time/by-unit
   * Tempo médio agrupado por unidade
   * Query params: servidor, unidadeCadastro, meses, apenasConcluidos
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/by-unit', (req, res) => statsController.averageTimeByUnit(req, res));
  
  /**
   * GET /api/stats/average-time/by-month-unit
   * Tempo médio agrupado por mês e unidade (matriz)
   * Query params: servidor, unidadeCadastro, meses, apenasConcluidos
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/average-time/by-month-unit', (req, res) => statsController.averageTimeByMonthUnit(req, res));
  
  /**
   * GET /api/stats/status-overview
   * Visão geral de status com distribuição
   * Query params: servidor, unidadeCadastro
   * OTIMIZAÇÃO: Usa pipeline MongoDB nativo
   * REFATORAÇÃO: Mongoose (sem prisma)
   */
  router.get('/status-overview', (req, res) => statsController.statusOverview(req, res, getMongoClient));
  
  return router;
}

