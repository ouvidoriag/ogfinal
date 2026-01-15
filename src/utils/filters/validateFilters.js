/**
 * Validador de Filtros
 * 
 * Middleware de segurança para validar filtros antes de executar pipelines
 * Previne injection, regex gigantes, e uso indevido de operadores
 */

/**
 * Operadores MongoDB permitidos
 */
const ALLOWED_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$exists', '$regex', '$and', '$or', '$not'
];

/**
 * Campos permitidos para filtros
 */
const ALLOWED_FIELDS = [
  'servidor', 'unidadeCadastro', 'status', 'tema', 'orgaos',
  'tipoDeManifestacao', 'canal', 'prioridade', 'assunto',
  'responsavel', 'unidadeSaude', 'bairro', 'categoria',
  'dataInicio', 'dataFim', 'createdAt', 'dataCriacaoIso'
];

/**
 * Limites de segurança
 */
const LIMITS = {
  MAX_STRING_LENGTH: 500,
  MAX_ARRAY_LENGTH: 100,
  MAX_REGEX_LENGTH: 200,
  MAX_NESTED_DEPTH: 3
};

/**
 * Validar filtros conflitantes
 * @param {Array} filters - Array de filtros
 * @returns {{valid: boolean, error?: string}} Resultado da validação
 */
