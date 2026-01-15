/**
 * Rotas de Sincronização de Dados
 * 
 * Endpoints:
 * - POST /api/data-sync/execute - Executar atualização manual
 * - GET /api/data-sync/status - Status do scheduler
 * 
 * CÉREBRO X-3
 * Data: 2025-01-XX
 */

import express from 'express';
import {
  executeDataSync,
  getDataSyncStatus
} from '../controllers/dataSyncController.js';

export default function dataSyncRoutes() {
  const router = express.Router();
  
  /**
   * POST /api/data-sync/execute
   * Executar atualização manual de dados do Google Sheets
   */
  router.post('/execute', executeDataSync);
  
  /**
   * GET /api/data-sync/status
   * Obter status do scheduler de atualização
   */
  router.get('/status', getDataSyncStatus);
  
  return router;
}

