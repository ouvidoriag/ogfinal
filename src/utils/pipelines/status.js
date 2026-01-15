/**
 * Pipeline para Análise por Status
 * Retorna distribuição de manifestações por status
 */

/**
 * Construir pipeline de status
 * @param {Object} filters - Filtros a aplicar
 * @returns {Array} Pipeline MongoDB
 */
export function buildStatusPipeline(filters = {}) {
  const pipeline = [];
  
  // Construir $match
  const match = buildMatchFromFilters(filters);
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  
  // Agrupar por status
  pipeline.push(
    { $match: { status: { $exists: true, $ne: null, $ne: '' } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        // Estatísticas adicionais
        total: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 50 }
  );
  
  return pipeline;
}

/**
 * Construir $match a partir de filtros
 */
function buildMatchFromFilters(filters = {}) {
  const match = {};
  
  // Excluir status dos filtros (já estamos agrupando por ele)
  const { status, ...otherFilters } = filters;
  
  const filterFields = [
    'servidor', 'unidadeCadastro', 'tema', 'orgaos', 
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

