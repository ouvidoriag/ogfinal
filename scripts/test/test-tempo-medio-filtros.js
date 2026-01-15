/**
 * Script de Teste: Filtros de Mês na Página Tempo Médio
 * 
 * Este script testa se os endpoints estão respondendo corretamente aos filtros de mês
 * e se o frontend está passando os parâmetros corretamente.
 * 
 * Executar: node NOVO/scripts/test/test-tempo-medio-filtros.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

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

async function testEndpoint(endpoint, description, expectedMinItems = 0) {
  try {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`Testando: ${description}`, 'blue');
    log(`Endpoint: ${endpoint}`, 'cyan');
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      log(`❌ Erro HTTP: ${response.status} ${response.statusText}`, 'red');
      return false;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      log(`✅ Resposta recebida: ${data.length} itens`, 'green');
      if (data.length > 0) {
        log(`   Primeiro item: ${JSON.stringify(data[0]).substring(0, 100)}...`, 'yellow');
      }
      return data.length >= expectedMinItems;
    } else if (typeof data === 'object') {
      log(`✅ Resposta recebida: objeto com ${Object.keys(data).length} propriedades`, 'green');
      log(`   Propriedades: ${Object.keys(data).join(', ')}`, 'yellow');
      return true;
    } else {
      log(`⚠️  Resposta inesperada: ${typeof data}`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Erro ao testar endpoint: ${error.message}`, 'red');
    return false;
  }
}

async function testWithMonthFilter(baseEndpoint, month, description) {
  const endpoint = `${baseEndpoint}?meses=${encodeURIComponent(month)}`;
  return await testEndpoint(endpoint, `${description} (com filtro: ${month})`);
}

async function testWithoutMonthFilter(baseEndpoint, description) {
  return await testEndpoint(baseEndpoint, `${description} (sem filtro)`);
}

async function compareResults(endpointWithoutFilter, endpointWithFilter, month, description) {
  try {
    log(`\n${'='.repeat(60)}`, 'cyan');
    log(`Comparando: ${description}`, 'blue');
    
    const [responseWithout, responseWith] = await Promise.all([
      fetch(`${BASE_URL}${endpointWithoutFilter}`),
      fetch(`${BASE_URL}${endpointWithFilter}?meses=${encodeURIComponent(month)}`)
    ]);
    
    if (!responseWithout.ok || !responseWith.ok) {
      log(`❌ Erro em uma das requisições`, 'red');
      return false;
    }
    
    const dataWithout = await responseWithout.json();
    const dataWith = await responseWith.json();
    
    if (Array.isArray(dataWithout) && Array.isArray(dataWith)) {
      log(`Sem filtro: ${dataWithout.length} itens`, 'yellow');
      log(`Com filtro (${month}): ${dataWith.length} itens`, 'yellow');
      
      if (dataWith.length < dataWithout.length) {
        log(`✅ Filtro está funcionando (reduziu de ${dataWithout.length} para ${dataWith.length})`, 'green');
        return true;
      } else if (dataWith.length === dataWithout.length && dataWithout.length > 0) {
        log(`⚠️  Filtro não parece estar funcionando (mesmo número de itens)`, 'yellow');
        log(`   Verificando se os dados são diferentes...`, 'yellow');
        
        // Verificar se pelo menos os dados são diferentes
        const firstWithout = JSON.stringify(dataWithout[0]);
        const firstWith = JSON.stringify(dataWith[0]);
        if (firstWithout !== firstWith) {
          log(`✅ Dados são diferentes, filtro pode estar funcionando`, 'green');
          return true;
        } else {
          log(`❌ Dados são idênticos, filtro não está funcionando`, 'red');
          return false;
        }
      } else {
        log(`⚠️  Resultado inesperado`, 'yellow');
        return false;
      }
    } else {
      log(`⚠️  Respostas não são arrays`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ Erro ao comparar: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🧪 TESTE DE FILTROS DE MÊS - PÁGINA TEMPO MÉDIO', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Obter um mês recente para teste (último mês)
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const testMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  log(`\n📅 Mês de teste: ${testMonth}`, 'blue');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Teste 1: Endpoint principal (por órgão/unidade)
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time', 'Tempo Médio por Órgão/Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time', testMonth, 'Tempo Médio por Órgão/Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 2: Comparar resultados com e sem filtro
  results.total++;
  if (await compareResults(
    '/api/stats/average-time',
    '/api/stats/average-time',
    testMonth,
    'Tempo Médio por Órgão/Unidade'
  )) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 3: Endpoint by-day
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time/by-day', 'Tempo Médio por Dia')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time/by-day', testMonth, 'Tempo Médio por Dia')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 4: Endpoint by-week
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time/by-week', 'Tempo Médio por Semana')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time/by-week', testMonth, 'Tempo Médio por Semana')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 5: Endpoint by-unit
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time/by-unit', 'Tempo Médio por Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time/by-unit', testMonth, 'Tempo Médio por Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 6: Endpoint by-month-unit
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time/by-month-unit', 'Tempo Médio por Mês e Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time/by-month-unit', testMonth, 'Tempo Médio por Mês e Unidade')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Teste 7: Endpoint stats
  results.total++;
  if (await testWithoutMonthFilter('/api/stats/average-time/stats', 'Estatísticas de Tempo Médio')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  results.total++;
  if (await testWithMonthFilter('/api/stats/average-time/stats', testMonth, 'Estatísticas de Tempo Médio')) {
    results.passed++;
  } else {
    results.failed++;
  }
  
  // Resumo
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('📊 RESUMO DOS TESTES', 'blue');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`Total de testes: ${results.total}`, 'cyan');
  log(`✅ Passou: ${results.passed}`, 'green');
  log(`❌ Falhou: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`${'='.repeat(60)}`, 'cyan');
  
  if (results.failed === 0) {
    log('\n🎉 Todos os testes passaram!', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Alguns testes falharam. Verifique os logs acima.', 'yellow');
    process.exit(1);
  }
}

// Executar testes
main().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

