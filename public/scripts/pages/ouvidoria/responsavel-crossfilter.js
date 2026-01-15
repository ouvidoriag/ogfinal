/**
 * Integração Crossfilter para Página Responsável
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
   * Inicializar crossfilter para página Responsável
   */
  function initResponsavelCrossfilter() {
    if (isInitialized) {
      return;
    }

    if (!window.chartCommunication) {
      if (window.Logger) {
        window.Logger.warn('ResponsavelCrossfilter: chartCommunication não encontrado. Tentando novamente...');
      }
      setTimeout(initResponsavelCrossfilter, 500);
      return;
    }

    // Criar listener para mudanças de filtros globais
    if (window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-responsavel', async () => {
        if (window.loadResponsavel) {
          await window.loadResponsavel();
        }
      }, 500);

      if (window.Logger) {
        window.Logger.success('✅ ResponsavelCrossfilter: Integração com filtros globais inicializada');
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
        if (chartId && chartId.includes('Responsavel')) {
          addChartClickListener(chartId);
        }
      });
    }

    setTimeout(() => {
      // Tentar encontrar gráficos de responsável
      const charts = ['chartResponsavel', 'chartStatusResponsavel'];
      charts.forEach(chartId => addChartClickListener(chartId));
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
        const field = chartId.includes('Status') ? 'StatusDemanda' : 'Responsavel';

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

        if (window.loadResponsavel) {
          window.loadResponsavel();
        }
      }
    });
  }

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initResponsavelCrossfilter, 1000);
    });
  } else {
    setTimeout(initResponsavelCrossfilter, 1000);
  }

  window.responsavelCrossfilterAdapter = {
    init: initResponsavelCrossfilter
  };
})();

