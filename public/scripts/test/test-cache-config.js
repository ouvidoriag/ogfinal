/**
 * Teste de Consistência de TTLs
 * Verifica se cache-config.js está funcionando corretamente
 * 
 * REFATORAÇÃO: FASE 1 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

(function() {
  'use strict';
  
  console.log('🧪 Iniciando testes de Cache Config...');
  
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
  
  // Aguardar cache-config estar disponível
  function waitForCacheConfig(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (window.cacheConfig) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('cacheConfig não encontrado após ' + maxAttempts + ' tentativas'));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }
  
  // Teste 1: Verificar se cache-config está disponível
  test('cache-config disponível', () => {
    assert(window.cacheConfig !== undefined, 'window.cacheConfig deve estar definido');
    assert(window.cacheConfig.getTTL !== undefined, 'window.cacheConfig.getTTL deve estar definido');
    assert(window.cacheConfig.getDefaultTTL !== undefined, 'window.cacheConfig.getDefaultTTL deve estar definido');
  });
  
  // Teste 2: Verificar TTL padrão
  test('TTL padrão correto', () => {
    const defaultTTL = window.cacheConfig.getDefaultTTL();
    assert(defaultTTL === 5000, `TTL padrão deve ser 5000ms, mas foi ${defaultTTL}ms`);
  });
  
  // Teste 3: Verificar TTL por endpoint específico
  test('TTL por endpoint específico', () => {
    const ttlDashboard = window.cacheConfig.getTTL('/api/dashboard-data');
    assert(ttlDashboard === 5000, `TTL para /api/dashboard-data deve ser 5000ms, mas foi ${ttlDashboard}ms`);
    
    const ttlDistritos = window.cacheConfig.getTTL('/api/distritos');
    assert(ttlDistritos === 30 * 60 * 1000, `TTL para /api/distritos deve ser ${30 * 60 * 1000}ms, mas foi ${ttlDistritos}ms`);
    
    const ttlSummary = window.cacheConfig.getTTL('/api/summary');
    assert(ttlSummary === 5000, `TTL para /api/summary deve ser 5000ms, mas foi ${ttlSummary}ms`);
  });
  
  // Teste 4: Verificar TTL com wildcard
  test('TTL com wildcard', () => {
    const ttlUnit = window.cacheConfig.getTTL('/api/unit/123');
    assert(ttlUnit === 30 * 60 * 1000, `TTL para /api/unit/* deve ser ${30 * 60 * 1000}ms, mas foi ${ttlUnit}ms`);
  });
  
  // Teste 5: Verificar TTL para endpoint desconhecido (fallback)
  test('TTL fallback para endpoint desconhecido', () => {
    const ttlUnknown = window.cacheConfig.getTTL('/api/unknown-endpoint');
    assert(ttlUnknown === 5000, `TTL para endpoint desconhecido deve ser 5000ms (padrão), mas foi ${ttlUnknown}ms`);
  });
  
  // Teste 6: Verificar integração com dataStore
  test('Integração com dataStore', () => {
    if (window.dataStore && window.dataStore.getDefaultTTL) {
      const dataStoreTTL = window.dataStore.getDefaultTTL();
      const cacheConfigTTL = window.cacheConfig.getDefaultTTL();
      assert(dataStoreTTL === cacheConfigTTL, 
        `dataStore.getDefaultTTL() (${dataStoreTTL}ms) deve ser igual a cacheConfig.getDefaultTTL() (${cacheConfigTTL}ms)`);
    }
  });
  
  // Executar testes
  async function runTests() {
    try {
      await waitForCacheConfig();
      
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
  window.testCacheConfig = runTests;
  
})();

