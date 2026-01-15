/**
 * Rotas de Métricas
 * 
 * Endpoints:
 * - GET /api/metrics - Obter métricas do sistema
 * - GET /api/metrics/reset - Resetar métricas (apenas desenvolvimento)
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as metricsController from '../controllers/metricsController.js';

export default function metricsRoutes(prisma) {
  const router = express.Router();
  
  /**
   * GET /api/metrics
   * Obter métricas completas do sistema
   * 
   * Response:
   * {
   *   "cache": {
   *     "hits": 1234,
   *     "misses": 56,
   *     "hitRate": "95.67%",
   *     "total": 100,
   *     "active": 95,
   *     "expired": 5
   *   },
   *   "pipelines": {
   *     "total": 5000,
   *     "errors": 10,
   *     "errorRate": "0.2%",
   *     "perMinute": "125.5"
   *   },
   *   "endpoints": [
   *     {
   *       "endpoint": "overview",
   *       "calls": 1000,
   *       "avgDuration": "85ms",
   *       "minDuration": "50ms",
   *       "maxDuration": "200ms",
   *       "percentiles": {
   *         "p50": 80,
   *         "p75": 95,
   *         "p90": 120,
   *         "p95": 150,
   *         "p99": 180
   *       },
   *       "errorRate": "0.1%",
   *       "errors": 1
   *     }
   *   ],
   *   "slowQueries": [...],
   *   "system": {
   *     "uptime": "24.5h",
   *     "startTime": "2025-11-28T10:00:00.000Z"
   *   }
   * }
   */
  router.get('/', (req, res) => metricsController.getMetrics(req, res)); // REFATORAÇÃO: prisma removido
  
  /**
   * GET /api/metrics/reset
   * Resetar métricas (apenas em desenvolvimento)
   */
  router.get('/reset', (req, res) => metricsController.resetMetrics(req, res));
  
  return router;
}

