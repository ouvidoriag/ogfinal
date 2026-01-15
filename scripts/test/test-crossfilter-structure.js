/**
 * Teste de Estrutura do Sistema Crossfilter
 * Valida que todas as funções e módulos estão corretos
 * Não requer servidor rodando
 * 
 * CÉREBRO X-3
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '../..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function testFileExists(filePath, description) {
  results.total++;
  const fullPath = join(ROOT, filePath);
  if (existsSync(fullPath)) {
    logSuccess(`${description}: ${filePath}`);
    results.passed++;
    return true;
  } else {
    logError(`${description}: ${filePath} NÃO ENCONTRADO`);
    results.failed++;
    results.errors.push(`${description}: ${filePath} não existe`);
    return false;
  }
}

function testFileContains(filePath, searchString, description) {
  results.total++;
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) {
    logError(`${description}: Arquivo não existe`);
    results.failed++;
    return false;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    if (content.includes(searchString)) {
      logSuccess(`${description}: Encontrado "${searchString}"`);
      results.passed++;
      return true;
    } else {
      logError(`${description}: "${searchString}" NÃO encontrado`);
      results.failed++;
      results.errors.push(`${description}: "${searchString}" não encontrado em ${filePath}`);
      return false;
    }
  } catch (error) {
    logError(`${description}: Erro ao ler arquivo - ${error.message}`);
    results.failed++;
    return false;
  }
}

async function runStructureTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🧪 TESTE DE ESTRUTURA DO SISTEMA CROSSFILTER', 'blue');
  log('='.repeat(60) + '\n', 'blue');
  
  // Teste 1: Arquivos principais existem
  logInfo('\n📁 Teste 1: Verificando arquivos principais');
  testFileExists('public/scripts/core/crossfilter-overview.js', 'Módulo crossfilter-overview');
  testFileExists('public/scripts/pages/ouvidoria/overview.js', 'Página overview');
  testFileExists('public/scripts/test/test-crossfilter-browser.js', 'Script de teste browser');
  testFileExists('scripts/test/test-crossfilter.js', 'Script de teste Node.js');
  
  // Teste 2: Funções principais existem
  logInfo('\n🔧 Teste 2: Verificando funções principais');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'crossfilterOverview', 'Objeto crossfilterOverview');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'setAllData(', 'Função setAllData');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'getFilteredData(', 'Função getFilteredData');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'toggleFilter(', 'Função toggleFilter');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'clearAllFilters', 'Função clearAllFilters');
  testFileContains('public/scripts/core/crossfilter-overview.js', 'notifyListeners', 'Função notifyListeners');
  
  // Teste 3: Função aggregateFilteredData
  logInfo('\n📊 Teste 3: Verificando função aggregateFilteredData');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'function aggregateFilteredData', 'Função aggregateFilteredData');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'window.aggregateFilteredData', 'Exposição global aggregateFilteredData');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'getFieldValue', 'Função helper getFieldValue');
  
  // Teste 4: Handlers de clique
  logInfo('\n🖱️  Teste 4: Verificando handlers de clique');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'options.onClick', 'Handlers onClick');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setStatusFilter', 'Handler Status');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setTemaFilter', 'Handler Tema');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setOrgaosFilter', 'Handler Órgãos');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setTipoFilter', 'Handler Tipo');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setCanalFilter', 'Handler Canal');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setPrioridadeFilter', 'Handler Prioridade');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'setUnidadeFilter', 'Handler Unidade');
  
  // Teste 5: Prevenção de loops
  logInfo('\n🔄 Teste 5: Verificando prevenção de loops infinitos');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', '_listenerRegistered', 'Flag _listenerRegistered');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', '_isUpdating', 'Flag _isUpdating');
  testFileContains('public/scripts/core/crossfilter-overview.js', '_debounceTimer', 'Debounce timer');
  
  // Teste 6: Banner de filtros
  logInfo('\n🏷️  Teste 6: Verificando banner de filtros');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'renderCrossfilterBanner', 'Função renderCrossfilterBanner');
  testFileContains('public/scripts/pages/ouvidoria/overview.js', 'crossfilter-banner', 'ID do banner');
  
  // Teste 7: Integração no HTML
  logInfo('\n📄 Teste 7: Verificando integração no HTML');
  testFileContains('public/index.html', 'crossfilter-overview.js', 'Script crossfilter-overview no HTML');
  testFileContains('public/index.html', 'test-crossfilter-browser.js', 'Script de teste no HTML');
  
  // Teste 8: Package.json
  logInfo('\n📦 Teste 8: Verificando package.json');
  testFileContains('package.json', 'test:crossfilter', 'Comando test:crossfilter');
  
  // Resumo
  log('\n' + '='.repeat(60), 'blue');
  log('📊 RESUMO DOS TESTES DE ESTRUTURA', 'blue');
  log('='.repeat(60), 'blue');
  log(`Total de testes: ${results.total}`, 'cyan');
  logSuccess(`Passou: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Falhou: ${results.failed}`);
    log('\n❌ Erros encontrados:', 'red');
    results.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error}`, 'red');
    });
  }
  
  const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;
  log(`\nTaxa de sucesso: ${successRate}%`, successRate >= 90 ? 'green' : 'yellow');
  
  if (successRate >= 90) {
    logSuccess('\n✅ Estrutura do Sistema Crossfilter está correta!');
    logInfo('\n💡 Para testar funcionalmente, inicie o servidor e execute:');
    logInfo('   1. Abra http://localhost:3000/ouvidoria/overview');
    logInfo('   2. Abra o console (F12)');
    logInfo('   3. Execute: testCrossfilter()');
    return 0;
  } else {
    logError('\n❌ Estrutura do Sistema Crossfilter precisa de ajustes.');
    return 1;
  }
}

// Executar testes
runStructureTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  logError(`Erro fatal: ${error.message}`);
  console.error(error);
  process.exit(1);
});

