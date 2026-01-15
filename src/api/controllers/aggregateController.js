/**
 * Controllers de Agregação
 * /api/aggregate/*
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { withCache } from '../../utils/formatting/responseHelper.js';
import { optimizedGroupBy, optimizedGroupByMonth } from '../../utils/queryOptimizer.js';
import { getNormalizedField } from '../../utils/formatting/fieldMapper.js';
import { getDataCriacao, normalizeDate } from '../../utils/formatting/dateUtils.js';
import { executeAggregation } from '../../utils/dbAggregations.js';
import { buildTemaPipeline, buildAssuntoPipeline, buildOrgaoMesPipeline } from '../../utils/pipelines/index.js';
import { formatGroupByResult, formatMonthlySeries } from '../../utils/formatting/dataFormatter.js';
import { sanitizeFilters } from '../../utils/filters/validateFilters.js';
import { withSmartCache } from '../../utils/cache/smartCache.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';

/**
 * GET /api/aggregate/count-by
 * Contagem por campo
 * 
 * PRIORIDADE 3: Documentação completa
 * REFATORAÇÃO: Prisma → Mongoose
 * 
 * @route GET /api/aggregate/count-by
 * @param {string} req.query.field - Campo para agregação (obrigatório)
 * @param {string} [req.query.servidor] - Filtrar por servidor (opcional)
 * @param {string} [req.query.unidadeCadastro] - Filtrar por unidade de cadastro (opcional)
 * @returns {Promise<Array>} Array de objetos {key: string, count: number} ordenado por count decrescente
 * @example
 * // GET /api/aggregate/count-by?field=statusDemanda
 * // Retorna: [{key: "Em Andamento", count: 150}, {key: "Concluído", count: 200}]
 * 
 * @cache TTL: 3600 segundos (1 hora)
 * @performance Usa agregação MongoDB nativa para máxima performance
 */
