/**
 * Controller de Filtros
 * POST /api/filter
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * OTIMIZAÇÃO: Usa MongoDB Native para queries mais eficientes
 * Suporta paginação cursor-based opcional
 */

import { getNormalizedField } from '../../utils/formatting/fieldMapper.js';
import { paginateWithCursor } from '../../utils/cursorPagination.js';
import Record from '../../models/Record.model.js';
import { logger } from '../../utils/logger.js';
import { getOverviewData } from '../../utils/dbAggregations.js';
import { normalizeFilters } from '../../utils/filters/normalizeFilters.js';
import { limitMultiSelect } from '../../utils/filters/limitMultiSelect.js';
import { CompositeFilter } from '../../utils/filters/compositeFilters.js';

/**
 * POST /api/filter
 * Filtro dinâmico de registros
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} getMongoClient - Função para obter cliente MongoDB nativo
 */
export async function filterRecords(req, res, getMongoClient) {
  try {
    let filters = Array.isArray(req.body?.filters) ? req.body.filters : [];
    const originalUrl = req.body?.originalUrl || '';

    // MELHORIA: Suporte a filtros compostos (estrutura básica)
    // Verificar se é um filtro composto (tem operator e filters)
    let isComposite = false;
    let compositeFilter = null;

    if (req.body?.operator && Array.isArray(req.body?.filters)) {
      // É um filtro composto
      try {
        compositeFilter = CompositeFilter.fromJSON(req.body);
        const validation = compositeFilter.validate();
        if (validation.valid) {
          isComposite = true;
          logger.debug('/api/filter: Filtro composto detectado', {
            operator: compositeFilter.operator,
            filtersCount: compositeFilter.filters.length
          });
        } else {
          logger.warn('/api/filter: Filtro composto inválido, usando formato simples:', validation.error);
        }
      } catch (error) {
        logger.warn('/api/filter: Erro ao processar filtro composto, usando formato simples:', error.message);
      }
    }

    // Se não há filtros, retornar vazio
    if (filters.length === 0 && !isComposite) {
      logger.warn('/api/filter: Chamado SEM filtros! Retornando array vazio.');
      return res.json([]);
    }

    // MELHORIA: Limitar MultiSelect (arrays muito grandes)
    if (!isComposite) {
      filters = limitMultiSelect(filters);

      // MELHORIA: Normalizar filtros (remover duplicatas, combinar ranges, unificar operadores)
      filters = normalizeFilters(filters);
    }

    // Debug: log dos filtros recebidos e normalizados
    logger.debug('/api/filter: Filtros recebidos e normalizados', {
      original: req.body?.filters?.length || 0,
      normalized: filters.length,
      isComposite,
      filters
    });

    // Construir filtro MongoDB otimizado
    let mongoFilter = {};
    const needsInMemoryFilter = [];
    const fieldsNeeded = new Set(['_id', 'data']);

    // MELHORIA: Se for filtro composto, usar conversão direta
    if (isComposite && compositeFilter) {
      mongoFilter = compositeFilter.toMongoQuery(getNormalizedField);
      logger.debug('/api/filter: Filtro composto convertido para MongoDB', {
        mongoFilter,
        operator: compositeFilter.operator
      });
      // Para filtros compostos, precisamos buscar todos os campos possíveis
      // (a validação de campos será feita em memória se necessário)
    } else {
      // Processar filtros simples (código existente)
      // Separar filtros que podem usar $match do MongoDB
      for (const f of filters) {
        const col = getNormalizedField(f.field);

        // Se o campo está normalizado no schema, tentar usar $match
        if (col && f.op === 'eq') {
          // Tentar filtrar pelo campo normalizado
          // Se o valor for array, usar $in automaticamente
          if (Array.isArray(f.value)) {
            mongoFilter[col] = { $in: f.value };
          } else {
            mongoFilter[col] = f.value;
          }
          fieldsNeeded.add(col);
        } else if (col && f.op === 'in') {
          // Operador 'in' explícito para seleção múltipla
          const values = Array.isArray(f.value) ? f.value : [f.value];
          mongoFilter[col] = { $in: values };
          fieldsNeeded.add(col);
        } else if (col && f.op === 'contains') {
          // MELHORIA: Otimização de "contains" usando campos lowercase indexados
          // Para campos de data, usar regex se o valor for no formato YYYY-MM
          if ((col === 'dataDaCriacao' || col === 'dataCriacaoIso') && /^\d{4}-\d{2}$/.test(f.value)) {
            // Filtro por mês: usar regex para melhor performance
            mongoFilter[col] = { $regex: `^${f.value}`, $options: 'i' };
            fieldsNeeded.add(col);
          } else {
            // Tentar usar campo lowercase indexado se disponível
            const lowercaseField = `${col}Lowercase`;
            const lowercaseFields = [
              'temaLowercase', 'assuntoLowercase', 'canalLowercase', 'orgaosLowercase',
              'statusDemandaLowercase', 'tipoDeManifestacaoLowercase', 'responsavelLowercase',
              'bairroLowercase'
            ];

            if (lowercaseFields.includes(lowercaseField)) {
              // Usar campo lowercase indexado (muito mais rápido que regex)
              const normalizedValue = f.value.toLowerCase().trim();
              mongoFilter[lowercaseField] = { $regex: normalizedValue, $options: 'i' };
              fieldsNeeded.add(lowercaseField);
              fieldsNeeded.add(col); // Também precisamos do campo original para resposta
            } else {
              // Fallback: usar regex no campo original (mais lento)
              mongoFilter[col] = { $regex: f.value, $options: 'i' };
              fieldsNeeded.add(col);
            }
          }
        } else if (col && (f.op === 'gte' || f.op === 'lte' || f.op === 'gt' || f.op === 'lt')) {
          // Operadores de comparação para campos de data
          if (col === 'dataCriacaoIso' || col === 'dataDaCriacao' || col === 'dataConclusaoIso') {
            // Inicializar objeto de filtro de data se não existir
            if (!mongoFilter[col]) {
              mongoFilter[col] = {};
            }

            // Converter operador para formato MongoDB
            if (f.op === 'gte') {
              mongoFilter[col].$gte = f.value;
            } else if (f.op === 'lte') {
              mongoFilter[col].$lte = f.value;
            } else if (f.op === 'gt') {
              mongoFilter[col].$gt = f.value;
            } else if (f.op === 'lt') {
              mongoFilter[col].$lt = f.value;
            }

            fieldsNeeded.add(col);
          } else {
            // Campo não é de data, filtrar em memória
            needsInMemoryFilter.push(f);
            if (col) fieldsNeeded.add(col);
          }
        } else {
          // Campo não normalizado ou operação não suportada - filtrar em memória
          needsInMemoryFilter.push(f);
          if (col) fieldsNeeded.add(col);
        }
      }
    } // Fechar o bloco else da linha 94

    // Buscar apenas campos necessários
    const selectFields = Array.from(fieldsNeeded).join(' ');
    const hasFilter = Object.keys(mongoFilter).length > 0;

    // OTIMIZAÇÃO: Verificar se deve usar paginação cursor-based
    const usePagination = req.query.cursor !== undefined || req.query.pageSize !== undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 50;
    const cursor = req.query.cursor || null;

    let allRows;

    // Se usar paginação cursor-based e getMongoClient disponível
    if (usePagination && getMongoClient) {
      try {
        const paginationResult = await paginateWithCursor(
          getMongoClient,
          mongoFilter,
          pageSize,
          cursor
        );

        // Formatar resultados
        allRows = paginationResult.results.map(doc => ({
          id: doc._id.toString(),
          ...doc,
          _id: doc._id.toString() // Compatibilidade
        }));

        // Retornar com metadados de paginação
        return res.json({
          data: allRows,
          nextCursor: paginationResult.nextCursor,
          hasMore: paginationResult.hasMore,
          pageSize: paginationResult.pageSize,
          totalReturned: paginationResult.totalReturned
        });
      } catch (mongoError) {
        logger.warn('Erro ao usar MongoDB Native, usando fallback Mongoose:', { error: mongoError.message });
        // Continuar com Mongoose como fallback
      }
    }

    // Usar Mongoose diretamente
    const hasFilters = filters.length > 0;

    let limitValue;
    if (!hasFilters) {
      limitValue = 10000;
    } else {
      limitValue = undefined; // Sem limite quando há filtros
      logger.debug('/api/filter: Há filtros ativos, removendo limite de registros');
    }

    // OTIMIZAÇÃO: Timeout aumentado para 30s (padrão) para queries complexas
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout após 30 segundos')), 30000)
    );

    try {
      let query = Record.find(hasFilter ? mongoFilter : {});
      if (selectFields) query = query.select(selectFields);
      if (limitValue !== undefined) query = query.limit(limitValue);

      allRows = await Promise.race([query.lean(), timeoutPromise]);
    } catch (queryError) {
      if (queryError.message?.includes('timeout')) {
        logger.warn('Timeout ou erro de conexão, retornando array vazio');
        return res.json([]);
      }
      throw queryError;
    }

    // Aplicar filtros em memória
    // IMPORTANTE: Sempre verificar em memória porque os campos normalizados podem não estar populados
    // ou os valores podem estar no JSON com case diferente
    let filtered = allRows;

    if (filters.length > 0) {
      filtered = allRows.filter(r => {
        // Verificar todos os filtros
        for (const f of filters) {
          const col = getNormalizedField(f.field);

          // Tentar obter valor do campo normalizado primeiro, depois do JSON
          let value = '';

          // 1. Tentar campo normalizado direto no registro
          if (col && r[col] !== undefined && r[col] !== null) {
            value = r[col];
          }
          // 2. Tentar no JSON com diferentes variações de nome
          else if (r.data && typeof r.data === 'object') {
            // Tentar todas as variações possíveis do nome do campo
            const fieldVariations = [
              f.field,                    // Nome original: "Canal"
              col,                        // Campo normalizado: "canal"
              f.field?.toLowerCase(),      // "canal"
              f.field?.toUpperCase(),      // "CANAL"
              f.field?.charAt(0).toUpperCase() + f.field?.slice(1).toLowerCase(), // "Canal"
              col?.charAt(0).toUpperCase() + col?.slice(1).toLowerCase() // "Canal" (se col = "canal")
            ].filter(Boolean);

            // Buscar valor em todas as variações
            for (const fieldName of fieldVariations) {
              if (r.data[fieldName] !== undefined && r.data[fieldName] !== null) {
                value = r.data[fieldName];
                break;
              }
            }
          }

          // Aplicar operação de filtro
          if (f.op === 'eq') {
            // Comparação exata (case-insensitive)
            // Suportar arrays para seleção múltipla
            const filterValues = Array.isArray(f.value) ? f.value : [f.value];
            const valueStr = `${value}`.trim().toLowerCase();
            const matches = filterValues.some(filterVal => {
              const filterStr = `${filterVal}`.trim().toLowerCase();
              return valueStr === filterStr;
            });
            if (!matches) {
              return false; // Não corresponde a nenhum valor, excluir registro
            }
          } else if (f.op === 'in') {
            // Operador 'in' explícito (mesma lógica do 'eq' com array)
            const filterValues = Array.isArray(f.value) ? f.value : [f.value];
            const valueStr = `${value}`.trim().toLowerCase();
            const matches = filterValues.some(filterVal => {
              const filterStr = `${filterVal}`.trim().toLowerCase();
              return valueStr === filterStr;
            });
            if (!matches) {
              return false; // Não corresponde a nenhum valor, excluir registro
            }
          } else if (f.op === 'contains') {
            // Contém (case-insensitive)
            const valueStr = `${value}`.trim().toLowerCase();
            const filterStr = `${f.value}`.trim().toLowerCase();
            if (!valueStr.includes(filterStr)) {
              return false; // Não contém, excluir registro
            }
          } else if (f.op === 'gte' || f.op === 'lte' || f.op === 'gt' || f.op === 'lt') {
            // Operadores de comparação para datas
            // Tentar obter data do campo normalizado ou do JSON
            let dateValue = null;

            // 1. Tentar campo normalizado direto
            if (col && (col === 'dataCriacaoIso' || col === 'dataDaCriacao' || col === 'dataConclusaoIso')) {
              if (r[col]) {
                dateValue = new Date(r[col]);
              }
            }

            // 2. Tentar no JSON
            if (!dateValue && r.data && typeof r.data === 'object') {
              const dateFields = [
                'dataCriacaoIso', 'dataDaCriacao', 'dataConclusaoIso',
                'Data', 'data_da_criacao', 'data_da_conclusao'
              ];
              for (const fieldName of dateFields) {
                if (r.data[fieldName]) {
                  dateValue = new Date(r.data[fieldName]);
                  if (!isNaN(dateValue.getTime())) break;
                }
              }
            }

            // Se não encontrou data válida, pular este filtro
            if (!dateValue || isNaN(dateValue.getTime())) {
              continue; // Pular este filtro, não excluir o registro
            }

            // Converter valor do filtro para data
            const filterDate = new Date(f.value);
            if (isNaN(filterDate.getTime())) {
              continue; // Data inválida no filtro, pular
            }

            // Aplicar comparação
            if (f.op === 'gte' && dateValue < filterDate) {
              return false; // Data é menor que o mínimo, excluir
            } else if (f.op === 'lte' && dateValue > filterDate) {
              return false; // Data é maior que o máximo, excluir
            } else if (f.op === 'gt' && dateValue <= filterDate) {
              return false; // Data é menor ou igual, excluir
            } else if (f.op === 'lt' && dateValue >= filterDate) {
              return false; // Data é maior ou igual, excluir
            }
          }
        }
        return true; // Passou em todos os filtros
      });
    }

    const result = filtered.map(r => ({ ...r, data: r.data || {} }));

    // Debug: log do resultado
    logger.debug(`/api/filter: Retornando ${result.length} registro(s) de ${allRows.length} total após filtros`);
    if (result.length > 0 && result.length < allRows.length) {
      // Se houve filtragem, mostrar amostra
      const sample = result[0];
      logger.debug('/api/filter: Primeiro registro filtrado', {
        id: sample.id || sample._id,
        canal: sample.canal || sample.data?.Canal || sample.data?.canal,
        tipo: sample.tipoDeManifestacao || sample.data?.Tipo || sample.data?.tipo
      });
    } else if (result.length === allRows.length && filters.length > 0) {
      // AVISO: Filtros não foram aplicados corretamente
      logger.warn('/api/filter: ATENÇÃO - Filtros não reduziram o resultado!', { filters });
    }

    return res.json(result);
  } catch (error) {
    logger.error('Erro no endpoint /api/filter:', { error: error.message, stack: error.stack });
    return res.status(500).json({
      error: error.message || 'Erro ao processar filtros',
      data: [],
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * POST /api/filter/aggregated
 * Filtra registros e retorna dados agregados (solução definitiva)
 * 
 * SOLUÇÃO DEFINITIVA: Agregação no backend usando MongoDB aggregation pipeline
 * Evita problemas de encontrar campos no frontend e é muito mais rápido
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} getMongoClient - Função para obter cliente MongoDB nativo
 */
export async function filterAndAggregate(req, res, getMongoClient) {
  try {
    let filters = Array.isArray(req.body?.filters) ? req.body.filters : [];

    // MELHORIA: Suporte a filtros compostos (estrutura básica)
    let isComposite = false;
    let compositeFilter = null;

    if (req.body?.operator && Array.isArray(req.body?.filters)) {
      // É um filtro composto
      try {
        compositeFilter = CompositeFilter.fromJSON(req.body);
        const validation = compositeFilter.validate();
        if (validation.valid) {
          isComposite = true;
          logger.debug('/api/filter/aggregated: Filtro composto detectado', {
            operator: compositeFilter.operator,
            filtersCount: compositeFilter.filters.length
          });
        } else {
          logger.warn('/api/filter/aggregated: Filtro composto inválido, usando formato simples:', validation.error);
        }
      } catch (error) {
        logger.warn('/api/filter/aggregated: Erro ao processar filtro composto, usando formato simples:', error.message);
      }
    }

    logger.debug('/api/filter/aggregated: Filtros recebidos', {
      filtersCount: filters.length,
      isComposite,
      filters: filters.slice(0, 3) // Log apenas primeiros 3 para não poluir
    });

    // Se não há filtros, retornar estrutura vazia
    if (filters.length === 0 && !isComposite) {
      logger.warn('/api/filter/aggregated: Chamado SEM filtros! Retornando estrutura vazia.');
      return res.json({
        totalManifestations: 0,
        last7Days: 0,
        last30Days: 0,
        manifestationsByMonth: [],
        manifestationsByDay: [],
        manifestationsByStatus: [],
        manifestationsByTheme: [],
        manifestationsByOrgan: [],
        manifestationsByType: [],
        manifestationsByChannel: [],
        manifestationsByPriority: [],
        manifestationsByUnit: []
      });
    }

    // MELHORIA: Limitar MultiSelect e normalizar filtros
    if (!isComposite) {
      filters = limitMultiSelect(filters);
      filters = normalizeFilters(filters);
    }

    // Verificar se getMongoClient está disponível
    if (!getMongoClient) {
      logger.error('/api/filter/aggregated: getMongoClient não disponível');
      throw new Error('MongoDB client não disponível');
    }

    // Construir filtro MongoDB a partir dos filtros do frontend
    let mongoFilter = {};

    // MELHORIA: Se for filtro composto, usar conversão direta
    if (isComposite && compositeFilter) {
      mongoFilter = compositeFilter.toMongoQuery(getNormalizedField);
      logger.debug('/api/filter/aggregated: Filtro composto convertido para MongoDB', {
        mongoFilter,
        operator: compositeFilter.operator
      });
    } else {
      // Processar filtros simples
      for (const f of filters) {
        const col = getNormalizedField(f.field);

        logger.debug(`/api/filter/aggregated: Processando filtro:`, {
          originalField: f.field,
          normalizedField: col,
          operator: f.op,
          valueType: Array.isArray(f.value) ? 'array' : typeof f.value,
          valueLength: Array.isArray(f.value) ? f.value.length : 1,
          value: Array.isArray(f.value) ? f.value.slice(0, 5) : f.value
        });

        if (!col) {
          // Campo não normalizado - pular (será filtrado em memória se necessário)
          logger.warn(`/api/filter/aggregated: Campo não normalizado, ignorando: ${f.field}`);
          continue;
        }

        // Aplicar operador
        if (f.op === 'eq') {
          // Igualdade exata
          // Se o valor for array, usar $in automaticamente
          if (Array.isArray(f.value)) {
            mongoFilter[col] = { $in: f.value };
          } else {
            mongoFilter[col] = f.value;
          }
        } else if (f.op === 'in') {
          // Operador 'in' explícito para seleção múltipla
          // Garantir que o valor é um array
          const values = Array.isArray(f.value) ? f.value : [f.value];
          if (values.length > 0) {
            mongoFilter[col] = { $in: values };
            logger.debug(`/api/filter/aggregated: Aplicando filtro $in para ${col}:`, {
              values,
              count: values.length,
              sample: values.slice(0, 3)
            });
          } else {
            logger.warn(`/api/filter/aggregated: Array vazio para ${col}, ignorando filtro`);
          }
        } else if (f.op === 'contains') {
          // MELHORIA: Otimização de "contains" usando campos lowercase indexados
          // Para campos de data, usar regex se o valor for no formato YYYY-MM
          if ((col === 'dataDaCriacao' || col === 'dataCriacaoIso') && /^\d{4}-\d{2}$/.test(f.value)) {
            // Filtro por mês: usar regex para melhor performance
            mongoFilter[col] = { $regex: `^${f.value}`, $options: 'i' };
          } else {
            // Tentar usar campo lowercase indexado se disponível
            const lowercaseField = `${col}Lowercase`;
            const lowercaseFields = [
              'temaLowercase', 'assuntoLowercase', 'canalLowercase', 'orgaosLowercase',
              'statusDemandaLowercase', 'tipoDeManifestacaoLowercase', 'responsavelLowercase'
            ];

            if (lowercaseFields.includes(lowercaseField)) {
              // Usar campo lowercase indexado (muito mais rápido que regex)
              const normalizedValue = f.value.toLowerCase().trim();
              mongoFilter[lowercaseField] = { $regex: normalizedValue, $options: 'i' };
            } else {
              // Fallback: usar regex no campo original (mais lento)
              mongoFilter[col] = { $regex: f.value, $options: 'i' };
            }
          }
        } else if (f.op === 'gte' || f.op === 'lte' || f.op === 'gt' || f.op === 'lt') {
          // Operadores de comparação para campos de data
          if (col === 'dataCriacaoIso' || col === 'dataDaCriacao' || col === 'dataConclusaoIso') {
            if (!mongoFilter[col]) {
              mongoFilter[col] = {};
            }

            if (f.op === 'gte') {
              mongoFilter[col].$gte = f.value;
            } else if (f.op === 'lte') {
              mongoFilter[col].$lte = f.value;
            } else if (f.op === 'gt') {
              mongoFilter[col].$gt = f.value;
            } else if (f.op === 'lt') {
              mongoFilter[col].$lt = f.value;
            }
          }
        }
      }
    }

    logger.debug('/api/filter/aggregated: Filtro MongoDB construído', {
      mongoFilterKeys: Object.keys(mongoFilter),
      mongoFilter: mongoFilter,
      filtersReceived: filters.map(f => ({
        field: f.field,
        op: f.op,
        valueType: Array.isArray(f.value) ? 'array' : typeof f.value,
        valueLength: Array.isArray(f.value) ? f.value.length : 1,
        valueSample: Array.isArray(f.value) ? f.value.slice(0, 3) : f.value
      }))
    });

    // DEBUG CRÍTICO: Log detalhado do filtro de data se existir
    if (mongoFilter.dataCriacaoIso) {
      logger.info('🔍 FILTRO DE DATA DETECTADO:', {
        dataCriacaoIso: mongoFilter.dataCriacaoIso,
        type: typeof mongoFilter.dataCriacaoIso,
        isObject: typeof mongoFilter.dataCriacaoIso === 'object',
        hasGte: mongoFilter.dataCriacaoIso?.$gte,
        hasLte: mongoFilter.dataCriacaoIso?.$lte
      });
    }

    if (mongoFilter.statusDemanda) {
      logger.info('🔍 FILTRO DE STATUS DETECTADO:', {
        statusDemanda: mongoFilter.statusDemanda,
        type: typeof mongoFilter.statusDemanda
      });
    }

    // Usar getOverviewData com os filtros construídos
    // getOverviewData espera um objeto de filtros simples (ex: { servidor: 'X', orgaos: 'Y' })
    // Mas precisamos converter os filtros dinâmicos para esse formato
    // Por enquanto, vamos passar o mongoFilter diretamente como filtros
    // Mas getOverviewData usa sanitizeFilters que espera um formato específico

    // SOLUÇÃO: Usar o pipeline diretamente com os filtros MongoDB construídos
    const { buildOverviewPipeline } = await import('../../utils/pipelines/overview.js');
    const { executeAggregation, formatOverviewData } = await import('../../utils/dbAggregations.js');

    // CORREÇÃO: Passar os filtros MongoDB diretamente para buildOverviewPipeline
    // A função buildMatchFromFilters dentro do pipeline já suporta objetos MongoDB como { $in: [...] }
    const pipeline = buildOverviewPipeline(mongoFilter);

    logger.info('/api/filter/aggregated: Pipeline construído com filtros:', {
      mongoFilterKeys: Object.keys(mongoFilter),
      mongoFilter: mongoFilter,
      hasInOperator: Object.values(mongoFilter).some(v => v && typeof v === 'object' && v.$in),
      pipelineLength: pipeline.length,
      firstStage: pipeline[0],
      hasMatch: pipeline[0]?.$match ? true : false,
      matchContent: pipeline[0]?.$match || null
    });

    logger.debug('/api/filter/aggregated: Pipeline final construído:', {
      totalStages: pipeline.length,
      firstStage: pipeline[0],
      hasMatch: pipeline[0]?.$match ? true : false
    });

    // Executar agregação
    const startTime = Date.now();
    const result = await executeAggregation(getMongoClient, pipeline);
    const duration = Date.now() - startTime;

    logger.info(`/api/filter/aggregated: Agregação executada em ${duration}ms`, {
      filtersCount: filters.length,
      resultKeys: result[0] ? Object.keys(result[0]) : []
    });

    // Formatar resultado
    const facetResult = result[0] || {};
    const formatted = formatOverviewData(facetResult);

    // Log de resultado
    logger.debug('/api/filter/aggregated: Resultado formatado', {
      total: formatted.totalManifestations,
      byStatus: formatted.manifestationsByStatus.length,
      byTheme: formatted.manifestationsByTheme.length,
      byOrgan: formatted.manifestationsByOrgan.length,
      byType: formatted.manifestationsByType.length,
      byChannel: formatted.manifestationsByChannel.length,
      byPriority: formatted.manifestationsByPriority.length,
      byUnit: formatted.manifestationsByUnit.length,
      byMonth: formatted.manifestationsByMonth.length,
      byDay: formatted.manifestationsByDay.length
    });

    return res.json(formatted);

  } catch (error) {
    logger.error('Erro no endpoint /api/filter/aggregated:', {
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      error: error.message || 'Erro ao processar filtros e agregar dados',
      totalManifestations: 0,
      last7Days: 0,
      last30Days: 0,
      manifestationsByMonth: [],
      manifestationsByDay: [],
      manifestationsByStatus: [],
      manifestationsByTheme: [],
      manifestationsByOrgan: [],
      manifestationsByType: [],
      manifestationsByChannel: [],
      manifestationsByPriority: [],
      manifestationsByUnit: []
    });
  }
}

