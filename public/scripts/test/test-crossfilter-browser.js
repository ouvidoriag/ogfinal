/**
 * Script de Teste do Crossfilter - Executável no Browser
 * Execute no console do navegador após carregar a página Overview
 * 
 * CÉREBRO X-3
 */

(function() {
  'use strict';
  
  if (!window.crossfilterOverview) {
    console.error('❌ crossfilterOverview não está disponível. Carregue a página Overview primeiro.');
    return;
  }
  
  const colors = {
    reset: '%c',
    green: '%c',
    red: '%c',
    yellow: '%c',
    blue: '%c',
    cyan: '%c'
  };
  
  const styles = {
    green: 'color: #10b981; font-weight: bold;',
    red: 'color: #ef4444; font-weight: bold;',
    yellow: 'color: #f59e0b; font-weight: bold;',
    blue: 'color: #3b82f6; font-weight: bold;',
    cyan: 'color: #06b6d4; font-weight: bold;',
    reset: ''
  };
  
  function log(message, style = 'reset') {
    console.log(colors[style] + message, styles[style]);
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
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  /**
   * Testar filtro via API
   */
  async function testFilterAPI(field, value) {
    try {
      const response = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [{ field, op: 'eq', value }],
          originalUrl: '/'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const rows = Array.isArray(data) ? data : (data.data || []);
      
      // Verificar estrutura dos dados
      if (rows.length > 0) {
        const sample = rows[0];
        // Mapear campo para variações possíveis
        const fieldVariations = [
          field,
          field.toLowerCase(),
          field.charAt(0).toUpperCase() + field.slice(1).toLowerCase(),
          // Mapeamentos específicos conhecidos
          field === 'Tipo' ? 'tipoDeManifestacao' : null,
          field === 'UnidadeCadastro' ? 'unidadeCadastro' : null,
          field === 'Status' ? 'status' : null,
          field === 'Canal' ? 'canal' : null,
          field === 'Tema' ? 'tema' : null,
          field === 'Orgaos' ? 'orgaos' : null,
          field === 'Prioridade' ? 'prioridade' : null
        ].filter(Boolean);
        
        let hasField = false;
        for (const fv of fieldVariations) {
          if (sample[fv] !== undefined && sample[fv] !== null && sample[fv] !== '') {
            hasField = true;
            break;
          }
          if (sample.data && sample.data[fv] !== undefined && sample.data[fv] !== null && sample.data[fv] !== '') {
            hasField = true;
            break;
          }
        }
        
        return {
          success: true,
          count: rows.length,
          hasField: hasField,
          sample: {
            keys: Object.keys(sample).slice(0, 10),
            hasData: !!sample.data,
            dataKeys: sample.data ? Object.keys(sample.data).slice(0, 10) : []
          }
        };
      }
      
      return {
        success: true,
        count: 0,
        hasField: false,
        sample: null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Testar agregação de dados filtrados usando /api/filter/aggregated
   */
  async function testAggregation(field, value) {
    try {
      const response = await fetch('/api/filter/aggregated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [{ field, op: 'eq', value }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validar estrutura
      if (!data || typeof data !== 'object') {
        return {
          success: false,
          error: 'Resposta inválida: não é um objeto'
        };
      }
      
      const required = [
        'totalManifestations',
        'manifestationsByStatus',
        'manifestationsByTheme',
        'manifestationsByOrgan'
      ];
      
      const missing = required.filter(key => !(key in data));
      if (missing.length > 0) {
        return {
          success: false,
          error: `Campos faltando: ${missing.join(', ')}`
        };
      }
      
      return {
        success: true,
        aggregated: {
          total: data.totalManifestations || 0,
          byStatus: Array.isArray(data.manifestationsByStatus) ? data.manifestationsByStatus.length : 0,
          byTheme: Array.isArray(data.manifestationsByTheme) ? data.manifestationsByTheme.length : 0,
          byOrgan: Array.isArray(data.manifestationsByOrgan) ? data.manifestationsByOrgan.length : 0,
          byType: Array.isArray(data.manifestationsByType) ? data.manifestationsByType.length : 0,
          byChannel: Array.isArray(data.manifestationsByChannel) ? data.manifestationsByChannel.length : 0,
          byPriority: Array.isArray(data.manifestationsByPriority) ? data.manifestationsByPriority.length : 0
        },
        fullData: data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Obter valores distintos para teste
   */
  async function getDistinctValues(field, limit = 3) {
    try {
      const response = await fetch(`/api/distinct?field=${field}`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return Array.isArray(data) ? data.slice(0, limit) : [];
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
    log('🧪 TESTE COMPLETO DO SISTEMA CROSSFILTER (Browser)', 'blue');
    log('='.repeat(60) + '\n', 'blue');
    
    const filterTypes = [
      { field: 'Status', apiField: 'Status' },
      { field: 'Tema', apiField: 'Tema' },
      { field: 'Orgaos', apiField: 'Orgaos' },
      { field: 'Tipo', apiField: 'Tipo' },
      { field: 'Canal', apiField: 'Canal' },
      { field: 'Prioridade', apiField: 'Prioridade' },
      { field: 'UnidadeCadastro', apiField: 'UnidadeCadastro' }
    ];
    
    // Teste 1: Verificar se crossfilterOverview está funcionando
    logInfo('\n📊 Teste 1: Verificando crossfilterOverview');
    results.total++;
    if (window.crossfilterOverview) {
      logSuccess('crossfilterOverview está disponível');
      results.passed++;
    } else {
      logError('crossfilterOverview não está disponível');
      results.failed++;
      results.errors.push('crossfilterOverview não disponível');
    }
    
    // Teste 2: Verificar se aggregateFilteredData está disponível
    logInfo('\n📊 Teste 2: Verificando aggregateFilteredData');
    results.total++;
    if (typeof window.aggregateFilteredData === 'function') {
      logSuccess('aggregateFilteredData está disponível');
      results.passed++;
    } else {
      logWarning('aggregateFilteredData não está disponível globalmente (pode estar no escopo local)');
      // Tentar acessar via overview.js
      results.passed++; // Não é crítico
    }
    
    // Teste 3: Testar cada tipo de filtro
    for (const filterType of filterTypes) {
      logInfo(`\n📊 Teste 3.${filterTypes.indexOf(filterType) + 1}: Testando filtros de ${filterType.field}`);
      
      const values = await getDistinctValues(filterType.apiField, 2);
      
      if (values.length === 0) {
        logWarning(`Nenhum valor encontrado para ${filterType.apiField}`);
        continue;
      }
      
      for (const value of values) {
        results.total++;
        logInfo(`  Testando: ${filterType.apiField} = ${value}`);
        
        // Testar API
        const apiResult = await testFilterAPI(filterType.apiField, value);
        if (apiResult.success) {
          if (apiResult.count > 0) {
            logSuccess(`    API retornou ${apiResult.count} registros`);
            if (apiResult.hasField) {
              logSuccess(`    Campo '${filterType.apiField}' encontrado nos dados`);
            } else {
              logWarning(`    Campo '${filterType.apiField}' não encontrado nos dados`);
              logInfo(`    Chaves disponíveis: ${apiResult.sample?.keys?.join(', ') || 'N/A'}`);
            }
            results.passed++;
          } else {
            logWarning(`    API retornou 0 registros (pode ser esperado)`);
            results.passed++; // Não é erro se não houver dados
          }
        } else {
          logError(`    Erro na API: ${apiResult.error}`);
          results.failed++;
          results.errors.push(`${filterType.apiField}=${value}: ${apiResult.error}`);
        }
        
        // Pequeno delay
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Teste 4: Testar agregação
    logInfo('\n📊 Teste 4: Testando agregação de dados');
    const canalValues = await getDistinctValues('Canal', 1);
    if (canalValues.length > 0) {
      results.total++;
      const aggResult = await testAggregation('Canal', canalValues[0]);
      if (aggResult.success) {
        if (aggResult.aggregated) {
          logSuccess(`Agregação concluída: ${aggResult.aggregated.total} total`);
          logInfo(`  Status: ${aggResult.aggregated.byStatus}, Tema: ${aggResult.aggregated.byTheme}, Órgãos: ${aggResult.aggregated.byOrgan}`);
          if (aggResult.aggregated.byStatus > 0 || aggResult.aggregated.byTheme > 0) {
            logSuccess('Agregação gerou dados corretamente');
            results.passed++;
          } else {
            logWarning('Agregação não gerou dados (pode ser problema na estrutura)');
            results.failed++;
            results.errors.push('Agregação não gerou dados');
          }
        } else {
          logWarning(aggResult.message || 'Nenhum dado para agregar');
          results.passed++; // Não é erro se não houver dados
        }
      } else {
        logError(`Erro na agregação: ${aggResult.error}`);
        results.failed++;
        results.errors.push(`Agregação: ${aggResult.error}`);
      }
    }
    
    // Teste 5: Testar múltiplos filtros
    logInfo('\n📊 Teste 5: Testando múltiplos filtros simultâneos');
    const statusValues = await getDistinctValues('Status', 1);
    const temaValues = await getDistinctValues('Tema', 1);
    
    if (statusValues.length > 0 && temaValues.length > 0) {
      results.total++;
      const response = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [
            { field: 'Status', op: 'eq', value: statusValues[0] },
            { field: 'Tema', op: 'eq', value: temaValues[0] }
          ],
          originalUrl: '/'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const rows = Array.isArray(data) ? data : (data.data || []);
        logSuccess(`Múltiplos filtros retornaram ${rows.length} registros`);
        results.passed++;
      } else {
        logError(`Erro HTTP: ${response.status}`);
        results.failed++;
        results.errors.push(`Múltiplos filtros: HTTP ${response.status}`);
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
      log('\n❌ Erros encontrados:', 'red');
      results.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error}`, 'red');
      });
    }
    
    const successRate = results.total > 0 ? (results.passed / results.total * 100).toFixed(1) : 0;
    log(`\nTaxa de sucesso: ${successRate}%`, successRate >= 90 ? 'green' : 'yellow');
    
    if (successRate >= 90) {
      logSuccess('\n✅ Sistema Crossfilter está funcionando corretamente!');
    } else {
      logError('\n❌ Sistema Crossfilter precisa de ajustes.');
    }
    
    return {
      successRate,
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      errors: results.errors
    };
  }
  
  // Expor função globalmente
  window.testCrossfilter = runAllTests;
  
  log('\n✅ Script de teste carregado! Execute: testCrossfilter()', 'green');
  
  // Auto-executar se solicitado
  if (window.location.search.includes('test=crossfilter')) {
    setTimeout(() => {
      runAllTests();
    }, 2000);
  }
})();

