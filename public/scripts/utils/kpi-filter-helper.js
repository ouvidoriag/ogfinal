/**
 * Helper para KPIs e Cards Reagirem aos Filtros
 * 
 * Garante que cards/KPIs atualizam valores quando filtros mudam
 * e que cards clicáveis aplicam filtros
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function() {
  'use strict';

  /**
   * Fazer KPIs reagirem aos filtros
   * Atualiza valores dos KPIs quando filtros mudam
   */
  window.makeKPIsReactive = function(kpiConfig) {
    if (!kpiConfig || !kpiConfig.updateFunction) {
      if (window.Logger) {
        window.Logger.warn('makeKPIsReactive: updateFunction não fornecida');
      }
      return;
    }

    const { updateFunction, pageLoadFunction } = kpiConfig;

    // Listener para atualizar KPIs quando filtros mudarem
    function updateKPIsOnFilterChange() {
      if (pageLoadFunction && typeof pageLoadFunction === 'function') {
        // Recarregar página que atualiza os KPIs
        pageLoadFunction(true).catch(err => {
          if (window.Logger) {
            window.Logger.error('Erro ao atualizar KPIs:', err);
          }
        });
      } else if (updateFunction && typeof updateFunction === 'function') {
        // Atualizar KPIs diretamente
        updateFunction();
      }
    }

    // Registrar listener no sistema de filtros apropriado
    if (window.crossfilterOverview) {
      window.crossfilterOverview.onFilterChange(updateKPIsOnFilterChange);
    } else if (window.chartCommunication && window.chartCommunication.onFilterChange) {
      const originalOnFilterChange = window.chartCommunication.onFilterChange;
      window.chartCommunication.onFilterChange = function() {
        if (originalOnFilterChange) {
          originalOnFilterChange();
        }
        updateKPIsOnFilterChange();
      };
    }

    if (window.Logger) {
      window.Logger.debug('✅ KPIs configurados para reagir aos filtros');
    }
  };

  /**
   * Tornar cards clicáveis para aplicar filtros
   */
  window.makeCardsClickable = function(cardsConfig) {
    if (!cardsConfig || !Array.isArray(cardsConfig.cards)) {
      if (window.Logger) {
        window.Logger.warn('makeCardsClickable: cards não fornecidos');
      }
      return;
    }

    const { cards, field, getValueFromCard } = cardsConfig;

    cards.forEach(cardConfig => {
      const { selector, value, field: cardField } = cardConfig;
      
      const cardElements = document.querySelectorAll(selector);
      
      cardElements.forEach(cardEl => {
        // Tornar card clicável
        cardEl.style.cursor = 'pointer';
        cardEl.classList.add('hover:opacity-80', 'transition-opacity');
        
        // Adicionar tooltip
        cardEl.title = 'Clique para filtrar | Clique direito para limpar filtros';
        
        // Handler de clique
        cardEl.addEventListener('click', (e) => {
          e.stopPropagation();
          
          const cardValue = value || 
                           (getValueFromCard ? getValueFromCard(cardEl) : null) ||
                           cardEl.dataset.value ||
                           cardEl.textContent?.trim();
          
          const filterField = cardField || field;
          
          if (!cardValue || !filterField) {
            if (window.Logger) {
              window.Logger.warn('makeCardsClickable: valor ou campo não encontrado', { cardValue, filterField });
            }
            return;
          }

          const multiSelect = e.ctrlKey || e.metaKey;

          if (window.Logger) {
            window.Logger.debug('🖱️ Clique no card:', { cardValue, filterField, multiSelect });
          }

          // Aplicar filtro
          if (window.crossfilterOverview) {
            const methodName = `set${filterField.charAt(0).toUpperCase() + filterField.slice(1)}Filter`;
            const method = window.crossfilterOverview[methodName];
            if (method && typeof method === 'function') {
              method.call(window.crossfilterOverview, cardValue, multiSelect);
              window.crossfilterOverview.notifyListeners();
            }
          } else if (window.chartCommunication && window.chartCommunication.filters) {
            const existingFilters = window.chartCommunication.filters.filters || [];
            const newFilter = { 
              field: filterField.charAt(0).toUpperCase() + filterField.slice(1), 
              op: 'eq', 
              value: cardValue 
            };
            
            if (multiSelect) {
              const exists = existingFilters.some(f => 
                f.field === newFilter.field && f.value === newFilter.value
              );
              if (!exists) {
                window.chartCommunication.filters.filters = [...existingFilters, newFilter];
              }
            } else {
              window.chartCommunication.filters.filters = [
                ...existingFilters.filter(f => f.field !== newFilter.field),
                newFilter
              ];
            }

            if (window.chartCommunication.onFilterChange) {
              window.chartCommunication.onFilterChange();
            }
          }

          // Feedback visual
          cardEl.style.transform = 'scale(0.95)';
          setTimeout(() => {
            cardEl.style.transform = '';
          }, 150);
        });

        // Handler de clique direito (limpar filtros)
        cardEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();

          if (window.Logger) {
            window.Logger.debug('🖱️ Clique direito no card - limpando filtros');
          }

          if (window.crossfilterOverview) {
            window.crossfilterOverview.clearAllFilters();
            window.crossfilterOverview.notifyListeners();
          } else if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.clear();
            if (window.chartCommunication.onFilterChange) {
              window.chartCommunication.onFilterChange();
            }
          }

          // Feedback visual
          cardEl.style.transform = 'scale(0.95)';
          setTimeout(() => {
            cardEl.style.transform = '';
          }, 150);
        });
      });
    });

    if (window.Logger) {
      window.Logger.debug(`✅ ${cards.length} cards configurados como clicáveis`);
    }
  };

  /**
   * Verificar se um elemento é clicável e tem crossfilter
   */
  window.checkElementCrossfilter = function(selector) {
    const elements = document.querySelectorAll(selector);
    const results = [];
    
    elements.forEach((el, idx) => {
      const hasCursor = el.style.cursor === 'pointer' || el.classList.contains('cursor-pointer');
      const hasClick = el.onclick !== null || el.hasAttribute('onclick');
      const hasData = el.dataset.value || el.dataset.tema || el.dataset.assunto || 
                     el.dataset.tipo || el.dataset.canal || el.dataset.prioridade || 
                     el.dataset.responsavel || el.dataset.orgao;
      
      results.push({
        index: idx,
        element: el,
        hasCursor,
        hasClick,
        hasData,
        clickable: hasCursor || hasClick,
        complete: hasCursor && hasData
      });
    });
    
    return results;
  };

  if (window.Logger) {
    window.Logger.debug('✅ KPI Filter Helper inicializado');
  }
})();

