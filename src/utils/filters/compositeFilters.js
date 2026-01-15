/**
 * Filtros Compostos (OR, Agrupadores)
 * 
 * Estrutura básica para suporte a operadores compostos
 * Permite criar queries complexas com OR e agrupadores
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 * 
 * NOTA: Esta é uma estrutura básica para suporte futuro.
 * A implementação completa requer mudanças significativas no frontend e backend.
 */

import { logger } from '../logger.js';

/**
 * Tipos de operadores compostos
 */
export const COMPOSITE_OPERATORS = {
  AND: 'AND',
  OR: 'OR'
};

/**
 * Estrutura de filtro composto
 * 
 * Exemplo:
 * {
 *   operator: 'AND',
 *   filters: [
 *     {
 *       operator: 'OR',
 *       filters: [
 *         { field: 'statusDemanda', op: 'eq', value: 'Aberto' },
 *         { field: 'statusDemanda', op: 'eq', value: 'Em Andamento' }
 *       ]
 *     },
 *     { field: 'bairro', op: 'eq', value: 'Centro' }
 *   ]
 * }
 * 
 * Resultado: (status = 'Aberto' OR status = 'Em Andamento') AND bairro = 'Centro'
 */
export class CompositeFilter {
  constructor(operator = COMPOSITE_OPERATORS.AND, filters = []) {
    this.operator = operator;
    this.filters = filters;
  }

  /**
   * Adicionar filtro
   * @param {Object|CompositeFilter} filter - Filtro a adicionar
   */
  addFilter(filter) {
    this.filters.push(filter);
  }

  /**
   * Converter para formato MongoDB
   * @param {Function} getNormalizedFieldFn - Função para normalizar campos (opcional)
   * @returns {Object} Query MongoDB
   */
  toMongoQuery(getNormalizedFieldFn = null) {
    if (this.filters.length === 0) {
      return {};
    }

    if (this.filters.length === 1) {
      // Apenas um filtro, retornar diretamente
      return this._filterToMongo(this.filters[0], getNormalizedFieldFn);
    }

    // Múltiplos filtros, agrupar com operador
    const mongoFilters = this.filters.map(f => {
      if (f instanceof CompositeFilter) {
        return f.toMongoQuery(getNormalizedFieldFn);
      }
      return this._filterToMongo(f, getNormalizedFieldFn);
    });

    if (this.operator === COMPOSITE_OPERATORS.OR) {
      return { $or: mongoFilters };
    } else {
      // AND é o padrão do MongoDB
      return { $and: mongoFilters };
    }
  }

  /**
   * Converter filtro individual para MongoDB
   * @private
   * @param {Object|CompositeFilter} filter - Filtro
   * @param {Function} getNormalizedFieldFn - Função para normalizar campos (opcional)
   * @returns {Object} Query MongoDB
   */
  _filterToMongo(filter, getNormalizedFieldFn = null) {
    // Se for CompositeFilter, converter recursivamente
    if (filter instanceof CompositeFilter) {
      return filter.toMongoQuery(getNormalizedFieldFn);
    }

    // Filtro simples - converter para formato MongoDB
    const { field, op, value } = filter;
    const normalizedField = getNormalizedFieldFn ? getNormalizedFieldFn(field) : field;

    // Se não houver campo normalizado, usar campo original
    const mongoField = normalizedField || field;

    switch (op) {
      case 'eq':
        // Se valor é array, usar $in
        if (Array.isArray(value)) {
          return { [mongoField]: { $in: value } };
        }
        return { [mongoField]: value };
      case 'in':
        return { [mongoField]: { $in: Array.isArray(value) ? value : [value] } };
      case 'contains':
        // Tentar usar campo lowercase se disponível
        const lowercaseField = `${mongoField}Lowercase`;
        const lowercaseFields = [
          'temaLowercase', 'assuntoLowercase', 'canalLowercase', 'orgaosLowercase',
          'statusDemandaLowercase', 'tipoDeManifestacaoLowercase', 'responsavelLowercase',
          'bairroLowercase'
        ];
        if (lowercaseFields.includes(lowercaseField)) {
          const normalizedValue = value.toLowerCase().trim();
          return { [lowercaseField]: { $regex: normalizedValue, $options: 'i' } };
        }
        return { [mongoField]: { $regex: value, $options: 'i' } };
      case 'gte':
        return { [mongoField]: { $gte: value } };
      case 'lte':
        return { [mongoField]: { $lte: value } };
      case 'gt':
        return { [mongoField]: { $gt: value } };
      case 'lt':
        return { [mongoField]: { $lt: value } };
      default:
        logger.warn(`Operador não suportado: ${op}`);
        return {};
    }
  }

