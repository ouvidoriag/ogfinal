/**
 * Rotas de IA
 * Endpoints para inteligência artificial e insights
 * 
 * Endpoints:
 * - GET /api/ai/insights - Gerar insights com IA
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import { getInsights } from '../controllers/aiController.js';

export default function aiRoutes(prisma, getMongoClient) {
  const router = express.Router();
  
  /**
   * GET /api/ai/insights
   * Gerar insights inteligentes usando IA
   * Query params: servidor, unidadeCadastro
   * 
   * Retorna:
   * - insights: Array de insights gerados pela IA
   * - patterns: Padrões detectados nos dados
   * - geradoPorIA: Boolean indicando se foi gerado por IA ou fallback
   */
  router.get('/insights', (req, res) => getInsights(req, res)); // REFATORAÇÃO: prisma removido
  
  return router;
}