export function validateConflictingFilters(filters) {
  if (!Array.isArray(filters) || filters.length === 0) {
    return { valid: true };
  }

  const byField = {};
  const errors = [];

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
        errors.push(`Conflito: ${field} não pode ter múltiplos valores com 'eq'. Use 'in' para múltiplos valores.`);
      }
    }

    // Conflitos de data (gte > lte)
    const dateFields = ['dataCriacaoIso', 'dataConclusaoIso', 'dataDaCriacao', 'dataInicio', 'dataFim'];
    if (dateFields.includes(field)) {
      const gte = fieldFilters.find(f => f.op === 'gte');
      const lte = fieldFilters.find(f => f.op === 'lte');
      
      if (gte && lte) {
        const gteDate = new Date(gte.value);
        const lteDate = new Date(lte.value);
        
        if (isNaN(gteDate.getTime()) || isNaN(lteDate.getTime())) {
          errors.push(`Data inválida em ${field}: gte=${gte.value}, lte=${lte.value}`);
        } else if (gteDate > lteDate) {
          errors.push(`Conflito de data: ${field} gte=${gte.value} é maior que lte=${lte.value}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; ')
    };
  }

  return { valid: true };
}

/**
 * Validar filtros
 * @param {Object} filters - Filtros a validar
 * @returns {{valid: boolean, error?: string, sanitized?: Object}} Resultado da validação
 */
export function validateFilters(filters) {
  if (!filters || typeof filters !== 'object') {
    return { valid: true, sanitized: {} };
  }
  
  try {
    const sanitized = {};
    const errors = [];
    
    for (const [field, value] of Object.entries(filters)) {
      // Validar nome do campo
      if (!ALLOWED_FIELDS.includes(field) && !field.startsWith('data.')) {
        errors.push(`Campo não permitido: ${field}`);
        continue;
      }
      
      // Validar valor
      const validation = validateFieldValue(field, value);
      if (!validation.valid) {
        errors.push(`${field}: ${validation.error}`);
        continue;
      }
      
      sanitized[field] = validation.sanitized;
    }
    
    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; '),
        sanitized: {}
      };
    }
    
    return {
      valid: true,
      sanitized
    };
  } catch (error) {
    return {
      valid: false,
      error: `Erro na validação: ${error.message}`,
      sanitized: {}
    };
  }
}

/**
 * Validar valor de um campo
 * @param {string} field - Nome do campo
 * @param {*} value - Valor a validar
 * @param {number} depth - Profundidade atual (para objetos aninhados)
 * @returns {{valid: boolean, error?: string, sanitized?: *}} Resultado
 */
function validateFieldValue(field, value, depth = 0) {
  // Limite de profundidade
  if (depth > LIMITS.MAX_NESTED_DEPTH) {
    return {
      valid: false,
      error: 'Profundidade máxima excedida'
    };
  }
  
  // Valores nulos ou undefined são válidos (serão ignorados)
  if (value === null || value === undefined) {
    return { valid: true, sanitized: value };
  }
  
  // String
  if (typeof value === 'string') {
    if (value.length > LIMITS.MAX_STRING_LENGTH) {
      return {
        valid: false,
        error: `String muito longa (máx: ${LIMITS.MAX_STRING_LENGTH})`
      };
    }
    
    // Sanitizar strings (remover caracteres perigosos)
    const sanitized = value
      .replace(/[<>]/g, '') // Remover < e >
      .trim()
      .substring(0, LIMITS.MAX_STRING_LENGTH);
    
    return { valid: true, sanitized };
  }
  
  // Número
  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return {
        valid: false,
        error: 'Número inválido'
      };
    }
    return { valid: true, sanitized: value };
  }
  
  // Boolean
  if (typeof value === 'boolean') {
    return { valid: true, sanitized: value };
  }
  
  // Date
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return {
        valid: false,
        error: 'Data inválida'
      };
    }
    return { valid: true, sanitized: value };
  }
  
  // Array
  if (Array.isArray(value)) {
    if (value.length > LIMITS.MAX_ARRAY_LENGTH) {
      return {
        valid: false,
        error: `Array muito grande (máx: ${LIMITS.MAX_ARRAY_LENGTH})`
      };
    }
    
    const sanitized = [];
    for (const item of value) {
      const itemValidation = validateFieldValue(field, item, depth + 1);
      if (!itemValidation.valid) {
        return itemValidation;
      }
      sanitized.push(itemValidation.sanitized);
    }
    
    return { valid: true, sanitized };
  }
  
  // Objeto (operadores MongoDB)
  if (typeof value === 'object') {
    const sanitized = {};
    
    for (const [op, opValue] of Object.entries(value)) {
      // Validar operador
      if (!ALLOWED_OPERATORS.includes(op)) {
        return {
          valid: false,
          error: `Operador não permitido: ${op}`
        };
      }
      
      // Validar $regex especialmente
      if (op === '$regex') {
        if (typeof opValue !== 'string' || opValue.length > LIMITS.MAX_REGEX_LENGTH) {
          return {
            valid: false,
            error: `Regex muito longo (máx: ${LIMITS.MAX_REGEX_LENGTH})`
          };
        }
        
        // Tentar compilar regex para validar
        try {
          new RegExp(opValue);
        } catch (regexError) {
          return {
            valid: false,
            error: `Regex inválido: ${regexError.message}`
          };
        }
      }
      
      // Validar valor do operador
      const opValidation = validateFieldValue(field, opValue, depth + 1);
      if (!opValidation.valid) {
        return opValidation;
      }
      
      sanitized[op] = opValidation.sanitized;
    }
    
    return { valid: true, sanitized };
  }
  
  // Tipo não suportado
  return {
    valid: false,
    error: `Tipo não suportado: ${typeof value}`
  };
}

/**
 * Middleware Express para validar filtros
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
export function validateFiltersMiddleware(req, res, next) {
  // Extrair filtros do body ou query
  const filters = req.body?.filters || req.query || {};
  
  const validation = validateFilters(filters);
  
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Filtros inválidos',
      details: validation.error
    });
  }
  
  // Adicionar filtros sanitizados ao request
  req.sanitizedFilters = validation.sanitized;
  
  next();
}

/**
 * Validar e sanitizar filtros de uma requisição
 * @param {Object} filters - Filtros brutos
 * @returns {Object} Filtros sanitizados
 * @throws {Error} Se filtros forem inválidos
 */
export function sanitizeFilters(filters) {
  const validation = validateFilters(filters);
  
  if (!validation.valid) {
    throw new Error(`Filtros inválidos: ${validation.error}`);
  }
  
  return validation.sanitized;
}

