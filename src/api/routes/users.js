/**
 * Rotas de Gestão de Usuários
 * Protegidas por Admin (Nível 1)
 */

import express from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas as rotas aqui requerem que o usuário seja Admin
router.use(requireAuth);
router.use(requireRole('admin'));

// GET /api/users - Listar usuários
router.get('/', userController.getAllUsers);

// PUT /api/users/:id/role - Atualizar role
router.put('/:id/role', userController.updateUserRole);

export default router;
