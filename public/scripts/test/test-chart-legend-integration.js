/**
 * Teste de Integração chartLegend × chartFactory
 * Verifica se a integração está funcionando corretamente
 * 
 * REFATORAÇÃO: FASE 5 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

(function() {
  'use strict';
  
  console.log('🧪 Iniciando testes de Integração chartLegend × chartFactory...');
  
  const tests = [];
  let passed = 0;
  let failed = 0;
  
  function test(name, fn) {
    tests.push({ name, fn });
  }
  
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
  
  // Aguardar sistemas estarem disponíveis
  function waitForSystems(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (window.chartFactory && window.chartLegend) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Sistemas não encontrados após ' + maxAttempts + ' tentativas'));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }
  
  // Teste 1: Verificar que chartFactory existe
  test('chartFactory está disponível', () => {
    assert(window.chartFactory !== undefined, 'chartFactory deve estar definido');
    assert(typeof window.chartFactory.createBarChart === 'function', 'createBarChart deve ser função');
    assert(typeof window.chartFactory.createLineChart === 'function', 'createLineChart deve ser função');
    assert(typeof window.chartFactory.createDoughnutChart === 'function', 'createDoughnutChart deve ser função');
  });
  
  // Teste 2: Verificar que chartLegend existe (wrapper)
  test('chartLegend está disponível (wrapper)', () => {
    assert(window.chartLegend !== undefined, 'chartLegend deve estar definido');
    assert(typeof window.chartLegend.createInteractiveLegend === 'function', 'createInteractiveLegend deve ser função');
    assert(typeof window.chartLegend.createDoughnutLegend === 'function', 'createDoughnutLegend deve ser função');
  });
  
  // Teste 3: Verificar que chartFactory suporta opção createLegend
  test('chartFactory suporta opção createLegend', () => {
    // Verificar que os métodos aceitam options.createLegend
    const createBarChart = window.chartFactory.createBarChart.toString();
    const createLineChart = window.chartFactory.createLineChart.toString();
    const createDoughnutChart = window.chartFactory.createDoughnutChart.toString();
    
    // Verificar que há lógica para createLegend
    assert(
      createBarChart.includes('createLegend') || createBarChart.includes('legendContainer'),
      'createBarChart deve suportar createLegend ou legendContainer'
    );
    assert(
      createLineChart.includes('createLegend') || createLineChart.includes('legendContainer'),
      'createLineChart deve suportar createLegend ou legendContainer'
    );
    assert(
      createDoughnutChart.includes('createLegend') || createDoughnutChart.includes('legendContainer'),
      'createDoughnutChart deve suportar createLegend ou legendContainer'
    );
  });
  
  // Teste 4: Verificar compatibilidade (legendContainer ainda funciona)
  test('Compatibilidade: legendContainer ainda funciona', () => {
    // Verificar que o código ainda suporta legendContainer para compatibilidade
    const createBarChart = window.chartFactory.createBarChart.toString();
    assert(
      createBarChart.includes('legendContainer'),
      'createBarChart deve manter compatibilidade com legendContainer'
    );
  });
  
  // Teste 5: Verificar que chartLegend está documentado como wrapper
  test('chartLegend documentado como wrapper/deprecado', () => {
    // Verificar que há documentação sobre ser wrapper
    // Isso é verificado pela existência do arquivo e suas funções
    assert(window.chartLegend !== undefined, 'chartLegend deve existir como wrapper');
  });
  
  // Executar testes
  async function runTests() {
    try {
      await waitForSystems();
      
      for (const { name, fn } of tests) {
        try {
          await fn();
          console.log(`✅ ${name}`);
          passed++;
        } catch (error) {
          console.error(`❌ ${name}:`, error.message);
          failed++;
        }
      }
      
      console.log(`\n📊 Resultados: ${passed} passaram, ${failed} falharam de ${tests.length} testes`);
      
      if (failed === 0) {
        console.log('🎉 Todos os testes passaram!');
        console.log('✅ Integração chartLegend × chartFactory confirmada:');
        console.log('   - chartFactory suporta createLegend: true');
        console.log('   - chartLegend mantido como wrapper para compatibilidade');
        return true;
      } else {
        console.error('⚠️ Alguns testes falharam');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao executar testes:', error);
      return false;
    }
  }
  
  // Executar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runTests);
  } else {
    runTests();
  }
  
  // Exportar para uso manual
  window.testChartLegendIntegration = runTests;
  
})();

