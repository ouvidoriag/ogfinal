/**
 * Rotas: Saved Filters
 * API para gerenciar filtros salvos por usuário
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import express from 'express';
import {
  getSavedFilters,
  saveFilter,
  updateSavedFilter,
  deleteSavedFilter,
  useSavedFilter
} from '../controllers/savedFiltersController.js';

export default function savedFiltersRoutes() {
  const router = express.Router();

  /**
   * GET /api/saved-filters
   * Listar filtros salvos do usuário
   * Query params: favorite, recent, limit
   */
  router.get('/', getSavedFilters);

  /**
   * POST /api/saved-filters
   * Salvar novo filtro
   */
  router.post('/', saveFilter);

  /**
   * PUT /api/saved-filters/:id
   * Atualizar filtro salvo
   */
  router.put('/:id', updateSavedFilter);

  /**
   * DELETE /api/saved-filters/:id
   * Deletar filtro salvo
   */
  router.delete('/:id', deleteSavedFilter);

  /**
   * POST /api/saved-filters/:id/use
   * Marcar filtro como usado (incrementar contador)
   */
  router.post('/:id/use', useSavedFilter);

  return router;
}

