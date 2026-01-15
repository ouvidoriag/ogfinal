/**
 * Config Module - Sistema Global de Configuração Centralizada
 * Centraliza todos os nomes de campos, endpoints, configurações e mapeamentos
 */

const FIELD_NAMES = {
  STATUS: 'Status',
  ORGAOS: 'Orgaos',
  SECRETARIA: 'Secretaria',
  TEMA: 'Tema',
  ASSUNTO: 'Assunto',
  DATA: 'Data',
  MES: 'Mês',
  BAIRRO: 'Bairro',
  CATEGORIA: 'Categoria',
  TIPO: 'Tipo',
  SETOR: 'Setor',
  UAC: 'UAC',
  RESPONSAVEL: 'Responsavel',
  CANAL: 'Canal',
  PRIORIDADE: 'Prioridade',
  CADASTRANTE: 'Cadastrante',
  UNIDADE: 'Unidade'
};

const FIELD_LABELS = {
  [FIELD_NAMES.STATUS]: 'Status',
  [FIELD_NAMES.ORGAOS]: 'Órgão',
  [FIELD_NAMES.SECRETARIA]: 'Secretaria',
  [FIELD_NAMES.TEMA]: 'Tema',
  [FIELD_NAMES.ASSUNTO]: 'Assunto',
  [FIELD_NAMES.DATA]: 'Data',
  [FIELD_NAMES.MES]: 'Mês',
  [FIELD_NAMES.BAIRRO]: 'Bairro',
  [FIELD_NAMES.CATEGORIA]: 'Categoria',
  [FIELD_NAMES.TIPO]: 'Tipo',
  [FIELD_NAMES.SETOR]: 'Setor',
  [FIELD_NAMES.UAC]: 'UAC',
  [FIELD_NAMES.RESPONSAVEL]: 'Responsável',
  [FIELD_NAMES.CANAL]: 'Canal',
  [FIELD_NAMES.PRIORIDADE]: 'Prioridade',
  [FIELD_NAMES.CADASTRANTE]: 'Cadastrante',
  [FIELD_NAMES.UNIDADE]: 'Unidade'
};

function getFieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

const API_ENDPOINTS = {
  FILTER: '/api/filter',
  SUMMARY: '/api/summary',
  DASHBOARD_DATA: '/api/dashboard-data',
  AGGREGATE_BY_MONTH: '/api/aggregate/by-month',
  AGGREGATE_BY_DAY: '/api/aggregate/by-day',
  AGGREGATE_BY_THEME: '/api/aggregate/by-theme',
  AGGREGATE_BY_SUBJECT: '/api/aggregate/by-subject',
  AGGREGATE_COUNT_BY: '/api/aggregate/count-by',
  AGGREGATE_TIME_SERIES: '/api/aggregate/time-series',
  AGGREGATE_HEATMAP: '/api/aggregate/heatmap',
  STATUS_OVERVIEW: '/api/stats/status-overview',
  AVERAGE_TIME_STATS: '/api/stats/average-time/stats',
  AI_INSIGHTS: '/api/ai/insights',
  CHAT_MESSAGES: '/api/chat/messages'
};

function buildEndpoint(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.pathname + url.search;
}

