/**
 * Pipeline para Análise por Tema
 * Retorna distribuição de manifestações por tema
 */

/**
 * Construir pipeline de tema
 * @param {Object} filters - Filtros a aplicar
 * @param {number} limit - Limite de resultados (padrão: 20)
 * @returns {Array} Pipeline MongoDB
 */
export function buildTemaPipeline(filters = {}, limit = 20) {
  const pipeline = [];
  
  // Construir $match
  const match = buildMatchFromFilters(filters);
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  
  // Agrupar por tema
  pipeline.push(
    { $match: { tema: { $exists: true, $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$tema',
        count: { $sum: 1 },
        // Estatísticas adicionais por tema
        statuses: { $addToSet: '$status' },
        tipos: { $addToSet: '$tipoDeManifestacao' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: limit }
  );
  
  return pipeline;
}

/**
 * Construir $match a partir de filtros
 */
function buildMatchFromFilters(filters = {}) {
  const match = {};
  
  // Excluir tema dos filtros (já estamos agrupando por ele)
  const { tema, ...otherFilters } = filters;
  
  const filterFields = [
    'servidor', 'unidadeCadastro', 'status', 'orgaos', 
    'tipoDeManifestacao', 'canal', 'prioridade', 'assunto',
    'responsavel', 'unidadeSaude'
  ];
  
  for (const field of filterFields) {
    if (otherFilters[field] !== undefined && otherFilters[field] !== null) {
      match[field] = otherFilters[field];
    }
  }
  
  // Filtros de data
  if (otherFilters.dataInicio || otherFilters.dataFim) {
    const dateFilter = {};
    if (otherFilters.dataInicio) dateFilter.$gte = otherFilters.dataInicio;
    if (otherFilters.dataFim) dateFilter.$lte = otherFilters.dataFim;
    
    match.$or = [
      { createdAt: dateFilter },
      { dataCriacaoIso: dateFilter }
    ];
  }
  
  return match;
}

