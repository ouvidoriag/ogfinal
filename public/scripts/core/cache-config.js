/**
 * Configuração Centralizada de TTLs (Frontend)
 * Única fonte de verdade para todos os sistemas de cache do frontend
 * 
 * REFATORAÇÃO: FASE 1 - Unificação de TTLs
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

// TTLs em milissegundos (frontend)
const CACHE_TTLS = {
  // Estáticos (30 minutos)
  STATIC: 30 * 60 * 1000,
  DISTRITOS: 30 * 60 * 1000,
  UNIT: 30 * 60 * 1000,
  
  // Semi-estáticos (10 minutos)
  SEMI_STATIC: 10 * 60 * 1000,
  AGGREGATE_BY_MONTH: 10 * 60 * 1000,
  
  // Dinâmicos (5 segundos)
  DYNAMIC: 5000,
  DASHBOARD_DATA: 5000,
  SUMMARY: 5000,
  
  // Por endpoint (em milissegundos)
  ENDPOINTS: {
    '/api/distritos': 30 * 60 * 1000,
    '/api/unit/*': 30 * 60 * 1000,
    '/api/aggregate/by-month': 10 * 60 * 1000,
    '/api/dashboard-data': 5000,
    '/api/summary': 5000,
    '/api/aggregate': 60000,
    '/api/stats': 60000,
    '/api/sla': 90000,
    '/api/distinct': 10000,
    '/api/health': 5000
  }
};

/**
 * Obter TTL para uma chave/endpoint específico
 * @param {string} key - Chave ou endpoint
 * @returns {number} TTL em milissegundos
 */
function getTTL(key) {
  if (!key || typeof key !== 'string') {
    return CACHE_TTLS.DYNAMIC;
  }
  
  // Verificar endpoint específico
  for (const [pattern, ttl] of Object.entries(CACHE_TTLS.ENDPOINTS)) {
    if (pattern.includes('*')) {
      // Padrão com wildcard
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(key)) {
        if (window.Logger) {
          window.Logger.debug(`Cache TTL: ${key} → ${ttl}ms (padrão: ${pattern})`);
        }
        return ttl;
      }
    } else if (key === pattern || key.includes(pattern)) {
      // Match exato ou parcial
      if (window.Logger) {
        window.Logger.debug(`Cache TTL: ${key} → ${ttl}ms (endpoint: ${pattern})`);
      }
      return ttl;
    }
  }
  
  // Fallback para padrão dinâmico
  if (window.Logger) {
    window.Logger.debug(`Cache TTL: ${key} → ${CACHE_TTLS.DYNAMIC}ms (padrão)`);
  }
  return CACHE_TTLS.DYNAMIC;
}

/**
 * Obter TTL padrão
 * @returns {number} TTL padrão em milissegundos
 */
function getDefaultTTL() {
  return CACHE_TTLS.DYNAMIC;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.cacheConfig = {
    TTLS: CACHE_TTLS,
    getTTL: getTTL,
    getDefaultTTL: getDefaultTTL
  };
  
  if (window.Logger) {
    window.Logger.success('✅ Cache Config inicializado (TTLs centralizados)');
  }
}

// Export para módulos ES6 (se necessário)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_TTLS,
    getTTL,
    getDefaultTTL
  };
}

