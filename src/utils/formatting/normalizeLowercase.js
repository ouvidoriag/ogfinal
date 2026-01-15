/**
 * Normalização Lowercase
 * 
 * Helper para normalizar strings para lowercase (sem acentos)
 * Usado para criar campos indexados que otimizam filtros "contains"
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

/**
 * Normalizar string para lowercase sem acentos
 * @param {String} str - String a normalizar
 * @returns {String} String normalizada ou null
 */
export function normalizeToLowercase(str) {
  if (!str || typeof str !== 'string') {
    return null;
  }

  // Remover acentos e normalizar para lowercase
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .toLowerCase()
    .trim();
}

/**
 * Normalizar objeto de registro adicionando campos lowercase
 * @param {Object} record - Registro a normalizar
 * @returns {Object} Registro com campos lowercase adicionados
 */
export function addLowercaseFields(record) {
  const normalized = { ...record };

  // Campos que devem ter versão lowercase
  const fieldsToLowercase = [
    'tema',
    'assunto',
    'canal',
    'orgaos',
    'statusDemanda',
    'tipoDeManifestacao',
    'responsavel',
    'bairro',
    'unidadeCadastro',
    'unidadeSaude',
    'servidor'
  ];

  for (const field of fieldsToLowercase) {
    const value = record[field] || record.data?.[field];
    if (value) {
      const lowercaseField = `${field}Lowercase`;
      normalized[lowercaseField] = normalizeToLowercase(String(value));
    }
  }

  return normalized;
}

/**
 * Normalizar valor de filtro para lowercase (para comparação)
 * @param {String} value - Valor do filtro
 * @returns {String} Valor normalizado
 */
export function normalizeFilterValue(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  return normalizeToLowercase(value);
}

