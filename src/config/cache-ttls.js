/**
 * Configuração Centralizada de TTLs (Backend)
 * Única fonte de verdade para todos os sistemas de cache do backend
 * Sincronizado com frontend (cache-config.js)
 * 
 * REFATORAÇÃO: FASE 1 - Unificação de TTLs
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

// TTLs em segundos (backend)
const CACHE_TTLS = {
  // Estáticos (30 minutos)
  STATIC: 30 * 60,
  DISTRITOS: 30 * 60,
  UNIT: 30 * 60,
  
  // Semi-estáticos (10 minutos)
  SEMI_STATIC: 10 * 60,
  AGGREGATE_BY_MONTH: 10 * 60,
  
  // Dinâmicos (5 segundos)
  DYNAMIC: 5,
  DASHBOARD_DATA: 5,
  SUMMARY: 5,
  
  // Por endpoint (em segundos)
  ENDPOINTS: {
    '/api/distritos': 30 * 60,
    '/api/unit/*': 30 * 60,
    '/api/aggregate/by-month': 10 * 60,
    '/api/dashboard-data': 5,
    '/api/summary': 5,
    '/api/aggregate': 60,
    '/api/stats': 60,
    '/api/sla': 90,
    '/api/distinct': 10,
    '/api/health': 5
  },
  
  // Por tipo de endpoint (para smartCache)
  BY_TYPE: {
    overview: 5,
    status: 15,
    tema: 15,
    assunto: 15,
    categoria: 15,
    bairro: 15,
    orgaoMes: 30,
    distinct: 300,  // 5 minutos
    dashboard: 5,
    sla: 60,
    default: 15
  }
};

/**
 * Obter TTL para uma chave/endpoint específico
 * @param {string} key - Chave ou endpoint
 * @returns {number} TTL em segundos
 */
export function getTTL(key) {
  if (!key || typeof key !== 'string') {
    return CACHE_TTLS.DYNAMIC;
  }
  
  // Verificar endpoint específico
  for (const [pattern, ttl] of Object.entries(CACHE_TTLS.ENDPOINTS)) {
    if (pattern.includes('*')) {
      // Padrão com wildcard
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(key)) {
        return ttl;
      }
    } else if (key === pattern || key.includes(pattern)) {
      // Match exato ou parcial
      return ttl;
    }
  }
  
  // Fallback para padrão dinâmico
  return CACHE_TTLS.DYNAMIC;
}

/**
 * Obter TTL por tipo (para smartCache)
 * @param {string} type - Tipo de endpoint (overview, status, etc.)
 * @returns {number} TTL em segundos
 */
export function getTTLByType(type) {
  return CACHE_TTLS.BY_TYPE[type] || CACHE_TTLS.BY_TYPE.default;
}

/**
 * Obter TTL padrão
 * @returns {number} TTL padrão em segundos
 */
export function getDefaultTTL() {
  return CACHE_TTLS.DYNAMIC;
}

// Exportar configuração completa
export { CACHE_TTLS };