export async function countBy(req, res) {
  const field = String(req.query.field ?? '').trim();
  if (!field) {
    return res.status(400).json({ error: 'field required' });
  }

  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const cacheKey = servidor ? `countBy:${field}:servidor:${servidor}:v3` :
    unidadeCadastro ? `countBy:${field}:uac:${unidadeCadastro}:v3` :
      `countBy:${field}:v3`;

  // Cache de 1 hora para agregações
  return withCache(cacheKey, 3600, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // OTIMIZAÇÃO: Usar agregação MongoDB nativa
    const col = getNormalizedField(field);
    if (col) {
      // Para campo responsavel, usar pipeline que busca também no campo data
      if (col === 'responsavel') {
        const pipeline = [
          ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
          {
            $project: {
              responsavel: {
                $ifNull: [
                  '$responsavel',
                  {
                    $ifNull: [
                      '$data.responsavel',
                      {
                        $ifNull: [
                          '$data.Responsavel',
                          {
                            $ifNull: [
                              '$data.responsável',
                              {
                                $ifNull: [
                                  '$data.RESPONSAVEL',
                                  null
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          {
            $group: {
              _id: {
                $ifNull: ['$responsavel', 'Não informado']
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ];

        const result = await Record.aggregate(pipeline);
        return result.map(r => ({
          key: r._id && r._id !== 'null' && r._id.trim() !== '' ? r._id : 'Não informado',
          count: r.count
        }));
      }

      // Agregar direto no banco usando MongoDB aggregation
      const pipeline = [
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: { _id: `$${col}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];

      const result = await Record.aggregate(pipeline);
      return result.map(r => ({
        key: r._id ?? 'Não informado',
        count: r.count
      }));
    }

    // Fallback: agrega pelo JSON caso campo não esteja normalizado
    // OTIMIZAÇÃO: Adicionar limite e filtro de data
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    const finalFilter = {
      ...filter,
      $or: [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } }
      ]
    };

    const rows = await Record.find(finalFilter)
      .select('data')
      .limit(20000)
      .lean();

    const map = new Map();
    for (const r of rows) {
      const dat = r.data || {};
      let key;

      // Tratamento especial para campo Responsavel
      if (field && (field.toLowerCase() === 'responsavel' || field === 'Responsavel')) {
        key = r.responsavel ||
          dat.responsavel ||
          dat.Responsavel ||
          dat.responsável ||
          dat.RESPONSAVEL ||
          dat['responsavel'] ||
          dat['Responsavel'] ||
          'Não informado';
      } else {
        // Busca genérica com variações
        key = dat?.[field] ??
          dat?.[field.toLowerCase()] ??
          dat?.[field.replace(/\s+/g, '_')] ??
          dat?.[field.replace(/\s+/g, '-')] ??
          'Não informado';
      }

      // Normalizar: remover null, undefined, strings vazias
      if (!key || key === 'null' || key === 'undefined' || String(key).trim() === '') {
        key = 'Não informado';
      }

      const k = `${key}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  });
}

/**
 * GET /api/aggregate/time-series
 * Série temporal por campo de data
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function timeSeries(req, res) {
  const field = String(req.query.field ?? '').trim();
  if (!field) {
    return res.status(400).json({ error: 'field required' });
  }

  const cacheKey = `ts:${field}:v3`;
  // Cache de 1 hora para séries temporais
  return withCache(cacheKey, 3600, res, async () => {
    // Se pediram Data, usar sistema global de datas
    if (field === 'Data' || field === 'data_da_criacao') {
      const dateFilter = getDateFilter();

      try {
        // Usar agregação MongoDB nativa (muito mais rápido)
        const pipeline = [
          {
            $match: {
              dataCriacaoIso: { $ne: null, ...dateFilter }
            }
          },
          {
            $group: {
              _id: '$dataCriacaoIso',
              count: { $sum: 1 }
            }
          },
          {
            $sort: { _id: 1 }
          }
        ];

        const results = await Record.aggregate(pipeline);

        return results
          .filter(r => r._id)
          .map(r => ({ date: r._id, count: r.count }))
          .sort((a, b) => a.date.localeCompare(b.date));
      } catch (error) {
        // Fallback: processar em memória
        logger.warn('groupBy falhou para time-series, usando fallback:', { error: error.message });
        const mongoFilter = {
          dataDaCriacao: { $ne: null },
          ...dateFilter
        };

        const rows = await Record.find(mongoFilter)
          .select('dataCriacaoIso dataDaCriacao')
          .limit(20000)
          .lean();

        const map = new Map();
        for (const r of rows) {
          const dataCriacao = getDataCriacao(r);
          if (dataCriacao) {
            map.set(dataCriacao, (map.get(dataCriacao) || 0) + 1);
          }
        }

        return Array.from(map.entries())
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }
    }

    // Para outros campos, usar método genérico
    return [];
  });
}

/**
 * GET /api/aggregate/by-theme
 * Agregação por tema
 * OTIMIZAÇÃO: Usa pipeline MongoDB nativo com cache inteligente
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function byTheme(req, res, getMongoClient) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  // Construir filtros
  const filters = {};
  if (servidor) filters.servidor = servidor;
  if (unidadeCadastro) filters.unidadeCadastro = unidadeCadastro;

  // Validar filtros
  const sanitizedFilters = sanitizeFilters(filters);

  // REFATORAÇÃO FASE 4: Remover cache duplo - usar APENAS withSmartCache para filtros dinâmicos
  // Não usar withCache() + withSmartCache() (cache duplo)
  try {
    // Usar cache inteligente com Mongoose (único cache)
    if (getMongoClient) {
      const result = await withSmartCache(
        'tema',
        sanitizedFilters,
        async () => {
          const pipeline = buildTemaPipeline(sanitizedFilters, 50);
          const result = await executeAggregation(getMongoClient, pipeline);
          return formatGroupByResult(result, '_id', 'count');
        },
        null,
        [] // Fallback seguro: lista vazia
      );
      return res.json(result);
    }

    // Fallback para Mongoose aggregation
    const pipeline = [
      ...(Object.keys(sanitizedFilters).length > 0 ? [{ $match: sanitizedFilters }] : []),
      { $group: { _id: '$tema', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];

    const rows = await Record.aggregate(pipeline);
    const result = formatGroupByResult(rows.map(r => ({ _id: r._id ?? 'Não informado', count: r.count })));
    return res.json(result);
  } catch (error) {
    logger.error('Erro ao buscar dados por tema:', { error: error.message });
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

/**
 * GET /api/aggregate/by-subject
 * Agregação por assunto
 * OTIMIZAÇÃO: Usa pipeline MongoDB nativo com cache inteligente
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function bySubject(req, res, getMongoClient) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  // Construir filtros
  const filters = {};
  if (servidor) filters.servidor = servidor;
  if (unidadeCadastro) filters.unidadeCadastro = unidadeCadastro;

  // Validar filtros
  const sanitizedFilters = sanitizeFilters(filters);

  // REFATORAÇÃO FASE 4: Remover cache duplo - usar APENAS withSmartCache para filtros dinâmicos
  // Não usar withCache() + withSmartCache() (cache duplo)
  try {
    // Usar cache inteligente com Mongoose (único cache)
    if (getMongoClient) {
      const result = await withSmartCache(
        'assunto',
        sanitizedFilters,
        async () => {
          const pipeline = buildAssuntoPipeline(sanitizedFilters, 50);
          const result = await executeAggregation(getMongoClient, pipeline);
          return formatGroupByResult(result, '_id', 'count');
        },
        null,
        [] // Fallback seguro
      );
      return res.json(result);
    }

    // Fallback para Mongoose aggregation
    const pipeline = [
      ...(Object.keys(sanitizedFilters).length > 0 ? [{ $match: sanitizedFilters }] : []),
      { $group: { _id: '$assunto', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];

    const rows = await Record.aggregate(pipeline);
    const result = formatGroupByResult(rows.map(r => ({ _id: r._id ?? 'Não informado', count: r.count })));
    return res.json(result);
  } catch (error) {
    logger.error('Erro ao buscar dados por assunto:', { error: error.message });
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
}

/**
 * GET /api/aggregate/by-server
 * Agregação por servidor/cadastrante
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function byServer(req, res) {
  const unidadeCadastro = req.query.unidadeCadastro;
  const cacheKey = unidadeCadastro ? `byServer:uac:${unidadeCadastro}:v3` : 'byServer:v3';

  return withCache(cacheKey, 3600, res, async () => {
    const filter = unidadeCadastro ? { unidadeCadastro } : {};

    const pipeline = [
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      { $group: { _id: '$servidor', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];

    const rows = await Record.aggregate(pipeline);
    return rows
      .map(r => ({ servidor: r._id ?? 'Não informado', quantidade: r.count }))
      .sort((a, b) => b.quantidade - a.quantidade);
  });
}

/**
 * GET /api/aggregate/by-month
 * Agregação por mês
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function byMonth(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const cacheKey = servidor ? `byMonth:servidor:${servidor}:v3` :
    unidadeCadastro ? `byMonth:uac:${unidadeCadastro}:v3` :
      'byMonth:v3';

  // Timeout maior para agregações pesadas (60s)
  return withCache(cacheKey, 3600, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Usar função otimizada (precisa atualizar para Mongoose)
    const results = await optimizedGroupByMonth(null, filter, { dateFilter: true, limit: 24 });

    return results.map(r => ({
      month: r.ym,
      count: r.count
    }));
  }, null, 60000); // Timeout de 60s
}

/**
 * GET /api/aggregate/by-day
 * Agregação por dia (últimos 30 dias)
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function byDay(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const cacheKey = servidor ? `byDay:servidor:${servidor}:v3` :
    unidadeCadastro ? `byDay:uac:${unidadeCadastro}:v3` :
      'byDay:v3';

  return withCache(cacheKey, 3600, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    const today = new Date();
    const d30 = new Date(today);
    d30.setDate(today.getDate() - 29);
    const last30Str = d30.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const dateFilter = {
      ...filter,
      dataCriacaoIso: { $gte: last30Str, $lte: todayStr }
    };

    const rows = await Record.find(dateFilter)
      .select('dataCriacaoIso dataDaCriacao')
      .limit(20000)
      .lean();

    const dayMap = new Map();
    for (const r of rows) {
      const dataCriacao = getDataCriacao(r);
      if (dataCriacao) {
        dayMap.set(dataCriacao, (dayMap.get(dataCriacao) || 0) + 1);
      }
    }

    return Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

/**
 * GET /api/aggregate/heatmap
 * Heatmap por mês x dimensão
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function heatmap(req, res) {
  const dimReq = String(req.query.dim ?? 'Categoria');
  const cacheKey = `heatmap:${dimReq}:v3`;

  return withCache(cacheKey, 3600, res, async () => {
    const col = getNormalizedField(dimReq);
    if (!col) {
      return res.status(400).json({ error: 'dim must be one of Secretaria, Setor, Tipo, Categoria, Bairro, Status, UAC, Responsavel, Canal, Prioridade' });
    }

    // Construir últimos 12 meses como labels YYYY-MM
    const labels = [];
    const today = new Date();
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      labels.push(ym);
    }

    // Filtrar apenas últimos 24 meses
    const todayForHeatmap = new Date();
    const twoYearsAgo = new Date(todayForHeatmap);
    twoYearsAgo.setMonth(todayForHeatmap.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    const mongoFilter = {
      dataDaCriacao: { $ne: null },
      $or: [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: todayForHeatmap.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (todayForHeatmap.getFullYear() - 1).toString() } }
      ]
    };

    const selectFields = {
      dataCriacaoIso: 1,
      dataDaCriacao: 1,
      [col]: 1
    };

    const rows = await Record.find(mongoFilter)
      .select(selectFields)
      .limit(20000)
      .lean();

    const { getMes } = await import('../../utils/formatting/dateUtils.js');
    const matrix = new Map();
    for (const r of rows) {
      const mes = getMes(r);
      if (!mes || !labels.includes(mes)) continue;
      const key = r[col] ?? 'Não informado';
      if (!matrix.has(key)) matrix.set(key, new Map(labels.map(l => [l, 0])));
      const inner = matrix.get(key);
      inner.set(mes, (inner.get(mes) ?? 0) + 1);
    }

    // Selecionar top 10 chaves pelo total
    const totals = Array.from(matrix.entries()).map(([k, m]) => ({ key: k, total: Array.from(m.values()).reduce((a, b) => a + b, 0) }));
    totals.sort((a, b) => b.total - a.total);
    const topKeys = totals.slice(0, 10).map(x => x.key);

    const data = topKeys.map(k => ({ key: k, values: labels.map(ym => matrix.get(k)?.get(ym) ?? 0) }));
    return { labels, rows: data };
  });
}

/**
 * GET /api/aggregate/filtered
 * Dados filtrados por servidor ou unidade
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function filtered(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  if (!servidor && !unidadeCadastro) {
    return res.status(400).json({ error: 'servidor ou unidadeCadastro required' });
  }

  const cacheKey = servidor ? `filtered:servidor:${servidor}:v2` :
    `filtered:uac:${unidadeCadastro}:v2`;

  return withCache(cacheKey, 300, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    const total = await Record.countDocuments(filter);

    // Dados por mês
    // OTIMIZAÇÃO: Adicionar filtro de data e limite
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    const finalFilter = {
      ...filter,
      dataDaCriacao: { $ne: null },
      $or: [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } }
      ]
    };

    const rows = await Record.find(finalFilter)
      .select('dataCriacaoIso dataDaCriacao')
      .limit(20000)
      .lean();

    const { getMes } = await import('../../utils/formatting/dateUtils.js');
    const monthMap = new Map();
    for (const r of rows) {
      const mes = getMes(r);
      if (!mes) continue;
      monthMap.set(mes, (monthMap.get(mes) ?? 0) + 1);
    }
    const byMonth = Array.from(monthMap.entries()).map(([ym, count]) => ({ ym, count }))
      .sort((a, b) => a.ym.localeCompare(b.ym)).slice(-12);

    // Executar agregações em paralelo usando MongoDB aggregation
    const [temas, assuntos, status, uacs] = await Promise.all([
      Record.aggregate([
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: { _id: '$tema', count: { $sum: 1 } } }
      ]),
      Record.aggregate([
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: { _id: '$assunto', count: { $sum: 1 } } }
      ]),
      Record.aggregate([
        ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      servidor ? Record.aggregate([
        { $match: { servidor } },
        { $group: { _id: '$unidadeCadastro', count: { $sum: 1 } } }
      ]) : Promise.resolve([])
    ]);

    const byTheme = temas.map(r => ({ tema: r._id ?? 'Não informado', quantidade: r.count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const bySubject = assuntos.map(r => ({ assunto: r._id ?? 'Não informado', quantidade: r.count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const byStatus = status.map(r => ({ status: r._id ?? 'Não informado', quantidade: r.count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    const unidadesCadastradas = uacs.map(r => ({ unidade: r._id ?? 'Não informado', quantidade: r.count }))
      .sort((a, b) => b.quantidade - a.quantidade);

    return {
      total,
      byMonth,
      byTheme,
      bySubject,
      byStatus,
      unidadesCadastradas,
      filter: servidor ? { type: 'servidor', value: servidor } : { type: 'unidadeCadastro', value: unidadeCadastro }
    };
  });
}

/**
 * GET /api/aggregate/sankey-flow
 * Dados cruzados para Sankey: Tema → Órgão → Status
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function sankeyFlow(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  const cacheKey = servidor ? `sankey:servidor:${servidor}:v2` :
    unidadeCadastro ? `sankey:uac:${unidadeCadastro}:v2` :
      'sankey:v2';

  return withCache(cacheKey, 3600, res, async () => {
    const filter = {};
    if (servidor) filter.servidor = servidor;
    if (unidadeCadastro) filter.unidadeCadastro = unidadeCadastro;

    // Filtrar apenas últimos 24 meses
    const today = new Date();
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setMonth(today.getMonth() - 24);
    const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

    const finalFilter = {
      ...filter,
      tema: { $ne: null },
      orgaos: { $ne: null },
      status: { $ne: null },
      $or: [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      ]
    };

    const records = await Record.find(finalFilter)
      .select('tema orgaos status')
      .limit(20000)
      .lean();

    // Agrupar por combinações tema-órgão-status
    const flowMap = new Map();
    records.forEach(r => {
      const tema = r.tema || 'Não informado';
      const orgao = r.orgaos || 'Não informado';
      const status = r.status || 'Não informado';

      const key1 = `${tema}|${orgao}`;
      flowMap.set(key1, (flowMap.get(key1) || 0) + 1);

      const key2 = `${orgao}|${status}`;
      flowMap.set(key2, (flowMap.get(key2) || 0) + 1);
    });

    // Contar frequência de cada tema, órgão e status
    const temaCount = new Map();
    const orgaoCount = new Map();
    const statusCount = new Map();

    records.forEach(r => {
      const tema = r.tema || 'Não informado';
      const orgao = r.orgaos || 'Não informado';
      const status = r.status || 'Não informado';

      temaCount.set(tema, (temaCount.get(tema) || 0) + 1);
      orgaoCount.set(orgao, (orgaoCount.get(orgao) || 0) + 1);
      statusCount.set(status, (statusCount.get(status) || 0) + 1);
    });

    // Top temas, órgãos e status
    const topTemas = Array.from(temaCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tema]) => tema);

    const topOrgaos = Array.from(orgaoCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([orgao]) => orgao);

    const topStatuses = Array.from(statusCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([status]) => status);

    // Criar links apenas para os tops
    const links = [];

    topTemas.forEach(tema => {
      topOrgaos.forEach(orgao => {
        const key = `${tema}|${orgao}`;
        const value = flowMap.get(key) || 0;
        if (value > 0) {
          links.push({ source: tema, target: orgao, value, type: 'tema-orgao' });
        }
      });
    });

    topOrgaos.forEach(orgao => {
      topStatuses.forEach(status => {
        const key = `${orgao}|${status}`;
        const value = flowMap.get(key) || 0;
        if (value > 0) {
          links.push({ source: orgao, target: status, value, type: 'orgao-status' });
        }
      });
    });

    return {
      nodes: {
        temas: topTemas,
        orgaos: topOrgaos,
        statuses: topStatuses
      },
      links: links.filter(l => l.value > 0).sort((a, b) => b.value - a.value)
    };
  });
}

/**
 * GET /api/aggregate/count-by-status-mes
 * Status por mês ou campo por mês (se field for especificado)
 * Query params: field (opcional - Tema, Assunto, etc.), servidor, unidadeCadastro
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function countByStatusMes(req, res) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;
  const field = req.query.field; // Campo opcional (Tema, Assunto, etc.)

  // Cache key inclui o field se especificado
  const cacheKey = field
    ? (servidor ? `statusMes:${field}:servidor:${servidor}:v2` :
      unidadeCadastro ? `statusMes:${field}:uac:${unidadeCadastro}:v2` :
        `statusMes:${field}:v2`)
    : (servidor ? `statusMes:servidor:${servidor}:v1` :
      unidadeCadastro ? `statusMes:uac:${unidadeCadastro}:v1` :
        'statusMes:v1');

  // Timeout maior para agregações pesadas (60s)
  return withCache(cacheKey, 3600, res, async () => {
    // REFATORAÇÃO: Prisma → Mongoose - construir filtro MongoDB
    const mongoFilter = {};
    if (servidor) mongoFilter.servidor = servidor;
    if (unidadeCadastro) mongoFilter.unidadeCadastro = unidadeCadastro;

    // Garantir que temos data
    mongoFilter.$or = [
      { dataCriacaoIso: { $ne: null, $exists: true } },
      { dataDaCriacao: { $ne: null, $exists: true } }
    ];

    // Selecionar campos necessários
    const selectFields = [];
    selectFields.push('dataCriacaoIso', 'dataDaCriacao');

    // Adicionar campo dinâmico se especificado
    if (field) {
      const fieldLower = field.toLowerCase();
      // Mapear nomes do frontend para campos do banco
      if (fieldLower === 'tema') {
        selectFields.push('tema');
      } else if (fieldLower === 'assunto') {
        selectFields.push('assunto');
      } else if (fieldLower === 'categoria') {
        selectFields.push('categoria');
      } else if (fieldLower === 'status') {
        selectFields.push('status');
      } else if (fieldLower === 'tipodemanifestacao' || fieldLower === 'tipo') {
        selectFields.push('tipoDeManifestacao');
      } else if (fieldLower === 'orgaos' || fieldLower === 'orgao' || fieldLower === 'secretaria') {
        selectFields.push('orgaos');
      } else if (fieldLower === 'responsavel') {
        selectFields.push('responsavel');
        selectFields.push('data'); // Incluir data para buscar variações
      } else {
        // Tentar usar o campo diretamente
        selectFields.push(field);
      }
    } else {
      selectFields.push('status');
    }

    // OTIMIZAÇÃO: Limitar quantidade de registros para evitar timeout
    const rows = await Record.find(mongoFilter)
      .select(selectFields.join(' '))
      .limit(20000)
      .lean();

    // Usar getDataCriacao que já está importado
    const map = new Map();

    for (const r of rows) {
      const dataCriacao = getDataCriacao(r);
      if (!dataCriacao) continue;
      const mes = dataCriacao.slice(0, 7); // YYYY-MM

      // Obter valor do campo dinâmico
      let fieldValue;
      if (field) {
        const fieldLower = field.toLowerCase();
        if (fieldLower === 'tema') {
          fieldValue = r.tema || (r.data && typeof r.data === 'object' ? r.data.tema : null) || 'Não informado';
        } else if (fieldLower === 'assunto') {
          fieldValue = r.assunto || (r.data && typeof r.data === 'object' ? r.data.assunto : null) || 'Não informado';
        } else if (fieldLower === 'categoria') {
          fieldValue = r.categoria || (r.data && typeof r.data === 'object' ? r.data.categoria : null) || 'Não informado';
        } else if (fieldLower === 'tipodemanifestacao' || fieldLower === 'tipo') {
          fieldValue = r.tipoDeManifestacao || (r.data && typeof r.data === 'object' ? r.data.tipoDeManifestacao : null) || 'Não informado';
        } else if (fieldLower === 'orgaos' || fieldLower === 'orgao' || fieldLower === 'secretaria') {
          fieldValue = r.orgaos || r.secretaria || (r.data && typeof r.data === 'object' ? (r.data.orgaos || r.data.secretaria) : null) || 'Não informado';
        } else if (fieldLower === 'responsavel') {
          // Buscar responsável em múltiplas variações
          fieldValue = r.responsavel ||
            (r.data && typeof r.data === 'object' ? (
              r.data.responsavel ||
              r.data.Responsavel ||
              r.data.responsável ||
              r.data.RESPONSAVEL ||
              r.data['responsavel'] ||
              r.data['Responsavel']
            ) : null) ||
            'Não informado';
          // Normalizar: remover null, undefined, strings vazias
          if (!fieldValue || fieldValue === 'null' || fieldValue === 'undefined' || String(fieldValue).trim() === '') {
            fieldValue = 'Não informado';
          }
        } else {
          fieldValue = r[field] || (r.data && typeof r.data === 'object' ? r.data[field] : null) || 'Não informado';
        }
      } else {
        fieldValue = r.status || 'Não informado';
      }

      const key = `${fieldValue}|${mes}`;
      map.set(key, (map.get(key) || 0) + 1);
    }

    // Formatar resultado - manter compatibilidade com frontend
    const result = Array.from(map.entries()).map(([key, count]) => {
      const [value, month] = key.split('|');

      // Formato esperado pelo frontend
      const obj = {
        month,
        count
      };

      // Adicionar campo dinâmico
      if (field) {
        const fieldLower = field.toLowerCase();
        if (fieldLower === 'tema') {
          obj.theme = value;
          obj.tema = value; // Compatibilidade
        } else if (fieldLower === 'assunto') {
          obj.assunto = value;
        } else if (fieldLower === 'categoria') {
          obj.categoria = value;
        } else if (fieldLower === 'tipodemanifestacao' || fieldLower === 'tipo') {
          obj.tipo = value;
          obj.tipoDeManifestacao = value; // Compatibilidade
        } else if (fieldLower === 'orgaos' || fieldLower === 'orgao' || fieldLower === 'secretaria') {
          obj.orgaos = value;
          obj.organ = value; // Compatibilidade
        } else if (fieldLower === 'responsavel') {
          obj.responsavel = value;
          obj._id = value; // Compatibilidade com frontend
        } else {
          obj[fieldLower] = value;
        }
      } else {
        obj.status = value;
      }

      return obj;
    }).sort((a, b) => {
      if (a.month !== b.month) return a.month.localeCompare(b.month);
      // Ordenar por valor do campo
      const fieldName = field ? (field.toLowerCase() === 'tema' ? 'theme' : field.toLowerCase()) : 'status';
      return (a[fieldName] || '').localeCompare(b[fieldName] || '');
    });

    return result;
  }, null, 60000); // Timeout de 60s para agregações pesadas (memoryCache=null, timeoutMs=60000)
}

/**
 * GET /api/aggregate/count-by-orgao-mes
 * Órgão por mês
 * OTIMIZAÇÃO: Usa pipeline MongoDB nativo com cache inteligente
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
/**
 * GET /api/aggregate/count-by-orgao-mes
 * Agregação por órgão e mês
 * 
 * PRIORIDADE 3: Documentação completa
 * 
 * @route GET /api/aggregate/count-by-orgao-mes
 * @param {string} [req.query.servidor] - Filtrar por servidor (opcional)
 * @param {string} [req.query.unidadeCadastro] - Filtrar por unidade de cadastro (opcional)
 * @param {Function} getMongoClient - Cliente MongoDB nativo
 * @returns {Promise<Object>} Objeto com {orgaos: Array, mensal: Array}
 * @example
 * // GET /api/aggregate/count-by-orgao-mes
 * // Retorna: {orgaos: [{key: "Secretaria X", count: 50}], mensal: [{ym: "2024-01", count: 100}]}
 * 
 * @cache TTL: 3600 segundos (1 hora)
 * @performance Usa pipeline MongoDB otimizado com $facet
 */
export async function countByOrgaoMes(req, res, getMongoClient) {
  const servidor = req.query.servidor;
  const unidadeCadastro = req.query.unidadeCadastro;

  // Construir filtros
  const filters = {};
  if (servidor) filters.servidor = servidor;
  if (unidadeCadastro) filters.unidadeCadastro = unidadeCadastro;

  // Validar filtros
  const sanitizedFilters = sanitizeFilters(filters);

  // Cache inteligente
  const cacheKey = servidor ? `orgaoMes:servidor:${servidor}:v4` :
    unidadeCadastro ? `orgaoMes:uac:${unidadeCadastro}:v4` :
      'orgaoMes:v4';

  return withCache(cacheKey, 3600, res, async () => {
    try {
      // Usar cache inteligente com Mongoose
      if (getMongoClient) {
        return await withSmartCache(
          'orgaoMes',
          sanitizedFilters,
          async () => {
            const pipeline = buildOrgaoMesPipeline(sanitizedFilters, 20, 12);
            const result = await executeAggregation(getMongoClient, pipeline);
            // Formatar resultado para o formato esperado
            return result.map(item => ({
              orgao: item.orgao,
              month: item.month,
              count: item.count
            }));
          },
          null,
          [] // Fallback seguro
        );
      }

      // Fallback para Mongoose aggregation
      throw new Error('getMongoClient não disponível');
    } catch (error) {
      logger.error('Erro ao buscar dados por órgão e mês:', { error: error.message });
      throw error;
    }
  });
}

/**
 * GET /api/aggregate/by-district
 * Agregação por distrito
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 */
export async function byDistrict(req, res) {
  // Este endpoint está implementado no geographicController
  // Mas mantemos aqui para compatibilidade com a rota de aggregate
  const { aggregateByDistrict } = await import('./geographicController.js');
  return aggregateByDistrict(req, res);
}

/**
 * GET /api/aggregate/top-protocolos-demora
 * Busca os 10 protocolos com maior tempo de resolução
 * 
 * Calcula o tempo de resolução como:
 * - Se concluído: dataConclusaoIso - dataCriacaoIso
 * - Se não concluído: data atual - dataCriacaoIso
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * NOTA: Esta funcionalidade foi removida da interface, mas o endpoint permanece para compatibilidade
 */
export async function topProtocolosDemora(req, res, getMongoClient) {
  const limit = parseInt(req.query.limit) || 10;

  const cacheKey = `topProtocolosDemora:${limit}:v1`;

  return withCache(cacheKey, 300, res, async () => {
    try {
      // Buscar todos os registros com protocolo e data de criação
      const records = await Record.find({
        protocolo: { $exists: true, $ne: null, $ne: '' },
        $or: [
          { dataCriacaoIso: { $exists: true, $ne: null, $ne: '' } },
          { dataDaCriacao: { $exists: true, $ne: null, $ne: '' } }
        ]
      })
        .select('protocolo dataCriacaoIso dataDaCriacao dataConclusaoIso dataDaConclusao statusDemanda status tema assunto orgaos responsavel')
        .lean();

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // Calcular tempo de resolução para cada protocolo
      const protocolosComDemora = records
        .map(record => {
          // Obter data de criação (prioridade: dataCriacaoIso > dataDaCriacao)
          let dataCriacao = null;
          if (record.dataCriacaoIso) {
            dataCriacao = new Date(record.dataCriacaoIso + 'T00:00:00');
          } else if (record.dataDaCriacao) {
            // Tentar normalizar dataDaCriacao
            const normalized = normalizeDate(record.dataDaCriacao);
            if (normalized) {
              dataCriacao = new Date(normalized + 'T00:00:00');
            }
          }

          if (!dataCriacao || isNaN(dataCriacao.getTime())) {
            return null;
          }

          // Obter data de conclusão (se existir)
          let dataConclusao = null;
          let concluido = false;

          if (record.dataConclusaoIso) {
            dataConclusao = new Date(record.dataConclusaoIso + 'T00:00:00');
            concluido = true;
          } else if (record.dataDaConclusao) {
            const normalized = normalizeDate(record.dataDaConclusao);
            if (normalized) {
              dataConclusao = new Date(normalized + 'T00:00:00');
              concluido = true;
            }
          }

          // Calcular tempo de resolução em dias
          const dataFim = concluido && dataConclusao ? dataConclusao : hoje;
          const diffMs = dataFim.getTime() - dataCriacao.getTime();
          const tempoDemoraDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          // Ignorar se tempo negativo (erro de data)
          if (tempoDemoraDias < 0) {
            return null;
          }

          return {
            protocolo: record.protocolo || 'N/A',
            tempoDemoraDias: tempoDemoraDias,
            dataCriacao: record.dataCriacaoIso || record.dataDaCriacao || 'N/A',
            dataConclusao: record.dataConclusaoIso || record.dataDaConclusao || null,
            concluido: concluido,
            statusDemanda: record.statusDemanda || record.status || 'N/A',
            tema: record.tema || 'N/A',
            assunto: record.assunto || 'N/A',
            orgaos: record.orgaos || 'N/A',
            responsavel: record.responsavel || 'N/A'
          };
        })
        .filter(item => item !== null)
        .sort((a, b) => b.tempoDemoraDias - a.tempoDemoraDias)
        .slice(0, limit);

      return {
        total: protocolosComDemora.length,
        protocolos: protocolosComDemora
      };
    } catch (error) {
      logger.error('Erro ao buscar protocolos com maior tempo de resolução:', { error: error.message });
      throw error;
    }
  });
}

