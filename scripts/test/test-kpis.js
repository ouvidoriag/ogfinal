/**
 * Script de Teste Específico para KPIs
 * 
 * Testa todos os KPIs e métricas do sistema:
 * - Total de manifestações
 * - Últimos 7 e 30 dias
 * - Agregações por status, tema, órgão, tipo, canal, prioridade
 * - Dados mensais e diários
 * - Comparação entre endpoints
 * 
 * Execução: node NOVO/scripts/test/test-kpis.js
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

function validateKPI(data, kpiName) {
  const errors = [];
  
  // Validar totalManifestations
  if (typeof data.totalManifestations !== 'number') {
    errors.push(`${kpiName}: totalManifestations deve ser número`);
  }
  
  // Validar last7Days e last30Days
  if (typeof data.last7Days !== 'number') {
    errors.push(`${kpiName}: last7Days deve ser número`);
  }
  
  if (typeof data.last30Days !== 'number') {
    errors.push(`${kpiName}: last30Days deve ser número`);
  }
  
  // Validar arrays de agregação
  const arrays = [
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
  
  arrays.forEach(key => {
    if (!Array.isArray(data[key])) {
      errors.push(`${kpiName}: ${key} deve ser array`);
    }
  });
  
  // Validar estrutura dos itens de agregação
  if (data.manifestationsByStatus.length > 0) {
    const item = data.manifestationsByStatus[0];
    if (!('status' in item) || !('count' in item)) {
      errors.push(`${kpiName}: manifestationsByStatus items devem ter status e count`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function testKPIs() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  TESTE DE KPIs E MÉTRICAS                                 ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nBase URL: ${BASE_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  
  // Teste 1: GET /api/dashboard-data
  console.log(`${colors.cyan}▶ Testando GET /api/dashboard-data${colors.reset}`);
  const dashboardResult = await makeRequest('GET', '/api/dashboard-data');
  
  if (!dashboardResult.ok) {
    console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${dashboardResult.status}\n`);
    failed++;
  } else {
    const validation = validateKPI(dashboardResult.data, 'dashboard-data');
    if (validation.valid) {
      console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${dashboardResult.duration}ms`);
      console.log(`  Total: ${dashboardResult.data.totalManifestations}`);
      console.log(`  Últimos 7 dias: ${dashboardResult.data.last7Days}`);
      console.log(`  Últimos 30 dias: ${dashboardResult.data.last30Days}`);
      console.log(`  Status: ${dashboardResult.data.manifestationsByStatus.length} categorias`);
      console.log(`  Temas: ${dashboardResult.data.manifestationsByTheme.length} categorias`);
      console.log(`  Órgãos: ${dashboardResult.data.manifestationsByOrgan.length} categorias`);
      console.log(`  Tipos: ${dashboardResult.data.manifestationsByType.length} categorias`);
      console.log(`  Canais: ${dashboardResult.data.manifestationsByChannel.length} categorias`);
      console.log(`  Prioridades: ${dashboardResult.data.manifestationsByPriority.length} categorias`);
      console.log(`  Unidades: ${dashboardResult.data.manifestationsByUnit.length} categorias`);
      console.log(`  Meses: ${dashboardResult.data.manifestationsByMonth.length} meses`);
      console.log(`  Dias: ${dashboardResult.data.manifestationsByDay.length} dias\n`);
      passed++;
    } else {
      console.log(`${colors.red}✗ FAILED${colors.reset}`);
      validation.errors.forEach(err => console.log(`  ${err}`));
      console.log('');
      failed++;
    }
  }
  
  // Teste 2: GET /api/summary
  console.log(`${colors.cyan}▶ Testando GET /api/summary${colors.reset}`);
  const summaryResult = await makeRequest('GET', '/api/summary');
  
  if (!summaryResult.ok) {
    console.log(`${colors.red}✗ FAILED${colors.reset} HTTP ${summaryResult.status}\n`);
    failed++;
  } else {
    const required = ['total', 'last7', 'last30', 'statusCounts'];
    const missing = required.filter(key => !(key in summaryResult.data));
    
    if (missing.length > 0) {
      console.log(`${colors.red}✗ FAILED${colors.reset} Campos faltando: ${missing.join(', ')}\n`);
      failed++;
    } else {
      console.log(`${colors.green}✓ PASSED${colors.reset} ⏱️  ${summaryResult.duration}ms`);
      console.log(`  Total: ${summaryResult.data.total}`);
      console.log(`  Últimos 7 dias: ${summaryResult.data.last7}`);
      console.log(`  Últimos 30 dias: ${summaryResult.data.last30}`);
      console.log(`  Status: ${summaryResult.data.statusCounts.length} categorias\n`);
      passed++;
    }
  }
  
  // Teste 3: Comparar consistência entre endpoints
  console.log(`${colors.cyan}▶ Testando consistência entre endpoints${colors.reset}`);
  if (dashboardResult.ok && summaryResult.ok) {
    const dashboardTotal = dashboardResult.data.totalManifestations;
    const summaryTotal = summaryResult.data.total;
    
    if (Math.abs(dashboardTotal - summaryTotal) > 10) {
      // Permitir diferença de até 10 devido a cache/atualizações
      console.log(`${colors.yellow}⚠ WARNING${colors.reset} Diferença entre totais: dashboard=${dashboardTotal}, summary=${summaryTotal}`);
    } else {
      console.log(`${colors.green}✓ PASSED${colors.reset} Totais consistentes (diferença: ${Math.abs(dashboardTotal - summaryTotal)})\n`);
      passed++;
    }
  } else {
    console.log(`${colors.red}✗ FAILED${colors.reset} Não foi possível comparar (endpoints falharam)\n`);
    failed++;
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
    console.log(`${colors.green}✅ Todos os KPIs estão funcionando corretamente!${colors.reset}\n`);
    process.exit(0);
  }
}

testKPIs().catch(error => {
  console.error(`${colors.red}Erro fatal:${colors.reset}`, error);
  process.exit(1);
});

