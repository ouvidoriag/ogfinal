/**
 * Integração Crossfilter para Página Tema
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
   * Inicializar crossfilter para página Tema
   * Integra com chartCommunication para filtros globais
   */
  function initTemaCrossfilter() {
    if (isInitialized) {
      return; // Já inicializado
    }

    // Verificar se chartCommunication existe
    if (!window.chartCommunication) {
      if (window.Logger) {
        window.Logger.warn('TemaCrossfilter: chartCommunication não encontrado. Tentando novamente...');
      }
      setTimeout(initTemaCrossfilter, 500);
      return;
    }

    // Criar listener para mudanças de filtros globais
    if (window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-tema', async () => {
        // Recarregar página quando filtros mudarem
        if (window.loadTema) {
          await window.loadTema();
        }
      }, 500);

      if (window.Logger) {
        window.Logger.success('✅ TemaCrossfilter: Integração com filtros globais inicializada');
      }
    }

    // Adicionar listeners aos gráficos para aplicar filtros ao clicar
    setupChartClickListeners();

    isInitialized = true;
  }

  /**
   * Configurar listeners de clique nos gráficos
   */
  function setupChartClickListeners() {
    // Listener será adicionado quando os gráficos forem criados
    // Usar eventBus para detectar quando gráficos são criados
    if (window.eventBus) {
      window.eventBus.on('chart:created', (event) => {
        const { chartId } = event;
        if (chartId === 'chartTema' || chartId === 'chartStatusTema') {
          addChartClickListener(chartId);
        }
      });
    }

    // Tentar adicionar listeners imediatamente se gráficos já existirem
    setTimeout(() => {
      addChartClickListener('chartTema');
      addChartClickListener('chartStatusTema');
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

    // Remover listener anterior se existir
    const newCanvas = chart.canvas.cloneNode(true);
    chart.canvas.parentNode.replaceChild(newCanvas, chart.canvas);
    chart.canvas = newCanvas;

    // Adicionar novo listener
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

        // Determinar campo baseado no gráfico
        const field = chartId === 'chartTema' ? 'Tema' : 'StatusDemanda';

        // Aplicar filtro via chartCommunication
        if (window.chartCommunication.applyFilter) {
          window.chartCommunication.applyFilter(field, label, multiSelect);
        } else if (window.chartCommunication.filters) {
          // Fallback: adicionar filtro manualmente
          const existingFilters = window.chartCommunication.filters.filters || [];
          const newFilter = { field, op: 'eq', value: label };
          
          if (multiSelect) {
            // Verificar se já existe
            const exists = existingFilters.some(f => 
              f.field === field && f.value === label
            );
            if (!exists) {
              window.chartCommunication.filters.filters = [...existingFilters, newFilter];
            }
          } else {
            // Substituir filtros do mesmo campo
            window.chartCommunication.filters.filters = [
              ...existingFilters.filter(f => f.field !== field),
              newFilter
            ];
          }

          // Notificar mudança
          if (window.chartCommunication.onFilterChange) {
            window.chartCommunication.onFilterChange();
          }
        }

        // Recarregar página
        if (window.loadTema) {
          window.loadTema();
        }
      }
    });
  }

  // Auto-inicializar quando página carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initTemaCrossfilter, 1000);
    });
  } else {
    setTimeout(initTemaCrossfilter, 1000);
  }

  // Exportar para uso global
  window.temaCrossfilterAdapter = {
    init: initTemaCrossfilter
  };
})();

