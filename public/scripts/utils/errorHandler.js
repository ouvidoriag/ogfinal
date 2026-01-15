/**
 * Sistema Centralizado de Tratamento de Erros
 * Prioridade 1 - Correção de Falhas Críticas
 * 
 * Funcionalidades:
 * - Tratamento consistente de erros
 * - Notificações ao usuário
 * - Fallbacks automáticos
 * - Logging estruturado
 * 
 * Data: 11/12/2025
 * CÉREBRO X-3
 */

/**
 * Tipos de erro
 */
const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  DEPENDENCY: 'DEPENDENCY_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Configuração de notificações
 */
const NOTIFICATION_CONFIG = {
  duration: 5000, // 5 segundos
  position: 'top-right',
  types: {
    error: {
      bg: 'bg-red-600',
      icon: '❌',
      title: 'Erro'
    },
    warning: {
      bg: 'bg-yellow-600',
      icon: '⚠️',
      title: 'Aviso'
    },
    info: {
      bg: 'bg-blue-600',
      icon: 'ℹ️',
      title: 'Informação'
    },
    success: {
      bg: 'bg-green-600',
      icon: '✅',
      title: 'Sucesso'
    }
  }
};

/**
 * Criar notificação visual para o usuário
 */
function showNotification(message, type = 'error', duration = NOTIFICATION_CONFIG.duration) {
  const config = NOTIFICATION_CONFIG.types[type] || NOTIFICATION_CONFIG.types.error;
  
  // Remover notificações anteriores do mesmo tipo
  const existing = document.querySelector(`.error-notification[data-type="${type}"]`);
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `error-notification fixed ${config.bg} text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 min-w-[300px] max-w-[500px]`;
  notification.setAttribute('data-type', type);
  
  // Posicionamento
  const position = NOTIFICATION_CONFIG.position.split('-');
  if (position[0] === 'top') notification.style.top = '20px';
  if (position[0] === 'bottom') notification.style.bottom = '20px';
  if (position[1] === 'right') notification.style.right = '20px';
  if (position[1] === 'left') notification.style.left = '20px';
  
  notification.innerHTML = `
    <div class="flex items-center gap-3 flex-1">
      <span class="text-2xl">${config.icon}</span>
      <div class="flex-1">
        <div class="font-semibold">${config.title}</div>
        <div class="text-sm opacity-90">${message}</div>
      </div>
      <button class="text-white hover:text-gray-200 transition-colors" onclick="this.parentElement.parentElement.remove()">
        ✕
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remover após duração
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
}

/**
 * Tratar erro de forma centralizada
 */
function handleError(error, context = '', options = {}) {
  const {
    showToUser = true,
    fallback = null,
    retry = null,
    silent = false
  } = options;
  
  // Determinar tipo de erro
  let errorType = ERROR_TYPES.UNKNOWN;
  let userMessage = 'Ocorreu um erro inesperado.';
  
  if (error instanceof TypeError && error.message.includes('Cannot read')) {
    errorType = ERROR_TYPES.DEPENDENCY;
    userMessage = 'Sistema não inicializado corretamente. Recarregue a página.';
  } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
    errorType = ERROR_TYPES.NETWORK;
    userMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
  } else if (error.message?.includes('API') || error.status) {
    errorType = ERROR_TYPES.API;
    userMessage = 'Erro ao comunicar com o servidor. Tente novamente em alguns instantes.';
  } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
    errorType = ERROR_TYPES.VALIDATION;
    userMessage = 'Dados inválidos recebidos.';
  }
  
  // Log do erro
  if (!silent && window.Logger) {
    window.Logger.error(`[${context}] ${errorType}:`, {
      message: error.message,
      stack: error.stack,
      error: error
    });
  }
  
  // Mostrar notificação ao usuário
  if (showToUser && !silent) {
    showNotification(userMessage, 'error');
  }
  
  // Retornar objeto de erro padronizado
  return {
    type: errorType,
    message: error.message || 'Erro desconhecido',
    userMessage,
    context,
    originalError: error,
    fallback,
    retry
  };
}

/**
 * Wrapper para funções assíncronas com tratamento de erro
 */
async function safeAsync(fn, context = '', options = {}) {
  try {
    return await fn();
  } catch (error) {
    const errorInfo = handleError(error, context, options);
    
    // Executar fallback se disponível
    if (errorInfo.fallback && typeof errorInfo.fallback === 'function') {
      try {
        return await errorInfo.fallback();
      } catch (fallbackError) {
        handleError(fallbackError, `${context} (fallback)`, { ...options, silent: true });
      }
    }
    
    // Retornar null se não houver fallback
    return null;
  }
}

/**
 * Verificar se dependência está disponível
 */
function requireDependency(name, fallback = null) {
  const dependency = window[name];
  
  if (!dependency) {
    const error = new Error(`Dependência '${name}' não está disponível`);
    handleError(error, `requireDependency(${name})`, {
      showToUser: true,
      fallback: fallback || (() => {
        showNotification(`Sistema ${name} não carregado. Recarregue a página.`, 'warning');
        return null;
      })
    });
    return fallback || null;
  }
  
  return dependency;
}

/**
 * Verificar múltiplas dependências
 */
function requireDependencies(dependencies, fallback = null) {
  const missing = [];
  const available = {};
  
  for (const dep of dependencies) {
    if (window[dep]) {
      available[dep] = window[dep];
    } else {
      missing.push(dep);
    }
  }
  
  if (missing.length > 0) {
    const error = new Error(`Dependências não disponíveis: ${missing.join(', ')}`);
    handleError(error, 'requireDependencies', {
      showToUser: true,
      fallback: fallback || (() => {
        showNotification(`Sistemas não carregados: ${missing.join(', ')}. Recarregue a página.`, 'warning');
        return null;
      })
    });
    return fallback || null;
  }
  
  return available;
}

// Exportar para uso global
window.errorHandler = {
  handleError,
  safeAsync,
  requireDependency,
  requireDependencies,
  showNotification,
  ERROR_TYPES
};

// Compatibilidade: também exportar como window.ErrorHandler
window.ErrorHandler = window.errorHandler;

if (window.Logger) {
  window.Logger.success('✅ Sistema de tratamento de erros inicializado');
}

