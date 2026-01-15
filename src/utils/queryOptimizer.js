/**
 * Sistema Global de Otimização de Queries
 * Usa agregações do banco de dados em vez de processar em memória
 * Muito mais rápido e eficiente
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { getDataCriacao } from './formatting/dateUtils.js';
import Record from '../models/Record.model.js';

/**
 * Sanitizar string para garantir UTF-8 válido
 * Remove caracteres inválidos que podem causar erro no MongoDB
 */
function sanitizeUTF8(str) {
  if (typeof str !== 'string') return str;
  try {
    // Tentar decodificar e recodificar para garantir UTF-8 válido
    return Buffer.from(str, 'utf8').toString('utf8');
  } catch (error) {
    // Se falhar, remover caracteres não-ASCII inválidos
    return str.replace(/[^\x00-\x7F]/g, '').trim();
  }
}

/**
 * Obter filtro de data otimizado (últimos 24 meses)
 * @deprecated Para Prisma - use getDateFilterMongo() para MongoDB
 */
export function getDateFilter() {
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setMonth(today.getMonth() - 24);
  const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

  return {
    OR: [
      { dataCriacaoIso: { gte: minDateStr } },
      { dataDaCriacao: { contains: today.getFullYear().toString() } },
      { dataDaCriacao: { contains: (today.getFullYear() - 1).toString() } }
    ]
  };
}

/**
 * Obter filtro de data otimizado para MongoDB (últimos 24 meses)
 * REFATORAÇÃO: Prisma → Mongoose
 */
