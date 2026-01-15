/**
 * Módulo: Tabelas
 * Funções relacionadas a carregamento e renderização de tabelas
 * Integrado com sistema de comunicação de gráficos para atualização automática
 */

// Variáveis globais para estado da tabela
let currentTableData = [];
let currentTableHeaders = [];

/**
 * Carregar tabela de registros
 * @param {number|string} limit - Limite de registros (padrão: 50, 'all' para todos)
 * @param {Array} filters - Filtros opcionais para aplicar
 */
async function loadTable(limit = 50, filters = null) {
  // Verificar se elementos existem ANTES de fazer requisição
  const tbody = document.getElementById('tbody');
  const thead = document.getElementById('thead');
  
  if (!tbody || !thead) {
    // Elementos não existem - não fazer requisição desnecessária
    if (window.Logger) {
      window.Logger.debug('Tabela não está na página atual, pulando carregamento');
    }
    return; // Retornar sem fazer requisição
  }

  try {
    const pageSize = limit === 'all' ? 10000 : parseInt(limit) || 50;
    
    // Se houver filtros ativos do sistema de comunicação de gráficos, usá-los
    let activeFilters = filters;
    if (!activeFilters && window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters.filters || [];
      if (globalFilters.length > 0) {
        activeFilters = globalFilters;
      }
    }
    
    let data;
    
    // Se houver filtros, usar endpoint /api/filter
    if (activeFilters && activeFilters.length > 0) {
      if (window.Logger) {
        window.Logger.debug(`Carregando tabela com ${activeFilters.length} filtro(s) aplicado(s)`, activeFilters);
      }
      
      // Preparar requisição para /api/filter
      const filterRequest = {
        filters: activeFilters,
        originalUrl: window.location.pathname
      };
      
      // Usar fetch direto para POST (dataLoader não suporta POST customizado)
      try {
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include', // Enviar cookies de sessão
          body: JSON.stringify(filterRequest)
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar dados filtrados: ${response.statusText}`);
        }
        
        const filteredRows = await response.json();
        data = {
          rows: filteredRows,
          total: filteredRows.length
        };
      } catch (filterError) {
        if (window.Logger) {
          window.Logger.error('Erro ao aplicar filtros na tabela:', filterError);
        }
        // Em caso de erro, carregar sem filtros
        data = await window.dataLoader?.load(`/api/records?page=1&pageSize=${pageSize}`, { 
          fallback: { rows: [], total: 0 } 
        }) || { rows: [], total: 0 };
      }
    } else {
      // Sem filtros, usar endpoint normal
      data = await window.dataLoader?.load(`/api/records?page=1&pageSize=${pageSize}`, { 
        fallback: { rows: [], total: 0 } 
      }) || { rows: [], total: 0 };
    }
    
    const rows = data.rows || [];
    currentTableData = rows;
    
    const tableInfo = document.getElementById('tableInfo');
    
    tbody.innerHTML = '';
    thead.innerHTML = '';
      
    if (rows.length === 0) {
      if (tableInfo) {
        const filterText = activeFilters && activeFilters.length > 0 
          ? ` com ${activeFilters.length} filtro(s) aplicado(s)` 
          : '';
        tableInfo.textContent = `Nenhum registro encontrado${filterText}`;
      }
      return;
    }
      
    const first = rows[0];
    // Extrair chaves do objeto data ou do próprio objeto
    const dataObj = first.data || first;
    const keys = Object.keys(dataObj);
    currentTableHeaders = keys;
      
    // Ordenar colunas por importância
    const priorityOrder = [
      'protocolo', 
      'data_da_criacao', 
      'status_demanda', 
      'tipo_de_manifestacao', 
      'tema', 
      'assunto', 
      'orgaos', 
      'unidade_cadastro', 
      'responsavel', 
      'canal', 
      'prioridade', 
      'status'
    ];
    const sortedKeys = [
      ...priorityOrder.filter(k => keys.includes(k)), 
      ...keys.filter(k => !priorityOrder.includes(k))
    ];
      
    // Criar cabeçalho
    for (const k of sortedKeys) {
      const th = document.createElement('th'); 
      th.textContent = k; 
      th.className = 'px-3 py-2 text-left font-semibold text-slate-300 sticky top-0 bg-slate-900/95'; 
      thead.appendChild(th);
    }
      
    // Criar linhas
    for (const r of rows) {
      const tr = document.createElement('tr'); 
      tr.className = 'hover:bg-white/5 transition-colors duration-100';
      const rowData = r.data || r;
      
      for (const k of sortedKeys) {
        const td = document.createElement('td'); 
        const value = rowData[k] ?? '';
        td.textContent = value; 
        td.className = 'px-3 py-2 text-slate-300'; 
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
      
    if (tableInfo) {
      const filterText = activeFilters && activeFilters.length > 0 
        ? ` (${activeFilters.length} filtro(s) aplicado(s))` 
        : '';
      tableInfo.textContent = `Mostrando ${rows.length} de ${data.total || rows.length} registros${filterText}`;
    }
    
    if (window.Logger) {
      window.Logger.success(`Tabela carregada: ${rows.length} registros`);
    }
  } catch (error) {
    // Tratamento de erro
    if (window.Logger) {
      window.Logger.error('Erro ao carregar tabela:', error);
    } else {
      console.error('❌ Erro ao carregar tabela:', error);
    }
    const tableInfo = document.getElementById('tableInfo');
    if (tableInfo) {
      tableInfo.textContent = 'Erro ao carregar dados';
    }
    const tbody = document.getElementById('tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="100%" class="text-center text-red-400 py-4">Erro ao carregar dados da tabela</td></tr>';
    }
  }
}

/**
 * Obter dados atuais da tabela
 */
function getCurrentTableData() {
  return currentTableData;
}

/**
 * Obter cabeçalhos atuais da tabela
 */
function getCurrentTableHeaders() {
  return currentTableHeaders;
}

function initTableFilterListeners() {
  return;
}

// Exportar funções para uso global
if (typeof window !== 'undefined') {
  if (!window.data) window.data = {};
  
  window.data.loadTable = loadTable;
  window.data.getCurrentTableData = getCurrentTableData;
  window.data.getCurrentTableHeaders = getCurrentTableHeaders;
  window.data.initTableFilterListeners = initTableFilterListeners;
  
  // Exportar variáveis globais para compatibilidade
  window.data.currentTableData = currentTableData;
  window.data.currentTableHeaders = currentTableHeaders;
  
  // Exportar também como variáveis globais para compatibilidade
  window.loadTable = loadTable;
  window.getCurrentTableData = getCurrentTableData;
  window.getCurrentTableHeaders = getCurrentTableHeaders;
  
  // Permitir acesso direto às variáveis (com getters)
  Object.defineProperty(window.data, 'currentTableData', {
    get: () => currentTableData,
    set: (val) => { currentTableData = val; }
  });
  
  Object.defineProperty(window.data, 'currentTableHeaders', {
    get: () => currentTableHeaders,
    set: (val) => { currentTableHeaders = val; }
  });
  
  // Inicializar listeners quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Aguardar um pouco para garantir que chartCommunication está disponível
      setTimeout(() => {
        initTableFilterListeners();
      }, 500);
    });
  } else {
    // DOM já está pronto
    setTimeout(() => {
      initTableFilterListeners();
    }, 500);
  }
}

