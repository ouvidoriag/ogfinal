/**
 * Controller de Usuários
 * Gerencia listagem e atualização de usuários (Admin apenas)
 * 
 * CÉREBRO X-3
 * Data: 09/01/2026
 */

import User from '../../models/User.model.js';
import logger from '../../utils/logger.js';

/**
 * GET /api/users
 * Lista todos os usuários (Admin apenas)
 */
export async function getAllUsers(req, res) {
    try {
        const users = await User.find({})
            .select('-password') // Nunca retornar a senha
            .sort({ createdAt: -1 })
            .lean();

        res.json({
            success: true,
            users: users.map(user => ({
                ...user,
                id: user._id.toString()
            }))
        });
    } catch (error) {
        logger.error('Erro ao listar usuários:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar usuários'
        });
    }
}

/**
 * PUT /api/users/:id/role
 * Atualiza o papel de um usuário (Admin apenas)
 */
export async function updateUserRole(req, res) {
    try {
        const { id } = req.params;
        const { role } = req.body;

        // Validar se role é válida
        const validRoles = ['admin', 'manager', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Nível de acesso inválido'
            });
        }

        // Não permitir que o usuário mude a própria role (opcional, mas seguro)
        // No entanto, se for o 'master', ele deve poder (ou não deve poder se rebaixar)
        if (req.session.userId === id && role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Você não pode rebaixar seu próprio nível de acesso'
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { role } },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado'
            });
        }

        logger.info(`Nível de acesso do usuário ${updatedUser.username} alterado para ${role} por ${req.session.username}`);

        res.json({
            success: true,
            message: 'Nível de acesso atualizado com sucesso',
            user: updatedUser
        });
    } catch (error) {
        logger.error('Erro ao atualizar papel do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao atualizar nível de acesso'
        });
    }
}
