/**
 * Page Helper - Utilitário para Páginas
 * PRIORIDADE 3: Extração de código duplicado
 * 
 * Funcionalidades:
 * - Verificação de visibilidade de página
 * - Padrão comum de inicialização
 * - Helpers reutilizáveis
 * 
 * Data: 11/12/2025
 * CÉREBRO X-3
 */

/**
 * Verificar se uma página está visível
 * @param {string} pageId - ID da página (ex: 'page-tema')
 * @returns {boolean} - true se a página está visível
 */
function isPageVisible(pageId) {
  const page = document.getElementById(pageId);
  return page && page.style.display !== 'none';
}

/**
 * Verificar se uma página está visível e retornar o elemento
 * @param {string} pageId - ID da página
 * @returns {HTMLElement|null} - Elemento da página ou null
 */
function getPageElement(pageId) {
  const page = document.getElementById(pageId);
  if (!page || page.style.display === 'none') {
    return null;
  }
  return page;
}

/**
 * Padrão comum de inicialização de página
 * Verifica dependências, visibilidade e retorna early se necessário
 * @param {string} pageId - ID da página
 * @param {string[]} requiredDependencies - Array de dependências necessárias
 * @param {string} loadingMessage - Mensagem de loading (opcional)
 * @returns {Promise<{dependencies: Object, page: HTMLElement}|null>} - Dependências e página ou null
 */
async function initializePage(pageId, requiredDependencies = [], loadingMessage = null) {
  // Verificar visibilidade
  const page = getPageElement(pageId);
  if (!page) {
    if (window.Logger) {
      window.Logger.debug(`📄 ${pageId}: Página não visível, pulando...`);
    }
    return null;
  }
  
  // Verificar dependências
  if (requiredDependencies.length > 0 && window.errorHandler) {
    const dependencies = window.errorHandler.requireDependencies(
      requiredDependencies,
      () => {
        window.errorHandler?.showNotification(
          'Sistemas não carregados. Recarregue a página.',
          'warning'
        );
        return null;
      }
    );
    
    if (!dependencies) {
      return null;
    }
    
    // Mostrar loading se especificado
    if (loadingMessage && window.loadingManager) {
      window.loadingManager.show(loadingMessage);
    }
    
    return { dependencies, page };
  }
  
  // Mostrar loading se especificado
  if (loadingMessage && window.loadingManager) {
    window.loadingManager.show(loadingMessage);
  }
  
  return { dependencies: {}, page };
}

/**
 * Finalizar carregamento de página (esconder loading)
 * @param {string} pageId - ID da página (para logging)
 */
function finalizePage(pageId) {
  if (window.loadingManager) {
    window.loadingManager.hide();
  }
  
  if (window.Logger) {
    window.Logger.debug(`✅ ${pageId}: Carregamento concluído`);
  }
}

/**
 * Wrapper para função de carregamento de página com padrão completo
 * @param {string} pageId - ID da página
 * @param {Function} loadFunction - Função assíncrona de carregamento
 * @param {Object} options - Opções
 * @param {string[]} options.requiredDependencies - Dependências necessárias
 * @param {string} options.loadingMessage - Mensagem de loading
 * @param {string} options.context - Contexto para logging
 * @returns {Promise<void>}
 */
async function loadPageWithPattern(pageId, loadFunction, options = {}) {
  const {
    requiredDependencies = [],
    loadingMessage = null,
    context = pageId
  } = options;
  
  // Inicializar página
  const init = await initializePage(pageId, requiredDependencies, loadingMessage);
  if (!init) {
    return Promise.resolve();
  }
  
  const { dependencies, page } = init;
  
  // Executar função de carregamento com tratamento de erros
  try {
    if (window.errorHandler) {
      await window.errorHandler.safeAsync(
        async () => {
          await loadFunction(dependencies, page);
        },
        context,
        {
          showToUser: true,
          fallback: () => {
            finalizePage(pageId);
            return null;
          }
        }
      );
    } else {
      await loadFunction(dependencies, page);
    }
  } finally {
    finalizePage(pageId);
  }
}

/**
 * Coletar filtros de mês e globais
 * @param {string} monthFilterId - ID do filtro de mês (ex: 'filtroMesTema')
 * @returns {Array} - Array de filtros ativos
 */
function collectActiveFilters(monthFilterId = null) {
  let activeFilters = [];
  
  // Filtros de mês
  if (monthFilterId && window.MonthFilterHelper) {
    const monthFilters = window.MonthFilterHelper.coletarFiltrosMes?.(monthFilterId) || [];
    activeFilters = [...activeFilters, ...monthFilters];
  }
  
  // Filtros globais
  if (window.chartCommunication) {
    const globalFilters = window.chartCommunication.filters?.filters || [];
    activeFilters = [...activeFilters, ...globalFilters];
  }
  
  return activeFilters;
}

/**
 * Aplicar filtros via API
 * @param {string} originalUrl - URL original da API
 * @param {Array} filters - Array de filtros
 * @returns {Promise<any>} - Dados filtrados
 */
async function applyFiltersToAPI(originalUrl, filters) {
  if (!filters || filters.length === 0) {
    return null;
  }
  
  const filterRequest = {
    filters,
    originalUrl
  };
  
  const response = await fetch('/api/filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(filterRequest)
  });
  
  if (!response.ok) {
    throw new Error(`Erro ao aplicar filtros: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Destruir gráficos antes de recriar
 * @param {string[]} chartIds - Array de IDs de gráficos
 */
function destroyCharts(chartIds) {
  if (window.chartFactory?.destroyCharts && chartIds && chartIds.length > 0) {
    window.chartFactory.destroyCharts(chartIds);
  }
}

// Exportar para uso global
window.pageHelper = {
  isPageVisible,
  getPageElement,
  initializePage,
  finalizePage,
  loadPageWithPattern,
  collectActiveFilters,
  applyFiltersToAPI,
  destroyCharts
};

if (window.Logger) {
  window.Logger.success('✅ Page Helper inicializado');
}

