/**
 * Sistema de Logging Centralizado
 * Permite controlar logs em produção vs desenvolvimento
 */

// PRIORIDADE 3: Otimização de logs em produção
const LOG_CONFIG = {
  environment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'development' 
    : 'production',
  
  // PRIORIDADE 3: Em produção, apenas erros e warnings
  levels: {
    error: true,
    warn: true,
    info: false, // Desabilitado em produção
    debug: false, // Desabilitado em produção
    log: false // Desabilitado em produção
  },
  
  prefixes: {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    debug: '🔍',
    log: '📝',
    success: '✅',
    performance: '⚡'
  }
};

const Logger = {
  error(message, ...args) {
    if (LOG_CONFIG.levels.error) {
      console.error(`${LOG_CONFIG.prefixes.error} ${message}`, ...args);
    }
  },
  
  warn(message, ...args) {
    if (LOG_CONFIG.levels.warn) {
      console.warn(`${LOG_CONFIG.prefixes.warn} ${message}`, ...args);
    }
  },
  
  info(message, ...args) {
    if (LOG_CONFIG.levels.info || LOG_CONFIG.environment === 'development') {
      console.info(`${LOG_CONFIG.prefixes.info} ${message}`, ...args);
    }
  },
  
  debug(message, ...args) {
    if (LOG_CONFIG.levels.debug || LOG_CONFIG.environment === 'development') {
      console.log(`${LOG_CONFIG.prefixes.debug} ${message}`, ...args);
    }
  },
  
  log(message, ...args) {
    if (LOG_CONFIG.levels.log || LOG_CONFIG.environment === 'development') {
      console.log(`${LOG_CONFIG.prefixes.log} ${message}`, ...args);
    }
  },
  
  success(message, ...args) {
    if (LOG_CONFIG.environment === 'development') {
      console.log(`${LOG_CONFIG.prefixes.success} ${message}`, ...args);
    }
  },
  
  performance(message, duration, ...args) {
    if (LOG_CONFIG.environment === 'development') {
      const color = duration < 100 ? 'green' : duration < 500 ? 'orange' : 'red';
      console.log(
        `%c${LOG_CONFIG.prefixes.performance} ${message}: ${duration.toFixed(2)}ms`,
        `color: ${color}`,
        ...args
      );
    }
  }
};

window.Logger = Logger;

