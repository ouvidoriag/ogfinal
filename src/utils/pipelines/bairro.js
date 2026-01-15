/**
 * Pipeline para Análise por Bairro
 * Retorna distribuição de manifestações por bairro
 */

/**
 * Construir pipeline de bairro
 * @param {Object} filters - Filtros a aplicar
 * @param {number} limit - Limite de resultados (padrão: 20)
 * @returns {Array} Pipeline MongoDB
 */
export function buildBairroPipeline(filters = {}, limit = 20) {
  const pipeline = [];
  
  // Construir $match
  const match = buildMatchFromFilters(filters);
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
  }
  
  // Agrupar por bairro (pode estar em diferentes campos)
  pipeline.push(
    {
      $addFields: {
        bairroField: {
          $ifNull: [
            '$bairro',
            { $ifNull: ['$data.bairro', '$data.Bairro'] }
          ]
        }
      }
    },
    {
      $match: {
        bairroField: { $exists: true, $ne: null, $ne: '' }
      }
    },
    {
      $group: {
        _id: '$bairroField',
        count: { $sum: 1 },
        // Estatísticas adicionais
        temas: { $addToSet: '$tema' },
        statuses: { $addToSet: '$status' },
        orgaos: { $addToSet: '$orgaos' }
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
  
  const { bairro, ...otherFilters } = filters;
  
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

