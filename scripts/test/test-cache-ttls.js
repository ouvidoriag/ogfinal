/**
 * Teste de Cache TTLs - Backend
 * Valida se cache-ttls.js está funcionando corretamente
 * 
 * REFATORAÇÃO: FASE 1 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

import { getTTL, getTTLByType, getDefaultTTL, CACHE_TTLS } from '../src/config/cache-ttls.js';

console.log('🧪 Iniciando testes de Cache TTLs (Backend)...\n');

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

// Teste 1: Verificar se funções estão disponíveis
test('Funções exportadas corretamente', () => {
  assert(typeof getTTL === 'function', 'getTTL deve ser uma função');
  assert(typeof getTTLByType === 'function', 'getTTLByType deve ser uma função');
  assert(typeof getDefaultTTL === 'function', 'getDefaultTTL deve ser uma função');
  assert(CACHE_TTLS !== undefined, 'CACHE_TTLS deve estar definido');
});

// Teste 2: Verificar TTL padrão
test('TTL padrão retorna 5 segundos', () => {
  const defaultTTL = getDefaultTTL();
  assert(defaultTTL === 5, `TTL padrão deve ser 5 segundos, mas foi ${defaultTTL}`);
});

// Teste 3: Verificar TTL por endpoint específico
test('TTL por endpoint específico', () => {
  const ttlDashboard = getTTL('/api/dashboard-data');
  assert(ttlDashboard === 5, `TTL para /api/dashboard-data deve ser 5s, mas foi ${ttlDashboard}s`);
  
  const ttlDistritos = getTTL('/api/distritos');
  assert(ttlDistritos === 1800, `TTL para /api/distritos deve ser 1800s (30min), mas foi ${ttlDistritos}s`);
  
  const ttlSummary = getTTL('/api/summary');
  assert(ttlSummary === 5, `TTL para /api/summary deve ser 5s, mas foi ${ttlSummary}s`);
  
  const ttlAggregate = getTTL('/api/aggregate');
  assert(ttlAggregate === 60, `TTL para /api/aggregate deve ser 60s, mas foi ${ttlAggregate}s`);
});

// Teste 4: Verificar TTL com wildcard
test('TTL com wildcard', () => {
  const ttlUnit1 = getTTL('/api/unit/123');
  assert(ttlUnit1 === 1800, `TTL para /api/unit/123 deve ser 1800s, mas foi ${ttlUnit1}s`);
  
  const ttlUnit2 = getTTL('/api/unit/abc');
  assert(ttlUnit2 === 1800, `TTL para /api/unit/abc deve ser 1800s, mas foi ${ttlUnit2}s`);
});

// Teste 5: Verificar TTL para endpoint desconhecido (fallback)
test('TTL fallback para endpoint desconhecido', () => {
  const ttlUnknown = getTTL('/api/unknown-endpoint');
  assert(ttlUnknown === 5, `TTL para endpoint desconhecido deve ser 5s (padrão), mas foi ${ttlUnknown}s`);
});

// Teste 6: Verificar getTTLByType
test('getTTLByType retorna TTLs corretos', () => {
  const ttlOverview = getTTLByType('overview');
  assert(ttlOverview === 5, `TTL para tipo 'overview' deve ser 5s, mas foi ${ttlOverview}s`);
  
  const ttlStatus = getTTLByType('status');
  assert(ttlStatus === 15, `TTL para tipo 'status' deve ser 15s, mas foi ${ttlStatus}s`);
  
  const ttlDistinct = getTTLByType('distinct');
  assert(ttlDistinct === 300, `TTL para tipo 'distinct' deve ser 300s (5min), mas foi ${ttlDistinct}s`);
  
  const ttlUnknown = getTTLByType('unknown-type');
  assert(ttlUnknown === 15, `TTL para tipo desconhecido deve ser 15s (default), mas foi ${ttlUnknown}s`);
});

// Teste 7: Verificar valores de CACHE_TTLS
test('CACHE_TTLS contém valores corretos', () => {
  assert(CACHE_TTLS.STATIC === 1800, `CACHE_TTLS.STATIC deve ser 1800s, mas foi ${CACHE_TTLS.STATIC}s`);
  assert(CACHE_TTLS.DYNAMIC === 5, `CACHE_TTLS.DYNAMIC deve ser 5s, mas foi ${CACHE_TTLS.DYNAMIC}s`);
  assert(CACHE_TTLS.ENDPOINTS['/api/dashboard-data'] === 5, 'ENDPOINTS deve conter /api/dashboard-data');
});

// Executar testes
console.log('Executando testes...\n');

for (const { name, fn } of tests) {
  try {
    fn();
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
  process.exit(0);
} else {
  console.error('⚠️ Alguns testes falharam');
  process.exit(1);
}

