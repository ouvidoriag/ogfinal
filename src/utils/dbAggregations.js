/**
 * Utilitários para Agregações MongoDB Nativas
 * 
 * Este módulo encapsula chamadas ao MongoDB nativo para agregações pesadas.
 * Use este módulo ao invés de Prisma para queries analíticas e dashboards.
 * 
 * Regra de Ouro:
 * - Prisma → CRUD, validação, tipagem
 * - Mongo Native → Agregações, pipelines, analytics
 * 
 * OTIMIZAÇÃO: Agora usa pipelines modulares e cache inteligente
 */

import { buildOverviewPipeline as buildOverviewPipelineModular } from './pipelines/overview.js';
import { sanitizeFilters } from './filters/validateFilters.js';
import { withSmartCache } from './cache/smartCache.js';

/**
 * Executar pipeline de agregação MongoDB
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {Array} pipeline - Pipeline de agregação MongoDB
 * @param {string} collection - Nome da collection (padrão: 'records')
 * @param {Object} options - Opções adicionais (allowDiskUse, maxTimeMS, etc.)
 * @returns {Promise<Array>} Resultado da agregação
 */
export async function executeAggregation(getMongoClient, pipeline, collection = 'records', options = {}) {
  try {
    const client = await getMongoClient();

    // Inferir nome do banco a partir da connection string se não houver DB_NAME explícito
    let dbName =
      process.env.DB_NAME ||
      process.env.MONGODB_DB_NAME ||
      null;

    if (!dbName) {
      const url = process.env.DATABASE_URL || process.env.MONGODB_ATLAS_URL || '';
      try {
        // Extrair nome do banco da connection string: mongodb+srv://user:pass@host/dbName?params
        const withoutParams = url.split('?')[0] || '';
        const parts = withoutParams.split('/');
        const candidate = parts[parts.length - 1];
        if (candidate && !candidate.startsWith('mongodb')) {
          dbName = candidate;
        }
      } catch {
        // Fallback silencioso
      }
    }

    // Fallback final caso não consiga inferir
    if (!dbName) {
      dbName = 'dashboard';
    }

    const db = client.db(dbName);

    const defaultOptions = {
      allowDiskUse: pipeline.length > 10 || options.allowDiskUse === true,
      // Aumentar maxTimeMS para ficar alinhado com o timeout global do servidor (120s)
      maxTimeMS: 110000,
      ...options
    };

    const startTime = Date.now();
    const result = await db.collection(collection)
      .aggregate(pipeline, defaultOptions)
      .toArray();
    const duration = Date.now() - startTime;

    // Log de performance apenas se demorar mais que 1s
    if (duration > 1000) {
      console.log(`⏱️ Agregação executada em ${duration}ms (db=${dbName}, collection=${collection})`);
    }

    return result;
  } catch (error) {
    console.error('❌ Erro ao executar agregação:', error);
    // Re-throw para que o controller possa tratar
    throw error;
  }
}

/**
 * Executar agregação com $facet para múltiplas análises em uma query
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {Object} facets - Objeto com facetas a calcular
 * @param {Object} match - Filtros $match iniciais
 * @param {string} collection - Nome da collection
 * @returns {Promise<Object>} Objeto com resultados de cada faceta
 */
export async function executeFacetAggregation(getMongoClient, facets, match = {}, collection = 'records') {
  const pipeline = [];

  // Adicionar $match se houver filtros
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }

  // Construir objeto $facet
  const facetObject = {};
  for (const [name, stages] of Object.entries(facets)) {
    facetObject[name] = stages;
  }

  pipeline.push({ $facet: facetObject });

  const result = await executeAggregation(getMongoClient, pipeline, collection);
  return result[0] || {};
}

/**
 * Pipeline para dados de overview (dashboard)
 * OTIMIZAÇÃO: Agora usa pipeline modular de pipelines/overview.js
 * @param {Object} filters - Filtros a aplicar
 * @returns {Array} Pipeline MongoDB
 */
export function buildOverviewPipeline(filters = {}) {
  // Nota: Filtros já devem estar sanitizados antes de chamar esta função
  // Usar pipeline modular diretamente
  return buildOverviewPipelineModular(filters);
}

/**
 * Converter resultado do pipeline para formato esperado pelo frontend
 * @param {Object} facetResult - Resultado do $facet
 * @returns {Object} Dados formatados para dashboard
 */
