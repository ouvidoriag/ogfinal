/**
 * Normalização de Filtros
 * 
 * Remove duplicatas, combina ranges de datas e unifica operadores
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import { logger } from '../logger.js';

/**
 * Normalizar array de filtros
 * @param {Array} filters - Array de filtros a normalizar
 * @returns {Array} Array de filtros normalizados
 */
export function normalizeFilters(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return [];
  }

  try {
    // 1. Remover duplicatas exatas (mesmo field, op e value)
    const uniqueFilters = removeExactDuplicates(filters);

    // 2. Combinar ranges de datas (gte + lte do mesmo campo)
    const dateMergedFilters = mergeDateRanges(uniqueFilters);

    // 3. Unificar operadores do mesmo campo (eq múltiplos → in)
    const unifiedFilters = unifyOperators(dateMergedFilters);

    // 4. Validar filtros conflitantes
    const validatedFilters = validateConflictingFilters(unifiedFilters);

    if (validatedFilters.length !== filters.length) {
      logger.debug('Filtros normalizados:', {
        original: filters.length,
        normalized: validatedFilters.length,
        removed: filters.length - validatedFilters.length
      });
    }

    return validatedFilters;
  } catch (error) {
    logger.error('Erro ao normalizar filtros:', error);
    // Em caso de erro, retornar filtros originais (fail-safe)
    return filters;
  }
}

/**
 * Remover duplicatas exatas
 * @param {Array} filters - Array de filtros
 * @returns {Array} Filtros sem duplicatas
 */
function removeExactDuplicates(filters) {
  const seen = new Map();
  const unique = [];

  for (const filter of filters) {
    const key = `${filter.field}:${filter.op}:${JSON.stringify(filter.value)}`;

    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(filter);
    }
  }

  return unique;
}

/**
 * Combinar ranges de datas (gte + lte do mesmo campo)
 * @param {Array} filters - Array de filtros
 * @returns {Array} Filtros com ranges de datas combinados
 */
function mergeDateRanges(filters) {
  const dateFields = ['dataCriacaoIso', 'dataConclusaoIso', 'dataDaCriacao', 'dataInicio', 'dataFim'];
  const merged = [];
  const dateFiltersByField = {};

  // Agrupar filtros de data por campo
  for (const filter of filters) {
    if (dateFields.includes(filter.field) && (filter.op === 'gte' || filter.op === 'lte')) {
      if (!dateFiltersByField[filter.field]) {
        dateFiltersByField[filter.field] = { gte: null, lte: null };
      }

      if (filter.op === 'gte') {
        dateFiltersByField[filter.field].gte = filter;
      } else if (filter.op === 'lte') {
        dateFiltersByField[filter.field].lte = filter;
      }
    } else {
      // Filtro não é de data, manter como está
      merged.push(filter);
    }
  }

  // Combinar ranges de datas
  for (const [field, range] of Object.entries(dateFiltersByField)) {
    const { gte, lte } = range;

    // Se há apenas gte ou apenas lte, manter como está
    if (gte && !lte) {
      merged.push(gte);
    } else if (lte && !gte) {
      merged.push(lte);
    } else if (gte && lte) {
      // Validar que gte <= lte
      const gteDate = new Date(gte.value);
      const lteDate = new Date(lte.value);

      if (gteDate <= lteDate) {
        // Range válido, manter ambos
        merged.push(gte);
        merged.push(lte);
      } else {
        // Range inválido (gte > lte), manter apenas o mais recente
        logger.warn(`Range de data inválido para ${field}: gte=${gte.value}, lte=${lte.value}. Removendo gte.`);
        merged.push(lte);
      }
    }
  }

  return merged;
}

/**
 * Unificar operadores do mesmo campo
 * Múltiplos 'eq' do mesmo campo → um único 'in'
 * @param {Array} filters - Array de filtros
 * @returns {Array} Filtros com operadores unificados
 */
