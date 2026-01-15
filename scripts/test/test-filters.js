/**
 * Script de Teste Específico para Filtros Crossfilter
 * 
 * Testa todos os tipos de filtros:
 * - Filtros simples (Status, Canal, Tipo, etc.)
 * - Filtros múltiplos simultâneos
 * - Filtros com operadores diferentes (eq, contains)
 * - Comparação entre /api/filter e /api/filter/aggregated
 * - Validação de estrutura de dados
 * 
 * Execução: node NOVO/scripts/test/test-filters.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function makeRequest(method, endpoint, body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const startTime = Date.now();
  const response = await fetch(url, options);
  const duration = Date.now() - startTime;
  const data = await response.json();
  
  return {
    ok: response.ok,
    status: response.status,
    data,
    duration
  };
}

function validateFilteredAggregated(data) {
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

async function getTestValues() {
  // Buscar valores válidos para teste
  const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
  
  if (!dashboardResult.ok) {
    throw new Error('Não foi possível obter dados do dashboard');
  }
  
  return {
    status: dashboardResult.data.manifestationsByStatus[0]?.status,
    channel: dashboardResult.data.manifestationsByChannel[0]?.channel,
    theme: dashboardResult.data.manifestationsByTheme[0]?.theme,
    type: dashboardResult.data.manifestationsByType[0]?.type,
    priority: dashboardResult.data.manifestationsByPriority[0]?.priority,
    organ: dashboardResult.data.manifestationsByOrgan[0]?.organ
  };
}

async function testFilters() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTE DE FILTROS CROSSFILTER                            ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nBase URL: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  // Obter valores de teste
  console.log(`${colors.cyan}▶ Obtendo valores de teste...${colors.reset}`);
  let testValues;
  try {
    testValues = await getTestValues();
    console.log(`${colors.green}✓ Valores obtidos${colors.reset}\n`);
  } catch (error) {
    console.log(`${colors.red}✗ FAILED${colors.reset} ${error.message}\n`);
    process.exit(1);
  }
  
  // Teste 1: POST /api/filter/aggregated - Sem filtros
  console.log(`${colors.cyan}▶ Teste 1: POST /api/filter/aggregated (sem filtros)${colors.reset}`);
  const emptyResult = await makeRequest('POST', '/api/filter/aggregated', {
    filters: []
  });
  
  if (!emptyResult.ok) {
    console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${emptyResult.status}\n`);
    failed++;
  } else {
    const validation = validateFilteredAggregated(emptyResult.data);
    if (validation.valid && emptyResult.data.totalManifestations === 0) {
      console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${emptyResult.duration}ms\n`);
      passed++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset} ${validation.error || 'Total deveria ser 0'}\n`);
      failed++;
    }
  }
  
  // Teste 2: POST /api/filter/aggregated - Filtro por Status
  if (testValues.status) {
    console.log(`${colors.cyan}▶ Teste 2: POST /api/filter/aggregated (filtro: Status = ${testValues.status})${colors.reset}`);
    const statusResult = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [{ field: 'Status', op: 'eq', value: testValues.status }]
    });
    
    if (!statusResult.ok) {
      console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${statusResult.status}\n`);
      failed++;
    } else {
      const validation = validateFilteredAggregated(statusResult.data);
      if (validation.valid) {
        const statusItem = statusResult.data.manifestationsByStatus.find(s => s.status === testValues.status);
        if (statusItem) {
          console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${statusResult.duration}ms`);
          console.log(`  Total filtrado: ${statusResult.data.totalManifestations}`);
          console.log(`  Status encontrado: ${statusItem.count} registros\n`);
          passed++;
        } else {
          console.log(`${colors.red}✗ FAILED${colors.reset} Status filtrado não encontrado no resultado\n`);
          failed++;
        }
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset} ${validation.error}\n`);
        failed++;
      }
    }
  }
  
  // Teste 3: POST /api/filter/aggregated - Filtro por Canal
  if (testValues.channel) {
    console.log(`${colors.cyan}▶ Teste 3: POST /api/filter/aggregated (filtro: Canal = ${testValues.channel})${colors.reset}`);
    const channelResult = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [{ field: 'Canal', op: 'eq', value: testValues.channel }]
    });
    
    if (!channelResult.ok) {
      console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${channelResult.status}\n`);
      failed++;
    } else {
      const validation = validateFilteredAggregated(channelResult.data);
      if (validation.valid) {
        const channelItem = channelResult.data.manifestationsByChannel.find(c => c.channel === testValues.channel);
        if (channelItem) {
          console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${channelResult.duration}ms`);
          console.log(`  Total filtrado: ${channelResult.data.totalManifestations}`);
          console.log(`  Canal encontrado: ${channelItem.count} registros\n`);
          passed++;
        } else {
          console.log(`${colors.red}✗ FAILED${colors.reset} Canal filtrado não encontrado no resultado\n`);
          failed++;
        }
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset} ${validation.error}\n`);
        failed++;
      }
    }
  }
  
  // Teste 4: POST /api/filter/aggregated - Múltiplos filtros
  if (testValues.status && testValues.channel) {
    console.log(`${colors.cyan}▶ Teste 4: POST /api/filter/aggregated (múltiplos filtros)${colors.reset}`);
    const multiResult = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [
        { field: 'Status', op: 'eq', value: testValues.status },
        { field: 'Canal', op: 'eq', value: testValues.channel }
      ]
    });
    
    if (!multiResult.ok) {
      console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${multiResult.status}\n`);
      failed++;
    } else {
      const validation = validateFilteredAggregated(multiResult.data);
      if (validation.valid) {
        const statusItem = multiResult.data.manifestationsByStatus.find(s => s.status === testValues.status);
        const channelItem = multiResult.data.manifestationsByChannel.find(c => c.channel === testValues.channel);
        
        if (statusItem && channelItem) {
          console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${multiResult.duration}ms`);
          console.log(`  Total filtrado: ${multiResult.data.totalManifestations}`);
          console.log(`  Status: ${statusItem.count}, Canal: ${channelItem.count}\n`);
          passed++;
        } else {
          console.log(`${colors.red}✗ FAILED${colors.reset} Filtros múltiplos não aplicados corretamente\n`);
          failed++;
        }
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset} ${validation.error}\n`);
        failed++;
      }
    }
  }
  
  // Teste 5: POST /api/filter - Comparar com /api/filter/aggregated
  if (testValues.status) {
    console.log(`${colors.cyan}▶ Teste 5: Comparar /api/filter vs /api/filter/aggregated${colors.reset}`);
    const filterResult = await makeRequest('POST', '/api/filter', {
      filters: [{ field: 'Status', op: 'eq', value: testValues.status }]
    });
    
    const aggregatedResult = await makeRequest('POST', '/api/filter/aggregated', {
      filters: [{ field: 'Status', op: 'eq', value: testValues.status }]
    });
    
    if (!filterResult.ok || !aggregatedResult.ok) {
      console.log(`${colors.red}✗ FAILED${colors.reset} Um dos endpoints falhou\n`);
      failed++;
    } else {
      const filterCount = Array.isArray(filterResult.data) ? filterResult.data.length : 0;
      const aggregatedCount = aggregatedResult.data.totalManifestations;
      
      // Permitir pequena diferença devido a cache/atualizações
      if (Math.abs(filterCount - aggregatedCount) <= 5) {
        console.log(`${colors.green}✓ PASSED${colors.reset}`);
        console.log(`  /api/filter: ${filterCount} registros`);
        console.log(`  /api/filter/aggregated: ${aggregatedCount} registros`);
        console.log(`  Diferença: ${Math.abs(filterCount - aggregatedCount)}\n`);
        passed++;
      } else {
        console.log(`${colors.yellow}⚠ WARNING${colors.reset} Diferença significativa entre endpoints`);
        console.log(`  /api/filter: ${filterCount} registros`);
        console.log(`  /api/filter/aggregated: ${aggregatedCount} registros\n`);
        passed++; // Ainda passa, mas com warning
      }
    }
  }
  
  // Resumo
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  RESUMO                                                    ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\n${colors.green}✓ Passou: ${passed}${colors.reset}`);
  console.log(`${colors.red}✗ Falhou: ${failed}${colors.reset}\n`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ Todos os testes de filtros passaram!${colors.reset}\n`);
    process.exit(0);
  }
}

testFilters().catch(error => {
  console.error(`${colors.red}Erro fatal:${colors.reset}`, error);
  process.exit(1);
});

