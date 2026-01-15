/**
 * Sistema de Cache para Respostas da CORA
 * Cacheia respostas baseadas em similaridade de perguntas
 * 
 * MELHORIA CORA - CÉREBRO X-3
 * Data: 12/12/2025
 */

import crypto from 'crypto';
import { setDbCache, getDbCache } from '../cache/dbCache.js';
import { normalizarTexto } from '../nlpHelper.js';
import { logger } from '../logger.js';

// Cache em memória para respostas recentes (mais rápido)
const memoryCache = new Map();
const MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const DB_CACHE_TTL = 30 * 60; // 30 minutos no banco

/**
 * Gerar hash de uma pergunta normalizada
 */
function hashPergunta(texto, context) {
  const textoNormalizado = normalizarTexto(texto);
  const hash = crypto.createHash('md5')
    .update(`${context}:${textoNormalizado}`)
    .digest('hex')
    .substring(0, 16);
  return `cora:response:${hash}`;
}

/**
 * Calcular similaridade entre duas perguntas (Jaccard)
 */
function calcularSimilaridade(texto1, texto2) {
  const palavras1 = new Set(normalizarTexto(texto1).split(/\s+/).filter(w => w.length > 2));
  const palavras2 = new Set(normalizarTexto(texto2).split(/\s+/).filter(w => w.length > 2));

  const intersecao = new Set([...palavras1].filter(x => palavras2.has(x)));
  const uniao = new Set([...palavras1, ...palavras2]);

  return uniao.size > 0 ? intersecao.size / uniao.size : 0;
}

/**
 * Buscar resposta similar no cache
 */
async function buscarRespostaSimilar(texto, context, threshold = 0.7) {
  const textoNormalizado = normalizarTexto(texto);

  // Buscar no cache em memória primeiro
  for (const [key, value] of memoryCache.entries()) {
    if (value.context === context && value.timestamp + MEMORY_CACHE_TTL > Date.now()) {
      const similaridade = calcularSimilaridade(textoNormalizado, value.pergunta);
      if (similaridade >= threshold) {
        logger.debug(`CORA Cache Hit (memória): similaridade ${(similaridade * 100).toFixed(1)}%`);
        return value.resposta;
      }
    }
  }

  return null;
}

/**
 * Obter resposta do cache
 */
export async function getCachedResponse(texto, context) {
  try {
    // 1. Buscar resposta exata (hash)
    const hash = hashPergunta(texto, context);
    const cached = await getDbCache(hash);
    if (cached) {
      logger.debug('CORA Cache Hit (exato)');
      return cached.resposta;
    }

    // 2. Buscar resposta similar
    const similar = await buscarRespostaSimilar(texto, context);
    if (similar) {
      return similar;
    }

    return null;
  } catch (error) {
    logger.warn('Erro ao buscar cache da CORA:', error.message);
    return null;
  }
}

/**
 * Salvar resposta no cache
 */
export async function setCachedResponse(texto, context, resposta) {
  try {
    const hash = hashPergunta(texto, context);
    const timestamp = Date.now();

    // Salvar no banco
    await setDbCache(hash, {
      pergunta: texto,
      resposta: resposta,
      context: context,
      timestamp: timestamp
    }, DB_CACHE_TTL);

    // Salvar em memória também
    memoryCache.set(hash, {
      pergunta: texto,
      resposta: resposta,
      context: context,
      timestamp: timestamp
    });

    // Limpar cache em memória antigo (manter apenas últimos 100)
    if (memoryCache.size > 100) {
      const entries = Array.from(memoryCache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 100);
      memoryCache.clear();
      entries.forEach(([key, value]) => memoryCache.set(key, value));
    }

    logger.debug('CORA Cache: Resposta salva', { hash: hash.substring(0, 20) });
  } catch (error) {
    logger.warn('Erro ao salvar cache da CORA:', error.message);
  }
}

/**
 * Limpar cache da CORA
 */
export async function clearCoraCache() {
  try {
    memoryCache.clear();
    // Limpar do banco seria feito via invalidateCachePattern('cora:response:*')
    logger.info('CORA Cache: Limpo');
  } catch (error) {
    logger.warn('Erro ao limpar cache da CORA:', error.message);
  }
}