const CHART_CONFIG = {
  COLORS: {
    PRIMARY: '#06b6d4',        // Cyan - cor principal
    SECONDARY: '#8b5cf6',      // Violet - cor secundária
    SUCCESS: '#10b981',        // Verde - sucesso/concluído
    WARNING: '#f59e0b',        // Amarelo/Laranja - atenção
    DANGER: '#ef4444',         // Vermelho - erro/crítico
    INFO: '#3b82f6',           // Azul - informação
    PURPLE: '#a78bfa',         // Roxo
    PINK: '#ec4899',           // Rosa
    INDIGO: '#6366f1'          // Índigo
  },
  
  // Paleta principal - cores suaves otimizadas para fundo escuro
  COLOR_PALETTE: [
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#10b981', // Verde
    '#f59e0b', // Amarelo
    '#ef4444', // Vermelho
    '#3b82f6', // Azul
    '#ec4899', // Rosa
    '#a78bfa', // Roxo claro
    '#f97316', // Laranja
    '#6366f1', // Índigo
    '#eab308', // Amarelo ouro
    '#14b8a6'  // Turquesa
  ],
  
  // Paleta alternativa - tons mais suaves para gráficos múltiplos
  COLOR_PALETTE_SOFT: [
    'rgba(6, 182, 212, 0.7)',   // Cyan suave
    'rgba(139, 92, 246, 0.7)',  // Violet suave
    'rgba(16, 185, 129, 0.7)',  // Verde suave
    'rgba(245, 158, 11, 0.7)',  // Amarelo suave
    'rgba(239, 68, 68, 0.7)',   // Vermelho suave
    'rgba(59, 130, 246, 0.7)',  // Azul suave
    'rgba(236, 72, 153, 0.7)',  // Rosa suave
    'rgba(167, 139, 250, 0.7)', // Roxo suave
    'rgba(249, 115, 22, 0.7)',  // Laranja suave
    'rgba(99, 102, 241, 0.7)',  // Índigo suave
    'rgba(234, 179, 8, 0.7)',   // Amarelo ouro suave
    'rgba(20, 184, 166, 0.7)'   // Turquesa suave
  ],
  
  // Mapeamento de cores por tipo de manifestação (modo escuro) - cores suaves e consistentes
  // PADRÃO: Denúncia=vermelho, Reclamação=laranja, Sugestão=amarelo, Elogio=verde, ESIC=azul
  TIPO_MANIFESTACAO_COLORS: {
    'elogio': '#10b981',        // Verde - positivo
    'elogios': '#10b981',
    'reclamação': '#f97316',    // Laranja - sempre laranja para reclamação
    'reclamações': '#f97316',
    'reclamacao': '#f97316',
    'reclamacoes': '#f97316',
    'reclama': '#f97316',
    'denúncia': '#ef4444',      // Vermelho - crítico
    'denúncias': '#ef4444',
    'denuncia': '#ef4444',
    'denuncias': '#ef4444',
    'denún': '#ef4444',
    'sugestão': '#eab308',      // Amarelo - neutro/positivo (PADRÃO)
    'sugestões': '#eab308',
    'sugestao': '#eab308',
    'sugestoes': '#eab308',
    'sugest': '#eab308',
    'não informado': '#94a3b8', // Cinza
    'nao informado': '#94a3b8',
    'não informada': '#94a3b8',
    'nao informada': '#94a3b8',
    'não informados': '#94a3b8',
    'nao informados': '#94a3b8',
    'não informadas': '#94a3b8',
    'nao informadas': '#94a3b8',
    'acesso a informação': '#3b82f6', // Azul (PADRÃO)
    'acesso a informacao': '#3b82f6',
    'acesso à informação': '#3b82f6',
    'acesso à informacao': '#3b82f6',
    'esic': '#3b82f6',          // Azul (PADRÃO)
    'e-sic': '#3b82f6',
    'e sic': '#3b82f6',
    'lei de acesso': '#3b82f6',
    'lei acesso': '#3b82f6'
  },
  
  // Mapeamento de cores por tipo de manifestação (modo claro - cores mais escuras para contraste)
  // PADRÃO: Denúncia=vermelho, Reclamação=laranja, Sugestão=amarelo, Elogio=verde, ESIC=azul
  TIPO_MANIFESTACAO_COLORS_LIGHT: {
    'elogio': '#059669',        // Verde mais escuro
    'elogios': '#059669',
    'reclamação': '#ea580c',    // Laranja mais escuro
    'reclamações': '#ea580c',
    'reclamacao': '#ea580c',
    'reclamacoes': '#ea580c',
    'reclama': '#ea580c',
    'denúncia': '#dc2626',      // Vermelho mais escuro
    'denúncias': '#dc2626',
    'denuncia': '#dc2626',
    'denuncias': '#dc2626',
    'denún': '#dc2626',
    'sugestão': '#ca8a04',      // Amarelo mais escuro (PADRÃO)
    'sugestões': '#ca8a04',
    'sugestao': '#ca8a04',
    'sugestoes': '#ca8a04',
    'sugest': '#ca8a04',
    'não informado': '#64748b', // Cinza mais escuro
    'nao informado': '#64748b',
    'não informada': '#64748b',
    'nao informada': '#64748b',
    'não informados': '#64748b',
    'nao informados': '#64748b',
    'não informadas': '#64748b',
    'nao informadas': '#64748b',
    'acesso a informação': '#2563eb', // Azul mais escuro (PADRÃO)
    'acesso a informacao': '#2563eb',
    'acesso à informação': '#2563eb',
    'acesso à informacao': '#2563eb',
    'esic': '#2563eb',          // Azul mais escuro (PADRÃO)
    'e-sic': '#2563eb',
    'e sic': '#2563eb',
    'lei de acesso': '#2563eb',
    'lei acesso': '#2563eb'
  },
  
  // Mapeamento de cores por Status (consistente em todo o dashboard)
  STATUS_COLORS: {
    'aberto': '#3b82f6',           // Azul - em andamento
    'abertos': '#3b82f6',
    'em andamento': '#3b82f6',
    'andamento': '#3b82f6',
    'pendente': '#f59e0b',         // Amarelo - atenção
    'pendentes': '#f59e0b',
    'fechado': '#10b981',          // Verde - resolvido
    'fechados': '#10b981',
    'resolvido': '#10b981',
    'resolvidos': '#10b981',
    'concluído': '#10b981',
    'concluidos': '#10b981',
    'concluída': '#10b981',
    'concluidas': '#10b981',
    'cancelado': '#94a3b8',        // Cinza - cancelado
    'cancelados': '#94a3b8',
    'cancelada': '#94a3b8',
    'canceladas': '#94a3b8',
    'vencido': '#ef4444',          // Vermelho - atrasado
    'vencidos': '#ef4444',
    'vencida': '#ef4444',
    'vencidas': '#ef4444',
    'atrasado': '#ef4444',
    'atrasados': '#ef4444',
    'atrasada': '#ef4444',
    'atrasadas': '#ef4444',
    'em análise': '#8b5cf6',       // Roxo - análise
    'em analise': '#8b5cf6',
    'análise': '#8b5cf6',
    'analise': '#8b5cf6'
  },
  
  // Mapeamento de cores por Canal (consistente em todo o dashboard)
  CANAL_COLORS: {
    'site': '#06b6d4',             // Cyan - online
    'internet': '#06b6d4',
    'web': '#06b6d4',
    'online': '#06b6d4',
    'e-mail': '#3b82f6',           // Azul - email
    'email': '#3b82f6',
    'correio eletrônico': '#3b82f6',
    'presencial': '#10b981',       // Verde - presencial
    'balcão': '#10b981',
    'balcao': '#10b981',
    'telefone': '#f59e0b',         // Amarelo - telefone
    'fone': '#f59e0b',
    'whatsapp': '#25d366',         // Verde WhatsApp
    'redes sociais': '#ec4899',    // Rosa - redes sociais
    'facebook': '#1877f2',
    'instagram': '#e4405f',
    'twitter': '#1da1f2'
  },
  
  // Mapeamento de cores por Prioridade (consistente em todo o dashboard)
  PRIORIDADE_COLORS: {
    'alta': '#ef4444',             // Vermelho - urgente
    'altas': '#ef4444',
    'urgente': '#ef4444',
    'urgentes': '#ef4444',
    'média': '#f59e0b',            // Amarelo/Laranja - atenção
    'media': '#f59e0b',
    'médias': '#f59e0b',
    'medias': '#f59e0b',
    'baixa': '#10b981',            // Verde - normal
    'baixas': '#10b981',
    'normal': '#10b981',
    'normais': '#10b981'
  },
  
  PERFORMANCE: {
    MAX_POINTS: 100,
    MAX_LABELS: 15,
    ANIMATION_DURATION: 0,
    POINT_RADIUS: 3,
    POINT_HOVER_RADIUS: 5
  },
  
  TOOLTIP: {
    BACKGROUND: 'rgba(15, 23, 42, 0.95)',
    TITLE_COLOR: '#e2e8f0',
    BODY_COLOR: '#cbd5e1',
    BORDER_COLOR: 'rgba(34, 211, 238, 0.3)',
    BORDER_WIDTH: 1,
    PADDING: 12
  },
  
  DATA_LABELS: {
    COLOR: '#e2e8f0',
    FONT_SIZE: 11,
    FONT_WEIGHT: 'bold',
    PADDING: 4,
    BACKGROUND: 'rgba(15, 23, 42, 0.7)',
    BORDER_RADIUS: 4
  }
};

