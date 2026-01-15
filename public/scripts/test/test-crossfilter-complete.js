/**
 * Teste Completo do Sistema Crossfilter
 * 
 * Testa TODOS os elementos: gráficos, cards, rankings, listas
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

  function recordTest(name, passed, message = '', warning = false) {
    testResults.tests.push({ name, passed, message, warning, timestamp: new Date().toISOString() });
    if (warning) {
      testResults.warnings++;
    } else if (passed) {
      testResults.passed++;
    } else {
      testResults.failed++;
    }
  }

  /**
   * Teste 1: Verificar gráficos de pizza (doughnut/pie)
   */
  function testPieCharts() {
    const pieChartIds = [
      'chartStatusPage', 'chartStatusTema', 'chartStatusAssunto',
      'chartTipo', 'chartCanal', 'chartPrioridade',
      'notificacoes-chart-tipo'
    ];

    pieChartIds.forEach(chartId => {
      const chart = window.ChartFactory?.getChart?.(chartId) || 
                   window.chartFactory?.getChart?.(chartId) ||
                   (window.Chart && Chart.getChart(chartId));
      
      if (chart) {
        const hasOnClick = typeof chart.options?.onClick === 'function';
        const hasCursor = chart.canvas?.style.cursor === 'pointer';
        recordTest(`Gráfico Pizza ${chartId}`, hasOnClick && hasCursor,
          hasOnClick && hasCursor ? 'Tem crossfilter' : 'Sem crossfilter completo');
      } else {
        recordTest(`Gráfico Pizza ${chartId}`, true, 'Não renderizado', true);
      }
    });
  }

  /**
   * Teste 2: Verificar gráficos de barras
   */
  function testBarCharts() {
    const barChartIds = [
      'chartTema', 'chartAssunto', 'chartBairro', 'chartResponsavel',
      'chartTemaMes', 'chartAssuntoMes', 'chartStatusMes',
      'chartCanalMes', 'chartBairroMes', 'chartReclamacoesTipo', 'chartReclamacoesMes'
    ];

    barChartIds.forEach(chartId => {
      const chart = window.ChartFactory?.getChart?.(chartId) || 
                   window.chartFactory?.getChart?.(chartId) ||
                   (window.Chart && Chart.getChart(chartId));
      
      if (chart) {
        const hasOnClick = typeof chart.options?.onClick === 'function';
        const hasCursor = chart.canvas?.style.cursor === 'pointer';
        recordTest(`Gráfico Barra ${chartId}`, hasOnClick && hasCursor,
          hasOnClick && hasCursor ? 'Tem crossfilter' : 'Sem crossfilter completo');
      } else {
        recordTest(`Gráfico Barra ${chartId}`, true, 'Não renderizado', true);
      }
    });
  }

  /**
   * Teste 3: Verificar rankings clicáveis
   */
  function testRankings() {
    const rankings = [
      { id: 'rankTipo', field: 'tipo', selector: '.rank-item[data-tipo]' },
      { id: 'rankCanal', field: 'canal', selector: '.rank-item[data-canal]' },
      { id: 'rankPrioridade', field: 'prioridade', selector: '.rank-item[data-prioridade]' },
      { id: 'rankResponsavel', field: 'responsavel', selector: '.rank-item[data-responsavel]' }
    ];

    rankings.forEach(rank => {
      const rankEl = document.getElementById(rank.id);
      if (rankEl) {
        const items = rankEl.querySelectorAll(rank.selector);
        const hasItems = items.length > 0;
        const hasCursor = items.length > 0 && Array.from(items).every(item => 
          item.style.cursor === 'pointer' || item.classList.contains('cursor-pointer')
        );
        recordTest(`Ranking ${rank.id}`, hasItems && hasCursor,
          hasItems && hasCursor ? `${items.length} itens clicáveis` : 'Sem itens clicáveis');
      } else {
        recordTest(`Ranking ${rank.id}`, true, 'Não encontrado', true);
      }
    });
  }

  /**
   * Teste 4: Verificar listas clicáveis
   */
  function testLists() {
    const lists = [
      { id: 'listaTemas', field: 'tema', selector: '.tema-item' },
      { id: 'listaAssuntos', field: 'assunto', selector: '.assunto-item' }
    ];

    lists.forEach(list => {
      const listEl = document.getElementById(list.id);
      if (listEl) {
        const items = listEl.querySelectorAll(list.selector);
        const hasItems = items.length > 0;
        const hasCursor = items.length > 0 && Array.from(items).every(item => 
          item.style.cursor === 'pointer' || item.classList.contains('cursor-pointer')
        );
        recordTest(`Lista ${list.id}`, hasItems && hasCursor,
          hasItems && hasCursor ? `${items.length} itens clicáveis` : 'Sem itens clicáveis');
      } else {
        recordTest(`Lista ${list.id}`, true, 'Não encontrada', true);
      }
    });
  }

  /**
   * Teste 5: Verificar KPIs reativos
   */
  function testKPIsReactive() {
    const kpiIds = [
      'kpiTotalTema', 'kpiTemasUnicos', 'kpiMediaTema',
      'kpiTotalAssunto', 'kpiAssuntosUnicos',
      'kpiTotalBairro', 'kpiBairrosUnicos',
      'kpiTotalResponsavel', 'kpiResponsaveisUnicos'
    ];

    // Verificar se helper está disponível
    const hasHelper = typeof window.makeKPIsReactive === 'function';
    recordTest('Helper makeKPIsReactive disponível', hasHelper,
      hasHelper ? 'Helper carregado' : 'Helper não encontrado');

    // Verificar se KPIs existem (não podemos testar reatividade sem filtros ativos)
    kpiIds.forEach(kpiId => {
      const kpiEl = document.getElementById(kpiId);
      recordTest(`KPI ${kpiId} existe`, !!kpiEl,
        kpiEl ? 'Elemento encontrado' : 'Elemento não encontrado', !kpiEl);
    });
  }

  /**
   * Teste 6: Verificar cards clicáveis
   */
  function testClickableCards() {
    const cardSelectors = [
      '.status-card', // Overview
      '.tema-item', // Tema
      '.assunto-item', // Assunto
      '.rank-item' // Rankings
    ];

    cardSelectors.forEach(selector => {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        const clickable = Array.from(cards).every(card => 
          card.style.cursor === 'pointer' || 
          card.classList.contains('cursor-pointer') ||
          card.onclick !== null
        );
        recordTest(`Cards ${selector}`, clickable,
          clickable ? `${cards.length} cards clicáveis` : 'Cards não clicáveis');
      } else {
        recordTest(`Cards ${selector}`, true, 'Nenhum card encontrado', true);
      }
    });
  }

  /**
   * Teste 7: Verificar integração completa
   */
  function testIntegration() {
    // Verificar se todos os helpers estão disponíveis
    const helpers = {
      'addCrossfilterToChart': typeof window.addCrossfilterToChart === 'function',
      'makeKPIsReactive': typeof window.makeKPIsReactive === 'function',
      'makeCardsClickable': typeof window.makeCardsClickable === 'function'
    };

    Object.entries(helpers).forEach(([name, available]) => {
      recordTest(`Helper ${name}`, available,
        available ? 'Disponível' : 'Não disponível');
    });

    // Verificar sistemas de filtros
    const filterSystems = {
      'crossfilterOverview': !!window.crossfilterOverview,
      'chartCommunication': !!window.chartCommunication
    };

    Object.entries(filterSystems).forEach(([name, available]) => {
      recordTest(`Sistema ${name}`, available,
        available ? 'Disponível' : 'Não disponível', !available);
    });
  }

  /**
   * Executar todos os testes
   */
  function runCompleteTests() {
    console.log('%c🧪 TESTE COMPLETO DO SISTEMA CROSSFILTER', 'color: #22d3ee; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));

    testPieCharts();
    testBarCharts();
    testRankings();
    testLists();
    testKPIsReactive();
    testClickableCards();
    testIntegration();

    showResults();
  }

  /**
   * Mostrar resultados
   */
  function showResults() {
    console.log('\n%c📊 RESULTADOS COMPLETOS', 'color: #22d3ee; font-size: 14px; font-weight: bold;');
    console.log('='.repeat(60));

    // Agrupar por categoria
    const categories = {
      'Gráficos Pizza': [],
      'Gráficos Barras': [],
      'Rankings': [],
      'Listas': [],
      'KPIs': [],
      'Cards': [],
      'Sistema': []
    };

    testResults.tests.forEach(test => {
      if (test.name.includes('Pizza')) {
        categories['Gráficos Pizza'].push(test);
      } else if (test.name.includes('Barra')) {
        categories['Gráficos Barras'].push(test);
      } else if (test.name.includes('Ranking')) {
        categories['Rankings'].push(test);
      } else if (test.name.includes('Lista')) {
        categories['Listas'].push(test);
      } else if (test.name.includes('KPI')) {
        categories['KPIs'].push(test);
      } else if (test.name.includes('Card')) {
        categories['Cards'].push(test);
      } else {
        categories['Sistema'].push(test);
      }
    });

    Object.entries(categories).forEach(([category, tests]) => {
      if (tests.length > 0) {
        console.log(`\n%c${category}`, 'color: #3b82f6; font-weight: bold;');
        tests.forEach(test => {
          const icon = test.passed ? '✅' : '❌';
          const warning = test.warning ? '⚠️' : '';
          const color = test.passed ? '#34d399' : '#ef4444';
          console.log(`%c${icon} ${warning} ${test.name}`, `color: ${color};`);
          if (test.message) {
            console.log(`   ${test.message}`);
          }
        });
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`%c✅ Passou: ${testResults.passed}`, 'color: #34d399; font-weight: bold;');
    console.log(`%c❌ Falhou: ${testResults.failed}`, 'color: #ef4444; font-weight: bold;');
    console.log(`%c⚠️ Avisos: ${testResults.warnings}`, 'color: #fbbf24; font-weight: bold;');
    console.log(`%c📊 Total: ${testResults.tests.length}`, 'color: #22d3ee; font-weight: bold;');
    console.log('='.repeat(60));

    // Exportar resultados
    window.crossfilterCompleteTestResults = testResults;

    return {
      passed: testResults.passed,
      failed: testResults.failed,
      warnings: testResults.warnings,
      total: testResults.tests.length,
      success: testResults.failed === 0
    };
  }

  // Exportar
  window.testCrossfilterComplete = {
    run: runCompleteTests,
    results: () => testResults,
    showResults: showResults
  };

  console.log('%c✅ Teste completo crossfilter carregado!', 'color: #34d399; font-weight: bold;');
  console.log('%c💡 Use: testCrossfilterComplete.run() para executar todos os testes', 'color: #22d3ee;');
})();

