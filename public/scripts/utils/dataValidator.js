/**
 * Sistema de Validação de Dados
 * Prioridade 1 - Correção de Falhas Críticas
 * 
 * Funcionalidades:
 * - Validação de estruturas de dados
 * - Validação de respostas de API
 * - Schemas de validação
 * - Mensagens de erro claras
 * 
 * Data: 11/12/2025
 * CÉREBRO X-3
 */

/**
 * Validar estrutura básica de dados
 */
function validateDataStructure(data, schema, context = '') {
  if (!data) {
    return {
      valid: false,
      error: 'Dados são null ou undefined',
      context
    };
  }
  
  if (!schema) {
    return {
      valid: true,
      data
    };
  }
  
  const errors = [];
  
  // Validar campos obrigatórios
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Campo obrigatório '${field}' está faltando`);
      }
    }
  }
  
  // Validar tipos
  if (schema.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (data[field] !== undefined && data[field] !== null) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        if (actualType !== expectedType) {
          errors.push(`Campo '${field}' deve ser ${expectedType}, mas é ${actualType}`);
        }
      }
    }
  }
  
  // Validar arrays
  if (schema.arrays) {
    for (const [field, itemSchema] of Object.entries(schema.arrays)) {
      if (data[field] && Array.isArray(data[field])) {
        for (let i = 0; i < data[field].length; i++) {
          const item = data[field][i];
          const itemValidation = validateDataStructure(item, itemSchema, `${context}.${field}[${i}]`);
          if (!itemValidation.valid) {
            errors.push(`Item ${i} em '${field}': ${itemValidation.error}`);
          }
        }
      }
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; '),
      errors,
      context
    };
  }
  
  return {
    valid: true,
    data
  };
}

/**
 * Validar resposta de API
 */
function validateApiResponse(response, expectedSchema = null) {
  // Verificar se é array
  if (Array.isArray(response)) {
    if (expectedSchema && expectedSchema.arrayItem) {
      for (let i = 0; i < response.length; i++) {
        const validation = validateDataStructure(response[i], expectedSchema.arrayItem, `response[${i}]`);
        if (!validation.valid) {
          return validation;
        }
      }
    }
    return { valid: true, data: response };
  }
  
  // Verificar se é objeto
  if (typeof response === 'object' && response !== null) {
    if (expectedSchema) {
      return validateDataStructure(response, expectedSchema, 'response');
    }
    return { valid: true, data: response };
  }
  
  return {
    valid: false,
    error: 'Resposta da API não é um objeto ou array válido',
    data: response
  };
}

/**
 * Schemas comuns
 */
const COMMON_SCHEMAS = {
  // Schema para dados agregados
  aggregatedData: {
    required: [],
    types: {
      manifestationsByOrgan: 'array',
      manifestationsByMonth: 'array',
      manifestationsByStatus: 'array'
    },
    arrays: {
      manifestationsByOrgan: {
        required: ['organ', 'count'],
        types: {
          organ: 'string',
          count: 'number'
        }
      },
      manifestationsByMonth: {
        required: ['month', 'count'],
        types: {
          month: 'string',
          count: 'number'
        }
      }
    }
  },
  
  // Schema para dados de órgão
  orgaoData: {
    required: ['key', 'count'],
    types: {
      key: 'string',
      count: 'number'
    }
  },
  
  // Schema para dados mensais
  monthlyData: {
    required: ['ym', 'count'],
    types: {
      ym: 'string',
      count: 'number'
    }
  }
};

/**
 * Validar dados com schema comum
 */
function validateWithCommonSchema(data, schemaName) {
  const schema = COMMON_SCHEMAS[schemaName];
  if (!schema) {
    return {
      valid: false,
      error: `Schema comum '${schemaName}' não encontrado`
    };
  }
  
  return validateDataStructure(data, schema, schemaName);
}

/**
 * Sanitizar dados (remover campos inválidos, normalizar tipos)
 */
function sanitizeData(data, schema) {
  if (!data || !schema) return data;
  
  const sanitized = Array.isArray(data) ? [] : {};
  
  if (Array.isArray(data)) {
    for (const item of data) {
      if (schema.arrayItem) {
        sanitized.push(sanitizeData(item, schema.arrayItem));
      } else {
        sanitized.push(item);
      }
    }
  } else {
    // Aplicar apenas campos permitidos
    if (schema.allowedFields) {
      for (const field of schema.allowedFields) {
        if (data[field] !== undefined) {
          sanitized[field] = data[field];
        }
      }
    } else {
      // Se não há campos permitidos, copiar tudo
      Object.assign(sanitized, data);
    }
    
    // Normalizar tipos
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (sanitized[field] !== undefined) {
          if (expectedType === 'number' && typeof sanitized[field] !== 'number') {
            sanitized[field] = Number(sanitized[field]) || 0;
          } else if (expectedType === 'string' && typeof sanitized[field] !== 'string') {
            sanitized[field] = String(sanitized[field] || '');
          }
        }
      }
    }
  }
  
  return sanitized;
}

// Exportar para uso global
window.dataValidator = {
  validateDataStructure,
  validateApiResponse,
  validateWithCommonSchema,
  sanitizeData,
  COMMON_SCHEMAS
};

if (window.Logger) {
  window.Logger.success('✅ Sistema de validação de dados inicializado');
}

