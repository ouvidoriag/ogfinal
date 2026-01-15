/**
 * Controller de Métricas
 * 
 * Fornece métricas de performance, cache e uso do sistema
 * Endpoint: GET /api/metrics
 */

import { getCacheStats } from '../../utils/cache/smartCache.js';

// Métricas em memória (resetadas a cada restart)
const runtimeMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  pipelineExecutions: 0,
  pipelineErrors: 0,
  endpointCalls: {},
  slowQueries: [],
  startTime: Date.now()
};

/**
 * Registrar hit de cache
 */
export function recordCacheHit() {
  runtimeMetrics.cacheHits++;
}

/**
 * Registrar miss de cache
 */
export function recordCacheMiss() {
  runtimeMetrics.cacheMisses++;
}

/**
 * Registrar execução de pipeline
 */
export function recordPipelineExecution(endpoint, duration) {
  runtimeMetrics.pipelineExecutions++;

  if (!runtimeMetrics.endpointCalls[endpoint]) {
    runtimeMetrics.endpointCalls[endpoint] = {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      durations: []
    };
  }

  const stats = runtimeMetrics.endpointCalls[endpoint];
  stats.count++;
  stats.totalDuration += duration;
  stats.minDuration = Math.min(stats.minDuration, duration);
  stats.maxDuration = Math.max(stats.maxDuration, duration);
  stats.durations.push(duration);

  // Manter apenas últimos 1000 valores para cálculo de percentis
  if (stats.durations.length > 1000) {
    stats.durations.shift();
  }

  // Registrar queries lentas (> 1s)
  if (duration > 1000) {
    runtimeMetrics.slowQueries.push({
      endpoint,
      duration,
      timestamp: new Date().toISOString()
    });

    // Manter apenas últimos 100 queries lentas
    if (runtimeMetrics.slowQueries.length > 100) {
      runtimeMetrics.slowQueries.shift();
    }
  }
}

/**
 * Registrar erro de pipeline
 */
export function recordPipelineError(endpoint, error) {
  runtimeMetrics.pipelineErrors++;

  if (!runtimeMetrics.endpointCalls[endpoint]) {
    runtimeMetrics.endpointCalls[endpoint] = {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      durations: [],
      errors: 0
    };
  }

  if (!runtimeMetrics.endpointCalls[endpoint].errors) {
    runtimeMetrics.endpointCalls[endpoint].errors = 0;
  }

  runtimeMetrics.endpointCalls[endpoint].errors++;
}

/**
 * Calcular percentis
 */
function calculatePercentiles(durations, percentiles = [50, 75, 90, 95, 99]) {
  if (durations.length === 0) return {};

  const sorted = [...durations].sort((a, b) => a - b);
  const result = {};

  percentiles.forEach(p => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, index)];
  });

  return result;
}

/**
 * GET /api/metrics
 * Retornar métricas do sistema
 */
export async function getMetrics(req, res) {
  try {
    const uptime = Date.now() - runtimeMetrics.startTime;
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

    // Estatísticas de cache
    // REFATORAÇÃO: Prisma → Mongoose (getCacheStats não precisa mais de prisma)
    const cacheStats = await getCacheStats();
    const cacheHitRate = runtimeMetrics.cacheHits + runtimeMetrics.cacheMisses > 0
      ? ((runtimeMetrics.cacheHits / (runtimeMetrics.cacheHits + runtimeMetrics.cacheMisses)) * 100).toFixed(2)
      : 0;

    // Estatísticas por endpoint
    const endpointStats = Object.entries(runtimeMetrics.endpointCalls).map(([endpoint, stats]) => {
      const avgDuration = stats.count > 0 ? (stats.totalDuration / stats.count).toFixed(2) : 0;
      const percentiles = calculatePercentiles(stats.durations);
      const errorRate = stats.count > 0
        ? ((stats.errors || 0) / stats.count * 100).toFixed(2)
        : 0;

      return {
        endpoint,
        calls: stats.count,
        avgDuration: `${avgDuration}ms`,
        minDuration: stats.minDuration === Infinity ? 'N/A' : `${stats.minDuration}ms`,
        maxDuration: `${stats.maxDuration}ms`,
        percentiles,
        errorRate: `${errorRate}%`,
        errors: stats.errors || 0
      };
    });

    // Queries lentas (últimas 10)
    const recentSlowQueries = runtimeMetrics.slowQueries
      .slice(-10)
      .reverse();

    // Taxa de execução de pipelines por minuto
    const pipelinesPerMinute = (runtimeMetrics.pipelineExecutions / (uptime / (1000 * 60))).toFixed(2);

    return res.json({
      cache: {
        hits: runtimeMetrics.cacheHits,
        misses: runtimeMetrics.cacheMisses,
        hitRate: `${cacheHitRate}%`,
        ...cacheStats
      },
      pipelines: {
        total: runtimeMetrics.pipelineExecutions,
        errors: runtimeMetrics.pipelineErrors,
        errorRate: runtimeMetrics.pipelineExecutions > 0
          ? `${((runtimeMetrics.pipelineErrors / runtimeMetrics.pipelineExecutions) * 100).toFixed(2)}%`
          : '0%',
        perMinute: pipelinesPerMinute
      },
      endpoints: endpointStats.sort((a, b) => b.calls - a.calls),
      slowQueries: recentSlowQueries,
      system: {
        uptime: `${uptimeHours}h`,
        startTime: new Date(runtimeMetrics.startTime).toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao obter métricas:', error);
    return res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
}

/**
 * GET /api/metrics/reset
 * Resetar métricas (apenas em desenvolvimento)
 */
export async function resetMetrics(req, res) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Reset de métricas não permitido em produção'
    });
  }

  runtimeMetrics.cacheHits = 0;
  runtimeMetrics.cacheMisses = 0;
  runtimeMetrics.pipelineExecutions = 0;
  runtimeMetrics.pipelineErrors = 0;
  runtimeMetrics.endpointCalls = {};
  runtimeMetrics.slowQueries = [];
  runtimeMetrics.startTime = Date.now();

  return res.json({
    message: 'Métricas resetadas',
    timestamp: new Date().toISOString()
  });
}