const FORMAT_CONFIG = {
  LOCALE: 'pt-BR',
  DATE_FORMAT: {
    SHORT: 'dd/MM/yyyy',
    LONG: 'dd de MMMM de yyyy',
    MONTH_YEAR: 'MMM. de yyyy'
  },
  MONTH_NAMES: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
  MONTH_NAMES_FULL: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ],
  NUMBER: {
    DECIMAL_PLACES: 2,
    THOUSAND_SEPARATOR: '.',
    DECIMAL_SEPARATOR: ','
  },
  PERCENTAGE: {
    DECIMAL_PLACES: 1,
    SHOW_SYMBOL: true
  }
};

const PERFORMANCE_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 6,
  REQUEST_TIMEOUT: 60000,
  MAX_RETRIES: 2,
  RETRY_DELAY_BASE: 2000,
  MAX_RECORDS_PER_PAGE: 2000,
  MAX_CHART_POINTS: 100,
  MAX_LIST_ITEMS: 50
};

/**
 * Verificar se está no modo claro
 * @returns {boolean}
 */
function isLightMode() {
  return document.body && document.body.classList.contains('light-mode');
}

/**
 * Obter cor baseada no tipo de manifestação
 * @param {string} tipo - Tipo de manifestação
 * @returns {string} - Cor hexadecimal
 */
