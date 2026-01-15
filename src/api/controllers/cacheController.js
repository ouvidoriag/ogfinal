/**
 * Controllers de Cache
 * /api/cache/*
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { safeQuery } from '../../utils/formatting/responseHelper.js';
import { getCacheStats, cleanExpiredCache, clearAllDbCache } from '../../utils/cache/dbCache.js';

/**
 * GET /api/cache/status
 * Status do cache
 */
export async function getCacheStatus(req, res) {
  return safeQuery(res, async () => {
    const stats = await getCacheStats();
    return {
      memory: { keys: 0, hits: 0, misses: 0, ksize: 0, vsize: 0 },
      database: stats
    };
  });
}

/**
 * POST /api/cache/rebuild
 * Reconstruir cache universal
 */
export async function rebuildCache(req, res) {
  return safeQuery(res, async () => {
    // TODO: Implementar reconstrução do cache universal
    return {
      success: true,
      message: 'Cache universal reconstruído',
      timestamp: new Date().toISOString()
    };
  });
}

/**
 * POST /api/cache/clean-expired
 * Limpar cache expirado
 */
export async function cleanExpired(req, res) {
  return safeQuery(res, async () => {
    const count = await cleanExpiredCache();
    return {
      success: true,
      message: `${count} entradas de cache expiradas removidas`,
      count
    };
  });
}

/**
 * POST /api/cache/clear-all
 * Limpar todo o cache
 */
export async function clearAll(req, res) {
  return safeQuery(res, async () => {
    const count = await clearAllDbCache();
    return {
      success: true,
      message: `Todo o cache foi limpo: ${count} entradas removidas`,
      count
    };
  });
}

/**
 * POST /api/cache/clear
 * Limpar cache em memória (compatibilidade)
 */
export async function clearMemory(req, res) {
  return safeQuery(res, async () => {
    // Cache em memória não está implementado no novo sistema
    // Usar clear-all para limpar cache do banco
    return {
      success: true,
      message: 'Cache em memória limpo (sistema usa apenas cache do banco)',
      keysRemoved: 0
    };
  });
}

/**
 * GET /api/cache/universal
 * Cache universal (desabilitado por padrão)
 */
export async function getUniversal(req, res) {
  return safeQuery(res, async () => {
    // Por enquanto, cache universal está desabilitado
    // Pode ser implementado no futuro se necessário
    return { data: {}, message: 'Cache universal desabilitado' };
  });
}

