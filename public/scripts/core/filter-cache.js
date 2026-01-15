/**
 * Cache de Filtros
 * 
 * Sistema de cache automático para resultados de filtros
 * Evita recarregar dados completos a cada troca de filtro
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Cache de filtros por chave
   * Estrutura: { cacheKey: { data, timestamp, ttl } }
   */
  const filterCache = new Map();

  /**
   * TTL padrão para cache de filtros (5 minutos)
   */
  const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * TTL por tipo de endpoint
   */
  const TTL_BY_ENDPOINT = {
    '/api/stats/tempo-medio': 10 * 60 * 1000, // 10 minutos (dados mais estáveis)
    '/api/aggregate/by-theme': 5 * 60 * 1000, // 5 minutos
    '/api/aggregate/by-subject': 5 * 60 * 1000, // 5 minutos
    '/api/aggregate/by-month': 10 * 60 * 1000, // 10 minutos
    default: DEFAULT_TTL
  };

  /**
   * Gerar chave de cache para filtros
   * @param {Array} filters - Array de filtros
   * @param {String} endpoint - Endpoint original
   * @returns {String} Chave de cache
   */
  function generateCacheKey(filters, endpoint) {
    if (!Array.isArray(filters) || filters.length === 0) {
      return `${endpoint}_no-filters`;
    }

    // Ordenar filtros por field + op para garantir consistência
    const sorted = [...filters].sort((a, b) => {
      if (a.field !== b.field) {
        return a.field.localeCompare(b.field);
      }
      if (a.op !== b.op) {
        return a.op.localeCompare(b.op);
      }
      return JSON.stringify(a.value).localeCompare(JSON.stringify(b.value));
    });

    // Gerar hash simples (em produção, usar crypto)
    const key = JSON.stringify({ filters: sorted, endpoint });
    
    // Hash simples baseado em tamanho e primeiros caracteres
    // Em produção, usar: crypto.createHash('md5').update(key).digest('hex')
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return `filter_${Math.abs(hash)}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * Obter TTL para endpoint
   * @param {String} endpoint - Endpoint
   * @returns {Number} TTL em milissegundos
   */
  function getTTL(endpoint) {
    for (const [pattern, ttl] of Object.entries(TTL_BY_ENDPOINT)) {
      if (pattern === 'default') continue;
      if (endpoint.includes(pattern)) {
        return ttl;
      }
    }
    return TTL_BY_ENDPOINT.default;
  }

  /**
   * Verificar se cache está expirado
   * @param {Object} cacheEntry - Entrada do cache
   * @param {Number} ttl - TTL em milissegundos
   * @returns {Boolean} true se expirado
   */
  function isExpired(cacheEntry, ttl) {
    if (!cacheEntry || !cacheEntry.timestamp) {
      return true;
    }
    return Date.now() - cacheEntry.timestamp > ttl;
  }

  /**
   * Sistema de Cache de Filtros
   */
  window.filterCache = {
    /**
     * Obter dados do cache
     * @param {Array} filters - Array de filtros
     * @param {String} endpoint - Endpoint original
     * @returns {*} Dados em cache ou null
     */
    get(filters, endpoint) {
      const cacheKey = generateCacheKey(filters, endpoint);
      const ttl = getTTL(endpoint);
      const cached = filterCache.get(cacheKey);

      if (cached && !isExpired(cached, ttl)) {
        if (window.Logger) {
          window.Logger.debug(`FilterCache: Cache hit para ${endpoint}`, {
            cacheKey: cacheKey.substring(0, 50),
            age: Date.now() - cached.timestamp
          });
        }
        return cached.data;
      }

      // Cache expirado ou não existe
      if (cached && isExpired(cached, ttl)) {
        filterCache.delete(cacheKey);
        if (window.Logger) {
          window.Logger.debug(`FilterCache: Cache expirado para ${endpoint}`);
        }
      }

      return null;
    },

    /**
     * Salvar dados no cache
     * @param {Array} filters - Array de filtros
     * @param {String} endpoint - Endpoint original
     * @param {*} data - Dados a cachear
     * @param {Number} customTTL - TTL customizado (opcional)
     */
    set(filters, endpoint, data, customTTL = null) {
      const cacheKey = generateCacheKey(filters, endpoint);
      const ttl = customTTL || getTTL(endpoint);

      filterCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl
      });

      if (window.Logger) {
        window.Logger.debug(`FilterCache: Dados salvos no cache para ${endpoint}`, {
          cacheKey: cacheKey.substring(0, 50),
          ttl: ttl / 1000 + 's'
        });
      }
    },

    /**
     * Invalidar cache para um endpoint
     * @param {String} endpoint - Endpoint (opcional, se não fornecido, limpa tudo)
     */
    invalidate(endpoint = null) {
      if (endpoint) {
        // Invalidar apenas entradas relacionadas ao endpoint
        const keysToDelete = [];
        for (const [key] of filterCache.entries()) {
          if (key.includes(endpoint)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => filterCache.delete(key));
        
        if (window.Logger) {
          window.Logger.debug(`FilterCache: Cache invalidado para ${endpoint}`, {
            removed: keysToDelete.length
          });
        }
      } else {
        // Limpar todo o cache
        const size = filterCache.size;
        filterCache.clear();
        
        if (window.Logger) {
          window.Logger.debug(`FilterCache: Todo o cache foi limpo`, {
            removed: size
          });
        }
      }
    },

    /**
     * Obter estatísticas do cache
     * @returns {Object} Estatísticas
     */
    getStats() {
      const stats = {
        total: filterCache.size,
        entries: [],
        expired: 0
      };

      for (const [key, entry] of filterCache.entries()) {
        const ttl = getTTL(key);
        const expired = isExpired(entry, ttl);
        
        if (expired) {
          stats.expired++;
        }

        stats.entries.push({
          key: key.substring(0, 50),
          age: Date.now() - entry.timestamp,
          expired
        });
      }

      return stats;
    },

    /**
     * Limpar cache expirado
     */
    clearExpired() {
      const keysToDelete = [];
      
      for (const [key, entry] of filterCache.entries()) {
        // Tentar extrair endpoint da chave
        const endpoint = key.split('_').pop() || '';
        const ttl = getTTL(endpoint);
        
        if (isExpired(entry, ttl)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => filterCache.delete(key));

      if (keysToDelete.length > 0 && window.Logger) {
        window.Logger.debug(`FilterCache: ${keysToDelete.length} entradas expiradas removidas`);
      }
    }
  };

  // Limpar cache expirado a cada 5 minutos
  if (typeof setInterval !== 'undefined') {
    setInterval(() => {
      window.filterCache.clearExpired();
    }, 5 * 60 * 1000);
  }

  if (window.Logger) {
    window.Logger.debug('FilterCache: Sistema de cache de filtros inicializado');
  }
})();

