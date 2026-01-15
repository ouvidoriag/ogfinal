/**
 * Script de Teste Completo - APIs, KPIs e Filtros
 * 
 * Testa 100% das funcionalidades:
 * - APIs de dados (dashboard-data, summary, records, etc.)
 * - KPIs e métricas
 * - Filtros crossfilter
 * - Endpoint /api/filter/aggregated
 * 
 * Execução: node NOVO/scripts/test/test-all-apis.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000; // 30 segundos

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Estatísticas de teste
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

/**
 * Função auxiliar para fazer requisições
 */
async function makeRequest(method, endpoint, body = null, headers = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const startTime = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      duration,
      headers: response.headers
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      duration
    };
  }
}

/**
 * Função de teste
 */
function test(name, testFn) {
  stats.total++;
  return async () => {
    try {
      console.log(`${colors.cyan}▶ ${name}${colors.reset}`);
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TEST_TIMEOUT)
        )
      ]);
      
      if (result.passed) {
        stats.passed++;
        console.log(`${colors.green}✓ PASSED${colors.reset} ${result.message || ''}`);
        if (result.duration) {
          console.log(`  ⏱️  ${result.duration}ms`);
        }
        return true;
      } else {
        stats.failed++;
        stats.errors.push({ name, error: result.error || 'Test failed' });
        console.log(`${colors.red}✗ FAILED${colors.reset} ${result.error || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      stats.failed++;
      stats.errors.push({ name, error: error.message });
      console.log(`${colors.red}✗ FAILED${colors.reset} ${error.message}`);
      return false;
    }
  };
}

/**
 * Validar estrutura de dados do dashboard
 */
function validateDashboardStructure(data) {
  const required = [
    'totalManifestations',
    'last7Days',
    'last30Days',
    'manifestationsByStatus',
    'manifestationsByTheme',
    'manifestationsByOrgan',
    'manifestationsByType',
    'manifestationsByChannel',
    'manifestationsByPriority',
    'manifestationsByUnit',
    'manifestationsByMonth',
    'manifestationsByDay'
  ];
  
  const missing = required.filter(key => !(key in data));
  if (missing.length > 0) {
    return { valid: false, error: `Campos faltando: ${missing.join(', ')}` };
  }
  
  // Validar tipos
  if (typeof data.totalManifestations !== 'number') {
    return { valid: false, error: 'totalManifestations deve ser número' };
  }
  
  if (!Array.isArray(data.manifestationsByStatus)) {
    return { valid: false, error: 'manifestationsByStatus deve ser array' };
  }
  
  return { valid: true };
}

/**
 * Validar estrutura de dados agregados filtrados
 */
function validateFilteredAggregatedStructure(data) {
  const validation = validateDashboardStructure(data);
  if (!validation.valid) {
    return validation;
  }
  
  // Validar estrutura dos itens de agregação
  if (data.manifestationsByStatus.length > 0) {
    const item = data.manifestationsByStatus[0];
    if (!('status' in item) || !('count' in item)) {
      return { valid: false, error: 'manifestationsByStatus items devem ter status e count' };
    }
  }
  
  return { valid: true };
}

// ============================================
// TESTES DE APIs
// ============================================

const tests = [
  // 1. Teste básico de conectividade
  test('Conectividade do servidor', async () => {
    const result = await makeRequest('GET', '/api/summary');
    return {
      passed: result.ok || result.status === 200,
      message: result.ok ? 'Servidor respondendo' : `Status: ${result.status}`,
      duration: result.duration,
      error: result.error || (result.ok ? null : `HTTP ${result.status}`)
    };
  }),
  
  // 2. Teste GET /api/dashboard-data
  test('GET /api/dashboard-data - Estrutura completa', async () => {
    const result = await makeRequest('GET', '/api/dashboard-data');
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const validation = validateDashboardStructure(result.data);
    if (!validation.valid) {
      return { passed: false, error: validation.error };
    }
    
    return {
      passed: true,
      message: `Total: ${result.data.totalManifestations}, Status: ${result.data.manifestationsByStatus.length}`,
      duration: result.duration,
      data: result.data
    };
  }),
  
  // 3. Teste GET /api/summary
  test('GET /api/summary - KPIs principais', async () => {
    const result = await makeRequest('GET', '/api/summary');
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const required = ['total', 'last7', 'last30', 'statusCounts'];
    const missing = required.filter(key => !(key in result.data));
    
    if (missing.length > 0) {
      return { passed: false, error: `Campos faltando: ${missing.join(', ')}` };
    }
    
    return {
      passed: true,
      message: `Total: ${result.data.total}, Últimos 7 dias: ${result.data.last7}`,
      duration: result.duration
    };
  }),
  
  // 4. Teste POST /api/filter/aggregated - Sem filtros
  test('POST /api/filter/aggregated - Sem filtros (estrutura vazia)', async () => {
    const result = await makeRequest('POST', '/api/filter/aggregated', {
      filters: []
    });
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const validation = validateFilteredAggregatedStructure(result.data);
    if (!validation.valid) {
      return { passed: false, error: validation.error };
    }
    
    if (result.data.totalManifestations !== 0) {
      return { passed: false, error: 'Sem filtros deveria retornar totalManifestations = 0' };
    }
    
    return {
      passed: true,
      message: 'Estrutura vazia retornada corretamente',
      duration: result.duration
    };
  }),
  
  // 5. Teste POST /api/filter/aggregated - Com filtro de Status
  test('POST /api/filter/aggregated - Filtro por Status', async () => {
    // Primeiro, buscar um status válido
    const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
    if (!dashboardResult.ok || !dashboardResult.data.manifestationsByStatus?.length) {
      return { passed: false, error: 'Não foi possível obter status válido' };
    }
    
    const testStatus = dashboardResult.data.manifestationsByStatus[0].status;
    
    const result = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [
        { field: 'Status', op: 'eq', value: testStatus }
      ]
    });
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const validation = validateFilteredAggregatedStructure(result.data);
    if (!validation.valid) {
      return { passed: false, error: validation.error };
    }
    
    // Verificar se o filtro foi aplicado corretamente
    const statusItem = result.data.manifestationsByStatus.find(s => s.status === testStatus);
    if (!statusItem) {
      return { passed: false, error: `Status filtrado (${testStatus}) não encontrado no resultado` };
    }
    
    return {
      passed: true,
      message: `Filtro aplicado: ${testStatus} (${statusItem.count} registros)`,
      duration: result.duration
    };
  }),
  
  // 6. Teste POST /api/filter/aggregated - Com filtro de Canal
  test('POST /api/filter/aggregated - Filtro por Canal', async () => {
    const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
    if (!dashboardResult.ok || !dashboardResult.data.manifestationsByChannel?.length) {
      return { passed: false, error: 'Não foi possível obter canal válido' };
    }
    
    const testChannel = dashboardResult.data.manifestationsByChannel[0].channel;
    
    const result = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [
        { field: 'Canal', op: 'eq', value: testChannel }
      ]
    });
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const validation = validateFilteredAggregatedStructure(result.data);
    if (!validation.valid) {
      return { passed: false, error: validation.error };
    }
    
    const channelItem = result.data.manifestationsByChannel.find(c => c.channel === testChannel);
    if (!channelItem) {
      return { passed: false, error: `Canal filtrado (${testChannel}) não encontrado no resultado` };
    }
    
    return {
      passed: true,
      message: `Filtro aplicado: ${testChannel} (${channelItem.count} registros)`,
      duration: result.duration
    };
  }),
  
  // 7. Teste POST /api/filter/aggregated - Múltiplos filtros
  test('POST /api/filter/aggregated - Múltiplos filtros simultâneos', async () => {
    const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
    if (!dashboardResult.ok) {
      return { passed: false, error: 'Não foi possível obter dados do dashboard' };
    }
    
    const status = dashboardResult.data.manifestationsByStatus[0]?.status;
    const channel = dashboardResult.data.manifestationsByChannel[0]?.channel;
    
    if (!status || !channel) {
      return { passed: false, error: 'Não há dados suficientes para teste' };
    }
    
    const result = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [
        { field: 'Status', op: 'eq', value: status },
        { field: 'Canal', op: 'eq', value: channel }
      ]
    });
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    const validation = validateFilteredAggregatedStructure(result.data);
    if (!validation.valid) {
      return { passed: false, error: validation.error };
    }
    
    // Verificar se ambos os filtros foram aplicados
    const statusItem = result.data.manifestationsByStatus.find(s => s.status === status);
    const channelItem = result.data.manifestationsByChannel.find(c => c.channel === channel);
    
    if (!statusItem || !channelItem) {
      return { passed: false, error: 'Filtros múltiplos não aplicados corretamente' };
    }
    
    return {
      passed: true,
      message: `Filtros: ${status} + ${channel} (Total: ${result.data.totalManifestations})`,
      duration: result.duration
    };
  }),
  
  // 8. Teste POST /api/filter - Filtro básico
  test('POST /api/filter - Filtro básico de registros', async () => {
    const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
    if (!dashboardResult.ok || !dashboardResult.data.manifestationsByStatus?.length) {
      return { passed: false, error: 'Não foi possível obter dados' };
    }
    
    const testStatus = dashboardResult.data.manifestationsByStatus[0].status;
    
    const result = await makeRequest('POST', '/api/filter', {
      filters: [
        { field: 'Status', op: 'eq', value: testStatus }
      ]
    });
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    if (!Array.isArray(result.data)) {
      return { passed: false, error: 'Resposta deve ser um array' };
    }
    
    return {
      passed: true,
      message: `${result.data.length} registros filtrados`,
      duration: result.duration
    };
  }),
  
  // 9. Teste GET /api/records - Paginação
  test('GET /api/records - Paginação básica', async () => {
    const result = await makeRequest('GET', '/api/records?page=1&limit=10');
    
    if (!result.ok) {
      return { passed: false, error: `HTTP ${result.status}: ${result.statusText}` };
    }
    
    if (!result.data || !Array.isArray(result.data.records || result.data)) {
      return { passed: false, error: 'Resposta deve conter array de registros' };
    }
    
    return {
      passed: true,
      message: `${(result.data.records || result.data).length} registros retornados`,
      duration: result.duration
    };
  }),
  
  // 10. Teste de performance - Comparar /api/dashboard-data vs /api/filter/aggregated
  test('Performance: Comparar dashboard-data vs filter/aggregated', async () => {
    const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
    if (!dashboardResult.ok) {
      return { passed: false, error: 'Dashboard-data falhou' };
    }
    
    const filteredResult = await makeRequest('POST', '/api/filter/aggregated', {
      filters: []
    });
    
    if (!filteredResult.ok) {
      return { passed: false, error: 'Filter/aggregated falhou' };
    }
    
    const dashboardTime = dashboardResult.duration;
    const filteredTime = filteredResult.duration;
    
    return {
      passed: true,
      message: `Dashboard: ${dashboardTime}ms, Filtered: ${filteredTime}ms`,
      duration: Math.max(dashboardTime, filteredTime)
    };
  })
];

/**
 * Executar todos os testes
 */
async function runAllTests() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTE COMPLETO - APIs, KPIs e FILTROS                    ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nBase URL: ${BASE_URL}\n`);
  
  const startTime = Date.now();
  
  for (const testFn of tests) {
    await testFn();
    console.log(''); // Linha em branco entre testes
  }
  
  const totalTime = Date.now() - startTime;
  
  // Resumo
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  RESUMO DOS TESTES                                         ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nTotal de testes: ${stats.total}`);
  console.log(`${colors.green}✓ Passou: ${stats.passed}${colors.reset}`);
  console.log(`${colors.red}✗ Falhou: ${stats.failed}${colors.reset}`);
  console.log(`⏱️  Tempo total: ${totalTime}ms\n`);
  
  if (stats.failed > 0) {
    console.log(`${colors.red}Erros encontrados:${colors.reset}`);
    stats.errors.forEach(({ name, error }) => {
      console.log(`  • ${name}: ${error}`);
    });
    console.log('');
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Todos os testes passaram!${colors.reset}\n`);
    process.exit(0);
  }
}

// Executar
runAllTests().catch(error => {
  console.error(`${colors.red}Erro fatal:${colors.reset}`, error);
  process.exit(1);
});