function unifyOperators(filters) {
  const byField = {};
  const unified = [];

  // Agrupar filtros por campo
  for (const filter of filters) {
    if (!byField[filter.field]) {
      byField[filter.field] = [];
    }
    byField[filter.field].push(filter);
  }

  // Processar cada campo
  for (const [field, fieldFilters] of Object.entries(byField)) {
    // Se há múltiplos 'eq' do mesmo campo, unificar em 'in'
    const eqFilters = fieldFilters.filter(f => f.op === 'eq');

    if (eqFilters.length > 1) {
      // Unificar múltiplos 'eq' em um único 'in'
      const values = eqFilters.map(f => f.value);
      unified.push({
        field,
        op: 'in',
        value: values
      });

      // Adicionar outros filtros do mesmo campo (não 'eq')
      const otherFilters = fieldFilters.filter(f => f.op !== 'eq');
      unified.push(...otherFilters);
    } else {
      // Não há múltiplos 'eq', manter todos os filtros
      unified.push(...fieldFilters);
    }
  }

  return unified;
}

/**
 * Validar filtros conflitantes
 * @param {Array} filters - Array de filtros
 * @returns {Array} Filtros sem conflitos
 */
function validateConflictingFilters(filters) {
  const validated = [];
  const byField = {};

  // Agrupar por campo
  for (const filter of filters) {
    if (!byField[filter.field]) {
      byField[filter.field] = [];
    }
    byField[filter.field].push(filter);
  }

  // Validar cada campo
  for (const [field, fieldFilters] of Object.entries(byField)) {
    // Conflitos de igualdade (múltiplos 'eq' com valores diferentes)
    const eqFilters = fieldFilters.filter(f => f.op === 'eq');
    if (eqFilters.length > 1) {
      const uniqueValues = new Set(eqFilters.map(f => f.value));
      if (uniqueValues.size > 1) {
        // Conflito: múltiplos valores diferentes com 'eq'
        // Isso já foi tratado em unifyOperators, mas validar novamente
        logger.warn(`Conflito detectado: ${field} tem múltiplos valores com 'eq'. Deve ser unificado em 'in'.`);
      }
    }

    // Conflitos de data (gte > lte)
    const dateFields = ['dataCriacaoIso', 'dataConclusaoIso', 'dataDaCriacao'];
    if (dateFields.includes(field)) {
      const gte = fieldFilters.find(f => f.op === 'gte');
      const lte = fieldFilters.find(f => f.op === 'lte');

      if (gte && lte) {
        const gteDate = new Date(gte.value);
        const lteDate = new Date(lte.value);

        if (gteDate > lteDate) {
          logger.warn(`Conflito de data detectado: ${field} gte=${gte.value} > lte=${lte.value}. Removendo gte.`);
          // Remover gte (manter lte)
          validated.push(...fieldFilters.filter(f => f !== gte));
          continue;
        }
      }
    }

    // Todos os filtros do campo são válidos
    validated.push(...fieldFilters);
  }

  return validated;
}

/**
 * Gerar chave de cache para filtros
 * @param {Array} filters - Array de filtros
 * @returns {String} Chave de cache
 */
export function generateFilterCacheKey(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return 'no-filters';
  }

  // Normalizar filtros antes de gerar chave
  const normalized = normalizeFilters(filters);

  // Ordenar por field + op para garantir consistência
  const sorted = normalized.sort((a, b) => {
    if (a.field !== b.field) {
      return a.field.localeCompare(b.field);
    }
    return a.op.localeCompare(b.op);
  });

  // Gerar hash simples (MD5 seria ideal, mas para simplicidade usar JSON)
  const key = JSON.stringify(sorted);

  // Hash simples (não usar MD5 real, apenas para demonstração)
  // Em produção, usar crypto.createHash('md5').update(key).digest('hex')
  return `filter_${key.length}_${key.substring(0, 50)}`;
}

