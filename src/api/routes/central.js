/**
 * Rotas do Painel Central
 * Endpoints para dados consolidados de todos os sistemas
 * 
 * CÉREBRO X-3
 */

import express from 'express';
import * as centralController from '../controllers/centralController.js';

export default function centralRoutes() {
  const router = express.Router();
  
  /**
   * GET /api/central/dashboard
   * Dashboard principal com dados consolidados
   */
  router.get('/dashboard', (req, res) => centralController.getDashboard(req, res));
  
  return router;
}

