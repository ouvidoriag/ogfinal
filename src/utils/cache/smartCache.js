/**
 * Cache Inteligente (Smart Cache)
 * 
 * Sistema de cache baseado em chaves derivadas de filtros
 * TTL configurável por tipo de endpoint
 * Integração com AggregationCache do banco de dados
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import crypto from 'crypto';
import AggregationCache from '../../models/AggregationCache.model.js';
import { logger } from '../logger.js';
import { getTTLByType, getDefaultTTL } from '../../config/cache-ttls.js';

/**
 * TTL por tipo de endpoint (em segundos)
 * REFATORAÇÃO: Agora usa cache-ttls.js centralizado
 * Mantido para compatibilidade, mas usa getTTLByType() internamente
 */
const TTL_CONFIG = {
  overview: 5,           // 5 segundos - dados muito dinâmicos
  status: 15,            // 15 segundos
  tema: 15,              // 15 segundos
  assunto: 15,           // 15 segundos
  categoria: 15,        // 15 segundos
  bairro: 15,            // 15 segundos
  orgaoMes: 30,          // 30 segundos
  distinct: 300,         // 5 minutos - valores distintos mudam pouco
  dashboard: 5,          // 5 segundos
  sla: 60,               // 1 minuto
  default: 15            // 15 segundos padrão
};

/**
 * Gerar chave de cache baseada em filtros
 * @param {string} endpoint - Tipo de endpoint (overview, status, etc.)
 * @param {Object} filters - Filtros aplicados
 * @param {string} version - Versão do cache (padrão: 'v1')
 * @returns {string} Chave de cache única
 */
export function generateCacheKey(endpoint, filters = {}, version = 'v1') {
  // Normalizar filtros (ordenar chaves para consistência)
  const normalizedFilters = {};
  const sortedKeys = Object.keys(filters).sort();

  for (const key of sortedKeys) {
    const value = filters[key];
    if (value !== undefined && value !== null) {
      // Se for objeto MongoDB, serializar
      if (typeof value === 'object' && !Array.isArray(value)) {
        normalizedFilters[key] = JSON.stringify(value);
      } else {
        normalizedFilters[key] = value;
      }
    }
  }

  // Criar hash dos filtros para chave mais curta
  const filtersStr = JSON.stringify(normalizedFilters);
  const hash = crypto.createHash('md5').update(filtersStr).digest('hex').substring(0, 8);

  // Formato: endpoint:hash:v1
  return `${endpoint}:${hash}:${version}`;
}

/**
 * Obter TTL para um endpoint
 * @param {string} endpoint - Tipo de endpoint
 * @returns {number} TTL em segundos
 * REFATORAÇÃO: Agora usa cache-ttls.js centralizado
 */
export function getTTL(endpoint) {
  // Usar TTL centralizado se disponível
  try {
    return getTTLByType(endpoint);
  } catch (error) {
    // Fallback para configuração antiga (compatibilidade)
    logger.warn(`Erro ao obter TTL centralizado para ${endpoint}, usando fallback:`, error.message);
    return TTL_CONFIG[endpoint] || TTL_CONFIG.default;
  }
}

/**
 * Obter cache de agregação do banco
 * 
 * @param {string} key - Chave do cache
 * @returns {Promise<Object|null>} Dados em cache ou null
 */
export async function getCachedAggregation(key) {
  try {
    const cached = await AggregationCache.findByKey(key);

    if (cached && cached.data) {
      return cached.data;
    }

    return null;
  } catch (error) {
    logger.warn('Erro ao buscar cache:', { error: error.message, key });
    return null;
  }
}

/**
 * Armazenar agregação no cache do banco
 * 
 * @param {string} key - Chave do cache
 * @param {Object} data - Dados para cachear
 * @param {number} ttlSeconds - TTL em segundos
 * @returns {Promise<void>}
 */
export async function setCachedAggregation(key, data, ttlSeconds) {
  try {
    await AggregationCache.setCache(key, data, ttlSeconds);
  } catch (error) {
    logger.warn('Erro ao armazenar cache:', { error: error.message, key });
    // Não lançar erro - cache é opcional
  }
}

/**
 * Executar função com cache inteligente
 * 
 * REFATORAÇÃO FASE 4: Documentação de uso
 * 
 * ⚠️ IMPORTANTE: Use APENAS para endpoints com filtros dinâmicos
 * - Se não tem filtros, use withCache() em vez disso
 * - NÃO use dentro de withCache() (evitar cache duplo)
 * - Ver: docs/system/GUIA_DECISAO_CACHE.md
 * 
 * @param {string} endpoint - Tipo de endpoint
 * @param {Object} filters - Filtros aplicados (obrigatório - varia por requisição)
 * @param {Function} fn - Função para executar se cache não existir
 * @param {number} customTTL - TTL customizado (opcional, usa cache-ttls.js se null)
 * @param {*} fallback - Valor de fallback em caso de erro (opcional)
 * @returns {Promise<Object>} Dados (do cache, da função ou do fallback)
 */
export async function withSmartCache(endpoint, filters, fn, customTTL = null, fallback = null) {
  const cacheKey = generateCacheKey(endpoint, filters);
  const ttl = customTTL || getTTL(endpoint);

  // Tentar obter do cache
  const cached = await getCachedAggregation(cacheKey);
  if (cached) {
    return cached;
  }

  // Executar função com proteção de erro
  let data;
  try {
    data = await fn();
  } catch (error) {
    logger.error(`Erro em withSmartCache (${endpoint}):`, { error: error.message, endpoint });
    // Se um fallback foi fornecido, retornar fallback em vez de propagar erro
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    // Caso contrário, rethrow para que o caller trate
    throw error;
  }

  // Armazenar no cache (não bloquear se falhar)
  setCachedAggregation(cacheKey, data, ttl).catch(err => {
    logger.warn('Erro ao cachear (não crítico):', { error: err.message, key: cacheKey });
  });

  return data;
}

/**
 * Invalidar cache por padrão
 * 
 * @param {string} pattern - Padrão de chave (ex: 'overview:*')
 * @returns {Promise<number>} Número de registros removidos
 */
export async function invalidateCachePattern(pattern) {
  try {
    // MongoDB não suporta LIKE diretamente, usar regex
    const regexPattern = pattern.replace('*', '.*');
    const searchPattern = pattern.replace('*', '');

    const result = await AggregationCache.deleteMany({
      key: { $regex: regexPattern, $options: 'i' }
    });

    return result.deletedCount || 0;
  } catch (error) {
    logger.warn('Erro ao invalidar cache:', { error: error.message, pattern });
    return 0;
  }
}

/**
 * Limpar cache expirado
 * 
 * @returns {Promise<number>} Número de registros removidos
 */
export async function cleanExpiredCache() {
  try {
    const result = await AggregationCache.deleteExpired();
    return result.deletedCount || 0;
  } catch (error) {
    logger.warn('Erro ao limpar cache expirado:', { error: error.message });
    return 0;
  }
}

/**
 * Obter estatísticas de cache
 * 
 * @returns {Promise<Object>} Estatísticas do cache
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
      hitRate: 0 // Seria calculado com métricas de uso
    };
  } catch (error) {
    logger.warn('Erro ao obter estatísticas de cache:', { error: error.message });
    return { total: 0, active: 0, expired: 0, hitRate: 0 };
  }
}

