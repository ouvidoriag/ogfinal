/**
 * Pipeline para Análise por Categoria
 * Retorna distribuição de manifestações por categoria
 */

/**
 * Construir pipeline de categoria
 * @param {Object} filters - Filtros a aplicar
 * @param {number} limit - Limite de resultados (padrão: 20)
 * @returns {Array} Pipeline MongoDB
 */
export function buildCategoriaPipeline(filters = {}, limit = 20) {
  const pipeline = [];
  
  // Construir $match
  const match = buildMatchFromFilters(filters);
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  
  // Agrupar por categoria (campo pode variar - tentar múltiplos campos)
  pipeline.push(
    {
      $match: {
        $or: [
          { categoria: { $exists: true, $ne: null, $ne: '' } },
          { 'data.categoria': { $exists: true, $ne: null, $ne: '' } },
          { 'data.Categoria': { $exists: true, $ne: null, $ne: '' } }
        ]
      }
    },
    {
      $addFields: {
        categoriaField: {
          $ifNull: [
            '$categoria',
            { $ifNull: ['$data.categoria', '$data.Categoria'] }
          ]
        }
      }
    },
    {
      $group: {
        _id: '$categoriaField',
        count: { $sum: 1 },
        temas: { $addToSet: '$tema' },
        statuses: { $addToSet: '$status' }
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
  
  const { categoria, ...otherFilters } = filters;
  
  const filterFields = [
    'servidor', 'unidadeCadastro', 'status', 'tema', 'orgaos', 
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

