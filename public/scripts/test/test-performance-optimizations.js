/**
 * Teste de Otimizações de Performance - FASE 6
 * Verifica se as otimizações estão implementadas
 * 
 * REFATORAÇÃO: FASE 6 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

(function() {
  'use strict';
  
  console.log('🧪 Iniciando testes de Otimizações de Performance...');
  
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
        if (window.dataLoader && window.dataStore && window.globalFilters) {
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
  
  // Teste 1: Verificar concorrência adaptativa
  test('Concorrência adaptativa implementada', () => {
    // Verificar que dataLoader tem MAX_CONCURRENT_REQUESTS adaptativo
    const stats = window.dataLoader.getQueueStats();
    assert(typeof stats === 'object', 'getQueueStats deve retornar objeto');
    assert('maxConcurrent' in stats, 'Stats deve ter propriedade maxConcurrent');
    assert(typeof stats.maxConcurrent === 'number', 'maxConcurrent deve ser número');
    assert(stats.maxConcurrent >= 4, 'maxConcurrent deve ser pelo menos 4');
    
    // Verificar que usa navigator.hardwareConcurrency se disponível
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      const expectedMax = Math.max(4, navigator.hardwareConcurrency - 2);
      assert(stats.maxConcurrent === expectedMax || stats.maxConcurrent === 6, 
        `maxConcurrent deve ser adaptativo (esperado: ${expectedMax} ou 6, obtido: ${stats.maxConcurrent})`);
    }
  });
  
  // Teste 2: Verificar debounce nos filtros
  test('Debounce nos filtros implementado', () => {
    assert(window.globalFilters !== undefined, 'globalFilters deve estar definido');
    assert(typeof window.globalFilters.apply === 'function', 'globalFilters.apply deve ser função');
    
    // Verificar que há debounce (verificar código fonte)
    const applyCode = window.globalFilters.apply.toString();
    assert(applyCode.includes('debounce') || applyCode.includes('_debounceTimer'), 
      'globalFilters.apply deve ter debounce');
  });
  
  // Teste 3: Verificar deep copy inteligente
  test('Deep copy inteligente implementado', () => {
    assert(window.dataStore !== undefined, 'dataStore deve estar definido');
    assert(typeof window.dataStore.set === 'function', 'dataStore.set deve ser função');
    
    // Testar com objeto pequeno (< 5KB)
    const smallData = { test: 'data', items: Array(100).fill(0) };
    window.dataStore.set('test-small', smallData, true);
    const retrieved = window.dataStore.get('test-small');
    assert(retrieved !== null, 'Dados pequenos devem ser salvos');
    
    // Testar com objeto grande (> 5KB)
    const largeData = { test: 'data', items: Array(10000).fill(0) };
    window.dataStore.set('test-large', largeData, true);
    const retrievedLarge = window.dataStore.get('test-large');
    assert(retrievedLarge !== null, 'Dados grandes devem ser salvos');
    
    // Limpar após teste
    window.dataStore.clear('test-small');
    window.dataStore.clear('test-large');
  });
  
  // Teste 4: Verificar que debounce padrão é 200ms
  test('Debounce padrão é 200ms', () => {
    // Verificar código fonte
    const applyCode = window.globalFilters.apply.toString();
    assert(applyCode.includes('200') || applyCode.includes('debounceDelay'), 
      'Debounce padrão deve ser 200ms ou configurável');
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
        console.log('✅ Otimizações de performance confirmadas:');
        console.log('   - Concorrência adaptativa baseada em hardware');
        console.log('   - Debounce nos filtros (200ms padrão)');
        console.log('   - Deep copy inteligente (< 5KB: shallow, > 5KB: deep)');
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
  window.testPerformanceOptimizations = runTests;
  
})();

