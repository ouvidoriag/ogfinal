/**
 * Pipeline para Overview (Dashboard Principal)
 * Retorna múltiplas agregações em uma única query usando $facet
 */

/**
 * Construir pipeline de overview com $facet
 * @param {Object} filters - Filtros a aplicar
 * @returns {Array} Pipeline MongoDB
 */
export function buildOverviewPipeline(filters = {}) {
  const pipeline = [];
  
  // DEBUG: Log dos filtros recebidos
  if (filters.dataCriacaoIso || filters.statusDemanda) {
    console.log('🔍 buildOverviewPipeline: Filtros recebidos:', {
      hasDataCriacaoIso: !!filters.dataCriacaoIso,
      dataCriacaoIso: filters.dataCriacaoIso,
      hasStatusDemanda: !!filters.statusDemanda,
      statusDemanda: filters.statusDemanda,
      filterKeys: Object.keys(filters)
    });
  }
  
  // Construir $match a partir dos filtros
  const match = buildMatchFromFilters(filters);
  
  // DEBUG: Log do match construído (usar console.log para garantir que aparece)
  if (match.dataCriacaoIso || match.statusDemanda) {
    console.log('🔍 buildOverviewPipeline: Match construído:', {
      hasDataCriacaoIso: !!match.dataCriacaoIso,
      dataCriacaoIso: match.dataCriacaoIso,
      hasStatusDemanda: !!match.statusDemanda,
      statusDemanda: match.statusDemanda,
      matchKeys: Object.keys(match),
      fullMatch: match
    });
  }
  
  if (Object.keys(match).length > 0) {
    pipeline.push({ $match: match });
    console.log('✅ $match adicionado ao pipeline com', Object.keys(match).length, 'filtros');
  } else {
    console.log('⚠️ Nenhum filtro aplicado no $match');
  }
  
  // Pipeline com $facet para múltiplas agregações
  pipeline.push({
    $facet: {
      // Por Status
      porStatus: [
        { $match: { status: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ],
      
      // Por Mês (últimos 24 meses)
      porMes: buildMonthAggregation(),
      
      // Por Dia (últimos 30 dias)
      porDia: buildDayAggregation(),
      
      // Por Tema (TOP 5 para Rankings)
      porTema: [
        { $match: { tema: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$tema', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      
      // Por Assunto
      porAssunto: [
        { $match: { assunto: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$assunto', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ],
      
      // Por Órgãos (TOP 5 para Rankings)
      porOrgaos: [
        { $match: { orgaos: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$orgaos', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      
      // Por Tipo
      porTipo: [
        { $match: { tipoDeManifestacao: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$tipoDeManifestacao', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ],
      
      // Por Canal
      porCanal: [
        { $match: { canal: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$canal', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ],
      
      // Por Prioridade
      porPrioridade: [
        { $match: { prioridade: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$prioridade', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ],
      
      // Por Unidade de Cadastro (TOP 5 para Rankings)
      porUnidadeCadastro: [
        { $match: { unidadeCadastro: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: '$unidadeCadastro', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ],
      
      // Total e contadores
      total: [
        { $count: 'total' }
      ],
      
      // Últimos 7 dias
      last7Days: buildLastDaysAggregation(7),
      
      // Últimos 30 dias
      last30Days: buildLastDaysAggregation(30)
    }
  });
  
  return pipeline;
}

/**
 * Construir $match a partir de filtros
 * @param {Object} filters - Filtros do sistema
 * @returns {Object} Objeto $match para MongoDB
 */
function buildMatchFromFilters(filters = {}) {
  // Garantir que filters é um objeto
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return {};
  }
  
  const match = {};
  
  const filterFields = [
    'servidor', 'unidadeCadastro', 'status', 'tema', 'orgaos', 
    'tipoDeManifestacao', 'canal', 'prioridade', 'assunto',
    'responsavel', 'unidadeSaude'
  ];
  
  for (const field of filterFields) {
    if (filters[field] !== undefined && filters[field] !== null) {
      // Suportar objetos MongoDB como { $in: [...] } para seleção múltipla
      if (typeof filters[field] === 'object' && !Array.isArray(filters[field]) && filters[field].constructor === Object) {
        // Se for um objeto MongoDB (ex: { $in: [...] }), usar diretamente
        if (filters[field].$in || filters[field].$regex || filters[field].$gte || filters[field].$lte) {
          match[field] = filters[field];
        } else {
          // Objeto simples, usar como está
          match[field] = filters[field];
        }
      } else if (Array.isArray(filters[field])) {
        // Se for array, converter para $in
        match[field] = { $in: filters[field] };
      } else {
        // Valor simples
        match[field] = filters[field];
      }
    }
  }
  
  // Filtros de data
  // CORREÇÃO: Processar filtros de data que já vêm no formato MongoDB (do filterController)
  // Verificar se dataCriacaoIso já tem operadores MongoDB ($gte, $lte, etc)
  if (filters.dataCriacaoIso && typeof filters.dataCriacaoIso === 'object' && 
      (filters.dataCriacaoIso.$gte || filters.dataCriacaoIso.$lte || filters.dataCriacaoIso.$gt || filters.dataCriacaoIso.$lt)) {
    // Filtro já está no formato MongoDB, usar diretamente
    // IMPORTANTE: dataCriacaoIso é string no formato YYYY-MM-DD
    // MongoDB compara strings lexicograficamente, então "2025-11-01" <= "2025-11-30" funciona corretamente
    // Se o $lte vier com timestamp, remover o timestamp para manter consistência
    const dateFilter = { ...filters.dataCriacaoIso };
    if (dateFilter.$gte && typeof dateFilter.$gte === 'string' && dateFilter.$gte.includes('T')) {
      dateFilter.$gte = dateFilter.$gte.split('T')[0]; // Remover timestamp
    }
    if (dateFilter.$lte && typeof dateFilter.$lte === 'string' && dateFilter.$lte.includes('T')) {
      dateFilter.$lte = dateFilter.$lte.split('T')[0]; // Remover timestamp
    }
    
    match.dataCriacaoIso = dateFilter;
    
    // DEBUG: Log do filtro de data aplicado
    console.log('✅ Filtro de data aplicado no $match:', {
      dataCriacaoIso: match.dataCriacaoIso,
      gte: match.dataCriacaoIso.$gte,
      lte: match.dataCriacaoIso.$lte,
      original: filters.dataCriacaoIso
    });
  } else if (filters.dataInicio || filters.dataFim) {
    // Formato antigo: dataInicio e dataFim
    const dateFilter = {};
    if (filters.dataInicio) dateFilter.$gte = filters.dataInicio;
    if (filters.dataFim) dateFilter.$lte = filters.dataFim;
    
    if (match.createdAt) {
      match.createdAt = { ...match.createdAt, ...dateFilter };
    } else {
      // Evitar sobrescrever $or existente
      if (match.$or) {
        match.$and = [
          { $or: match.$or },
          { $or: [
            { createdAt: dateFilter },
            { dataCriacaoIso: dateFilter }
          ]}
        ];
        delete match.$or;
      } else {
        match.$or = [
          { createdAt: dateFilter },
          { dataCriacaoIso: dateFilter }
        ];
      }
    }
  }
  
  // CORREÇÃO: Processar também statusDemanda se vier com operador contains (do filterController)
  if (filters.statusDemanda && typeof filters.statusDemanda === 'object' && 
      (filters.statusDemanda.$regex || filters.statusDemanda.$in)) {
    match.statusDemanda = filters.statusDemanda;
  }
  
  return match;
}

/**
 * Pipeline para agregação por mês
 * CORREÇÃO: Priorizar dataCriacaoIso (data real da manifestação) ao invés de createdAt (data de importação)
 */
function buildMonthAggregation() {
  return [
    {
      $addFields: {
        dateField: {
          $cond: {
            // PRIORIDADE 1: dataCriacaoIso (data real da manifestação)
            if: { $ne: ['$dataCriacaoIso', null] },
            then: { $dateFromString: { dateString: { $concat: ['$dataCriacaoIso', 'T00:00:00Z'] } } },
            else: {
              // PRIORIDADE 2: dataDaCriacao (fallback se dataCriacaoIso não existir)
              // Tentar parsear dataDaCriacao diretamente
              $cond: {
                if: { $ne: ['$dataDaCriacao', null] },
                then: {
                  $dateFromString: {
                    dateString: {
                      $cond: {
                        // Se dataDaCriacao já está em formato ISO (YYYY-MM-DD), usar diretamente
                        if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{4}-\d{2}-\d{2}/ } },
                        then: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] },
                        // Se está em formato DD/MM/YYYY, converter para YYYY-MM-DD
                        else: {
                          $cond: {
                            if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{2}\/\d{2}\/\d{4}/ } },
                            then: {
                              $concat: [
                                { $substr: ['$dataDaCriacao', 6, 4] }, // ano (posições 6-9)
                                '-',
                                { $substr: ['$dataDaCriacao', 3, 2] }, // mês (posições 3-4)
                                '-',
                                { $substr: ['$dataDaCriacao', 0, 2] }, // dia (posições 0-1)
                                'T00:00:00Z'
                              ]
                            },
                            // Tentar parsear como está (pode ser outro formato)
                            else: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] }
                          }
                        }
                      }
                    },
                    onError: null
                  }
                },
                else: null
              }
            }
          }
        }
      }
    },
    { $match: { dateField: { $ne: null } } },
    {
      $group: {
        _id: {
          year: { $year: '$dateField' },
          month: { $month: '$dateField' }
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        month: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            {
              $cond: {
                if: { $lt: ['$_id.month', 10] },
                then: { $concat: ['0', { $toString: '$_id.month' }] },
                else: { $toString: '$_id.month' }
              }
            }
          ]
        },
        count: 1
      }
    },
    { $sort: { month: 1 } },
    { $limit: 24 }
  ];
}

/**
 * Pipeline para agregação por dia
 * CORREÇÃO: Priorizar dataCriacaoIso (data real da manifestação) ao invés de createdAt (data de importação)
 */
function buildDayAggregation() {
  return [
    {
      $addFields: {
        dateField: {
          $cond: {
            // PRIORIDADE 1: dataCriacaoIso (data real da manifestação)
            if: { $ne: ['$dataCriacaoIso', null] },
            then: { $dateFromString: { dateString: { $concat: ['$dataCriacaoIso', 'T00:00:00Z'] } } },
            else: {
              // PRIORIDADE 2: dataDaCriacao (fallback se dataCriacaoIso não existir)
              // Tentar parsear dataDaCriacao diretamente
              $cond: {
                if: { $ne: ['$dataDaCriacao', null] },
                then: {
                  $dateFromString: {
                    dateString: {
                      $cond: {
                        // Se dataDaCriacao já está em formato ISO (YYYY-MM-DD), usar diretamente
                        if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{4}-\d{2}-\d{2}/ } },
                        then: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] },
                        // Se está em formato DD/MM/YYYY, converter para YYYY-MM-DD
                        else: {
                          $cond: {
                            if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{2}\/\d{2}\/\d{4}/ } },
                            then: {
                              $concat: [
                                { $substr: ['$dataDaCriacao', 6, 4] }, // ano (posições 6-9)
                                '-',
                                { $substr: ['$dataDaCriacao', 3, 2] }, // mês (posições 3-4)
                                '-',
                                { $substr: ['$dataDaCriacao', 0, 2] }, // dia (posições 0-1)
                                'T00:00:00Z'
                              ]
                            },
                            // Tentar parsear como está (pode ser outro formato)
                            else: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] }
                          }
                        }
                      }
                    },
                    onError: null
                  }
                },
                else: null
              }
            }
          }
        }
      }
    },
    {
      $match: {
        dateField: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          $ne: null
        }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateField' } },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        count: 1
      }
    },
    { $sort: { date: 1 } },
    { $limit: 30 }
  ];
}

/**
 * Pipeline para contagem dos últimos N dias
 * CORREÇÃO: Priorizar dataCriacaoIso (data real da manifestação) ao invés de createdAt (data de importação)
 */
function buildLastDaysAggregation(days) {
  return [
    {
      $addFields: {
        dateField: {
          $cond: {
            // PRIORIDADE 1: dataCriacaoIso (data real da manifestação)
            if: { $ne: ['$dataCriacaoIso', null] },
            then: { $dateFromString: { dateString: { $concat: ['$dataCriacaoIso', 'T00:00:00Z'] } } },
            else: {
              // PRIORIDADE 2: dataDaCriacao (fallback se dataCriacaoIso não existir)
              // Tentar parsear dataDaCriacao diretamente
              $cond: {
                if: { $ne: ['$dataDaCriacao', null] },
                then: {
                  $dateFromString: {
                    dateString: {
                      $cond: {
                        // Se dataDaCriacao já está em formato ISO (YYYY-MM-DD), usar diretamente
                        if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{4}-\d{2}-\d{2}/ } },
                        then: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] },
                        // Se está em formato DD/MM/YYYY, converter para YYYY-MM-DD
                        else: {
                          $cond: {
                            if: { $regexMatch: { input: '$dataDaCriacao', regex: /^\d{2}\/\d{2}\/\d{4}/ } },
                            then: {
                              $concat: [
                                { $substr: ['$dataDaCriacao', 6, 4] }, // ano (posições 6-9)
                                '-',
                                { $substr: ['$dataDaCriacao', 3, 2] }, // mês (posições 3-4)
                                '-',
                                { $substr: ['$dataDaCriacao', 0, 2] }, // dia (posições 0-1)
                                'T00:00:00Z'
                              ]
                            },
                            // Tentar parsear como está (pode ser outro formato)
                            else: { $concat: ['$dataDaCriacao', 'T00:00:00Z'] }
                          }
                        }
                      }
                    },
                    onError: null
                  }
                },
                else: null
              }
            }
          }
        }
      }
    },
    {
      $match: {
        dateField: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          $ne: null
        }
      }
    },
    { $count: 'total' }
  ];
}

