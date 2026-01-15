/**
 * Configuração e inicialização do sistema de cache
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import cacheManager from '../utils/cache/cacheManager.js';
import { buildUniversalCache, scheduleDailyUpdate } from '../utils/cache/cacheBuilder.js';
import { logger } from '../utils/logger.js';

export async function initializeCache() {
  try {
    // Carregar cache persistente
    cacheManager.loadCache();

    // Inicializar cache universal e agendar atualizações diárias
    scheduleDailyUpdate();

    logger.info('Sistema de cache universal inicializado');
    return true;
  } catch (error) {
    logger.warn('Erro ao inicializar cache universal:', { error: error.message });
    return false;
  }
}

