/**
 * Rotas de Batch Requests
 * 
 * Endpoints:
 * - POST /api/batch - Executar múltiplas requisições em uma chamada
 * - GET /api/batch/endpoints - Listar endpoints disponíveis
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as batchController from '../controllers/batchController.js';

export default function batchRoutes(prisma, getMongoClient) {
  const router = express.Router();
  
  /**
   * POST /api/batch
   * Executar múltiplas requisições em uma única chamada HTTP
   * 
   * Body:
   * {
   *   "requests": [
   *     { "name": "overview", "filters": {...} },
   *     { "name": "status", "filters": {...} }
   *   ],
   *   "options": {
   *     "parallel": true,
   *     "timeout": 30000,
   *     "compress": false
   *   }
   * }
   * 
   * Response:
   * {
   *   "results": {
   *     "overview": {...},
   *     "status": [...]
   *   },
   *   "errors": {
   *     "tema": "Error message"
   *   },
   *   "meta": {
   *     "total": 2,
   *     "success": 1,
   *     "failed": 1,
   *     "duration": "150ms",
   *     "parallel": true
   *   }
   * }
   */
  router.post('/', (req, res) => batchController.batch(req, res, null, getMongoClient)); // REFATORAÇÃO: prisma não usado mais
  
  /**
   * GET /api/batch/endpoints
   * Listar endpoints disponíveis para batch
   * 
   * Response:
   * {
   *   "endpoints": [
   *     {
   *       "name": "overview",
   *       "description": "Pipeline de agregação para overview",
   *       "supportsFilters": true,
   *       "cacheTTL": 5
   *     },
   *     ...
   *   ],
   *   "maxRequests": 50,
   *   "defaultTimeout": 30000,
   *   "supportsParallel": true,
   *   "supportsCompression": true
   * }
   */
  router.get('/endpoints', (req, res) => batchController.listEndpoints(req, res));
  
  return router;
}

