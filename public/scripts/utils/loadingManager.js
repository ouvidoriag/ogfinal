/**
 * Sistema Global de Loading States
 * Prioridade 2 - Correção de Falhas Médias
 * 
 * Funcionalidades:
 * - Loading states consistentes em todas as páginas
 * - Indicadores visuais padronizados
 * - Gerenciamento centralizado
 * 
 * Data: 11/12/2025
 * CÉREBRO X-3
 */

/**
 * Configuração de loading
 */
const LOADING_CONFIG = {
  defaultMessage: 'Carregando...',
  position: 'center', // 'center', 'top', 'bottom'
  backdrop: true,
  zIndex: 9999
};

/**
 * Container global de loading
 */
let globalLoadingContainer = null;

/**
 * Criar container global de loading
 */
function createGlobalLoadingContainer() {
  if (globalLoadingContainer) {
    return globalLoadingContainer;
  }
  
  const container = document.createElement('div');
  container.id = 'global-loading-container';
  container.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center';
  container.style.display = 'none';
  document.body.appendChild(container);
  
  globalLoadingContainer = container;
  return container;
}

/**
 * Mostrar loading global
 */
function showLoading(message = LOADING_CONFIG.defaultMessage, options = {}) {
  const container = createGlobalLoadingContainer();
  
  const {
    position = LOADING_CONFIG.position,
    backdrop = LOADING_CONFIG.backdrop,
    customHTML = null
  } = options;
  
  // Configurar posicionamento
  if (position === 'top') {
    container.className = 'fixed top-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center py-4';
  } else if (position === 'bottom') {
    container.className = 'fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center py-4';
  } else {
    container.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center';
  }
  
  // Configurar backdrop
  if (!backdrop) {
    container.style.background = 'transparent';
  }
  
  // Conteúdo do loading
  if (customHTML) {
    container.innerHTML = customHTML;
  } else {
    container.innerHTML = `
      <div class="bg-slate-800 rounded-lg p-6 shadow-xl border border-cyan-500/20">
        <div class="flex items-center gap-4">
          <div class="animate-spin text-4xl text-cyan-400">⏳</div>
          <div>
            <div class="text-lg font-semibold text-cyan-300 mb-1">${message}</div>
            <div class="text-sm text-slate-400">Aguarde enquanto os dados são carregados</div>
          </div>
        </div>
      </div>
    `;
  }
  
  container.style.display = 'flex';
  
  if (window.Logger) {
    window.Logger.debug(`Loading mostrado: ${message}`);
  }
}

/**
 * Esconder loading global
 */
function hideLoading() {
  if (globalLoadingContainer) {
    globalLoadingContainer.style.display = 'none';
    
    if (window.Logger) {
      window.Logger.debug('Loading escondido');
    }
  }
}

/**
 * Mostrar loading em elemento específico
 */
function showLoadingInElement(elementId, message = LOADING_CONFIG.defaultMessage) {
  const element = document.getElementById(elementId);
  if (!element) {
    if (window.Logger) {
      window.Logger.warn(`Elemento ${elementId} não encontrado para mostrar loading`);
    }
    return;
  }
  
  // Salvar conteúdo original
  if (!element.dataset.originalContent) {
    element.dataset.originalContent = element.innerHTML;
  }
  
  element.innerHTML = `
    <div class="flex items-center justify-center gap-3 py-8">
      <div class="animate-spin text-2xl text-cyan-400">⏳</div>
      <div class="text-slate-400">${message}</div>
    </div>
  `;
  
  if (window.Logger) {
    window.Logger.debug(`Loading mostrado em ${elementId}: ${message}`);
  }
}

/**
 * Esconder loading em elemento específico
 */
function hideLoadingInElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  
  // Restaurar conteúdo original
  if (element.dataset.originalContent) {
    element.innerHTML = element.dataset.originalContent;
    delete element.dataset.originalContent;
  }
  
  if (window.Logger) {
    window.Logger.debug(`Loading escondido em ${elementId}`);
  }
}

/**
 * Wrapper para funções assíncronas com loading automático
 */
async function withLoading(fn, message = LOADING_CONFIG.defaultMessage, options = {}) {
  const {
    showGlobal = true,
    elementId = null,
    hideOnError = true
  } = options;
  
  try {
    if (showGlobal) {
      showLoading(message, options);
    } else if (elementId) {
      showLoadingInElement(elementId, message);
    }
    
    const result = await fn();
    
    return result;
  } catch (error) {
    if (hideOnError) {
      if (showGlobal) {
        hideLoading();
      } else if (elementId) {
        hideLoadingInElement(elementId);
      }
    }
    throw error;
  } finally {
    if (showGlobal) {
      hideLoading();
    } else if (elementId) {
      hideLoadingInElement(elementId);
    }
  }
}

// Exportar para uso global
window.loadingManager = {
  show: showLoading,
  hide: hideLoading,
  showInElement: showLoadingInElement,
  hideInElement: hideLoadingInElement,
  withLoading,
  LOADING_CONFIG
};

if (window.Logger) {
  window.Logger.success('✅ Sistema de loading states inicializado');
}

