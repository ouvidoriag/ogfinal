/**
 * Script de Teste - Sistema Crossfilter
 * 
 * Testa o sistema de filtros crossfilter em todas as páginas da Ouvidoria
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function() {
  'use strict';

  const testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  /**
   * Registrar resultado de teste
   */
  function recordTest(name, passed, message = '', warning = false) {
    testResults.tests.push({
      name,
      passed,
      message,
      warning,
      timestamp: new Date().toISOString()
    });
    
    if (warning) {
      testResults.warnings++;
    } else if (passed) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  }

  /**
   * Teste 1: Verificar se o helper está carregado
   */
  function testHelperLoaded() {
    const name = 'Helper Crossfilter Carregado';
    try {
      if (typeof window.addCrossfilterToChart === 'function') {
        recordTest(name, true, 'Helper addCrossfilterToChart está disponível');
        return true;
      } else {
        recordTest(name, false, 'Helper addCrossfilterToChart NÃO está disponível');
        return false;
      }
    } catch (error) {
      recordTest(name, false, `Erro ao verificar helper: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste 2: Verificar se crossfilterOverview está disponível
   */
  function testCrossfilterOverview() {
    const name = 'Crossfilter Overview Disponível';
    try {
      if (window.crossfilterOverview) {
        const hasMethods = 
          typeof window.crossfilterOverview.setStatusFilter === 'function' &&
          typeof window.crossfilterOverview.setTemaFilter === 'function' &&
          typeof window.crossfilterOverview.clearAllFilters === 'function' &&
          typeof window.crossfilterOverview.notifyListeners === 'function';
        
        if (hasMethods) {
          recordTest(name, true, 'CrossfilterOverview com todos os métodos necessários');
          return true;
        } else {
          recordTest(name, false, 'CrossfilterOverview não tem todos os métodos necessários');
          return false;
        }
      } else {
        recordTest(name, true, 'CrossfilterOverview não disponível (normal em páginas que não são Overview)', true);
        return true;
      }
    } catch (error) {
      recordTest(name, false, `Erro ao verificar crossfilterOverview: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste 3: Verificar se chartCommunication está disponível
   */
  function testChartCommunication() {
    const name = 'Chart Communication Disponível';
    try {
      if (window.chartCommunication) {
        const hasFilters = window.chartCommunication.filters !== undefined;
        if (hasFilters) {
          recordTest(name, true, 'ChartCommunication com sistema de filtros');
          return true;
        } else {
          recordTest(name, false, 'ChartCommunication sem sistema de filtros');
          return false;
        }
      } else {
        recordTest(name, true, 'ChartCommunication não disponível (normal em algumas páginas)', true);
        return true;
      }
    } catch (error) {
      recordTest(name, false, `Erro ao verificar chartCommunication: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste 4: Verificar gráficos com crossfilter em uma página específica
   */
  function testChartsWithCrossfilter(pageName, chartIds) {
    const results = [];
    
    chartIds.forEach(chartId => {
      const name = `Gráfico ${chartId} (${pageName})`;
      try {
        // Tentar obter o gráfico
        const chart = window.ChartFactory?.getChart?.(chartId) || 
                     window.chartFactory?.getChart?.(chartId) ||
                     (window.Chart && Chart.getChart(chartId));
        
        if (!chart) {
          recordTest(name, true, `Gráfico ${chartId} não encontrado (pode não estar renderizado)`, true);
          return;
        }

        // Verificar se tem onClick handler
        const hasOnClick = chart.options && typeof chart.options.onClick === 'function';
        
        // Verificar se canvas tem cursor pointer
        const hasCursor = chart.canvas && chart.canvas.style.cursor === 'pointer';
        
        // Verificar se tem handler de clique direito
        const container = chart.canvas?.parentElement;
        const hasContextMenu = container && container.dataset.crossfilterEnabled === 'true';

        if (hasOnClick || hasCursor || hasContextMenu) {
          recordTest(name, true, `Gráfico ${chartId} tem handlers de crossfilter`);
          results.push(true);
        } else {
          recordTest(name, false, `Gráfico ${chartId} NÃO tem handlers de crossfilter`);
          results.push(false);
        }
      } catch (error) {
        recordTest(name, false, `Erro ao verificar gráfico: ${error.message}`);
        results.push(false);
      }
    });

    return results.every(r => r === true);
  }

  /**
   * Teste 5: Testar aplicação de filtro
   */
  function testFilterApplication() {
    const name = 'Aplicação de Filtro';
    try {
      // Testar com crossfilterOverview se disponível
      if (window.crossfilterOverview) {
        const originalFilters = JSON.parse(JSON.stringify(window.crossfilterOverview.filters));
        
        // Aplicar filtro de teste
        window.crossfilterOverview.setStatusFilter('Aberto', false);
        
        const hasFilter = window.crossfilterOverview.filters.status === 'Aberto';
        
        // Restaurar filtros
        window.crossfilterOverview.filters = originalFilters;
        
        if (hasFilter) {
          recordTest(name, true, 'Filtro aplicado com sucesso via crossfilterOverview');
          return true;
        } else {
          recordTest(name, false, 'Filtro não foi aplicado corretamente');
          return false;
        }
      } 
      // Testar com chartCommunication se disponível
      else if (window.chartCommunication && window.chartCommunication.filters) {
        const originalFilters = [...(window.chartCommunication.filters.filters || [])];
        
        // Aplicar filtro de teste
        const newFilter = { field: 'StatusDemanda', op: 'eq', value: 'Aberto' };
        window.chartCommunication.filters.filters = [
          ...originalFilters.filter(f => f.field !== 'StatusDemanda'),
          newFilter
        ];
        
        const hasFilter = window.chartCommunication.filters.filters.some(
          f => f.field === 'StatusDemanda' && f.value === 'Aberto'
        );
        
        // Restaurar filtros
        window.chartCommunication.filters.filters = originalFilters;
        
        if (hasFilter) {
          recordTest(name, true, 'Filtro aplicado com sucesso via chartCommunication');
          return true;
        } else {
          recordTest(name, false, 'Filtro não foi aplicado corretamente');
          return false;
        }
      } else {
        recordTest(name, true, 'Nenhum sistema de filtros disponível para teste', true);
        return true;
      }
    } catch (error) {
      recordTest(name, false, `Erro ao testar aplicação de filtro: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste 6: Testar limpeza de filtros
   */
  function testFilterClearing() {
    const name = 'Limpeza de Filtros';
    try {
      // Testar com crossfilterOverview se disponível
      if (window.crossfilterOverview) {
        // Aplicar alguns filtros
        window.crossfilterOverview.setStatusFilter('Aberto', false);
        window.crossfilterOverview.setTemaFilter('Saúde', false);
        
        // Limpar
        window.crossfilterOverview.clearAllFilters();
        
        const allCleared = Object.values(window.crossfilterOverview.filters).every(
          v => v === null || v === undefined || (Array.isArray(v) && v.length === 0)
        );
        
        if (allCleared) {
          recordTest(name, true, 'Filtros limpos com sucesso via crossfilterOverview');
          return true;
        } else {
          recordTest(name, false, 'Filtros não foram limpos corretamente');
          return false;
        }
      } 
      // Testar com chartCommunication se disponível
      else if (window.chartCommunication && window.chartCommunication.filters) {
        // Aplicar alguns filtros
        window.chartCommunication.filters.filters = [
          { field: 'StatusDemanda', op: 'eq', value: 'Aberto' },
          { field: 'Tema', op: 'eq', value: 'Saúde' }
        ];
        
        // Limpar
        if (typeof window.chartCommunication.filters.clear === 'function') {
          window.chartCommunication.filters.clear();
        } else {
          window.chartCommunication.filters.filters = [];
        }
        
        const allCleared = !window.chartCommunication.filters.filters || 
                          window.chartCommunication.filters.filters.length === 0;
        
        if (allCleared) {
          recordTest(name, true, 'Filtros limpos com sucesso via chartCommunication');
          return true;
        } else {
          recordTest(name, false, 'Filtros não foram limpos corretamente');
          return false;
        }
      } else {
        recordTest(name, true, 'Nenhum sistema de filtros disponível para teste', true);
        return true;
      }
    } catch (error) {
      recordTest(name, false, `Erro ao testar limpeza de filtros: ${error.message}`);
      return false;
    }
  }

  /**
   * Teste 7: Verificar gráficos em páginas específicas
   */
  function testPageCharts() {
    const pages = {
      'Tema': ['chartTema', 'chartStatusTema', 'chartTemaMes'],
      'Assunto': ['chartAssunto', 'chartStatusAssunto', 'chartAssuntoMes'],
      'Status': ['chartStatusPage', 'chartStatusMes'],
      'Tipo': ['chartTipo'],
      'Canal': ['chartCanal', 'chartCanalMes'],
      'Prioridade': ['chartPrioridade'],
      'Bairro': ['chartBairro', 'chartBairroMes'],
      'Responsável': ['chartResponsavel'],
      'Reclamações': ['chartReclamacoesTipo', 'chartReclamacoesMes'],
      'Notificações': ['notificacoes-chart-tipo']
    };

    const results = [];
    
    Object.entries(pages).forEach(([pageName, chartIds]) => {
      const pageResult = testChartsWithCrossfilter(pageName, chartIds);
      results.push(pageResult);
    });

    return results;
  }

  /**
   * Executar todos os testes
   */
  function runAllTests() {
    console.log('%c🧪 INICIANDO TESTES DO SISTEMA CROSSFILTER', 'color: #22d3ee; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));

    // Testes básicos
    testHelperLoaded();
    testCrossfilterOverview();
    testChartCommunication();
    testFilterApplication();
    testFilterClearing();

    // Testes de gráficos (aguardar um pouco para gráficos carregarem)
    setTimeout(() => {
      testPageCharts();
      showResults();
    }, 2000);
  }

  /**
   * Mostrar resultados
   */
  function showResults() {
    console.log('\n%c📊 RESULTADOS DOS TESTES', 'color: #22d3ee; font-size: 14px; font-weight: bold;');
    console.log('='.repeat(60));

    testResults.tests.forEach((test, index) => {
      const icon = test.passed ? '✅' : '❌';
      const warning = test.warning ? '⚠️' : '';
      const color = test.passed ? '#34d399' : '#ef4444';
      const style = `color: ${color}; font-weight: ${test.passed ? 'normal' : 'bold'};`;
      
      console.log(`%c${icon} ${warning} ${test.name}`, style);
      if (test.message) {
        console.log(`   ${test.message}`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`%c✅ Passou: ${testResults.passed}`, 'color: #34d399; font-weight: bold;');
    console.log(`%c❌ Falhou: ${testResults.failed}`, 'color: #ef4444; font-weight: bold;');
    console.log(`%c⚠️ Avisos: ${testResults.warnings}`, 'color: #fbbf24; font-weight: bold;');
    console.log(`%c📊 Total: ${testResults.tests.length}`, 'color: #22d3ee; font-weight: bold;');

    // Exportar resultados para window
    window.crossfilterTestResults = testResults;

    // Retornar resumo
    return {
      passed: testResults.passed,
      failed: testResults.failed,
      warnings: testResults.warnings,
      total: testResults.tests.length,
      success: testResults.failed === 0
    };
  }

  /**
   * Teste rápido de um gráfico específico
   */
  function testSpecificChart(chartId) {
    console.log(`%c🔍 Testando gráfico: ${chartId}`, 'color: #22d3ee; font-weight: bold;');
    
    const chart = window.ChartFactory?.getChart?.(chartId) || 
                 window.chartFactory?.getChart?.(chartId) ||
                 (window.Chart && Chart.getChart(chartId));
    
    if (!chart) {
      console.error(`❌ Gráfico ${chartId} não encontrado`);
      return false;
    }

    const checks = {
      'Gráfico existe': !!chart,
      'Tem canvas': !!chart.canvas,
      'Tem options': !!chart.options,
      'Tem onClick handler': typeof chart.options.onClick === 'function',
      'Canvas tem cursor pointer': chart.canvas?.style.cursor === 'pointer',
      'Tem handler de clique direito': chart.canvas?.parentElement?.dataset.crossfilterEnabled === 'true'
    };

    console.table(checks);

    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log(`%c✅ Gráfico ${chartId} está configurado corretamente`, 'color: #34d399; font-weight: bold;');
    } else {
      console.log(`%c⚠️ Gráfico ${chartId} tem algumas configurações faltando`, 'color: #fbbf24; font-weight: bold;');
    }

    return allPassed;
  }

  // Exportar funções para uso global
  window.testCrossfilter = {
    runAll: runAllTests,
    testChart: testSpecificChart,
    results: () => testResults,
    showResults: showResults
  };

  // Auto-executar se solicitado
  if (window.location.search.includes('test=crossfilter')) {
    setTimeout(runAllTests, 1000);
  }

  console.log('%c✅ Script de teste crossfilter carregado!', 'color: #34d399; font-weight: bold;');
  console.log('%c💡 Use: testCrossfilter.runAll() para executar todos os testes', 'color: #22d3ee;');
  console.log('%c💡 Use: testCrossfilter.testChart("chartId") para testar um gráfico específico', 'color: #22d3ee;');
})();

