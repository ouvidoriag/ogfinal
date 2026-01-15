/**
 * Rotas de Autenticação
 */

import express from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

export default function authRoutes(prisma) {
  const router = express.Router();

  // REFATORAÇÃO: Prisma → Mongoose (controllers já migrados, não precisam mais de prisma)
  // router.use removido - controllers não usam mais req.prisma

  // POST /api/auth/register
  router.post('/register', register);

  // POST /api/auth/login
  router.post('/login', login);

  // POST /api/auth/logout
  router.post('/logout', requireAuth, logout);

  // GET /api/auth/me - Informações do usuário autenticado
  // Não usa requireAuth para evitar loops de redirecionamento
  router.get('/me', getCurrentUser);

  return router;
}

