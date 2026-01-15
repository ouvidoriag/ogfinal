/**
 * Sistema de Cache no Banco de Dados
 * Armazena agregações pré-computadas diretamente no MongoDB
 * Muito mais rápido que cache em memória para dados grandes
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import AggregationCache from '../../models/AggregationCache.model.js';
import { logger } from '../logger.js';

/**
 * Obter cache do banco de dados
 * 
 * @param {string} key - Chave do cache
 * @returns {Promise<Object|null>} - Dados cacheados ou null
 */
export async function getDbCache(key) {
  try {
    const cached = await AggregationCache.findByKey(key);

    if (!cached) return null;

    // Verificar se expirou (método do model já faz isso, mas garantimos)
    if (cached.isExpired()) {
      // Cache expirado, remover
      await AggregationCache.deleteOne({ _id: cached._id });
      return null;
    }

    return cached.data;
  } catch (error) {
    logger.warn(`Erro ao buscar cache do banco para ${key}:`, { error: error.message });
    return null;
  }
}

/**
 * Salvar cache no banco de dados
 * 
 * @param {string} key - Chave do cache
 * @param {Object} data - Dados para cachear
 * @param {number} ttlSeconds - TTL em segundos (padrão: 3600 = 1 hora)
 * @returns {Promise<boolean>} - true se salvo com sucesso
 */
export async function setDbCache(key, data, ttlSeconds = 3600) {
  try {
    await AggregationCache.setCache(key, data, ttlSeconds);
    return true;
  } catch (error) {
    logger.warn(`Erro ao salvar cache no banco para ${key}:`, { error: error.message });
    return false;
  }
}

/**
 * Limpar cache expirado do banco
 * 
 * @returns {Promise<number>} - Número de entradas removidas
 */
export async function cleanExpiredCache() {
  try {
    const result = await AggregationCache.deleteExpired();
    const count = result.deletedCount || 0;

    if (count > 0) {
      logger.info(`Limpeza de cache: ${count} entradas expiradas removidas`);
    }

    return count;
  } catch (error) {
    logger.warn('Erro ao limpar cache expirado:', { error: error.message });
    return 0;
  }
}

/**
 * Limpar cache específico
 * 
 * @param {string} key - Chave do cache a limpar
 * @returns {Promise<boolean>} - true se removido com sucesso
 */
export async function clearDbCache(key) {
  try {
    await AggregationCache.deleteOne({ key });
    return true;
  } catch (error) {
    logger.warn(`Erro ao limpar cache ${key}:`, { error: error.message });
    return false;
  }
}

/**
 * Limpar todo o cache
 * 
 * @returns {Promise<number>} - Número de entradas removidas
 */
export async function clearAllDbCache() {
  try {
    const result = await AggregationCache.deleteMany({});
    const count = result.deletedCount || 0;
    logger.info(`Cache do banco limpo: ${count} entradas removidas`);
    return count;
  } catch (error) {
    logger.warn('Erro ao limpar todo o cache:', { error: error.message });
    return 0;
  }
}

/**
 * Obter estatísticas do cache
 * 
 * @returns {Promise<Object>} - Estatísticas do cache
 */
export async function getCacheStats() {
  try {
    const total = await AggregationCache.countDocuments();
    const now = new Date();
    const expired = await AggregationCache.countDocuments({
      expiresAt: { $lt: now }
    });
    const active = total - expired;

    return {
      total,
      active,
      expired,
      expiredPercent: total > 0 ? ((expired / total) * 100).toFixed(1) : 0
    };
  } catch (error) {
    logger.warn('Erro ao obter estatísticas do cache:', { error: error.message });
    return { total: 0, active: 0, expired: 0, expiredPercent: 0 };
  }
}

/**
 * Wrapper para usar cache do banco com fallback para cache em memória
 * 
 * @param {string} key - Chave do cache
 * @param {number} ttlSeconds - TTL em segundos
 * @param {Function} fn - Função para executar se cache não existir
 * @param {Object|null} memoryCache - Cache em memória opcional
 * @returns {Promise<Object>} - Dados (do cache ou da função)
 */
export async function withDbCache(key, ttlSeconds, fn, memoryCache = null) {
  // 1. Tentar cache do banco primeiro
  const dbCached = await getDbCache(key);
  if (dbCached !== null) {
    return dbCached;
  }

  // 2. Tentar cache em memória se disponível
  if (memoryCache) {
    const memCached = memoryCache.get(key);
    if (memCached) {
      // Salvar no banco também para próxima vez
      await setDbCache(key, memCached, ttlSeconds);
      return memCached;
    }
  }

  // 3. Executar função e cachear resultado
  const result = await fn();

  // Salvar em ambos os caches
  await setDbCache(key, result, ttlSeconds);
  if (memoryCache) {
    memoryCache.set(key, result, ttlSeconds);
  }

  return result;
}

