/**
 * Crossfilter Core - Módulo Reutilizável de Filtros Multi-Dimensionais
 * 
 * Extraído de crossfilter-overview.js para ser reutilizado em outras páginas
 * 
 * Funcionalidades:
 * - Múltiplos filtros simultâneos
 * - Toggle de filtros (clique = ativa/desativa)
 * - Seleção múltipla (Ctrl+Clique)
 * - Integração com sistema global de filtros
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Criar instância de Crossfilter
   * @param {Object} options - Opções de configuração
   * @returns {Object} Instância de crossfilter
   */
  window.createCrossfilter = function(options = {}) {
    const {
      fields = ['status', 'tema', 'orgaos', 'tipo', 'canal', 'prioridade', 'unidade', 'bairro'],
      onFilterChange = null,
      autoSyncGlobal = true // Sincronizar automaticamente com globalFilters
    } = options;

    // Estado de filtros
    const filters = {};
    fields.forEach(field => {
      filters[field] = null;
    });

    // Listeners
    const listeners = [];

    /**
     * Instância do Crossfilter
     */
    const crossfilter = {
      filters,
      allData: null,
      filteredData: null,
      listeners,

      /**
       * Definir dados brutos
       */
      setAllData(data) {
        this.allData = data;
        if (window.Logger) {
          window.Logger.debug('Crossfilter: Dados brutos definidos', { total: data?.length || 0 });
        }
      },

      /**
       * Obter dados filtrados
       */
      getFilteredData() {
        const hasActiveFilters = Object.values(this.filters).some(v => {
          if (v === null || v === undefined) return false;
          if (Array.isArray(v)) return v.length > 0;
          return true;
        });
        if (!hasActiveFilters) {
          return null;
        }
        return this.filters;
      },

      /**
       * Alternar filtro
       */
      toggleFilter(field, value, multiSelect = false) {
        if (!this.filters.hasOwnProperty(field)) {
          if (window.Logger) {
            window.Logger.warn(`Crossfilter: Campo '${field}' não está configurado`);
          }
          return;
        }

        if (multiSelect) {
          // Seleção múltipla
          const current = this.filters[field];
          if (Array.isArray(current)) {
            const index = current.findIndex(v => String(v).toLowerCase() === String(value).toLowerCase());
            if (index >= 0) {
              current.splice(index, 1);
              if (current.length === 0) {
                this.filters[field] = null;
              }
            } else {
              current.push(value);
            }
          } else if (current === null || current === undefined) {
            this.filters[field] = [value];
          } else {
            this.filters[field] = [current, value];
          }
        } else {
          // Toggle simples
          const current = this.filters[field];
          if (Array.isArray(current)) {
            const index = current.findIndex(v => String(v).toLowerCase() === String(value).toLowerCase());
            if (index >= 0 && current.length === 1) {
              this.filters[field] = null;
            } else {
              this.filters[field] = value;
            }
          } else if (current === value) {
            this.filters[field] = null;
          } else {
            this.filters[field] = value;
          }
        }

        this.notifyListeners();
      },

      /**
       * Definir filtro diretamente
       */
      setFilter(field, value) {
        if (!this.filters.hasOwnProperty(field)) {
          return;
        }
        this.filters[field] = value;
        this.notifyListeners();
      },

      /**
       * Limpar filtro específico
       */
      clearFilter(field) {
        if (this.filters.hasOwnProperty(field)) {
          this.filters[field] = null;
          this.notifyListeners();
        }
      },

      /**
       * Limpar todos os filtros
       */
      clearAllFilters() {
        Object.keys(this.filters).forEach(field => {
          this.filters[field] = null;
        });
        this.notifyListeners();
      },

      /**
       * Adicionar listener
       */
      onFilterChange(callback) {
        if (typeof callback === 'function') {
          this.listeners.push(callback);
        }
      },

      /**
       * Notificar listeners
       */
      notifyListeners() {
        // Notificar listeners locais
        this.listeners.forEach(callback => {
          try {
            callback(this.filters, this.getFilteredData());
          } catch (error) {
            if (window.Logger) {
              window.Logger.error('Crossfilter: Erro em listener:', error);
            }
          }
        });

        // Sincronizar com globalFilters se habilitado
        if (autoSyncGlobal && window.chartCommunication && window.chartCommunication.filters) {
          this.syncToGlobalFilters();
        }

        // Chamar callback externo se fornecido
        if (onFilterChange) {
          try {
            onFilterChange(this.filters, this.getFilteredData());
          } catch (error) {
            if (window.Logger) {
              window.Logger.error('Crossfilter: Erro em callback externo:', error);
            }
          }
        }
      },

      /**
       * Sincronizar com globalFilters
       */
      syncToGlobalFilters() {
        if (!window.chartCommunication || !window.chartCommunication.filters) {
          return;
        }

        // Limpar filtros globais
        window.chartCommunication.filters.clear();

        // Aplicar filtros ativos
        Object.entries(this.filters).forEach(([field, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              // Múltiplos valores: usar operador 'in'
              value.forEach(v => {
                window.chartCommunication.filters.apply(field, v, null, {
                  operator: 'in',
                  toggle: false,
                  clearPrevious: false
                });
              });
            } else {
              // Valor único
              window.chartCommunication.filters.apply(field, value, null, {
                toggle: false,
                clearPrevious: false
              });
            }
          }
        });

        // Notificar gráficos
        window.chartCommunication.filters.notifyAllCharts();
      },

      /**
       * Carregar filtros de globalFilters
       */
      loadFromGlobalFilters() {
        if (!window.chartCommunication || !window.chartCommunication.filters) {
          return;
        }

        const globalFilters = window.chartCommunication.filters.filters;
        
        // Agrupar por campo
        const byField = {};
        globalFilters.forEach(f => {
          if (!byField[f.field]) {
            byField[f.field] = [];
          }
          byField[f.field].push(f.value);
        });

        // Aplicar aos filtros locais
        Object.entries(byField).forEach(([field, values]) => {
          if (this.filters.hasOwnProperty(field)) {
            if (values.length === 1) {
              this.filters[field] = values[0];
            } else {
              this.filters[field] = values;
            }
          }
        });

        this.notifyListeners();
      },

      /**
       * Converter filtros para formato de API
       */
      toAPIFilters() {
        const apiFilters = [];

        Object.entries(this.filters).forEach(([field, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              apiFilters.push({
                field,
                op: 'in',
                value
              });
            } else {
              apiFilters.push({
                field,
                op: 'eq',
                value
              });
            }
          }
        });

        return apiFilters;
      }
    };

    return crossfilter;
  };

  if (window.Logger) {
    window.Logger.debug('CrossfilterCore: Módulo reutilizável de crossfilter inicializado');
  }
})();

