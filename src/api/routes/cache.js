/**
 * Rotas de cache
 * Endpoints para gerenciamento de cache híbrido (banco + memória)
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Endpoints:
 * - GET /api/cache/status - Status do cache (memória, banco, universal)
 * - GET /api/cache/universal - Cache universal (desabilitado por padrão)
 * - POST /api/cache/rebuild - Reconstruir cache universal
 * - POST /api/cache/clean-expired - Limpar entradas expiradas
 * - POST /api/cache/clear-all - Limpar todo o cache
 * - POST /api/cache/clear - Limpar cache em memória
 * 
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as cacheController from '../controllers/cacheController.js';

export default function cacheRoutes() {
  const router = express.Router();
  
  /**
   * GET /api/cache/status
   * Status completo do cache (memória, banco de dados, universal)
   */
  router.get('/status', (req, res) => cacheController.getCacheStatus(req, res));
  
  /**
   * GET /api/cache/universal
   * Cache universal (desabilitado por padrão)
   */
  router.get('/universal', (req, res) => cacheController.getUniversal(req, res));
  
  /**
   * POST /api/cache/rebuild
   * Reconstruir cache universal manualmente
   */
  router.post('/rebuild', (req, res) => cacheController.rebuildCache(req, res));
  
  /**
   * POST /api/cache/clean-expired
   * Limpar entradas de cache expiradas
   */
  router.post('/clean-expired', (req, res) => cacheController.cleanExpired(req, res));
  
  /**
   * POST /api/cache/clear-all
   * Limpar todo o cache (memória + banco de dados)
   */
  router.post('/clear-all', (req, res) => cacheController.clearAll(req, res));
  
  /**
   * POST /api/cache/clear
   * Limpar cache em memória (compatibilidade)
   */
  router.post('/clear', (req, res) => cacheController.clearMemory(req, res));
  
  return router;
}

