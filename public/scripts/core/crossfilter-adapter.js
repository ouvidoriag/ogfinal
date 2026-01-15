/**
 * Crossfilter Adapter - Adaptador Genérico para Páginas
 * 
 * Facilita a integração do crossfilter em qualquer página
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Criar adaptador crossfilter para uma página
   * @param {Object} options - Opções de configuração
   * @returns {Object} Adaptador configurado
   */
  window.createCrossfilterAdapter = function(options = {}) {
    const {
      pageName, // Nome da página (ex: 'tema', 'assunto')
      fields = [], // Campos filtáveis específicos da página
      chartSelectors = {}, // Seletores de gráficos { chartId: selector }
      onDataLoad = null, // Callback quando dados são carregados
      autoApply = true // Aplicar filtros automaticamente
    } = options;

    if (!pageName) {
      throw new Error('pageName é obrigatório');
    }

    // Criar instância de crossfilter
    const crossfilter = window.createCrossfilter({
      fields: fields.length > 0 ? fields : ['status', 'tema', 'orgaos', 'tipo', 'canal'],
      autoSyncGlobal: true,
      onFilterChange: (filters, filteredData) => {
        if (autoApply) {
          applyFiltersToPage(filters);
        }
      }
    });

    /**
     * Aplicar filtros à página
     */
    function applyFiltersToPage(filters) {
      // Converter filtros para formato de API
      const apiFilters = crossfilter.toAPIFilters();

      if (apiFilters.length === 0) {
        // Sem filtros: recarregar dados originais
        if (onDataLoad) {
          onDataLoad(null);
        }
        return;
      }

      // Aplicar filtros via API
      fetch('/api/filter/aggregated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ filters: apiFilters })
      })
      .then(res => res.json())
      .then(data => {
        if (onDataLoad) {
          onDataLoad(data);
        }
        updateCharts(data);
      })
      .catch(error => {
        if (window.Logger) {
          window.Logger.error(`CrossfilterAdapter[${pageName}]: Erro ao aplicar filtros:`, error);
        }
      });
    }

    /**
     * Atualizar gráficos com dados filtrados
     */
    function updateCharts(data) {
      Object.entries(chartSelectors).forEach(([chartId, selector]) => {
        const chartElement = document.querySelector(selector);
        if (!chartElement) return;

        // Notificar gráfico para atualizar
        if (window.eventBus) {
          window.eventBus.emit('chart:update', {
            chartId,
            data
          });
        }
      });
    }

    /**
     * Adaptador
     */
    const adapter = {
      crossfilter,
      pageName,

      /**
       * Inicializar adaptador
       */
      init() {
        // Carregar filtros de globalFilters se existirem
        crossfilter.loadFromGlobalFilters();

        // Registrar listeners de gráficos
        if (window.eventBus) {
          window.eventBus.on('chart:click', (event) => {
            const { chartId, field, value, multiSelect } = event;
            
            // Verificar se o campo é filtável nesta página
            if (crossfilter.filters.hasOwnProperty(field)) {
              crossfilter.toggleFilter(field, value, multiSelect);
            }
          });
        }

        if (window.Logger) {
          window.Logger.debug(`CrossfilterAdapter[${pageName}]: Adaptador inicializado`);
        }
      },

      /**
       * Aplicar filtro manualmente
       */
      applyFilter(field, value, multiSelect = false) {
        crossfilter.toggleFilter(field, value, multiSelect);
      },

      /**
       * Limpar todos os filtros
       */
      clearFilters() {
        crossfilter.clearAllFilters();
      },

      /**
       * Obter filtros ativos
       */
      getActiveFilters() {
        return crossfilter.filters;
      },

      /**
       * Obter dados filtrados
       */
      getFilteredData() {
        return crossfilter.getFilteredData();
      }
    };

    return adapter;
  };

  if (window.Logger) {
    window.Logger.debug('CrossfilterAdapter: Sistema de adaptadores inicializado');
  }
})();

