/**
 * Rotas de chat
 * Endpoints para sistema de mensagens e chat
 * 
 * Endpoints:
 * - GET /api/chat/messages - Listar mensagens do chat
 * - POST /api/chat/messages - Criar nova mensagem
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @returns {express.Router} Router configurado
 */

import express from 'express';
import * as chatController from '../controllers/chatController.js';

export default function chatRoutes(prisma) {
  const router = express.Router();
  
  /**
   * GET /api/chat/messages
   * Listar todas as mensagens do chat
   * Query params: limit (opcional, padrão: 500)
   */
  router.get('/messages', (req, res) => chatController.getMessages(req, res)); // REFATORAÇÃO: prisma removido
  
  /**
   * POST /api/chat/messages
   * Criar nova mensagem no chat
   * Body: { text: string, sender: 'user' | 'assistant' }
   */
  router.post('/messages', (req, res) => chatController.createMessage(req, res)); // REFATORAÇÃO: prisma removido
  
  /**
   * GET /api/chat/export
   * Exportar conversas do usuário
   * Query params: context (opcional), format (json|csv|txt, padrão: json)
   * MELHORIA: Nova funcionalidade
   */
  router.get('/export', (req, res) => chatController.exportConversations(req, res));
  
  return router;
}

