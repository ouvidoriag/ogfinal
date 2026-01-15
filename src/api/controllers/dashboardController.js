/**
 * Controller para /api/dashboard-data
 * Endpoint centralizado de dados do dashboard
 * Retorna todos os datasets fundamentais pré-agregados em uma única requisição
 * 
 * OTIMIZAÇÃO: Usa MongoDB Native com pipeline $facet para máxima performance
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { getOverviewData } from '../../utils/dbAggregations.js';
import { sanitizeFilters } from '../../utils/filters/validateFilters.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/dashboard-data
 * 
 * PRIORIDADE 3: Documentação completa
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Endpoint centralizado que retorna todos os datasets fundamentais pré-agregados
 * em uma única requisição para máxima performance do dashboard.
 * 
 * @route GET /api/dashboard-data
 * @param {string} [req.query.servidor] - Filtrar por servidor (opcional)
 * @param {string} [req.query.unidadeCadastro] - Filtrar por unidade de cadastro (opcional)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB nativo
 * @returns {Promise<Object>} Objeto com todos os datasets agregados:
 *   - totalManifestations: number
 *   - manifestationsByMonth: Array
 *   - manifestationsByStatus: Array
 *   - manifestationsByTheme: Array
 *   - manifestationsByOrgan: Array
 *   - manifestationsByType: Array
 *   - manifestationsByChannel: Array
 *   - manifestationsByPriority: Array
 *   - manifestationsByUnit: Array
 * 
 * @example
 * // GET /api/dashboard-data
 * // Retorna: {totalManifestations: 1000, manifestationsByMonth: [...], ...}
 * 
 * @cache TTL: 18000 segundos (5 horas)
 * @performance Usa MongoDB Native com pipeline $facet (3-10x mais rápido)
 */
export async function getDashboardData(req, res, getMongoClient) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const key = servidor ? `dashboardData:servidor:${servidor}:v2` :
    unidadeCadastro ? `dashboardData:uac:${unidadeCadastro}:v2` :
      'dashboardData:v2';

  // Cache de 5 horas para dados agregados (dados mudam a cada ~5h)
  // OTIMIZAÇÃO: Usar MongoDB Native com pipeline $facet (3-10x mais rápido)
  return withCache(key, 18000, res, async () => {
    try {
      // Construir e validar filtros
      const filters = {};
      if (servidor) filters.servidor = servidor;
      if (unidadeCadastro) filters.unidadeCadastro = unidadeCadastro;

      // Validar filtros antes de usar
      let sanitizedFilters = {};
      try {
        sanitizedFilters = sanitizeFilters(filters);
      } catch (validationError) {
        logger.error('Erro na validação de filtros:', { error: validationError.message });
        // Se validação falhar, usar filtros vazios (mais seguro)
        sanitizedFilters = {};
      }

      // Verificar se getMongoClient está disponível
      if (!getMongoClient) {
        logger.error('getMongoClient não disponível');
        throw new Error('MongoDB client não disponível');
      }

      // Usar pipeline otimizado com $facet e cache inteligente (Mongoose)
      const startTime = Date.now();
      let result;

      try {
        result = await getOverviewData(getMongoClient, sanitizedFilters, true); // useCache = true
        const duration = Date.now() - startTime;

        // Log de performance
        if (duration > 1000) {
          logger.info(`Dashboard Data (MongoDB Native): ${duration}ms`, {
            total: result.totalManifestations,
            byMonth: result.manifestationsByMonth.length,
            byStatus: result.manifestationsByStatus.length,
            byTheme: result.manifestationsByTheme.length,
            byOrgan: result.manifestationsByOrgan.length,
            byType: result.manifestationsByType.length,
            byChannel: result.manifestationsByChannel.length,
            byPriority: result.manifestationsByPriority.length,
            byUnit: result.manifestationsByUnit.length
          });
        }
      } catch (mongoError) {
        logger.error('Erro ao usar MongoDB Native:', { error: mongoError.message });
        throw new Error('MongoDB aggregation failed. Please check database connection.');
      }

      // Garantir que todos os campos esperados existam
      if (!result.manifestationsBySubject) {
        result.manifestationsBySubject = [];
      }

      // Adicionar campo manifestationsBySecretaria (compatibilidade)
      if (!result.manifestationsBySecretaria) {
        result.manifestationsBySecretaria = result.manifestationsByOrgan.map(o => ({
          secretaria: o.organ,
          count: o.count
        }));
      }

      return result;
    } catch (error) {
      logger.error('Erro ao buscar dados do dashboard:', { error: error.message });
      throw error;
    }
  }, null, 60000); // Timeout de 60s para endpoint pesado (sem memoryCache)
}
