/**
 * Controller de Batch Requests
 * 
 * Permite executar múltiplas requisições em uma única chamada HTTP
 * Reduz latência, carga no servidor e congestionamento no navegador
 * 
 * Endpoint: POST /api/batch
 * 
 * Payload:
 * {
 *   "requests": [
 *     { "name": "overview", "filters": {...} },
 *     { "name": "status", "filters": {...} },
 *     { "name": "tema", "filters": {...} }
 *   ],
 *   "options": {
 *     "parallel": true,
 *     "timeout": 30000,
 *     "compress": true
 *   }
 * }
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { executeAggregation, getOverviewData } from '../../utils/dbAggregations.js';
import {
  buildStatusPipeline,
  buildTemaPipeline,
  buildAssuntoPipeline,
  buildCategoriaPipeline,
  buildBairroPipeline,
  buildOrgaoMesPipeline
} from '../../utils/pipelines/index.js';
import { formatGroupByResult } from '../../utils/formatting/dataFormatter.js';
import { sanitizeFilters } from '../../utils/filters/validateFilters.js';
import { withSmartCache } from '../../utils/cache/smartCache.js';

/**
 * Mapeamento de endpoints para pipelines
 */
const ENDPOINT_PIPELINES = {
  'overview': {
    useOverviewData: true, // Flag especial para usar getOverviewData
    cacheKey: 'overview',
    ttl: 5
  },
  'status': {
    pipeline: buildStatusPipeline,
    formatter: (result) => formatGroupByResult(result, '_id', 'count'),
    cacheKey: 'status',
    ttl: 15
  },
  'tema': {
    pipeline: buildTemaPipeline,
    formatter: (result) => formatGroupByResult(result, '_id', 'count'),
    cacheKey: 'tema',
    ttl: 15
  },
  'assunto': {
    pipeline: buildAssuntoPipeline,
    formatter: (result) => formatGroupByResult(result, '_id', 'count'),
    cacheKey: 'assunto',
    ttl: 15
  },
  'categoria': {
    pipeline: buildCategoriaPipeline,
    formatter: (result) => formatGroupByResult(result, '_id', 'count'),
    cacheKey: 'categoria',
    ttl: 15
  },
  'bairro': {
    pipeline: buildBairroPipeline,
    formatter: (result) => formatGroupByResult(result, '_id', 'count'),
    cacheKey: 'bairro',
    ttl: 15
  },
  'orgaoMes': {
    pipeline: buildOrgaoMesPipeline,
    formatter: (result) => result.map(item => ({
      orgao: item.orgao,
      month: item.month,
      count: item.count
    })),
    cacheKey: 'orgaoMes',
    ttl: 30
  }
};

/**
 * Executar uma requisição individual
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function executeRequest(name, filters, getMongoClient) {
  const endpointConfig = ENDPOINT_PIPELINES[name];

  if (!endpointConfig) {
    throw new Error(`Endpoint desconhecido: ${name}`);
  }

  // Validar filtros
  const sanitizedFilters = sanitizeFilters(filters || {});

  // Caso especial: overview usa getOverviewData
  if (endpointConfig.useOverviewData) {
    // REFATORAÇÃO: getOverviewData não precisa mais de prisma
    return await getOverviewData(getMongoClient, sanitizedFilters);
  }

  // Usar cache inteligente (não precisa mais de prisma)
  return await withSmartCache(
    endpointConfig.cacheKey,
    sanitizedFilters,
    async () => {
      const pipeline = endpointConfig.pipeline(sanitizedFilters);
      const result = await executeAggregation(getMongoClient, pipeline);
      return endpointConfig.formatter(result);
    }
  );
}

/**
 * Agrupar requests por tipo de pipeline para otimização
 */
function groupRequests(requests) {
  const groups = {
    overview: [],
    status: [],
    tema: [],
    assunto: [],
    categoria: [],
    bairro: [],
    orgaoMes: []
  };

  requests.forEach((req, index) => {
    if (groups[req.name]) {
      groups[req.name].push({ ...req, originalIndex: index });
    }
  });

  return groups;
}

/**
 * POST /api/batch
 * Executar múltiplas requisições em uma única chamada
 */
export async function batch(req, res, prisma, getMongoClient) {
  // REFATORAÇÃO: prisma não é mais usado (sistema migrado para Mongoose)
  try {
    const { requests, options = {} } = req.body;

    // Validação
    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'requests deve ser um array não vazio'
      });
    }

    if (requests.length > 50) {
      return res.status(400).json({
        error: 'Too many requests',
        message: 'Máximo de 50 requests por batch'
      });
    }

    // Opções padrão
    const {
      parallel = true,
      timeout = 30000,
      compress = false
    } = options;

    const startTime = Date.now();
    const results = {};
    const errors = {};

    // Agrupar requests por tipo para otimização
    const grouped = groupRequests(requests);

    // Executar requests
    if (parallel) {
      // Executar em paralelo
      const promises = requests.map(async (reqItem, index) => {
        try {
          const result = await Promise.race([
            executeRequest(reqItem.name, reqItem.filters || {}, getMongoClient),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);

          return { index, name: reqItem.name, result, error: null };
        } catch (error) {
          return {
            index,
            name: reqItem.name,
            result: null,
            error: error.message
          };
        }
      });

      const responses = await Promise.allSettled(promises);

      responses.forEach((response, index) => {
        if (response.status === 'fulfilled') {
          const { name, result, error } = response.value;
          if (error) {
            errors[name] = error;
          } else {
            results[name] = result;
          }
        } else {
          errors[requests[index].name] = response.reason?.message || 'Unknown error';
        }
      });
    } else {
      // Executar sequencialmente
      for (let i = 0; i < requests.length; i++) {
        const reqItem = requests[i];
        try {
          const result = await Promise.race([
            executeRequest(reqItem.name, reqItem.filters || {}, getMongoClient),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), timeout)
            )
          ]);

          results[reqItem.name] = result;
        } catch (error) {
          errors[reqItem.name] = error.message;
        }
      }
    }

    const duration = Date.now() - startTime;

    // Preparar resposta
    const response = {
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      meta: {
        total: requests.length,
        success: Object.keys(results).length,
        failed: Object.keys(errors).length,
        duration: `${duration}ms`,
        parallel
      }
    };

    // Log de performance
    if (duration > 1000) {
      console.log(`📦 Batch executado em ${duration}ms: ${Object.keys(results).length}/${requests.length} sucessos`);
    }

    // Compressão (se solicitada e se houver biblioteca disponível)
    if (compress) {
      // Nota: Compressão seria feita pelo middleware Express se configurado
      // Aqui apenas marcamos que a resposta pode ser comprimida
      res.setHeader('Content-Encoding', 'gzip');
    }

    return res.json(response);
  } catch (error) {
    console.error('❌ Erro no batch:', error);
    return res.status(500).json({
      error: 'Batch execution failed',
      message: error.message
    });
  }
}

/**
 * GET /api/batch/endpoints
 * Listar endpoints disponíveis para batch
 */
export async function listEndpoints(req, res) {
  return res.json({
    endpoints: Object.keys(ENDPOINT_PIPELINES).map(name => ({
      name,
      description: `Pipeline de agregação para ${name}`,
      supportsFilters: true,
      cacheTTL: ENDPOINT_PIPELINES[name].ttl
    })),
    maxRequests: 50,
    defaultTimeout: 30000,
    supportsParallel: true,
    supportsCompression: true
  });
}

