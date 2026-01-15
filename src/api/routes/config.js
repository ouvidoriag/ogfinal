/**
 * Rotas de Configurações Administrativas
 * 
 * CÉREBRO X-3
 * Data: 17/12/2025
 */

import express from 'express';
import {
  getConfig,
  getCacheConfig,
  saveCacheConfig,
  clearCache,
  getNotificationsConfig,
  saveNotificationsConfig,
  getIntegrationsStatus,
  getSLAConfig,
  saveSLAConfig,
  getSecretariasList,
  updateSecretariaEmail,
  testSecretariaEmail,
  getSystemStats,
  executePipeline,
  downloadPlanilha,
  previewDownload
} from '../controllers/configController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(requireAuth);

// Rotas principais
router.get('/', getConfig);

// Rotas de Cache
router.get('/cache', getCacheConfig);
router.post('/cache', saveCacheConfig);
router.post('/cache/clear', clearCache);

// Rotas de Notificações
router.get('/notifications', getNotificationsConfig);
router.post('/notifications', saveNotificationsConfig);

// Rotas de Integrações
router.get('/integrations', getIntegrationsStatus);

// Rotas de SLA
router.get('/sla', getSLAConfig);
router.post('/sla', saveSLAConfig);

// Rotas de Secretarias
router.get('/secretarias', getSecretariasList);
router.post('/secretarias/:id', updateSecretariaEmail);
router.post('/secretarias/:id/test-email', testSecretariaEmail);

// Rotas de Estatísticas
router.get('/system-stats', getSystemStats);

// Rotas de Pipeline
router.post('/pipeline/execute', executePipeline);

// Rotas de Download (ordem importante: rotas mais específicas primeiro)
router.post('/download/preview', previewDownload);
router.post('/download', downloadPlanilha);

export default router;


