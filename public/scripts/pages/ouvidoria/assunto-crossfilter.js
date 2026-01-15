/**
 * Integração Crossfilter para Página Assunto
 * 
 * Exemplo completo de como integrar crossfilter em uma página
 * Integra com o sistema global de filtros (chartCommunication)
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  let isInitialized = false;

  /**
   * Inicializar crossfilter para página Assunto
   */
  function initAssuntoCrossfilter() {
    if (isInitialized) {
      return;
    }

    if (!window.chartCommunication) {
      if (window.Logger) {
        window.Logger.warn('AssuntoCrossfilter: chartCommunication não encontrado. Tentando novamente...');
      }
      setTimeout(initAssuntoCrossfilter, 500);
      return;
    }

    // Criar listener para mudanças de filtros globais
    if (window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-assunto', async () => {
        if (window.loadAssunto) {
          await window.loadAssunto();
        }
      }, 500);

      if (window.Logger) {
        window.Logger.success('✅ AssuntoCrossfilter: Integração com filtros globais inicializada');
      }
    }

    setupChartClickListeners();
    isInitialized = true;
  }

  /**
   * Configurar listeners de clique nos gráficos
   */
  function setupChartClickListeners() {
    if (window.eventBus) {
      window.eventBus.on('chart:created', (event) => {
        const { chartId } = event;
        if (chartId === 'chartAssunto' || chartId === 'chartStatusAssunto') {
          addChartClickListener(chartId);
        }
      });
    }

    setTimeout(() => {
      addChartClickListener('chartAssunto');
      addChartClickListener('chartStatusAssunto');
    }, 2000);
  }

  /**
   * Adicionar listener de clique a um gráfico
   */
  function addChartClickListener(chartId) {
    const chart = window.ChartFactory?.getChart?.(chartId);
    if (!chart || !chart.canvas) {
      return;
    }

    const newCanvas = chart.canvas.cloneNode(true);
    chart.canvas.parentNode.replaceChild(newCanvas, chart.canvas);
    chart.canvas = newCanvas;

    newCanvas.addEventListener('click', (event) => {
      if (!window.chartCommunication) return;

      const activePoints = chart.getElementsAtEventForMode(
        event,
        'nearest',
        { intersect: true },
        true
      );

      if (activePoints.length > 0) {
        const dataIndex = activePoints[0].index;
        const label = chart.data.labels[dataIndex];
        const multiSelect = event.ctrlKey || event.metaKey;
        const field = chartId === 'chartAssunto' ? 'Assunto' : 'StatusDemanda';

        if (window.chartCommunication.applyFilter) {
          window.chartCommunication.applyFilter(field, label, multiSelect);
        } else if (window.chartCommunication.filters) {
          const existingFilters = window.chartCommunication.filters.filters || [];
          const newFilter = { field, op: 'eq', value: label };
          
          if (multiSelect) {
            const exists = existingFilters.some(f => 
              f.field === field && f.value === label
            );
            if (!exists) {
              window.chartCommunication.filters.filters = [...existingFilters, newFilter];
            }
          } else {
            window.chartCommunication.filters.filters = [
              ...existingFilters.filter(f => f.field !== field),
              newFilter
            ];
          }

          if (window.chartCommunication.onFilterChange) {
            window.chartCommunication.onFilterChange();
          }
        }

        if (window.loadAssunto) {
          window.loadAssunto();
        }
      }
    });
  }

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initAssuntoCrossfilter, 1000);
    });
  } else {
    setTimeout(initAssuntoCrossfilter, 1000);
  }

  window.assuntoCrossfilterAdapter = {
    init: initAssuntoCrossfilter
  };
})();

