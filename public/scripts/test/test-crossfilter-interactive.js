/**
 * Script de Teste Interativo - Sistema Crossfilter
 * 
 * Testa o sistema de filtros crossfilter de forma interativa
 * Permite simular cliques e verificar comportamento
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function() {
  'use strict';

  /**
   * Simular clique em um gráfico
   */
  function simulateChartClick(chartId, index = 0, ctrlKey = false) {
    const chart = window.ChartFactory?.getChart?.(chartId) || 
                 window.chartFactory?.getChart?.(chartId) ||
                 (window.Chart && Chart.getChart(chartId));
    
    if (!chart || !chart.canvas) {
      console.error(`❌ Gráfico ${chartId} não encontrado`);
      return false;
    }

    console.log(`%c🖱️ Simulando clique no gráfico ${chartId} (índice: ${index}, Ctrl: ${ctrlKey})`, 
                'color: #22d3ee; font-weight: bold;');

    // Criar evento simulado
    const canvas = chart.canvas;
    const rect = canvas.getBoundingClientRect();
    
    // Obter posição do elemento no gráfico
    const meta = chart.getDatasetMeta(0);
    const element = meta.data[index];
    
    if (!element) {
      console.error(`❌ Elemento no índice ${index} não encontrado`);
      return false;
    }

    const x = rect.left + element.x;
    const y = rect.top + element.y;

    // Criar evento de clique
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      ctrlKey: ctrlKey,
      metaKey: ctrlKey
    });

    // Disparar evento no canvas
    canvas.dispatchEvent(clickEvent);

    // Se o gráfico tem onClick handler, chamar diretamente
    if (chart.options && typeof chart.options.onClick === 'function') {
      const elements = chart.getElementsAtEventForMode(
        clickEvent,
        'nearest',
        { intersect: true },
        true
      );

      if (elements.length > 0) {
        // Criar evento simulado para o handler
        const mockEvent = {
          native: {
            ctrlKey: ctrlKey,
            metaKey: ctrlKey
          }
        };
        
        chart.options.onClick(mockEvent, elements);
        console.log(`%c✅ Clique simulado com sucesso`, 'color: #34d399; font-weight: bold;');
        return true;
      }
    }

    console.log(`%c⚠️ Clique simulado, mas nenhum elemento foi detectado`, 'color: #fbbf24;');
    return false;
  }

  /**
   * Simular clique direito (limpar filtros)
   */
  function simulateRightClick(chartId) {
    const chart = window.ChartFactory?.getChart?.(chartId) || 
                 window.chartFactory?.getChart?.(chartId) ||
                 (window.Chart && Chart.getChart(chartId));
    
    if (!chart || !chart.canvas) {
      console.error(`❌ Gráfico ${chartId} não encontrado`);
      return false;
    }

    console.log(`%c🖱️ Simulando clique direito no gráfico ${chartId}`, 
                'color: #22d3ee; font-weight: bold;');

    const container = chart.canvas.parentElement;
    if (container) {
      const contextMenuEvent = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        view: window
      });

      container.dispatchEvent(contextMenuEvent);
      console.log(`%c✅ Clique direito simulado com sucesso`, 'color: #34d399; font-weight: bold;');
      return true;
    }

    console.log(`%c⚠️ Container do gráfico não encontrado`, 'color: #fbbf24;');
    return false;
  }

  /**
   * Verificar estado atual dos filtros
   */
  function checkFilterState() {
    console.log('%c📊 Estado Atual dos Filtros', 'color: #22d3ee; font-size: 14px; font-weight: bold;');
    console.log('='.repeat(60));

    // Verificar crossfilterOverview
    if (window.crossfilterOverview) {
      console.log('%c🔵 CrossfilterOverview:', 'color: #3b82f6; font-weight: bold;');
      const filters = window.crossfilterOverview.filters;
      const activeFilters = Object.entries(filters)
        .filter(([key, value]) => {
          if (value === null || value === undefined) return false;
          if (Array.isArray(value)) return value.length > 0;
          return true;
        })
        .map(([key, value]) => ({ [key]: value }));

      if (activeFilters.length > 0) {
        console.table(activeFilters);
      } else {
        console.log('   Nenhum filtro ativo');
      }
    } else {
      console.log('%c⚠️ CrossfilterOverview não disponível', 'color: #fbbf24;');
    }

    // Verificar chartCommunication
    if (window.chartCommunication && window.chartCommunication.filters) {
      console.log('\n%c🟢 ChartCommunication:', 'color: #10b981; font-weight: bold;');
      const filters = window.chartCommunication.filters.filters || [];
      
      if (filters.length > 0) {
        console.table(filters);
      } else {
        console.log('   Nenhum filtro ativo');
      }
    } else {
      console.log('\n%c⚠️ ChartCommunication não disponível', 'color: #fbbf24;');
    }

    console.log('='.repeat(60));
  }

  /**
   * Listar todos os gráficos disponíveis
   */
  function listAvailableCharts() {
    console.log('%c📊 Gráficos Disponíveis', 'color: #22d3ee; font-size: 14px; font-weight: bold;');
    console.log('='.repeat(60));

    const chartIds = [
      'chartTema', 'chartStatusTema', 'chartTemaMes',
      'chartAssunto', 'chartStatusAssunto', 'chartAssuntoMes',
      'chartStatusPage', 'chartStatusMes',
      'chartTipo',
      'chartCanal', 'chartCanalMes',
      'chartPrioridade',
      'chartBairro', 'chartBairroMes',
      'chartResponsavel',
      'chartReclamacoesTipo', 'chartReclamacoesMes',
      'notificacoes-chart-tipo'
    ];

    const availableCharts = [];
    const unavailableCharts = [];

    chartIds.forEach(chartId => {
      const chart = window.ChartFactory?.getChart?.(chartId) || 
                   window.chartFactory?.getChart?.(chartId) ||
                   (window.Chart && Chart.getChart(chartId));
      
      if (chart) {
        availableCharts.push({
          id: chartId,
          type: chart.config?.type || 'unknown',
          hasOnClick: typeof chart.options?.onClick === 'function',
          hasCursor: chart.canvas?.style.cursor === 'pointer'
        });
      } else {
        unavailableCharts.push(chartId);
      }
    });

    if (availableCharts.length > 0) {
      console.log(`%c✅ ${availableCharts.length} gráficos encontrados:`, 'color: #34d399; font-weight: bold;');
      console.table(availableCharts);
    }

    if (unavailableCharts.length > 0) {
      console.log(`\n%c⚠️ ${unavailableCharts.length} gráficos não encontrados:`, 'color: #fbbf24;');
      console.log(unavailableCharts.join(', '));
    }

    console.log('='.repeat(60));
    return availableCharts;
  }

  /**
   * Teste completo interativo
   */
  function runInteractiveTest() {
    console.log('%c🧪 TESTE INTERATIVO DO CROSSFILTER', 'color: #22d3ee; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));

    // 1. Listar gráficos disponíveis
    const charts = listAvailableCharts();
    
    if (charts.length === 0) {
      console.log('%c⚠️ Nenhum gráfico encontrado. Aguarde o carregamento da página.', 'color: #fbbf24;');
      return;
    }

    // 2. Verificar estado inicial dos filtros
    console.log('\n');
    checkFilterState();

    // 3. Testar primeiro gráfico disponível
    if (charts.length > 0) {
      const firstChart = charts[0];
      console.log(`\n%c🔍 Testando gráfico: ${firstChart.id}`, 'color: #22d3ee; font-weight: bold;');
      
      // Simular clique simples
      simulateChartClick(firstChart.id, 0, false);
      
      // Aguardar um pouco e verificar estado
      setTimeout(() => {
        console.log('\n%c📊 Estado após clique:', 'color: #22d3ee; font-weight: bold;');
        checkFilterState();
        
        // Simular clique direito para limpar
        setTimeout(() => {
          console.log('\n%c🧹 Limpando filtros...', 'color: #22d3ee; font-weight: bold;');
          simulateRightClick(firstChart.id);
          
          setTimeout(() => {
            console.log('\n%c📊 Estado após limpeza:', 'color: #22d3ee; font-weight: bold;');
            checkFilterState();
            
            console.log('\n%c✅ Teste interativo concluído!', 'color: #34d399; font-weight: bold;');
          }, 500);
        }, 1000);
      }, 500);
    }
  }

  // Exportar funções para uso global
  window.testCrossfilterInteractive = {
    click: simulateChartClick,
    rightClick: simulateRightClick,
    checkState: checkFilterState,
    listCharts: listAvailableCharts,
    run: runInteractiveTest
  };

  console.log('%c✅ Script de teste interativo crossfilter carregado!', 'color: #34d399; font-weight: bold;');
  console.log('%c💡 Use: testCrossfilterInteractive.run() para executar teste completo', 'color: #22d3ee;');
  console.log('%c💡 Use: testCrossfilterInteractive.click("chartId", index, ctrlKey) para simular clique', 'color: #22d3ee;');
  console.log('%c💡 Use: testCrossfilterInteractive.checkState() para verificar estado dos filtros', 'color: #22d3ee;');
  console.log('%c💡 Use: testCrossfilterInteractive.listCharts() para listar gráficos disponíveis', 'color: #22d3ee;');
})();

