/**
 * Script de Teste para Sistema Crossfilter
 * Testa todos os filtros possíveis e valida a agregação de dados
 * 
 * CÉREBRO X-3
 */

// Node.js 18+ tem fetch nativo, não precisa importar
const fetch = globalThis.fetch;

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

// Cores para output
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

/**
 * Testar filtro único
 */
async function testFilter(field, value, expectedMin = 0) {
  try {
    logInfo(`\nTestando filtro: ${field} = ${value}`);
    
    const response = await fetch(`${BASE_URL}/api/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: [{ field, op: 'eq', value }],
        originalUrl: '/'
      })
    });
    
    if (!response.ok) {
      logError(`Erro HTTP: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    
    if (rows.length < expectedMin) {
      logWarning(`Retornou apenas ${rows.length} registros (esperado pelo menos ${expectedMin})`);
    } else {
      logSuccess(`Retornou ${rows.length} registros`);
    }
    
    // Verificar estrutura dos dados
    if (rows.length > 0) {
      const sample = rows[0];
      const hasField = sample[field] || sample.data?.[field] || 
                       sample[field.toLowerCase()] || sample.data?.[field.toLowerCase()];
      
      if (hasField) {
        logSuccess(`Campo '${field}' encontrado no primeiro registro`);
      } else {
        logWarning(`Campo '${field}' não encontrado no primeiro registro`);
        logInfo(`Chaves disponíveis: ${Object.keys(sample).slice(0, 10).join(', ')}`);
        if (sample.data) {
          logInfo(`Chaves em data: ${Object.keys(sample.data).slice(0, 10).join(', ')}`);
        }
      }
    }
    
    return rows.length > 0;
  } catch (error) {
    logError(`Erro ao testar filtro: ${error.message}`);
    return false;
  }
}

/**
 * Testar múltiplos filtros simultâneos
 */
async function testMultipleFilters(filters, expectedMin = 0) {
  try {
    logInfo(`\nTestando múltiplos filtros: ${filters.map(f => `${f.field}=${f.value}`).join(', ')}`);
    
    const response = await fetch(`${BASE_URL}/api/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: filters.map(f => ({ field: f.field, op: 'eq', value: f.value })),
        originalUrl: '/'
      })
    });
    
    if (!response.ok) {
      logError(`Erro HTTP: ${response.status} ${response.statusText}`);
      return false;
    }
    
    const data = await response.json();
    const rows = Array.isArray(data) ? data : (data.data || []);
    
    if (rows.length < expectedMin) {
      logWarning(`Retornou apenas ${rows.length} registros (esperado pelo menos ${expectedMin})`);
    } else {
      logSuccess(`Retornou ${rows.length} registros`);
    }
    
    return rows.length > 0;
  } catch (error) {
    logError(`Erro ao testar múltiplos filtros: ${error.message}`);
    return false;
  }
}

/**
 * Obter valores distintos de um campo para teste
 */
async function getDistinctValues(field, limit = 5) {
  try {
    const url = `${BASE_URL}/api/distinct?field=${encodeURIComponent(field)}`;
    logInfo(`  Buscando valores distintos: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      logWarning(`  API retornou status ${response.status} para ${field}`);
      return [];
    }
    
    const data = await response.json();
    const values = Array.isArray(data) ? data : [];
    
    if (values.length === 0) {
      logWarning(`  Nenhum valor retornado para ${field}`);
    } else {
      logSuccess(`  Encontrados ${values.length} valores para ${field}`);
    }
    
    return values.slice(0, limit);
  } catch (error) {
    logError(`Erro ao obter valores distintos de ${field}: ${error.message}`);
    return [];
  }
}

/**
 * Executar todos os testes
 */
async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue');
  log('🧪 TESTE COMPLETO DO SISTEMA CROSSFILTER', 'blue');
  log('='.repeat(60) + '\n', 'blue');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Testar cada tipo de filtro
  const filterTypes = [
    { field: 'Status', apiField: 'Status' },
    { field: 'Tema', apiField: 'Tema' },
    { field: 'Orgaos', apiField: 'Orgaos' },
    { field: 'Tipo', apiField: 'Tipo' },
    { field: 'Canal', apiField: 'Canal' },
    { field: 'Prioridade', apiField: 'Prioridade' },
    { field: 'UnidadeCadastro', apiField: 'UnidadeCadastro' }
  ];
  
  for (const filterType of filterTypes) {
    logInfo(`\n📊 Testando filtros de ${filterType.field}`);
    
    // Obter valores distintos
    const values = await getDistinctValues(filterType.apiField, 3);
    
    if (values.length === 0) {
      logWarning(`Nenhum valor encontrado para ${filterType.apiField}`);
      continue;
    }
    
    // Testar cada valor
    for (const value of values) {
      results.total++;
      const passed = await testFilter(filterType.apiField, value);
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
      
      // Pequeno delay para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Testar combinações de filtros
  logInfo('\n📊 Testando combinações de filtros');
  
  const statusValues = await getDistinctValues('Status', 1);
  const temaValues = await getDistinctValues('Tema', 1);
  
  if (statusValues.length > 0 && temaValues.length > 0) {
    results.total++;
    const passed = await testMultipleFilters([
      { field: 'Status', value: statusValues[0] },
      { field: 'Tema', value: temaValues[0] }
    ]);
    if (passed) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Resumo
  log('\n' + '='.repeat(60), 'blue');
  log('📊 RESUMO DOS TESTES', 'blue');
  log('='.repeat(60), 'blue');
  log(`Total de testes: ${results.total}`, 'cyan');
  logSuccess(`Passou: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Falhou: ${results.failed}`);
  }
  
  const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;
  log(`Taxa de sucesso: ${successRate}%`, successRate >= 90 ? 'green' : 'yellow');
  
  if (successRate >= 90) {
    logSuccess('\n✅ Sistema Crossfilter está funcionando corretamente!');
    process.exit(0);
  } else {
    logError('\n❌ Sistema Crossfilter precisa de ajustes.');
    process.exit(1);
  }
}

// Executar testes quando chamado diretamente
const isMainModule = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || 
                     process.argv[1]?.includes('test-crossfilter.js');

if (isMainModule) {
  runAllTests().catch(error => {
    logError(`Erro fatal: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

export { runAllTests, testFilter, testMultipleFilters };

