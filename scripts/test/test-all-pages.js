/**
 * Script de Teste de Todas as Páginas e Gráficos
 * 
 * Este script testa todas as páginas do sistema e verifica se os gráficos são renderizados corretamente.
 * 
 * Uso:
 * 1. Abra o dashboard no navegador
 * 2. Abra o console do navegador (F12)
 * 3. Cole e execute este script
 * 
 * Ou execute via Node.js (requer servidor rodando):
 * node scripts/test-all-pages.js
 */

// Lista de todas as páginas do sistema
const ALL_PAGES = {
  ouvidoria: [
    'home',
    'main',
    'orgao-mes',
    'tempo-medio',
    'tema',
    'assunto',
    'cadastrante',
    'reclamacoes',
    'projecao-2026',
    'secretaria',
    'secretarias-distritos',
    'tipo',
    'status',
    'categoria',
    'setor',
    'responsavel',
    'canal',
    'prioridade',
    'bairro',
    'uac',
    'unidades-saude'
  ],
  zeladoria: [
    'zeladoria-home',
    'zeladoria-overview',
    'zeladoria-status',
    'zeladoria-categoria',
    'zeladoria-departamento',
    'zeladoria-bairro',
    'zeladoria-responsavel',
    'zeladoria-canal',
    'zeladoria-tempo',
    'zeladoria-mensal',
    'zeladoria-geografica'
  ]
};

// Páginas dinâmicas de unidades de saúde (serão testadas se disponíveis)
const UNIT_PAGES_PREFIX = 'unit-';

// Resultados dos testes
const testResults = {
  passed: [],
  failed: [],
  skipped: [],
  errors: [],
  charts: {
    found: [],
    missing: [],
    errors: []
  },
  startTime: null,
  endTime: null
};

/**
 * Aguardar um tempo específico
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verificar se um elemento existe e está visível
 */
