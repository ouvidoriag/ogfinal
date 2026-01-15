/**
 * Validação Final - Fases 1 e 2
 * Verifica se todas as mudanças foram aplicadas corretamente
 * 
 * REFATORAÇÃO: Validação
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

import { getTTL, getTTLByType, getDefaultTTL, CACHE_TTLS } from '../src/config/cache-ttls.js';
import { getTTL as smartCacheGetTTL } from '../src/utils/smartCache.js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Validando Fases 1 e 2...\n');

let errors = [];
let warnings = [];
let passed = 0;

function check(condition, message, isWarning = false) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    if (isWarning) {
      console.log(`⚠️  ${message}`);
      warnings.push(message);
    } else {
      console.error(`❌ ${message}`);
      errors.push(message);
    }
  }
}

// ============================================
// FASE 1: Unificação de TTLs
// ============================================

console.log('📋 FASE 1: Unificação de TTLs\n');

// 1.1 Verificar arquivos criados
const cacheConfigPath = path.join(process.cwd(), 'public/scripts/core/cache-config.js');
const cacheTtlsPath = path.join(process.cwd(), 'src/config/cache-ttls.js');

check(fs.existsSync(cacheConfigPath), 'cache-config.js existe (frontend)');
check(fs.existsSync(cacheTtlsPath), 'cache-ttls.js existe (backend)');

// 1.2 Verificar funções backend
check(typeof getTTL === 'function', 'getTTL exportado do backend');
check(typeof getTTLByType === 'function', 'getTTLByType exportado do backend');
check(typeof getDefaultTTL === 'function', 'getDefaultTTL exportado do backend');
check(CACHE_TTLS !== undefined, 'CACHE_TTLS exportado do backend');

// 1.3 Verificar valores de TTL
check(getDefaultTTL() === 5, 'TTL padrão = 5 segundos');
check(getTTL('/api/dashboard-data') === 5, 'TTL /api/dashboard-data = 5s');
check(getTTL('/api/distritos') === 1800, 'TTL /api/distritos = 1800s (30min)');
check(getTTLByType('overview') === 5, 'getTTLByType overview = 5s');
check(getTTLByType('distinct') === 300, 'getTTLByType distinct = 300s');

// 1.4 Verificar integração smartCache
try {
  const smartCacheTTL = smartCacheGetTTL('overview');
  check(smartCacheTTL === 5, 'smartCache.getTTL usa cache-ttls.js');
} catch (e) {
  check(false, 'smartCache.getTTL não funciona: ' + e.message);
}

// 1.5 Verificar arquivos frontend
const dataLoaderPath = path.join(process.cwd(), 'public/scripts/core/dataLoader.js');
const globalStorePath = path.join(process.cwd(), 'public/scripts/core/global-store.js');

if (fs.existsSync(dataLoaderPath)) {
  const dataLoaderContent = fs.readFileSync(dataLoaderPath, 'utf8');
  check(dataLoaderContent.includes('window.cacheConfig'), 'dataLoader.js usa window.cacheConfig');
  check(dataLoaderContent.includes('cache-config.js'), 'dataLoader.js menciona cache-config.js');
}

if (fs.existsSync(globalStorePath)) {
  const globalStoreContent = fs.readFileSync(globalStorePath, 'utf8');
  check(globalStoreContent.includes('window.cacheConfig'), 'global-store.js usa window.cacheConfig');
}

// 1.6 Verificar index.html
const indexHtmlPath = path.join(process.cwd(), 'public/index.html');
if (fs.existsSync(indexHtmlPath)) {
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  check(indexHtmlContent.includes('cache-config.js'), 'index.html carrega cache-config.js');
  
  // Verificar ordem: cache-config.js antes de dataLoader.js
  const cacheConfigIndex = indexHtmlContent.indexOf('cache-config.js');
  const dataLoaderIndex = indexHtmlContent.indexOf('dataLoader.js');
  if (cacheConfigIndex !== -1 && dataLoaderIndex !== -1) {
    check(cacheConfigIndex < dataLoaderIndex, 'cache-config.js carregado antes de dataLoader.js');
  }
}

console.log('\n');

// ============================================
// FASE 2: Otimização dataLoader × dataStore
// ============================================

console.log('📋 FASE 2: Otimização dataLoader × dataStore\n');

if (fs.existsSync(dataLoaderPath)) {
  const dataLoaderContent = fs.readFileSync(dataLoaderPath, 'utf8');
  
  // 2.1 Verificar documentação de responsabilidades
  check(
    dataLoaderContent.includes('dataLoader: fetch, retry, timeout') || 
    dataLoaderContent.includes('dataLoader:') ||
    dataLoaderContent.includes('REFATORAÇÃO FASE 2'),
    'dataLoader.js documenta responsabilidades'
  );
  
  // 2.2 Verificar que pendingRequests é deduplicação, não cache
  check(
    dataLoaderContent.includes('DEDUPLICAÇÃO') || 
    dataLoaderContent.includes('deduplicação') ||
    dataLoaderContent.includes('NÃO é cache'),
    'pendingRequests documentado como deduplicação (não cache)'
  );
  
  // 2.3 Verificar que cache é delegado para dataStore
  check(
    dataLoaderContent.includes('window.dataStore.get') || 
    dataLoaderContent.includes('dataStore.get'),
    'dataLoader usa dataStore.get para cache'
  );
  
  check(
    dataLoaderContent.includes('window.dataStore.set') || 
    dataLoaderContent.includes('dataStore.set'),
    'dataLoader usa dataStore.set para salvar cache'
  );
  
  // 2.4 Verificar comentários claros
  check(
    dataLoaderContent.includes('CACHE:') || 
    dataLoaderContent.includes('// CACHE'),
    'Comentários CACHE: presentes'
  );
  
  check(
    dataLoaderContent.includes('DEDUPLICAÇÃO:') || 
    dataLoaderContent.includes('// DEDUPLICAÇÃO'),
    'Comentários DEDUPLICAÇÃO: presentes'
  );
  
  // 2.5 Verificar que não há métodos de cache no dataLoader
  const hasCacheMethods = dataLoaderContent.includes('getCache') || 
                          dataLoaderContent.includes('clearCache') ||
                          dataLoaderContent.includes('cache =');
  check(!hasCacheMethods, 'dataLoader não tem métodos de cache próprios', true);
}

// 2.6 Verificar testes criados
const testDataLoaderPath = path.join(process.cwd(), 'public/scripts/test/test-dataloader-datastore.js');
check(fs.existsSync(testDataLoaderPath), 'test-dataloader-datastore.js existe');

console.log('\n');

// ============================================
// RESUMO FINAL
// ============================================

console.log('📊 RESUMO FINAL\n');
console.log(`✅ Validações passadas: ${passed}`);
console.log(`❌ Erros encontrados: ${errors.length}`);
console.log(`⚠️  Avisos: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('❌ ERROS:');
  errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  AVISOS:');
  warnings.forEach((warn, i) => console.log(`   ${i + 1}. ${warn}`));
  console.log('');
}

if (errors.length === 0) {
  console.log('🎉 Fases 1 e 2 estão COMPLETAS e VALIDADAS!');
  console.log('✅ Pronto para FASE 3');
  process.exit(0);
} else {
  console.error('❌ Fases 1 e 2 têm erros que precisam ser corrigidos');
  process.exit(1);
}

