/**
 * Limite para MultiSelect
 * 
 * Valida e limita arrays muito grandes em filtros
 * Previne queries gigantes e payloads HTTP pesados
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import { logger } from '../logger.js';

/**
 * Limite máximo de valores em seleção múltipla
 */
const MAX_MULTISELECT = 20;

/**
 * Validar e limitar arrays em filtros
 * @param {Array} filters - Array de filtros
 * @returns {Array} Filtros com arrays limitados
 */
export function limitMultiSelect(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return filters;
  }

  const limited = [];
  const warnings = [];

  for (const filter of filters) {
    // Verificar se o valor é um array
    if (Array.isArray(filter.value)) {
      if (filter.value.length > MAX_MULTISELECT) {
        // Limitar array e adicionar aviso
        const originalLength = filter.value.length;
        const limitedValue = filter.value.slice(0, MAX_MULTISELECT);

        warnings.push({
          field: filter.field,
          originalLength,
          limitedLength: MAX_MULTISELECT,
          message: `Filtro ${filter.field} tinha ${originalLength} valores, limitado para ${MAX_MULTISELECT}`
        });

        limited.push({
          ...filter,
          value: limitedValue,
          _warning: `Limitado de ${originalLength} para ${MAX_MULTISELECT} valores`
        });
      } else {
        // Array dentro do limite, manter como está
        limited.push(filter);
      }
    } else {
      // Não é array, manter como está
      limited.push(filter);
    }
  }

  // Log de avisos
  if (warnings.length > 0) {
    logger.warn('MultiSelect limitado:', warnings);
  }

  return limited;
}

/**
 * Validar filtro individual
 * @param {Object} filter - Filtro individual
 * @returns {{valid: boolean, limited?: Object, warning?: string}} Resultado
 */
export function validateMultiSelect(filter) {
  if (!filter || !Array.isArray(filter.value)) {
    return { valid: true, limited: filter };
  }

  if (filter.value.length > MAX_MULTISELECT) {
    return {
      valid: true,
      limited: {
        ...filter,
        value: filter.value.slice(0, MAX_MULTISELECT)
      },
      warning: `Filtro ${filter.field} limitado de ${filter.value.length} para ${MAX_MULTISELECT} valores`
    };
  }

  return { valid: true, limited: filter };
}

/**
 * Obter limite máximo
 * @returns {Number} Limite máximo
 */
export function getMaxMultiSelect() {
  return MAX_MULTISELECT;
}

