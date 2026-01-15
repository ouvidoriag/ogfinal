/**
 * Crossfilter Overview - Sistema de Filtros Inteligentes Multi-Dimensionais
 * 
 * Implementação estilo Power BI / Looker para página Overview
 * 
 * Funcionalidades:
 * - Múltiplos filtros simultâneos (Status + Tema + Órgão + etc.)
 * - Clique esquerdo = aplica filtro
 * - Clique direito = limpa TODOS os filtros
 * - Banner visual mostra filtros ativos com botões de remoção
 * - Todos os gráficos reagem bidirecionalmente
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function () {
  'use strict';

  /**
   * Crossfilter Context - Gerencia estado global de filtros
   */
  const crossfilterContext = {
    // Estado: objeto com múltiplas dimensões
    filters: {
      status: null,
      tema: null,
      orgaos: null,
      tipo: null,
      canal: null,
      prioridade: null,
      unidade: null,
      bairro: null
    },

    // Dados completos (para cálculos de porcentagem)
    allData: null,

    // Dados filtrados (para exibição)
    filteredData: null,

    // Listeners de mudança
    listeners: [],

    /**
     * Definir todos os dados brutos
     * @param {Array} data - Array de registros brutos
     */
    setAllData(data) {
      this.allData = data;
      if (window.Logger) {
        window.Logger.debug('Crossfilter: Dados brutos definidos', { total: data?.length || 0 });
      }
    },

    /**
     * Obter dados filtrados (compatibilidade)
     * @returns {Object} Dados agregados filtrados
     */
    getFilteredData() {
      if (!this.allData) {
        return null;
      }
      // Se não há filtros, retornar null para usar dados originais
      const hasActiveFilters = Object.values(this.filters).some(v => {
        if (v === null || v === undefined) return false;
        if (Array.isArray(v)) return v.length > 0;
        return true;
      });
      if (!hasActiveFilters) {
        return null;
      }
      // Retornar filtros para que o listener busque dados da API
      return this.filters;
    },

    /**
     * Alternar filtro (toggle)
     * @param {String} field - Nome do campo
     * @param {String} value - Valor do filtro
     * @param {Boolean} multiSelect - Se true, permite seleção múltipla (Ctrl+clique)
     */
    toggleFilter(field, value, multiSelect = false) {
      if (multiSelect) {
        // Modo seleção múltipla: adicionar/remover do array
        const current = this.filters[field];
        if (Array.isArray(current)) {
          // Se já é array, adicionar ou remover
          const index = current.findIndex(v => String(v).toLowerCase() === String(value).toLowerCase());
          if (index >= 0) {
            // Remover se já existe
            current.splice(index, 1);
            if (current.length === 0) {
              this.filters[field] = null;
            }
            if (window.Logger) {
              window.Logger.debug(`Crossfilter: Valor removido de '${field}'`, { field, value, remaining: current });
            }
          } else {
            // Adicionar se não existe
            current.push(value);
            if (window.Logger) {
              window.Logger.debug(`Crossfilter: Valor adicionado a '${field}'`, { field, value, total: current.length });
            }
          }
        } else if (current === null || current === undefined) {
          // Criar novo array
          this.filters[field] = [value];
          if (window.Logger) {
            window.Logger.debug(`Crossfilter: Array criado para '${field}'`, { field, value });
          }
        } else {
          // Converter valor único em array e adicionar novo valor
          this.filters[field] = [current, value];
          if (window.Logger) {
            window.Logger.debug(`Crossfilter: Convertido '${field}' para array`, { field, values: this.filters[field] });
          }
        }
      } else {
        // Modo single select: comportamento original (toggle)
        // Se já existe um array, converter para valor único
        const current = this.filters[field];

        // Se é array, verificar se o valor está no array
        if (Array.isArray(current)) {
          const index = current.findIndex(v => String(v).toLowerCase() === String(value).toLowerCase());
          if (index >= 0 && current.length === 1) {
            // Se é o único valor no array, desativar
            this.filters[field] = null;
            if (window.Logger) {
              window.Logger.debug(`Crossfilter: Filtro '${field}' desativado (era array com 1 item)`, { field, value });
            }
          } else {
            // Substituir array por valor único
            this.filters[field] = value;
            if (window.Logger) {
              window.Logger.debug(`Crossfilter: Array convertido para valor único em '${field}'`, { field, value, previousArray: current });
            }
          }
        } else if (current === value) {
          // Valor único igual ao clicado: desativar
          this.filters[field] = null;
          if (window.Logger) {
            window.Logger.debug(`Crossfilter: Filtro '${field}' desativado`, { field, value });
          }
        } else {
          // Ativar filtro com valor único
          this.filters[field] = value;
          if (window.Logger) {
            window.Logger.debug(`Crossfilter: Filtro '${field}' ativado`, { field, value });
          }
        }
      }
      this.notifyListeners();
    },

    /**
     * Setters individuais para cada dimensão
     * @param {String} value - Valor do filtro
     * @param {Boolean} multiSelect - Se true, permite seleção múltipla (Ctrl+clique)
     */
    setStatusFilter(status, multiSelect = false) {
      this.toggleFilter('status', status, multiSelect);
    },

    setTemaFilter(tema, multiSelect = false) {
      this.toggleFilter('tema', tema, multiSelect);
    },

    setOrgaosFilter(orgaos, multiSelect = false) {
      this.toggleFilter('orgaos', orgaos, multiSelect);
    },

    setTipoFilter(tipo, multiSelect = false) {
      this.toggleFilter('tipo', tipo, multiSelect);
    },

    setCanalFilter(canal, multiSelect = false) {
      this.toggleFilter('canal', canal, multiSelect);
    },

    setPrioridadeFilter(prioridade, multiSelect = false) {
      this.toggleFilter('prioridade', prioridade, multiSelect);
    },

    setUnidadeFilter(unidade, multiSelect = false) {
      this.toggleFilter('unidade', unidade, multiSelect);
    },

    setBairroFilter(bairro, multiSelect = false) {
      this.toggleFilter('bairro', bairro, multiSelect);
    },

    /**
     * Limpar todos os filtros de uma vez
     */
    clearAllFilters() {
      this.filters = {
        status: null,
        tema: null,
        orgaos: null,
        tipo: null,
        canal: null,
        prioridade: null,
        unidade: null,
        bairro: null
      };
      this.notifyListeners();
    },

    /**
     * Função que aplica TODOS os filtros ativos de uma vez
     * @param {Object} data - Dados do dashboard (dashboardData)
     * @returns {Object} Dados filtrados no mesmo formato
     * 
     * NOTA: Esta função filtra apenas os arrays de agregação.
     * Para filtragem completa, use a API /api/filter e reagregue os dados.
     */
    applyFilters(data) {
      if (!data) return data;

      // Se não há filtros ativos, retornar dados originais
      const hasActiveFilters = Object.values(this.filters).some(v => {
        if (v === null || v === undefined) return false;
        if (Array.isArray(v)) return v.length > 0;
        return true;
      });
      if (!hasActiveFilters) {
        return data;
      }

      // Criar cópia dos dados para não modificar o original
      const filtered = JSON.parse(JSON.stringify(data));

      // Aplicar filtros em cada agregação
      // Suporta valores únicos ou arrays (seleção múltipla)
      if (filtered.manifestationsByStatus && this.filters.status) {
        const statusFilter = Array.isArray(this.filters.status) ? this.filters.status : [this.filters.status];
        filtered.manifestationsByStatus = filtered.manifestationsByStatus.filter(item => {
          const itemStatus = item.status || item._id || '';
          return statusFilter.some(filterValue =>
            String(itemStatus).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByTheme && this.filters.tema) {
        const temaFilter = Array.isArray(this.filters.tema) ? this.filters.tema : [this.filters.tema];
        filtered.manifestationsByTheme = filtered.manifestationsByTheme.filter(item => {
          const itemTheme = item.theme || item._id || '';
          return temaFilter.some(filterValue =>
            String(itemTheme).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByOrgan && this.filters.orgaos) {
        const orgaosFilter = Array.isArray(this.filters.orgaos) ? this.filters.orgaos : [this.filters.orgaos];
        filtered.manifestationsByOrgan = filtered.manifestationsByOrgan.filter(item => {
          const itemOrgan = item.organ || item._id || '';
          return orgaosFilter.some(filterValue =>
            String(itemOrgan).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByType && this.filters.tipo) {
        const tipoFilter = Array.isArray(this.filters.tipo) ? this.filters.tipo : [this.filters.tipo];
        filtered.manifestationsByType = filtered.manifestationsByType.filter(item => {
          const itemType = item.type || item._id || '';
          return tipoFilter.some(filterValue =>
            String(itemType).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByChannel && this.filters.canal) {
        const canalFilter = Array.isArray(this.filters.canal) ? this.filters.canal : [this.filters.canal];
        filtered.manifestationsByChannel = filtered.manifestationsByChannel.filter(item => {
          const itemChannel = item.channel || item._id || '';
          return canalFilter.some(filterValue =>
            String(itemChannel).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByPriority && this.filters.prioridade) {
        const prioridadeFilter = Array.isArray(this.filters.prioridade) ? this.filters.prioridade : [this.filters.prioridade];
        filtered.manifestationsByPriority = filtered.manifestationsByPriority.filter(item => {
          const itemPriority = item.priority || item._id || '';
          return prioridadeFilter.some(filterValue =>
            String(itemPriority).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      if (filtered.manifestationsByUnit && this.filters.unidade) {
        const unidadeFilter = Array.isArray(this.filters.unidade) ? this.filters.unidade : [this.filters.unidade];
        filtered.manifestationsByUnit = filtered.manifestationsByUnit.filter(item => {
          const itemUnit = item.unit || item._id || '';
          return unidadeFilter.some(filterValue =>
            String(itemUnit).toLowerCase() === String(filterValue).toLowerCase()
          );
        });
      }

      // Recalcular totais baseado nos dados filtrados
      filtered.totalManifestations = this.calculateTotal(filtered);
      filtered.last7Days = this.calculateLast7Days(filtered);
      filtered.last30Days = this.calculateLast30Days(filtered);

      return filtered;
    },

    /**
     * Filtrar array de agregações
     */
    filterArray(array, field, value) {
      if (!value || !array) return array;
      return array.filter(item => {
        const itemValue = item[field] || item._id || item.status || item.theme || item.organ || item.type || item.channel || item.priority || item.unit;
        return String(itemValue).toLowerCase() === String(value).toLowerCase();
      });
    },

    /**
     * Calcular total de manifestações filtradas
     */
    calculateTotal(data) {
      if (data.manifestationsByStatus && data.manifestationsByStatus.length > 0) {
        return data.manifestationsByStatus.reduce((sum, item) => sum + (item.count || 0), 0);
      }
      return data.totalManifestations || 0;
    },

    /**
     * Calcular últimos 7 dias filtrados
     */
    calculateLast7Days(data) {
      // Simplificado: usar proporção do total
      const total = this.calculateTotal(data);
      const originalTotal = this.allData?.totalManifestations || data.totalManifestations || 1;
      const originalLast7 = this.allData?.last7Days || data.last7Days || 0;
      return Math.round((total / originalTotal) * originalLast7);
    },

    /**
     * Calcular últimos 30 dias filtrados
     */
    calculateLast30Days(data) {
      // Simplificado: usar proporção do total
      const total = this.calculateTotal(data);
      const originalTotal = this.allData?.totalManifestations || data.totalManifestations || 1;
      const originalLast30 = this.allData?.last30Days || data.last30Days || 0;
      return Math.round((total / originalTotal) * originalLast30);
    },

    /**
     * Contador de filtros ativos (para o banner)
     */
    getActiveFilterCount() {
      return Object.values(this.filters).reduce((count, filter) => {
        if (filter === null || filter === undefined) return count;
        if (Array.isArray(filter)) {
          return count + filter.length;
        }
        return count + 1;
      }, 0);
    },

    /**
     * Registrar listener para mudanças
     */
    onFilterChange(callback) {
      this.listeners.push(callback);
      return () => {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
          this.listeners.splice(index, 1);
        }
      };
    },

    /**
     * Notificar todos os listeners com debounce
     */
    _debounceTimer: null,
    notifyListeners() {
      // Debounce para evitar múltiplas chamadas
      if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
      }

      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this.listeners.forEach(callback => {
          try {
            callback(this.filters, this.getActiveFilterCount());
          } catch (error) {
            if (window.Logger) {
              window.Logger.error('Erro em listener de crossfilter:', error);
            }
          }
        });
      }, 100); // 100ms de debounce
    },

    /**
     * Obter label amigável para um campo
     */
    getFieldLabel(field) {
      const labels = {
        status: 'Status',
        tema: 'Tema',
        orgaos: 'Órgão',
        tipo: 'Tipo',
        canal: 'Canal',
        prioridade: 'Prioridade',
        unidade: 'Unidade',
        bairro: 'Bairro'
      };
      return labels[field] || field;
    },

    /**
     * Obter emoji para um campo
     */
    getFieldEmoji(field) {
      const emojis = {
        status: '📊',
        tema: '🏷️',
        orgaos: '🏛️',
        tipo: '📋',
        canal: '📞',
        prioridade: '⚡',
        unidade: '🏥',
        bairro: '📍'
      };
      return emojis[field] || '🔍';
    }
  };

  // Exportar para uso global
  if (typeof window !== 'undefined') {
    window.crossfilterOverview = crossfilterContext;
  }

  if (window.Logger) {
    window.Logger.success('✅ Sistema Crossfilter Overview inicializado');
  }
})();