function getColorByTipoManifestacao(tipo) {
  if (!tipo || typeof tipo !== 'string') {
    return null;
  }
  
  const tipoLower = tipo.toLowerCase().trim();
  // Usar cores diferentes para modo claro e escuro
  const colorMap = isLightMode() 
    ? CHART_CONFIG.TIPO_MANIFESTACAO_COLORS_LIGHT 
    : CHART_CONFIG.TIPO_MANIFESTACAO_COLORS;
  
  // Buscar correspondência exata ou parcial
  for (const [key, color] of Object.entries(colorMap)) {
    if (tipoLower.includes(key) || key.includes(tipoLower)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Obter cor baseada em categoria e valor (função genérica)
 * @param {string} category - Categoria (Status, Canal, Prioridade, Tipo, etc.)
 * @param {string} value - Valor da categoria
 * @returns {string|null} - Cor hexadecimal ou null se não encontrada
 */
function getColorByCategory(category, value) {
  if (!category || !value) return null;
  
  const categoryLower = category.toLowerCase().trim();
  const valueLower = (value || '').toString().toLowerCase().trim();
  
  // Mapear categoria para o objeto de cores correspondente
  let colorMap = null;
  
  if (categoryLower.includes('tipo') || categoryLower.includes('manifestacao')) {
    colorMap = isLightMode() 
      ? CHART_CONFIG.TIPO_MANIFESTACAO_COLORS_LIGHT 
      : CHART_CONFIG.TIPO_MANIFESTACAO_COLORS;
  } else if (categoryLower.includes('status') || categoryLower.includes('situacao')) {
    colorMap = CHART_CONFIG.STATUS_COLORS;
  } else if (categoryLower.includes('canal') || categoryLower.includes('origem')) {
    colorMap = CHART_CONFIG.CANAL_COLORS;
  } else if (categoryLower.includes('prioridade')) {
    colorMap = CHART_CONFIG.PRIORIDADE_COLORS;
  }
  
  if (!colorMap) return null;
  
  // Buscar correspondência exata ou parcial
  for (const [key, color] of Object.entries(colorMap)) {
    if (valueLower === key || valueLower.includes(key) || key.includes(valueLower)) {
      return color;
    }
  }
  
  return null;
}

/**
 * Obter cor por Status
 * @param {string} status - Status
 * @returns {string|null} - Cor hexadecimal
 */
function getColorByStatus(status) {
  return getColorByCategory('status', status);
}

/**
 * Obter cor por Canal
 * @param {string} canal - Canal
 * @returns {string|null} - Cor hexadecimal
 */
function getColorByCanal(canal) {
  return getColorByCategory('canal', canal);
}

/**
 * Obter cor por Prioridade
 * @param {string} prioridade - Prioridade
 * @returns {string|null} - Cor hexadecimal
 */
function getColorByPrioridade(prioridade) {
  return getColorByCategory('prioridade', prioridade);
}

window.config = {
  FIELD_NAMES,
  FIELD_LABELS,
  getFieldLabel,
  API_ENDPOINTS,
  buildEndpoint,
  CHART_CONFIG,
  FORMAT_CONFIG,
  PERFORMANCE_CONFIG,
  getColorByTipoManifestacao,
  getColorByCategory,
  getColorByStatus,
  getColorByCanal,
  getColorByPrioridade
};

window.FIELD_NAMES = FIELD_NAMES;
window.FIELD_LABELS = FIELD_LABELS;
window.API_ENDPOINTS = API_ENDPOINTS;
window.CHART_CONFIG = CHART_CONFIG;