export function formatOverviewData(facetResult = {}) {
  // Garantir que facetResult é um objeto
  if (!facetResult || typeof facetResult !== 'object') {
    facetResult = {};
  }

  // CORREÇÃO: Calcular total de múltiplas formas para garantir que sempre temos um valor
  let totalManifestations = 0;

  // Tentar 1: facet total (contagem direta)
  if (facetResult.total && Array.isArray(facetResult.total) && facetResult.total.length > 0) {
    totalManifestations = facetResult.total[0].total || 0;
  }

  // Tentar 2: Se total não veio, calcular a partir das agregações
  if (!totalManifestations || totalManifestations === 0) {
    // Somar todos os status
    if (facetResult.porStatus && Array.isArray(facetResult.porStatus)) {
      totalManifestations = facetResult.porStatus.reduce((sum, item) => sum + (item.count || 0), 0);
    }
    // Se ainda não tiver, tentar somar por mês
    if (!totalManifestations && facetResult.porMes && Array.isArray(facetResult.porMes)) {
      totalManifestations = facetResult.porMes.reduce((sum, item) => sum + (item.count || 0), 0);
    }
    // Se ainda não tiver, tentar somar por dia
    if (!totalManifestations && facetResult.porDia && Array.isArray(facetResult.porDia)) {
      totalManifestations = facetResult.porDia.reduce((sum, item) => sum + (item.count || 0), 0);
    }
  }

  const result = {
    totalManifestations: totalManifestations,
    last7Days: facetResult.last7Days?.[0]?.total || 0,
    last30Days: facetResult.last30Days?.[0]?.total || 0,
    manifestationsByStatus: (facetResult.porStatus || []).map(item => ({
      status: item._id,
      count: item.count,
      _id: item._id // Compatibilidade
    })),
    manifestationsByMonth: (facetResult.porMes || []).map(item => ({
      month: item.month,
      count: item.count,
      ym: item.month, // Compatibilidade
      _id: item.month // Compatibilidade
    })),
    manifestationsByDay: (facetResult.porDia || []).map(item => ({
      date: item.date,
      count: item.count,
      _id: item.date // Compatibilidade
    })),
    manifestationsByTheme: (facetResult.porTema || []).map(item => ({
      theme: item._id,
      count: item.count,
      _id: item._id // Compatibilidade
    })),
    manifestationsBySubject: (facetResult.porAssunto || []).map(item => ({
      subject: item._id,
      count: item.count,
      assunto: item._id, // Compatibilidade
      _id: item._id // Compatibilidade
    })),
    manifestationsByOrgan: (facetResult.porOrgaos || []).map(item => ({
      organ: item._id,
      count: item.count,
      orgaos: item._id, // Compatibilidade
      _id: item._id // Compatibilidade
    })),
    manifestationsByType: (facetResult.porTipo || []).map(item => ({
      type: item._id,
      count: item.count
    })),
    manifestationsByChannel: (facetResult.porCanal || []).map(item => ({
      channel: item._id,
      count: item.count
    })),
    manifestationsByPriority: (facetResult.porPrioridade || []).map(item => ({
      priority: item._id,
      count: item.count
    })),
    manifestationsByUnit: (facetResult.porUnidadeCadastro || []).map(item => ({
      unit: item._id,
      count: item.count,
      unidadeCadastro: item._id // Compatibilidade
    }))
  };

  return result;
}

/**
 * Obter dados de overview usando pipeline otimizado com cache inteligente
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {Object} filters - Filtros a aplicar
 * @param {boolean} useCache - Usar cache inteligente (padrão: true)
 * @returns {Promise<Object>} Dados formatados para dashboard
 */
export async function getOverviewData(getMongoClient, filters = {}, useCache = true) {
  // Validar filtros
  let sanitized = {};
  try {
    sanitized = sanitizeFilters(filters);
  } catch (validationError) {
    console.error('❌ Erro na validação de filtros em getOverviewData:', validationError.message);
    // Se validação falhar, usar filtros vazios
    sanitized = {};
  }

  // Usar cache inteligente se habilitado
  if (useCache) {
    try {
      return await withSmartCache(
        'overview',
        sanitized,
        async () => {
          const pipeline = buildOverviewPipeline(sanitized);
          const result = await executeAggregation(getMongoClient, pipeline);
          const facetResult = result[0] || {};
          return formatOverviewData(facetResult);
        },
        null,
        // Fallback: overview vazio porém bem formatado
        formatOverviewData({})
      );
    } catch (cacheError) {
      console.error('❌ Erro no cache inteligente, executando sem cache:', cacheError.message);
      // Fallback: executar sem cache
    }
  }

  // Sem cache, executar diretamente
  try {
    const pipeline = buildOverviewPipeline(sanitized);

    // Validar pipeline
    if (!Array.isArray(pipeline) || pipeline.length === 0) {
      throw new Error('Pipeline inválido: deve ser um array não vazio');
    }

    const result = await executeAggregation(getMongoClient, pipeline);

    if (!result || !Array.isArray(result) || result.length === 0) {
      console.warn('⚠️ Pipeline retornou resultado vazio');
      return formatOverviewData({});
    }

    const facetResult = result[0] || {};
    return formatOverviewData(facetResult);
  } catch (error) {
    console.error('❌ Erro ao executar pipeline de overview:', error);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

/**
 * Obter valores distintos de um campo
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 * @param {string} field - Campo para obter valores distintos
 * @param {Object} filters - Filtros opcionais
 * @returns {Promise<Array<string>>} Array de valores distintos
 */
export async function getDistinctValues(getMongoClient, field, filters = {}) {
  const pipeline = [];

  // Adicionar $match se houver filtros
  if (Object.keys(filters).length > 0) {
    pipeline.push({ $match: filters });
  }

  // Agrupar por campo e obter valores distintos
  pipeline.push(
    { $group: { _id: `$${field}` } },
    { $match: { _id: { $ne: null, $ne: '' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, value: '$_id' } }
  );

  const result = await executeAggregation(getMongoClient, pipeline);
  return result.map(item => item.value).filter(Boolean);
}

