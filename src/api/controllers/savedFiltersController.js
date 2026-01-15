/**
 * Controller: Saved Filters
 * API para gerenciar filtros salvos por usuário
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import SavedFilter from '../../models/SavedFilter.model.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/saved-filters
 * Listar filtros salvos do usuário
 */
export async function getSavedFilters(req, res) {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const { favorite, recent, limit = 50 } = req.query;

    let filters;

    if (favorite === 'true') {
      filters = await SavedFilter.findFavorites(userId);
    } else if (recent === 'true') {
      const limitNum = parseInt(limit) || 10;
      filters = await SavedFilter.findRecent(userId, limitNum);
    } else {
      filters = await SavedFilter.findByUser(userId);
    }

    logger.info(`Filtros salvos recuperados para ${username}`, {
      userId,
      count: filters.length,
      favorite: favorite === 'true',
      recent: recent === 'true'
    });

    res.json({
      success: true,
      filters: filters.map(f => ({
        id: f._id.toString(),
        name: f.name,
        description: f.description,
        filters: f.filters,
        isComposite: f.isComposite,
        isFavorite: f.isFavorite,
        tags: f.tags,
        usageCount: f.usageCount,
        lastUsed: f.lastUsed,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt
      }))
    });
  } catch (error) {
    logger.error('Erro ao buscar filtros salvos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar filtros salvos',
      error: error.message
    });
  }
}

/**
 * POST /api/saved-filters
 * Salvar novo filtro
 */
export async function saveFilter(req, res) {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const { name, description, filters, isComposite, isFavorite, tags } = req.body;

    if (!name || !filters) {
      return res.status(400).json({
        success: false,
        message: 'Nome e filtros são obrigatórios'
      });
    }

    // Validar estrutura de filtros
    if (isComposite) {
      // Validar filtro composto
      if (!filters.operator || !Array.isArray(filters.filters)) {
        return res.status(400).json({
          success: false,
          message: 'Filtro composto inválido'
        });
      }
    } else {
      // Validar array de filtros simples
      if (!Array.isArray(filters)) {
        return res.status(400).json({
          success: false,
          message: 'Filtros deve ser um array'
        });
      }
    }

    const savedFilter = new SavedFilter({
      userId,
      username,
      name,
      description: description || '',
      filters,
      isComposite: isComposite || false,
      isFavorite: isFavorite || false,
      tags: tags || []
    });

    await savedFilter.save();

    logger.info(`Filtro salvo por ${username}`, {
      userId,
      filterId: savedFilter._id.toString(),
      name,
      isComposite
    });

    res.json({
      success: true,
      filter: {
        id: savedFilter._id.toString(),
        name: savedFilter.name,
        description: savedFilter.description,
        filters: savedFilter.filters,
        isComposite: savedFilter.isComposite,
        isFavorite: savedFilter.isFavorite,
        tags: savedFilter.tags,
        usageCount: savedFilter.usageCount,
        lastUsed: savedFilter.lastUsed,
        createdAt: savedFilter.createdAt
      }
    });
  } catch (error) {
    logger.error('Erro ao salvar filtro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao salvar filtro',
      error: error.message
    });
  }
}

/**
 * PUT /api/saved-filters/:id
 * Atualizar filtro salvo
 */
export async function updateSavedFilter(req, res) {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const filter = await SavedFilter.findById(id);

    if (!filter) {
      return res.status(404).json({
        success: false,
        message: 'Filtro não encontrado'
      });
    }

    // Verificar se o filtro pertence ao usuário
    if (filter.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    // Atualizar campos permitidos
    if (updates.name !== undefined) filter.name = updates.name;
    if (updates.description !== undefined) filter.description = updates.description;
    if (updates.filters !== undefined) filter.filters = updates.filters;
    if (updates.isFavorite !== undefined) filter.isFavorite = updates.isFavorite;
    if (updates.tags !== undefined) filter.tags = updates.tags;
    
    filter.updatedAt = new Date();
    await filter.save();

    logger.info(`Filtro atualizado por ${username}`, {
      userId,
      filterId: id
    });

    res.json({
      success: true,
      filter: {
        id: filter._id.toString(),
        name: filter.name,
        description: filter.description,
        filters: filter.filters,
        isComposite: filter.isComposite,
        isFavorite: filter.isFavorite,
        tags: filter.tags,
        usageCount: filter.usageCount,
        lastUsed: filter.lastUsed,
        updatedAt: filter.updatedAt
      }
    });
  } catch (error) {
    logger.error('Erro ao atualizar filtro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar filtro',
      error: error.message
    });
  }
}

/**
 * DELETE /api/saved-filters/:id
 * Deletar filtro salvo
 */
export async function deleteSavedFilter(req, res) {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const { id } = req.params;

    const filter = await SavedFilter.findById(id);

    if (!filter) {
      return res.status(404).json({
        success: false,
        message: 'Filtro não encontrado'
      });
    }

    // Verificar se o filtro pertence ao usuário
    if (filter.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    await SavedFilter.findByIdAndDelete(id);

    logger.info(`Filtro deletado por ${username}`, {
      userId,
      filterId: id
    });

    res.json({
      success: true,
      message: 'Filtro deletado com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao deletar filtro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar filtro',
      error: error.message
    });
  }
}

/**
 * POST /api/saved-filters/:id/use
 * Marcar filtro como usado (incrementar contador)
 */
export async function useSavedFilter(req, res) {
  try {
    const userId = req.session?.userId;
    const username = req.session?.username;

    if (!userId || !username) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
    }

    const { id } = req.params;

    const filter = await SavedFilter.findById(id);

    if (!filter) {
      return res.status(404).json({
        success: false,
        message: 'Filtro não encontrado'
      });
    }

    // Verificar se o filtro pertence ao usuário
    if (filter.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    await filter.incrementUsage();

    logger.debug(`Filtro usado por ${username}`, {
      userId,
      filterId: id,
      usageCount: filter.usageCount
    });

    res.json({
      success: true,
      usageCount: filter.usageCount,
      lastUsed: filter.lastUsed
    });
  } catch (error) {
    logger.error('Erro ao marcar filtro como usado:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao marcar filtro como usado',
      error: error.message
    });
  }
}