export function getDateFilterMongo() {
  const today = new Date();
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setMonth(today.getMonth() - 24);
  const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

  return {
    $or: [
      { dataCriacaoIso: { $gte: minDateStr } },
      { dataDaCriacao: { $regex: today.getFullYear().toString() } },
      { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
    ]
  };
}

/**
 * Agregação otimizada usando MongoDB aggregation (muito mais rápido)
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
export async function optimizedGroupBy(prisma, field, where = {}, options = {}) {
  const { limit, sortBy = 'count', sortOrder = 'desc', dateFilter = true } = options;

  try {
    // Construir filtro MongoDB
    const filter = { ...where };

    // Adicionar filtro de data se solicitado
    if (dateFilter) {
      const dateFilterObj = getDateFilterMongo();
      if (Object.keys(filter).length > 0) {
        filter.$and = [
          ...(filter.$and || []),
          dateFilterObj
        ];
      } else {
        Object.assign(filter, dateFilterObj);
      }
    }

    // Pipeline MongoDB para agrupar
    const pipeline = [
      { $match: filter },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { _id: { $ne: null, $ne: '', $exists: true } } },
      { $sort: { count: sortOrder === 'desc' ? -1 : 1 } }
    ];

    if (limit) {
      pipeline.push({ $limit: limit });
    }

    const results = await Record.aggregate(pipeline).allowDiskUse(true);

    // Mapear resultados e sanitizar strings
    const mapped = results
      .filter(r => r._id !== null && r._id !== undefined)
      .map(r => ({
        key: sanitizeUTF8(String(r._id ?? 'Não informado')),
        count: r.count || 0
      }));

    return mapped;
  } catch (error) {
    // Fallback: se aggregation falhar, usar método tradicional (mas otimizado)
    console.warn(`⚠️ groupBy falhou para ${field}, usando fallback:`, error.message);
    return await fallbackGroupBy(prisma, field, where, options);
  }
}

/**
 * Fallback: agregação em memória usando Mongoose (mais lento, mas funciona sempre)
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function fallbackGroupBy(prisma, field, where = {}, options = {}) {
  const { limit, dateFilter = true } = options;

  // Construir filtro MongoDB
  const filter = { ...where };

  // Adicionar filtro de data se solicitado
  if (dateFilter) {
    const dateFilterObj = getDateFilterMongo();
    if (Object.keys(filter).length > 0) {
      filter.$and = [
        ...(filter.$and || []),
        dateFilterObj
      ];
    } else {
      Object.assign(filter, dateFilterObj);
    }
  }

  // Buscar apenas campos necessários usando Mongoose
  const rows = await Record.find(filter)
    .select(field)
    .limit(limit || 100000)
    .lean();

  // Agrupar em memória com sanitização
  const map = new Map();
  for (const row of rows) {
    try {
      const rawKey = row[field] ?? 'Não informado';
      const key = sanitizeUTF8(String(rawKey));
      map.set(key, (map.get(key) || 0) + 1);
    } catch (error) {
      // Ignorar registros com erro de encoding
      continue;
    }
  }

  const result = Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);

  return limit ? result.slice(0, limit) : result;
}

/**
 * Agregação por mês otimizada usando MongoDB aggregation
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
export async function optimizedGroupByMonth(prisma, where = {}, options = {}) {
  const { limit = 24, dateFilter = true } = options; // Últimos 24 meses por padrão

  try {
    // Construir filtro MongoDB
    const filter = { ...where };

    // Garantir que temos data
    filter.$or = [
      ...(filter.$or || []),
      { dataDaCriacao: { $ne: null, $exists: true } },
      { dataCriacaoIso: { $ne: null, $exists: true } }
    ];

    // Adicionar filtro de data se solicitado
    if (dateFilter) {
      const dateFilterObj = getDateFilterMongo();
      filter.$and = [
        ...(filter.$and || []),
        dateFilterObj
      ];
    }

    // Pipeline MongoDB para agrupar por mês
    // Usar pipeline mais seguro que trata strings inválidas
    const pipeline = [
      { $match: filter },
      {
        $project: {
          // Extrair mês de forma segura, evitando $dateFromString que pode falhar com UTF-8 inválido
          month: {
            $cond: {
              if: {
                $and: [
                  { $ne: ['$dataCriacaoIso', null] },
                  { $ne: ['$dataCriacaoIso', ''] },
                  { $gt: [{ $strLenCP: { $ifNull: ['$dataCriacaoIso', ''] } }, 6] }
                ]
              },
              then: { $substr: ['$dataCriacaoIso', 0, 7] },
              else: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$dataDaCriacao', null] },
                      { $ne: ['$dataDaCriacao', ''] },
                      { $gt: [{ $strLenCP: { $ifNull: ['$dataDaCriacao', ''] } }, 6] }
                    ]
                  },
                  then: {
                    // Extrair YYYY-MM diretamente da string usando substr se possível
                    $cond: {
                      if: { $eq: [{ $type: '$dataDaCriacao' }, 'string'] },
                      then: {
                        $cond: {
                          // Se começa com YYYY-MM, usar substr
                          if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{4}-\d{2}/ } },
                          then: { $substr: ['$dataDaCriacao', 0, 7] },
                          else: null
                        }
                      },
                      else: null
                    }
                  },
                  else: null
                }
              }
            }
          }
        }
      },
      { $match: { month: { $ne: null, $exists: true, $type: 'string', $regex: /^\d{4}-\d{2}$/ } } },
      { $group: { _id: '$month', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: limit }
    ];

    const results = await Record.aggregate(pipeline).allowDiskUse(true);

    // Sanitizar resultados e filtrar inválidos
    return results
      .filter(r => r._id && typeof r._id === 'string' && r._id.match(/^\d{4}-\d{2}$/))
      .map(r => ({
        ym: sanitizeUTF8(r._id),
        count: r.count || 0
      }))
      .filter(r => r.ym && r.ym.length === 7);
  } catch (error) {
    // Fallback: se aggregation falhar, usar método tradicional
    console.warn(`⚠️ groupByMonth falhou, usando fallback:`, error.message);
    if (error.message && error.message.includes('UTF-8')) {
      console.warn('⚠️ Erro de encoding UTF-8 detectado, usando fallback seguro');
    }
    try {
      return await fallbackGroupByMonth(prisma, where, { ...options, dateFilter });
    } catch (fallbackError) {
      console.error('❌ Fallback também falhou:', fallbackError.message);
      // Retornar array vazio em vez de quebrar
      return [];
    }
  }
}

/**
 * Fallback: agregação por mês em memória usando Mongoose
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function fallbackGroupByMonth(prisma, where = {}, options = {}) {
  const { limit = 24, dateFilter = true } = options;

  // Construir filtro MongoDB
  const filter = { ...where };

  // Garantir que temos data
  filter.$or = [
    ...(filter.$or || []),
    { dataDaCriacao: { $ne: null, $exists: true } },
    { dataCriacaoIso: { $ne: null, $exists: true } }
  ];

  // Adicionar filtro de data se solicitado
  if (dateFilter) {
    const dateFilterObj = getDateFilterMongo();
    filter.$and = [
      ...(filter.$and || []),
      dateFilterObj
    ];
  }

  // OTIMIZAÇÃO: Reduzir limite para evitar timeout (50k é suficiente para agregações mensais)
  const rows = await Record.find(filter)
    .select('dataCriacaoIso dataDaCriacao data')
    .limit(50000) // Reduzido de 100k para 50k para melhor performance
    .lean();

  const monthMap = new Map();
  for (const r of rows) {
    try {
      // Usar getDataCriacao que já tem fallback para dados da planilha
      const dataCriacao = getDataCriacao(r);
      if (!dataCriacao) continue;

      // Sanitizar string antes de processar
      const dataCriacaoSanitizada = sanitizeUTF8(String(dataCriacao));
      if (!dataCriacaoSanitizada || dataCriacaoSanitizada.length < 7) continue;

      const mes = dataCriacaoSanitizada.slice(0, 7); // YYYY-MM

      // Validar formato YYYY-MM
      if (!mes.match(/^\d{4}-\d{2}$/)) continue;

      monthMap.set(mes, (monthMap.get(mes) || 0) + 1);
    } catch (error) {
      // Ignorar registros com erro de encoding
      if (window.Logger) {
        window.Logger.debug('Registro ignorado por erro de encoding:', error.message);
      }
      continue;
    }
  }

  return Array.from(monthMap.entries())
    .map(([ym, count]) => ({ ym, count }))
    .sort((a, b) => a.ym.localeCompare(b.ym))
    .slice(-limit);
}

/**
 * Contagem otimizada usando countDocuments do Mongoose
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
export async function optimizedCount(prisma, where = {}) {
  const filter = Object.keys(where).length > 0 ? where : {};
  return await Record.countDocuments(filter);
}

/**
 * Valores distintos otimizados usando MongoDB aggregation
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
export async function optimizedDistinct(prisma, field, where = {}, options = {}) {
  const { limit = 1000, dateFilter = true } = options;

  try {
    // Construir filtro MongoDB corretamente
    const filter = {};

    // Adicionar filtros básicos do where
    if (where.servidor) filter.servidor = where.servidor;
    if (where.unidadeCadastro) filter.unidadeCadastro = where.unidadeCadastro;

    // Adicionar filtro de data se solicitado
    if (dateFilter) {
      const today = new Date();
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setMonth(today.getMonth() - 24);
      const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

      // Usar $and para combinar filtros de data com outros filtros
      const dateConditions = [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      ];

      // Se já há outros filtros, usar $and
      if (Object.keys(filter).length > 0) {
        filter.$and = [
          ...(filter.$and || []),
          { $or: dateConditions }
        ];
      } else {
        filter.$or = dateConditions;
      }
    }

    // Usar MongoDB aggregation para obter valores distintos
    // Tentar campo direto primeiro
    const pipeline = [
      { $match: filter },
      { $group: { _id: `$${field}` } },
      { $match: { _id: { $ne: null, $ne: '', $exists: true } } },
      { $sort: { _id: 1 } },
      { $limit: limit }
    ];

    const results = await Record.aggregate(pipeline);

    // Extrair valores e filtrar
    const values = results
      .map(r => r._id)
      .filter(v => v !== null && v !== undefined && `${v}`.trim() !== '')
      .map(v => `${v}`.trim())
      .sort();

    return values;
  } catch (error) {
    // Fallback: buscar e processar em memória
    console.warn(`⚠️ aggregation distinct falhou para ${field}, usando fallback:`, error.message);
    console.error('Erro completo:', error);

    const filter = {};
    if (where.servidor) filter.servidor = where.servidor;
    if (where.unidadeCadastro) filter.unidadeCadastro = where.unidadeCadastro;

    if (dateFilter) {
      const today = new Date();
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setMonth(today.getMonth() - 24);
      const minDateStr = twoYearsAgo.toISOString().slice(0, 10);

      const dateConditions = [
        { dataCriacaoIso: { $gte: minDateStr } },
        { dataDaCriacao: { $regex: today.getFullYear().toString() } },
        { dataDaCriacao: { $regex: (today.getFullYear() - 1).toString() } }
      ];

      if (Object.keys(filter).length > 0) {
        filter.$and = [
          ...(filter.$and || []),
          { $or: dateConditions }
        ];
      } else {
        filter.$or = dateConditions;
      }
    }

    // Tentar buscar o campo diretamente, ou do objeto data
    const selectFields = `${field} data`;

    const rows = await Record.find(filter)
      .select(selectFields)
      .limit(50000)
      .lean();

    const values = new Set();
    for (const r of rows) {
      // Tentar múltiplas formas de acessar o campo
      let val = r[field];
      if (!val && r.data) {
        // Tentar snake_case e outras variações
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        val = r.data[field] || r.data[snakeField] || r.data[field.toLowerCase()];
      }

      if (val !== undefined && val !== null && `${val}`.trim() !== '') {
        values.add(`${val}`.trim());
      }
    }

    return Array.from(values).sort().slice(0, limit);
  }
}

/**
 * Agregação cruzada otimizada usando MongoDB aggregation (ex: por órgão e mês)
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
export async function optimizedCrossAggregation(prisma, field1, field2, where = {}, options = {}) {
  const { dateFilter = true, limit = 10000 } = options;

  try {
    // Construir filtro MongoDB
    const filter = { ...where };

    // Adicionar filtro de data se solicitado
    if (dateFilter) {
      const dateFilterObj = getDateFilterMongo();
      if (Object.keys(filter).length > 0) {
        filter.$and = [
          ...(filter.$and || []),
          dateFilterObj
        ];
      } else {
        Object.assign(filter, dateFilterObj);
      }
    }

    // Se field2 é data, usar pipeline especial para extrair mês
    if (field2 === 'dataDaCriacao' || field2 === 'dataCriacaoIso') {
      const pipeline = [
        { $match: filter },
        {
          $project: {
            field1: `$${field1}`,
            month: {
              $cond: {
                if: { $ne: ['$dataCriacaoIso', null] },
                then: { $substr: ['$dataCriacaoIso', 0, 7] },
                else: {
                  $cond: {
                    if: { $ne: ['$dataDaCriacao', null] },
                    then: {
                      $substr: [
                        {
                          $dateToString: {
                            date: { $dateFromString: { dateString: '$dataDaCriacao' } },
                            format: '%Y-%m'
                          }
                        },
                        0,
                        7
                      ]
                    },
                    else: null
                  }
                }
              }
            }
          }
        },
        { $match: { field1: { $ne: null, $exists: true }, month: { $ne: null, $exists: true } } },
        { $group: { _id: { field1: '$field1', month: '$month' }, count: { $sum: 1 } } },
        { $sort: { '_id.month': 1, '_id.field1': 1 } },
        { $limit: limit }
      ];

      const results = await Record.aggregate(pipeline);

      return results.map(r => ({
        [field1]: r._id.field1 || 'Não informado',
        month: r._id.month,
        count: r.count
      }));
    } else {
      // Pipeline para agregação cruzada normal
      const pipeline = [
        { $match: filter },
        {
          $project: {
            field1: `$${field1}`,
            field2: `$${field2}`
          }
        },
        { $match: { field1: { $ne: null, $exists: true }, field2: { $ne: null, $exists: true } } },
        { $group: { _id: { field1: '$field1', field2: '$field2' }, count: { $sum: 1 } } },
        { $sort: { '_id.field1': 1, '_id.field2': 1 } },
        { $limit: limit }
      ];

      const results = await Record.aggregate(pipeline);

      return results.map(r => ({
        [field1]: r._id.field1 || 'Não informado',
        [field2]: r._id.field2 || 'Não informado',
        count: r.count
      }));
    }
  } catch (error) {
    // Fallback: buscar e processar em memória
    console.warn(`⚠️ crossAggregation falhou, usando fallback:`, error.message);

    const filter = { ...where };
    if (dateFilter) {
      const dateFilterObj = getDateFilterMongo();
      if (Object.keys(filter).length > 0) {
        filter.$and = [
          ...(filter.$and || []),
          dateFilterObj
        ];
      } else {
        Object.assign(filter, dateFilterObj);
      }
    }

    const rows = await Record.find(filter)
      .select(`${field1} ${field2} dataCriacaoIso dataDaCriacao data`)
      .limit(limit)
      .lean();

    const map = new Map();
    for (const r of rows) {
      const val1 = r[field1] || 'Não informado';
      let val2 = r[field2];

      // Se field2 é data, extrair mês (YYYY-MM)
      if (field2 === 'dataDaCriacao' || field2 === 'dataCriacaoIso') {
        if (r.dataCriacaoIso) {
          val2 = r.dataCriacaoIso.slice(0, 7); // YYYY-MM
        } else if (r.dataDaCriacao) {
          const match = r.dataDaCriacao.match(/(\d{4})-(\d{2})/);
          if (match) {
            val2 = `${match[1]}-${match[2]}`;
          } else {
            try {
              const date = new Date(r.dataDaCriacao);
              if (!isNaN(date.getTime())) {
                val2 = date.toISOString().slice(0, 7);
              } else {
                continue;
              }
            } catch {
              continue;
            }
          }
        } else {
          continue;
        }
      } else {
        val2 = val2 || 'Não informado';
      }

      const key = `${val1}|${val2}`;
      map.set(key, (map.get(key) || 0) + 1);
    }

    const result = Array.from(map.entries()).map(([key, count]) => {
      const [val1, val2] = key.split('|');

      if (field2 === 'dataDaCriacao' || field2 === 'dataCriacaoIso') {
        return {
          [field1]: val1,
          month: val2,
          count
        };
      }

      return {
        [field1]: val1,
        [field2]: val2,
        count
      };
    });

    return result.sort((a, b) => {
      if (a.month && b.month && a.month !== b.month) {
        return a.month.localeCompare(b.month);
      }
      const key1 = a[field1] || '';
      const key2 = b[field1] || '';
      return key1.localeCompare(key2);
    });
  }
}