  /**
   * Validar estrutura
   * @returns {{valid: boolean, error?: string}} Resultado da validação
   */
  validate() {
    if (!this.operator || !Object.values(COMPOSITE_OPERATORS).includes(this.operator)) {
      return {
        valid: false,
        error: `Operador inválido: ${this.operator}. Deve ser AND ou OR.`
      };
    }

    if (!Array.isArray(this.filters)) {
      return {
        valid: false,
        error: 'Filtros deve ser um array'
      };
    }

    if (this.filters.length === 0) {
      return {
        valid: false,
        error: 'Pelo menos um filtro é necessário'
      };
    }

    // Validar cada filtro
    for (const filter of this.filters) {
      if (filter instanceof CompositeFilter) {
        const validation = filter.validate();
        if (!validation.valid) {
          return validation;
        }
      } else if (!filter.field || !filter.op) {
        return {
          valid: false,
          error: 'Filtro deve ter campo e operador'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Converter para formato JSON (para serialização)
   * @returns {Object} Representação JSON
   */
  toJSON() {
    return {
      operator: this.operator,
      filters: this.filters.map(f => {
        if (f instanceof CompositeFilter) {
          return f.toJSON();
        }
        return f;
      })
    };
  }

  /**
   * Criar CompositeFilter a partir de JSON
   * @param {Object} json - Representação JSON
   * @returns {CompositeFilter} Instância
   */
  static fromJSON(json) {
    const composite = new CompositeFilter(json.operator);

    for (const filter of json.filters) {
      if (filter.operator) {
        // É um CompositeFilter aninhado
        composite.addFilter(CompositeFilter.fromJSON(filter));
      } else {
        // É um filtro simples
        composite.addFilter(filter);
      }
    }

    return composite;
  }
}

/**
 * Helper: Criar filtro OR simples
 * @param {Array} filters - Array de filtros
 * @returns {CompositeFilter} Filtro OR
 */
export function createORFilter(filters) {
  return new CompositeFilter(COMPOSITE_OPERATORS.OR, filters);
}

/**
 * Helper: Criar filtro AND simples
 * @param {Array} filters - Array de filtros
 * @returns {CompositeFilter} Filtro AND
 */
export function createANDFilter(filters) {
  return new CompositeFilter(COMPOSITE_OPERATORS.AND, filters);
}

/**
 * Converter array de filtros simples para CompositeFilter
 * @param {Array} filters - Array de filtros simples
 * @param {String} operator - Operador (AND ou OR)
 * @returns {CompositeFilter} Filtro composto
 */
export function arrayToComposite(filters, operator = COMPOSITE_OPERATORS.AND) {
  return new CompositeFilter(operator, filters);
}

/**
 * Exemplo de uso:
 * 
 * const filter = new CompositeFilter('AND', [
 *   new CompositeFilter('OR', [
 *     { field: 'statusDemanda', op: 'eq', value: 'Aberto' },
 *     { field: 'statusDemanda', op: 'eq', value: 'Em Andamento' }
 *   ]),
 *   { field: 'bairro', op: 'eq', value: 'Centro' }
 * ]);
 * 
 * const mongoQuery = filter.toMongoQuery();
 * // Resultado: {
 * //   $and: [
 * //     { $or: [
 * //       { statusDemanda: 'Aberto' },
 * //       { statusDemanda: 'Em Andamento' }
 * //     ]},
 * //     { bairro: 'Centro' }
 * //   ]
 * // }
 */

