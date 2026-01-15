/**
 * Rotas de Notificações por Email
 * 
 * REFATORAÇÃO: Mongoose (sem prisma)
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import express from 'express';
import {
  getAuthUrlEndpoint,
  authCallback,
  getAuthStatus,
  executeNotifications,
  getNotificationHistory,
  getNotificationStats,
  getEmailConfig,
  getSchedulerStatus,
  executeSchedulerManual,
  testEmail
} from '../controllers/notificationController.js';

export default function notificationRoutes() {
  const router = express.Router();

/**
 * Rotas de autenticação
 */
router.get('/auth/url', getAuthUrlEndpoint);
router.post('/auth/callback', authCallback);
router.get('/auth/status', getAuthStatus);

/**
 * Rotas de execução
 * REFATORAÇÃO: Mongoose (sem prisma)
 */
router.post('/execute', (req, res) => executeNotifications(req, res));
router.post('/scheduler/execute', (req, res) => executeSchedulerManual(req, res));

/**
 * Rotas de consulta
 * REFATORAÇÃO: Mongoose (sem prisma)
 */
router.get('/history', (req, res) => getNotificationHistory(req, res));
router.get('/stats', (req, res) => getNotificationStats(req, res));
router.get('/config', getEmailConfig);
router.get('/scheduler/status', getSchedulerStatus);

/**
 * Rota de teste
 */
router.get('/test', testEmail);

return router;
}

