/**
 * Helper para Integração de Filtros
 * 
 * Facilita integração de cache, banner e histórico em todas as páginas
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Helper para aplicar filtros com cache e histórico
   * @param {Array} activeFilters - Filtros ativos
   * @param {String} endpoint - Endpoint da API
   * @param {Object} options - Opções
   * @returns {Promise<Array>} Dados filtrados
   */
  window.filterHelper = {
    /**
     * Aplicar filtros com cache e histórico
     */
    async applyFilters(activeFilters, endpoint, options = {}) {
      const {
        forceRefresh = false,
        transformData = null // Função para transformar dados após filtro
      } = options;

      // Se não há filtros, retornar vazio
      if (!activeFilters || activeFilters.length === 0) {
        return [];
      }

      // Verificar cache
      const cached = window.filterCache?.get?.(activeFilters, endpoint);
      if (cached && !forceRefresh) {
        if (window.Logger) {
          window.Logger.debug('filterHelper: Dados do cache');
        }
        return cached;
      }

      // Aplicar filtros via API
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: endpoint
        };

        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let data = await response.json();

        // Transformar dados se necessário
        if (transformData && typeof transformData === 'function') {
          data = transformData(data);
        }

        // Salvar no cache
        if (window.filterCache) {
          window.filterCache.set(activeFilters, endpoint, data);
        }

        // Salvar no histórico
        if (window.filterHistory) {
          window.filterHistory.saveRecent(activeFilters);
        }

        return data;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('filterHelper: Erro ao aplicar filtros:', error);
        }
        throw error;
      }
    },

    /**
     * Renderizar banner de filtros
     */
    renderBanner(containerId, activeFilters, options = {}) {
      if (!window.filterBanner || !activeFilters || activeFilters.length === 0) {
        return;
      }

      window.filterBanner.render(containerId, activeFilters, {
        onClear: () => {
          if (window.chartCommunication) {
            window.chartCommunication.filters.clear();
          }
          if (options.onClear) {
            options.onClear();
          }
        },
        ...options
      });
    },

    /**
     * Coletar filtros ativos (globais + página)
     */
    collectActiveFilters(pageFilters = []) {
      let activeFilters = [...pageFilters];

      // Adicionar filtros globais
      if (window.chartCommunication) {
        const globalFilters = window.chartCommunication.filters?.filters || [];
        activeFilters = [...globalFilters, ...pageFilters];
      }

      return activeFilters;
    }
  };

  if (window.Logger) {
    window.Logger.debug('filterHelper: Helper de filtros inicializado');
  }
})();

