/**
 * Gerenciador de Timers
 * Previne vazamentos de memória com setTimeout/setInterval
 * Garante limpeza automática de timers
 */

class TimerManager {
  constructor() {
    this.timers = new Map(); // Map<id, {type: 'timeout'|'interval', id: number, callback: function, name: string, createdAt: number}>
    this.nextId = 1;
  }
  
  /**
   * Criar timeout gerenciado
   * @param {Function} callback - Função a executar
   * @param {number} delay - Delay em milissegundos
   * @param {string} name - Nome descritivo (opcional)
   * @returns {string} ID do timer
   */
  setTimeout(callback, delay, name = '') {
    const id = `timeout_${this.nextId++}`;
    const timerId = window.setTimeout(() => {
      try {
        callback();
      } catch (error) {
        if (window.Logger) {
          window.Logger.error(`Erro em timer ${name || id}:`, error);
        } else {
          console.error(`❌ Erro em timer ${name || id}:`, error);
        }
      } finally {
        this.timers.delete(id);
      }
    }, delay);
    
    this.timers.set(id, {
      type: 'timeout',
      id: timerId,
      callback,
      name: name || id,
      createdAt: Date.now()
    });
    
    return id;
  }
  
  /**
   * Criar interval gerenciado
   * @param {Function} callback - Função a executar
   * @param {number} delay - Intervalo em milissegundos
   * @param {string} name - Nome descritivo (opcional)
   * @returns {string} ID do timer
   */
  setInterval(callback, delay, name = '') {
    const id = `interval_${this.nextId++}`;
    const timerId = window.setInterval(() => {
      try {
        callback();
      } catch (error) {
        if (window.Logger) {
          window.Logger.error(`Erro em interval ${name || id}:`, error);
        } else {
          console.error(`❌ Erro em interval ${name || id}:`, error);
        }
      }
    }, delay);
    
    this.timers.set(id, {
      type: 'interval',
      id: timerId,
      callback,
      name: name || id,
      createdAt: Date.now()
    });
    
    return id;
  }
  
  /**
   * Limpar timeout
   * @param {string} id - ID do timer
   */
  clearTimeout(id) {
    const timer = this.timers.get(id);
    if (timer) {
      if (timer.type === 'timeout') {
        window.clearTimeout(timer.id);
      } else {
        window.clearInterval(timer.id);
      }
      this.timers.delete(id);
    }
  }
  
  /**
   * Limpar interval
   * @param {string} id - ID do timer
   */
  clearInterval(id) {
    this.clearTimeout(id); // Mesma implementação
  }
  
  /**
   * Limpar todos os timers
   */
  clearAll() {
    this.timers.forEach((timer) => {
      if (timer.type === 'timeout') {
        window.clearTimeout(timer.id);
      } else {
        window.clearInterval(timer.id);
      }
    });
    this.timers.clear();
    
    if (window.Logger) {
      window.Logger.info('Todos os timers foram limpos');
    }
  }
  
  /**
   * Limpar timers antigos (mais de X minutos)
   * @param {number} maxAgeMinutes - Idade máxima em minutos
   */
  clearOld(maxAgeMinutes = 30) {
    const maxAge = maxAgeMinutes * 60 * 1000;
    const now = Date.now();
    let cleared = 0;
    
    this.timers.forEach((timer, id) => {
      if (now - timer.createdAt > maxAge) {
        if (timer.type === 'timeout') {
          window.clearTimeout(timer.id);
        } else {
          window.clearInterval(timer.id);
        }
        this.timers.delete(id);
        cleared++;
      }
    });
    
    if (cleared > 0 && window.Logger) {
      window.Logger.debug(`Limpos ${cleared} timers antigos`);
    }
    
    return cleared;
  }
  
  /**
   * Obter estatísticas dos timers
   * @returns {Object} Estatísticas
   */
  getStats() {
    const stats = {
      total: this.timers.size,
      timeouts: 0,
      intervals: 0,
      byName: {}
    };
    
    this.timers.forEach((timer) => {
      if (timer.type === 'timeout') {
        stats.timeouts++;
      } else {
        stats.intervals++;
      }
      
      const name = timer.name;
      if (!stats.byName[name]) {
        stats.byName[name] = 0;
      }
      stats.byName[name]++;
    });
    
    return stats;
  }
  
  /**
   * Listar todos os timers ativos
   * @returns {Array} Lista de timers
   */
  list() {
    return Array.from(this.timers.entries()).map(([id, timer]) => ({
      id,
      type: timer.type,
      name: timer.name,
      age: Date.now() - timer.createdAt
    }));
  }
}

// Criar instância global
const timerManager = new TimerManager();

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.timerManager = timerManager;
  
  // Wrappers para compatibilidade
  window.managedSetTimeout = (callback, delay, name) => timerManager.setTimeout(callback, delay, name);
  window.managedSetInterval = (callback, delay, name) => timerManager.setInterval(callback, delay, name);
  window.managedClearTimeout = (id) => timerManager.clearTimeout(id);
  window.managedClearInterval = (id) => timerManager.clearInterval(id);
  
  // Limpar timers ao descarregar página
  window.addEventListener('beforeunload', () => {
    timerManager.clearAll();
  });
  
  // Limpar timers antigos periodicamente (a cada 5 minutos)
  window.setInterval(() => {
    timerManager.clearOld(30); // Limpar timers com mais de 30 minutos
  }, 5 * 60 * 1000);
  
  if (window.Logger) {
    window.Logger.debug('✅ Timer Manager inicializado');
  }
}

