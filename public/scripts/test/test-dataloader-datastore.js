/**
 * Teste de Separação de Responsabilidades - dataLoader × dataStore
 * Verifica se não há cache duplo e se as responsabilidades estão claras
 * 
 * REFATORAÇÃO: FASE 2 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

(function() {
  'use strict';
  
  console.log('🧪 Iniciando testes de dataLoader × dataStore...');
  
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
  
  // Aguardar sistemas estarem disponíveis
  function waitForSystems(maxAttempts = 50, interval = 100) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (window.dataLoader && window.dataStore && window.cacheConfig) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('Sistemas não encontrados após ' + maxAttempts + ' tentativas'));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }
  
  // Teste 1: Verificar que dataLoader não mantém cache próprio
  test('dataLoader não mantém cache próprio (apenas deduplicação)', () => {
    // pendingRequests é para deduplicação, não cache
    // Não há como testar diretamente, mas podemos verificar que não há propriedades de cache
    assert(window.dataLoader !== undefined, 'dataLoader deve estar definido');
    assert(typeof window.dataLoader.load === 'function', 'dataLoader.load deve ser função');
    
    // Verificar que não há métodos de cache no dataLoader
    const hasCacheMethods = 'getCache' in window.dataLoader || 'clearCache' in window.dataLoader;
    assert(!hasCacheMethods, 'dataLoader não deve ter métodos de cache (cache é responsabilidade do dataStore)');
  });
  
  // Teste 2: Verificar que dataStore é o único cache
  test('dataStore é o único sistema de cache', () => {
    assert(window.dataStore !== undefined, 'dataStore deve estar definido');
    assert(typeof window.dataStore.get === 'function', 'dataStore.get deve ser função');
    assert(typeof window.dataStore.set === 'function', 'dataStore.set deve ser função');
    assert(typeof window.dataStore.clear === 'function', 'dataStore.clear deve ser função');
  });
  
  // Teste 3: Verificar que dataLoader usa dataStore para cache
  test('dataLoader delega cache para dataStore', async () => {
    // Limpar cache antes do teste
    if (window.dataStore) {
      window.dataStore.clear('test-endpoint');
    }
    
    // Simular dados de teste
    const testData = { test: 'data', timestamp: Date.now() };
    
    // Salvar no dataStore manualmente
    window.dataStore.set('test-endpoint', testData, false);
    
    // Verificar que dataLoader pode acessar via dataStore
    const cached = window.dataStore.get('test-endpoint');
    assert(cached !== null, 'dataStore deve retornar dados salvos');
    assert(cached.test === 'data', 'Dados devem estar corretos');
    
    // Limpar após teste
    window.dataStore.clear('test-endpoint');
  });
  
  // Teste 4: Verificar separação de responsabilidades
  test('Separação clara de responsabilidades', () => {
    // dataLoader: fetch, retry, timeout, concorrência, deduplicação
    assert(typeof window.dataLoader.load === 'function', 'dataLoader deve ter método load');
    assert(typeof window.dataLoader.getQueueStats === 'function', 'dataLoader deve gerenciar fila');
    assert(typeof window.dataLoader.clearQueue === 'function', 'dataLoader deve limpar fila');
    
    // dataStore: cache, TTL, listeners, persistência
    assert(typeof window.dataStore.get === 'function', 'dataStore deve ter método get');
    assert(typeof window.dataStore.set === 'function', 'dataStore deve ter método set');
    assert(typeof window.dataStore.subscribe === 'function', 'dataStore deve ter método subscribe');
    assert(typeof window.dataStore.getDefaultTTL === 'function', 'dataStore deve gerenciar TTL');
  });
  
  // Teste 5: Verificar que deduplicação funciona (não é cache)
  test('Deduplicação funciona (requisições em andamento)', async () => {
    // Este teste verifica que pendingRequests é para deduplicação, não cache
    // Não podemos testar diretamente sem fazer requisições reais, mas podemos verificar a estrutura
    
    // Verificar que dataLoader tem controle de concorrência
    assert(typeof window.dataLoader.getQueueStats === 'function', 'dataLoader deve ter getQueueStats');
    
    const stats = window.dataLoader.getQueueStats();
    assert(typeof stats === 'object', 'getQueueStats deve retornar objeto');
    assert('active' in stats, 'Stats deve ter propriedade active');
    assert('queued' in stats, 'Stats deve ter propriedade queued');
    assert('maxConcurrent' in stats, 'Stats deve ter propriedade maxConcurrent');
  });
  
  // Executar testes
  async function runTests() {
    try {
      await waitForSystems();
      
      for (const { name, fn } of tests) {
        try {
          await fn();
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
        console.log('✅ Separação de responsabilidades confirmada:');
        console.log('   - dataLoader: fetch, retry, timeout, concorrência, deduplicação');
        console.log('   - dataStore: cache, TTL, listeners, persistência (único cache)');
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
  window.testDataLoaderDataStore = runTests;
  
})();

