/**
 * Formatador Global de Dados
 * Funções utilitárias para formatar dados de agregações MongoDB
 * Garante consistência em todos os endpoints
 */

/**
 * Formatar percentual
 * @param {number} value - Valor
 * @param {number} total - Total
 * @param {number} decimals - Casas decimais (padrão: 1)
 * @returns {string} Percentual formatado
 */
export function formatPercent(value, total, decimals = 1) {
  if (!total || total === 0) return '0.0';
  return ((value / total) * 100).toFixed(decimals);
}

/**
 * Formatar grupo de dados com percentuais
 * @param {Array} data - Array de { _id, count }
 * @param {number} total - Total para cálculo de percentuais
 * @returns {Array} Array formatado com percentuais
 */
export function formatGroupByResult(data, total = null) {
  if (!Array.isArray(data)) return [];
  
  // Calcular total se não fornecido
  if (total === null) {
    total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  }
  
  return data.map(item => ({
    key: item._id || item.key || 'N/A',
    label: item._id || item.key || 'N/A',
    value: item.count || item.value || 0,
    count: item.count || item.value || 0,
    percent: formatPercent(item.count || item.value || 0, total),
    // Compatibilidade
    _id: item._id || item.key || 'N/A'
  }));
}

/**
 * Formatar série temporal mensal
 * @param {Array} data - Array de { month, count }
 * @returns {Array} Array formatado ordenado
 */
export function formatMonthlySeries(data) {
  if (!Array.isArray(data)) return [];
  
  return data
    .map(item => ({
      month: item.month || item.ym || item._id || 'N/A',
      ym: item.month || item.ym || item._id || 'N/A', // Compatibilidade
      count: item.count || item.value || 0,
      value: item.count || item.value || 0,
      _id: item.month || item.ym || item._id || 'N/A' // Compatibilidade
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Formatar série temporal diária
 * @param {Array} data - Array de { date, count }
 * @returns {Array} Array formatado ordenado
 */
export function formatDailySeries(data) {
  if (!Array.isArray(data)) return [];
  
  return data
    .map(item => ({
      date: item.date || item._id || 'N/A',
      count: item.count || item.value || 0,
      value: item.count || item.value || 0,
      _id: item.date || item._id || 'N/A' // Compatibilidade
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Formatar dados de funil
 * @param {Array} data - Array de dados do funil
 * @returns {Object} Dados formatados para gráfico de funil
 */
export function formatFunnel(data) {
  if (!Array.isArray(data)) return { stages: [], total: 0 };
  
  const total = data.reduce((sum, item) => sum + (item.count || item.value || 0), 0);
  
  const stages = data.map((item, index) => {
    const count = item.count || item.value || 0;
    const prevCount = index > 0 ? (data[index - 1].count || data[index - 1].value || 0) : total;
    
    return {
      stage: item._id || item.key || item.label || 'N/A',
      count,
      percent: formatPercent(count, total),
      dropoff: index > 0 ? formatPercent(prevCount - count, prevCount) : '0.0',
      dropoffCount: index > 0 ? prevCount - count : 0
    };
  });
  
  return {
    stages,
    total,
    conversionRate: stages.length > 0 ? formatPercent(stages[stages.length - 1].count, total) : '0.0'
  };
}

/**
 * Formatar KPIs
 * @param {Object} data - Dados de KPIs
 * @returns {Object} KPIs formatados
 */
export function formatKPIs(data) {
  return {
    total: data.total || data.totalManifestations || 0,
    last7Days: data.last7Days || 0,
    last30Days: data.last30Days || 0,
    // Formatar com separadores
    totalFormatted: (data.total || data.totalManifestations || 0).toLocaleString('pt-BR'),
    last7DaysFormatted: (data.last7Days || 0).toLocaleString('pt-BR'),
    last30DaysFormatted: (data.last30Days || 0).toLocaleString('pt-BR'),
    // Percentuais
    last7DaysPercent: formatPercent(data.last7Days || 0, data.total || data.totalManifestations || 1),
    last30DaysPercent: formatPercent(data.last30Days || 0, data.total || data.totalManifestations || 1)
  };
}

/**
 * Formatar grupo de tendências
 * @param {Array} data - Array de dados temporais
 * @param {string} groupBy - Campo para agrupar ('month', 'day', etc.)
 * @returns {Object} Dados formatados com tendências
 */
export function formatTrendGroup(data, groupBy = 'month') {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      data: [],
      trend: 'stable',
      growth: 0,
      average: 0
    };
  }
  
  const formatted = groupBy === 'month' ? formatMonthlySeries(data) : formatDailySeries(data);
  
  // Calcular tendência
  const values = formatted.map(d => d.count || d.value || 0);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  
  // Comparar primeiro e último período
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const growth = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  const trend = growth > 5 ? 'up' : growth < -5 ? 'down' : 'stable';
  
  return {
    data: formatted,
    trend,
    growth: growth.toFixed(1),
    average: Math.round(average),
    firstPeriod: Math.round(firstAvg),
    lastPeriod: Math.round(secondAvg)
  };
}

/**
 * Formatar resultado de agregação MongoDB para formato padrão
 * @param {Array} aggregationResult - Resultado bruto do MongoDB
 * @param {string} keyField - Campo a usar como chave (padrão: '_id')
 * @param {string} valueField - Campo a usar como valor (padrão: 'count')
 * @returns {Array} Array formatado
 */
export function formatAggregationResult(aggregationResult, keyField = '_id', valueField = 'count') {
  if (!Array.isArray(aggregationResult)) return [];
  
  return aggregationResult.map(item => ({
    key: item[keyField] || 'N/A',
    label: item[keyField] || 'N/A',
    value: item[valueField] || 0,
    count: item[valueField] || 0,
    // Manter campos originais para compatibilidade
    ...item,
    _id: item[keyField] || item._id || 'N/A'
  }));
}

/**
 * Formatar dados de ranking (top N)
 * @param {Array} data - Array de dados
 * @param {number} limit - Limite de itens (padrão: 10)
 * @returns {Array} Top N itens formatados
 */
export function formatRanking(data, limit = 10) {
  if (!Array.isArray(data)) return [];
  
  const sorted = [...data].sort((a, b) => (b.count || b.value || 0) - (a.count || a.value || 0));
  const topN = sorted.slice(0, limit);
  const total = data.reduce((sum, item) => sum + (item.count || item.value || 0), 0);
  
  return topN.map((item, index) => ({
    rank: index + 1,
    key: item._id || item.key || 'N/A',
    label: item._id || item.key || 'N/A',
    value: item.count || item.value || 0,
    count: item.count || item.value || 0,
    percent: formatPercent(item.count || item.value || 0, total),
    _id: item._id || item.key || 'N/A'
  }));
}