function isElementVisible(selector) {
  const element = document.querySelector(selector);
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

/**
 * Verificar se uma página está visível
 */
function isPageVisible(pageId) {
  const pageElement = document.getElementById(`page-${pageId}`);
  return pageElement && isElementVisible(`#page-${pageId}`);
}

/**
 * Encontrar todos os gráficos (canvas) em uma página
 */
function findChartsInPage(pageId) {
  const pageElement = document.getElementById(`page-${pageId}`);
  if (!pageElement) return [];
  
  const canvases = pageElement.querySelectorAll('canvas');
  const charts = [];
  
  canvases.forEach(canvas => {
    const chartId = canvas.id || canvas.getAttribute('data-chart-id');
    const chartInstance = window[chartId] || (window.Chart && window.Chart.getChart(canvas));
    
    charts.push({
      id: chartId || canvas.id || 'sem-id',
      element: canvas,
      hasInstance: !!chartInstance,
      isVisible: isElementVisible(`#${canvas.id}`),
      width: canvas.width,
      height: canvas.height,
      hasData: chartInstance ? (chartInstance.data?.datasets?.length > 0) : false
    });
  });
  
  return charts;
}

/**
 * Verificar se há erros no console
 */
function checkForErrors() {
  // Esta função será chamada após cada página ser carregada
  // Os erros serão capturados via window.onerror
  return window.__testErrors || [];
}

/**
 * Carregar uma página e aguardar carregamento
 */
async function loadPage(pageId, section = 'ouvidoria') {
  try {
    // Mudar para a seção correta se necessário
    if (section === 'zeladoria') {
      const btnZeladoria = document.getElementById('btnSectionZeladoria');
      if (btnZeladoria && !btnZeladoria.classList.contains('active')) {
        btnZeladoria.click();
        await wait(500);
      }
    } else {
      const btnOuvidoria = document.getElementById('btnSectionOuvidoria');
      if (btnOuvidoria && !btnOuvidoria.classList.contains('active')) {
        btnOuvidoria.click();
        await wait(500);
      }
    }
    
    // Clicar no item do menu
    const menuItem = document.querySelector(`[data-page="${pageId}"]`);
    if (!menuItem) {
      throw new Error(`Item do menu não encontrado para página: ${pageId}`);
    }
    
    menuItem.click();
    
    // Aguardar página ser exibida
    let attempts = 0;
    while (!isPageVisible(pageId) && attempts < 20) {
      await wait(200);
      attempts++;
    }
    
    if (!isPageVisible(pageId)) {
      throw new Error(`Página ${pageId} não ficou visível após 4 segundos`);
    }
    
    // Aguardar carregamento dos dados e gráficos
    await wait(2000);
    
    // Aguardar um pouco mais para gráficos complexos
    await wait(1000);
    
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * Testar uma página específica
 */
async function testPage(pageId, section = 'ouvidoria') {
  const result = {
    pageId,
    section,
    success: false,
    charts: [],
    errors: [],
    loadTime: null,
    startTime: Date.now()
  };
  
  try {
    console.log(`\n🧪 Testando página: ${pageId} (${section})`);
    
    // Limpar erros anteriores
    window.__testErrors = [];
    
    // Carregar página
    await loadPage(pageId, section);
    
    result.loadTime = Date.now() - result.startTime;
    
    // Verificar se página está visível
    if (!isPageVisible(pageId)) {
      throw new Error('Página não está visível');
    }
    
    // Encontrar gráficos
    const charts = findChartsInPage(pageId);
    result.charts = charts;
    
    // Verificar erros
    const errors = checkForErrors();
    result.errors = errors;
    
    // Verificar se há gráficos esperados (algumas páginas podem não ter gráficos)
    const hasCharts = charts.length > 0;
    const hasChartInstances = charts.some(c => c.hasInstance);
    
    // Considerar sucesso se:
    // 1. Página carregou sem erros críticos
    // 2. Página está visível
    // 3. Se há canvas, pelo menos um tem instância de gráfico
    result.success = errors.length === 0 && (hasCharts ? hasChartInstances : true);
    
    if (result.success) {
      testResults.passed.push(result);
      console.log(`✅ ${pageId}: OK (${charts.length} gráfico(s), ${result.loadTime}ms)`);
    } else {
      testResults.failed.push(result);
      console.log(`❌ ${pageId}: FALHOU (${charts.length} gráfico(s), ${errors.length} erro(s))`);
    }
    
    // Registrar gráficos
    charts.forEach(chart => {
      if (chart.hasInstance && chart.hasData) {
        testResults.charts.found.push({
          pageId,
          chartId: chart.id
        });
      } else {
        testResults.charts.missing.push({
          pageId,
          chartId: chart.id,
          reason: !chart.hasInstance ? 'Sem instância' : 'Sem dados'
        });
      }
    });
    
    if (errors.length > 0) {
      testResults.charts.errors.push({
        pageId,
        errors
      });
    }
    
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    testResults.failed.push(result);
    testResults.errors.push({
      pageId,
      error: error.message,
      stack: error.stack
    });
    console.error(`❌ ${pageId}: ERRO - ${error.message}`);
  }
  
  return result;
}

/**
 * Encontrar páginas dinâmicas de unidades
 */
function findUnitPages() {
  const unitPages = [];
  const menuItems = document.querySelectorAll('[data-page^="unit-"]');
  menuItems.forEach(item => {
    const pageId = item.getAttribute('data-page');
    if (pageId && !unitPages.includes(pageId)) {
      unitPages.push(pageId);
    }
  });
  return unitPages;
}

/**
 * Executar todos os testes
 */
async function runAllTests(options = {}) {
  const {
    skipOuvidoria = false,
    skipZeladoria = false,
    skipUnits = false,
    delayBetweenPages = 1000
  } = options;
  
  testResults.startTime = Date.now();
  console.log('🚀 Iniciando testes de todas as páginas e gráficos...\n');
  
  // Configurar captura de erros
  const originalError = window.onerror;
  window.__testErrors = [];
  window.onerror = function(msg, url, line, col, error) {
    window.__testErrors.push({
      message: msg,
      url,
      line,
      col,
      error: error?.stack
    });
    if (originalError) {
      return originalError.apply(this, arguments);
    }
    return false;
  };
  
  // Testar páginas da Ouvidoria
  if (!skipOuvidoria) {
    console.log('\n📋 Testando páginas da Ouvidoria...');
    for (const pageId of ALL_PAGES.ouvidoria) {
      await testPage(pageId, 'ouvidoria');
      await wait(delayBetweenPages);
    }
  }
  
  // Testar páginas da Zeladoria
  if (!skipZeladoria) {
    console.log('\n🏗️ Testando páginas da Zeladoria...');
    for (const pageId of ALL_PAGES.zeladoria) {
      await testPage(pageId, 'zeladoria');
      await wait(delayBetweenPages);
    }
  }
  
  // Testar páginas dinâmicas de unidades
  if (!skipUnits) {
    console.log('\n🏥 Testando páginas de unidades de saúde...');
    const unitPages = findUnitPages();
    if (unitPages.length > 0) {
      for (const pageId of unitPages.slice(0, 5)) { // Limitar a 5 para não demorar muito
        await testPage(pageId, 'ouvidoria');
        await wait(delayBetweenPages);
      }
    } else {
      console.log('⚠️ Nenhuma página de unidade encontrada');
    }
  }
  
  // Restaurar handler de erros
  window.onerror = originalError;
  
  testResults.endTime = Date.now();
  const totalTime = testResults.endTime - testResults.startTime;
  
  // Gerar relatório
  generateReport();
  
  return testResults;
}

/**
 * Gerar relatório final
 */
function generateReport() {
  const total = testResults.passed.length + testResults.failed.length + testResults.skipped.length;
  const successRate = total > 0 ? ((testResults.passed.length / total) * 100).toFixed(2) : 0;
  const totalTime = testResults.endTime - testResults.startTime;
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 RELATÓRIO DE TESTES');
  console.log('='.repeat(80));
  console.log(`\n⏱️  Tempo total: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`\n✅ Páginas passaram: ${testResults.passed.length}`);
  console.log(`❌ Páginas falharam: ${testResults.failed.length}`);
  console.log(`⏭️  Páginas puladas: ${testResults.skipped.length}`);
  console.log(`📈 Taxa de sucesso: ${successRate}%`);
  
  console.log(`\n📊 Gráficos encontrados: ${testResults.charts.found.length}`);
  console.log(`⚠️  Gráficos com problemas: ${testResults.charts.missing.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ PÁGINAS QUE FALHARAM:');
    testResults.failed.forEach(result => {
      console.log(`  - ${result.pageId} (${result.section})`);
      if (result.errors.length > 0) {
        result.errors.forEach(err => {
          console.log(`    Erro: ${err}`);
        });
      }
      if (result.charts.length === 0) {
        console.log(`    ⚠️ Nenhum gráfico encontrado`);
      } else {
        result.charts.forEach(chart => {
          if (!chart.hasInstance) {
            console.log(`    ⚠️ Gráfico ${chart.id} sem instância`);
          }
        });
      }
    });
  }
  
  if (testResults.charts.missing.length > 0) {
    console.log('\n⚠️ GRÁFICOS COM PROBLEMAS:');
    testResults.charts.missing.forEach(chart => {
      console.log(`  - ${chart.chartId} em ${chart.pageId}: ${chart.reason}`);
    });
  }
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 ERROS ENCONTRADOS:');
    testResults.errors.forEach(err => {
      console.log(`  - ${err.pageId}: ${err.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Retornar resultados para uso programático
  return {
    summary: {
      total,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      skipped: testResults.skipped.length,
      successRate: parseFloat(successRate),
      totalTime,
      chartsFound: testResults.charts.found.length,
      chartsMissing: testResults.charts.missing.length
    },
    details: {
      passed: testResults.passed,
      failed: testResults.failed,
      charts: testResults.charts,
      errors: testResults.errors
    }
  };
}

// Exportar para uso no navegador
if (typeof window !== 'undefined') {
  window.testAllPages = {
    runAllTests,
    testPage,
    findChartsInPage,
    generateReport,
    ALL_PAGES,
    testResults
  };
  
  console.log('✅ Script de teste carregado!');
  console.log('💡 Use: window.testAllPages.runAllTests() para executar todos os testes');
  console.log('💡 Use: window.testAllPages.testPage("main") para testar uma página específica');
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testPage,
    findChartsInPage,
    generateReport,
    ALL_PAGES,
    testResults
  };
}

