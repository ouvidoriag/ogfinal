/**
 * Helper Reutilizável para Aplicar Filtros em Páginas
 * Baseado no padrão da página Overview que funciona perfeitamente
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function() {
  'use strict';

  /**
   * Criar listener de filtros para uma página específica
   * Segue o mesmo padrão da página Overview
   * 
   * @param {Object} config - Configuração
   * @param {string} config.pageId - ID da página (ex: 'page-tema')
   * @param {string} config.listenerKey - Chave única para o listener (ex: '_temaListenerRegistered')
   * @param {Function} config.loadFunction - Função que carrega os dados da página
   * @param {Function} config.updateFunction - Função que atualiza gráficos/KPIs com dados filtrados
   * @param {Object} config.fieldMap - Mapeamento de campos do crossfilter para API (opcional)
   * @param {string} config.aggregateEndpoint - Endpoint para agregação específica (opcional)
   */
  window.createPageFilterListener = function(config) {
    const {
      pageId,
      listenerKey,
      loadFunction,
      updateFunction,
      fieldMap = {
        status: 'Status',
        tema: 'Tema',
        orgaos: 'Orgaos',
        tipo: 'Tipo',
        canal: 'Canal',
        prioridade: 'Prioridade',
        unidade: 'UnidadeCadastro',
        bairro: 'Bairro'
      },
      aggregateEndpoint = null
    } = config;

    if (!pageId || !listenerKey || !loadFunction) {
      if (window.Logger) {
        window.Logger.warn('createPageFilterListener: configuração inválida', config);
      }
      return;
    }

    // Registrar listener no crossfilterOverview (padrão Overview)
    if (window.crossfilterOverview && !window.crossfilterOverview[listenerKey]) {
      window.crossfilterOverview[listenerKey] = true;
      
      if (window.Logger) {
        window.Logger.debug(`📝 Registrando listener para ${pageId} com chave ${listenerKey}`);
      }
      
      // Flag para prevenir múltiplas execuções
      const updateKey = `${listenerKey}_isUpdating`;
      
      window.crossfilterOverview.onFilterChange(async () => {
        if (window.Logger) {
          window.Logger.debug(`🔔 Listener acionado para ${pageId}`);
        }
        // Verificar se a página está visível
        const page = document.getElementById(pageId);
        if (!page || page.style.display === 'none') {
          return;
        }
        
        // Prevenir múltiplas execuções simultâneas
        if (window.crossfilterOverview[updateKey]) {
          if (window.Logger) {
            window.Logger.debug(`⏸️ Listener ${pageId} já está executando, pulando...`);
          }
          return;
        }
        window.crossfilterOverview[updateKey] = true;
        
        try {
          const filters = window.crossfilterOverview.filters;
          const hasActiveFilters = Object.values(filters).some(v => {
            if (v === null || v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            return true;
          });
          
          if (window.Logger) {
            window.Logger.debug(`🔄 Listener de filtros acionado para ${pageId}:`, {
              hasActiveFilters,
              filters,
              activeFiltersCount: Object.values(filters).filter(v => v !== null).length
            });
          }
          
          let filteredData = null;
          
          // SEMPRE recarregar quando filtros mudarem (incluindo quando são limpos)
          if (hasActiveFilters) {
            window.loadingManager?.show('Aplicando filtros...');
            // Construir filtros para API (mesmo padrão da Overview)
            const apiFilters = [];
            Object.entries(filters).forEach(([field, value]) => {
              if (value !== null && value !== undefined) {
                const apiField = fieldMap[field] || field;
                
                // Suportar seleção múltipla (arrays)
                if (Array.isArray(value) && value.length > 0) {
                  apiFilters.push({ field: apiField, op: 'in', value: value });
                } else if (!Array.isArray(value)) {
                  apiFilters.push({ field: apiField, op: 'eq', value: value });
                }
              }
            });
            
            if (window.Logger) {
              window.Logger.debug(`🔍 Filtros construídos para ${pageId}:`, { 
                apiFilters, 
                count: apiFilters.length
              });
            }
            
            // Usar endpoint /api/filter/aggregated (mesmo da Overview)
            try {
              const endpoint = aggregateEndpoint || '/api/filter/aggregated';
              
              if (window.Logger) {
                window.Logger.debug(`🚀 Buscando dados filtrados para ${pageId} via ${endpoint}:`, {
                  filters: apiFilters,
                  count: apiFilters.length
                });
              }
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ filters: apiFilters })
              });
              
              if (response.ok) {
                filteredData = await response.json();
                
                // Validar estrutura retornada (mesmo padrão da Overview)
                if (!filteredData || typeof filteredData !== 'object' || Array.isArray(filteredData)) {
                  if (window.Logger) {
                    window.Logger.warn(`⚠️ Dados filtrados inválidos para ${pageId}, usando estrutura vazia`);
                  }
                  filteredData = {
                    totalManifestations: 0,
                    manifestationsByMonth: [],
                    manifestationsByDay: [],
                    manifestationsByStatus: [],
                    manifestationsByTheme: [],
                    manifestationsBySubject: [],
                    manifestationsByOrgan: [],
                    manifestationsByType: [],
                    manifestationsByChannel: [],
                    manifestationsByPriority: [],
                    manifestationsByUnit: []
                  };
                }
                
                if (window.Logger) {
                  window.Logger.debug(`📦 Dados filtrados recebidos para ${pageId}:`, {
                    type: typeof filteredData,
                    isArray: Array.isArray(filteredData),
                    keys: filteredData ? Object.keys(filteredData).slice(0, 15) : [],
                    hasByTheme: !!filteredData.manifestationsByTheme,
                    hasBySubject: !!filteredData.manifestationsBySubject,
                    hasByStatus: !!filteredData.manifestationsByStatus
                  });
                }
              } else {
                const errorText = await response.text();
                if (window.Logger) {
                  window.Logger.warn(`⚠️ Erro ao buscar dados filtrados para ${pageId}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                  });
                }
              }
            } catch (error) {
              if (window.Logger) {
                window.Logger.error(`❌ Erro ao buscar dados filtrados para ${pageId}:`, error);
              }
            }
          }
          
          // SEMPRE recarregar quando filtros mudarem (com ou sem filtros ativos)
          if (!hasActiveFilters) {
            // SEM FILTROS: Invalidar cache e recarregar dados originais
            if (window.dataStore) {
              window.dataStore.invalidate?.();
            }
            if (window.Logger) {
              window.Logger.debug(`🗑️ Filtros limpos para ${pageId}, invalidando cache e recarregando dados originais`);
            }
            window.loadingManager?.show('Removendo filtros...');
          }
          
          // Chamar função de atualização ou load
          if (hasActiveFilters && updateFunction && typeof updateFunction === 'function') {
            // Se há filtros E há updateFunction, usar updateFunction com dados filtrados
            try {
              if (window.Logger) {
                window.Logger.debug(`🔄 Chamando updateFunction para ${pageId} com dados filtrados`);
              }
              await updateFunction(filteredData, hasActiveFilters);
            } catch (error) {
              if (window.Logger) {
                window.Logger.error(`❌ Erro na função de atualização para ${pageId}:`, error);
              }
              // Fallback: recarregar página normalmente
              if (loadFunction && typeof loadFunction === 'function') {
                await loadFunction(false);
              }
            }
          } else {
            // SEM FILTROS ou SEM updateFunction: SEMPRE recarregar página
            if (loadFunction && typeof loadFunction === 'function') {
              if (window.Logger) {
                window.Logger.debug(`🔄 Recarregando ${pageId} ${hasActiveFilters ? 'com filtros aplicados' : 'sem filtros (dados originais)'}`);
              }
              await loadFunction(false);
            }
          }
          
          window.loadingManager?.hide();
          
        } catch (error) {
          if (window.Logger) {
            window.Logger.error(`❌ Erro no listener de filtros para ${pageId}:`, error);
          }
        } finally {
          window.crossfilterOverview[updateKey] = false;
        }
      });
      
      if (window.Logger) {
        window.Logger.success(`✅ Listener crossfilterOverview registrado para ${pageId}`);
      }
    }
    
    // Registrar listener no chartCommunication (compatibilidade)
    if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener(pageId, loadFunction, 500);
      if (window.Logger) {
        window.Logger.debug(`✅ Listener chartCommunication registrado para ${pageId}`);
      }
    }
  };

  /**
   * Converter filtros do crossfilterOverview para formato de API
   * Útil para páginas que precisam aplicar filtros manualmente
   */
  window.convertCrossfilterToAPIFilters = function(filters, fieldMap = {
    status: 'Status',
    tema: 'Tema',
    orgaos: 'Orgaos',
    tipo: 'Tipo',
    canal: 'Canal',
    prioridade: 'Prioridade',
    unidade: 'UnidadeCadastro',
    bairro: 'Bairro'
  }) {
    const apiFilters = [];
    
    if (!filters) return apiFilters;
    
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== null && value !== undefined) {
        const apiField = fieldMap[field] || field;
        
        if (Array.isArray(value) && value.length > 0) {
          apiFilters.push({ field: apiField, op: 'in', value: value });
        } else if (!Array.isArray(value)) {
          apiFilters.push({ field: apiField, op: 'eq', value: value });
        }
      }
    });
    
    return apiFilters;
  };

  /**
   * Obter filtros ativos de todas as fontes (crossfilterOverview + chartCommunication)
   */
  window.getActiveFilters = function() {
    const filters = [];
    
    // Prioridade 1: crossfilterOverview
    if (window.crossfilterOverview && window.crossfilterOverview.filters) {
      const crossFilters = window.crossfilterOverview.filters;
      Object.entries(crossFilters).forEach(([field, value]) => {
        if (value !== null && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => {
              filters.push({ 
                field: field.charAt(0).toUpperCase() + field.slice(1), 
                op: 'eq', 
                value: v 
              });
            });
          } else {
            filters.push({ 
              field: field.charAt(0).toUpperCase() + field.slice(1), 
              op: 'eq', 
              value 
            });
          }
        }
      });
    }
    
    // Prioridade 2: chartCommunication
    if (window.chartCommunication && window.chartCommunication.filters) {
      const globalFilters = window.chartCommunication.filters.filters || [];
      filters.push(...globalFilters);
    }
    
    return filters;
  };

  if (window.Logger) {
    window.Logger.debug('✅ PageFilterHelper: Helper reutilizável de filtros inicializado');
  }
})();

