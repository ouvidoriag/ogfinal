/**
 * Helper para respostas da API com cache
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * REFATORAÇÃO FASE 4: Documentação de uso
 * Data: 03/12/2025 (Atualizado: 09/12/2025)
 * CÉREBRO X-3
 * 
 * GUIA DE USO:
 * - Use para endpoints HTTP estáticos ou semi-estáticos
 * - NÃO use se a função interna já usa withSmartCache (evitar cache duplo)
 * - Ver: docs/system/GUIA_DECISAO_CACHE.md
 */

import { withDbCache } from '../cache/dbCache.js';
import { logger } from '../logger.js';

/**
 * Verificar se função usa withSmartCache internamente (detectar cache duplo)
 */
function detectDoubleCache(fn) {
  const fnString = fn.toString();
  // Verificar se a função contém chamadas a withSmartCache
  const hasWithSmartCache = fnString.includes('withSmartCache') ||
    fnString.includes('smartCache') ||
    fnString.includes('SmartCache');

  if (hasWithSmartCache) {
    logger.warn(`⚠️ Possível cache duplo detectado em ${fn.name || 'função anônima'}. A função interna já usa withSmartCache.`);
    return true;
  }

  return false;
}

/**
 * Wrapper para queries com cache e tratamento de erros
 * Adiciona timeout para evitar erros 502
 * 
 * ⚠️ IMPORTANTE: Não use se a função interna já usa withSmartCache (cache duplo)
 * 
 * @param {string} key - Chave do cache
 * @param {number} ttlSeconds - TTL em segundos
 * @param {Object} res - Response object do Express
 * @param {Function} fn - Função para executar (NÃO deve usar withSmartCache internamente)
 * @param {Object|null} memoryCache - Cache em memória opcional
 * @param {number} timeoutMs - Timeout em milissegundos (padrão: 30000)
 * @returns {Promise<Object>} - Resposta JSON
 */
export async function withCache(key, ttlSeconds, res, fn, memoryCache = null, timeoutMs = 30000) {
  // PRIORIDADE 2: Detectar cache duplo
  if (detectDoubleCache(fn)) {
    logger.warn(`⚠️ Cache duplo detectado em ${key}. A função já usa withSmartCache internamente.`);
  }

  try {
    let result;

    // Criar promise de timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${timeoutMs}ms`)), timeoutMs)
    );

    // Executar função com cache e timeout
    const executeFn = async () => {
      return await withDbCache(key, ttlSeconds, fn, memoryCache);
    };

    result = await Promise.race([executeFn(), timeoutPromise]);

    return res.json(result);
  } catch (error) {
    // Se houver timeout
    if (error.message?.includes('Timeout')) {
      logger.error(`Timeout em ${key} após ${timeoutMs}ms`);
      return res.status(504).json({
        error: 'Timeout',
        message: 'A operação demorou muito para responder. Tente novamente ou use filtros mais específicos.',
        code: 'TIMEOUT_ERROR'
      });
    }

    // Se houver erro de conexão, retornar erro apropriado
    if (error.code === 'P2010' || error.message?.includes('Server selection timeout') || error.name === 'MongooseError') {
      logger.error('Erro de conexão com MongoDB:', { error: error.message });
      return res.status(503).json({
        error: 'Serviço temporariamente indisponível',
        message: 'Não foi possível conectar ao banco de dados. Tente novamente em alguns instantes.',
        code: 'DATABASE_CONNECTION_ERROR'
      });
    }

    // Evitar estruturas circulares ao logar erros
    const errorInfo = {
      message: error.message,
      name: error.name,
      code: error.code,
      codeName: error.codeName
    };

    // Adicionar stack apenas se não for objeto MongoDB complexo
    if (error.stack && typeof error.stack === 'string') {
      errorInfo.stack = error.stack.substring(0, 500); // Limitar tamanho
    }

    logger.error(`Erro em ${key}:`, errorInfo);

    // Verificar se a resposta já foi enviada
    if (res.headersSent) {
      logger.warn(`Tentativa de enviar resposta duplicada para ${key}`);
      return;
    }

    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message || 'Erro desconhecido'
    });
  }
}

/**
 * Wrapper para queries sem cache (apenas tratamento de erros)
 * 
 * @param {Object} res - Response object do Express
 * @param {Function} fn - Função para executar
 * @returns {Promise<Object>} - Resposta JSON
 */
export async function safeQuery(res, fn) {
  try {
    const result = await fn();
    return res.json(result);
  } catch (error) {
    if (error.code === 'P2010' || error.message?.includes('Server selection timeout') || error.name === 'MongooseError') {
      logger.error('Erro de conexão com MongoDB:', { error: error.message });
      return res.status(503).json({
        error: 'Serviço temporariamente indisponível',
        message: 'Não foi possível conectar ao banco de dados.',
        code: 'DATABASE_CONNECTION_ERROR'
      });
    }

    logger.error('Erro na query:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

