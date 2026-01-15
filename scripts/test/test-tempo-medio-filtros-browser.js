/**
 * Script de Teste para Browser: Filtros de Mês na Página Tempo Médio
 * 
 * Este script deve ser executado no console do navegador na página de Tempo Médio
 * para testar se os filtros estão funcionando corretamente.
 * 
 * Como usar:
 * 1. Abra a página de Tempo Médio no navegador
 * 2. Abra o console do navegador (F12)
 * 3. Cole e execute este script
 */

(async function testTempoMedioFiltros() {
  console.log('%c🧪 TESTE DE FILTROS DE MÊS - PÁGINA TEMPO MÉDIO', 'color: cyan; font-size: 16px; font-weight: bold');
  console.log('='.repeat(60));
  
  // Verificar se estamos na página correta
  const page = document.getElementById('page-tempo-medio');
  if (!page || page.style.display === 'none') {
    console.error('❌ Página de Tempo Médio não encontrada ou não está visível');
    return;
  }
  
  // Obter mês de teste (último mês)
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const testMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  console.log(`📅 Mês de teste: ${testMonth}`);
  console.log('');
  
  // Teste 1: Verificar se o select de mês existe
  const selectMes = document.getElementById('filtroMesTempoMedio');
  if (!selectMes) {
    console.error('❌ Select de filtro de mês não encontrado');
    return;
  }
  
  console.log('✅ Select de filtro de mês encontrado');
  
  // Teste 2: Verificar endpoints sem filtro
  console.log('\n📊 Testando endpoints SEM filtro:');
  const endpoints = [
    '/api/stats/average-time',
    '/api/stats/average-time/by-day',
    '/api/stats/average-time/by-week',
    '/api/stats/average-time/by-unit',
    '/api/stats/average-time/by-month-unit'
  ];
  
  const resultsWithoutFilter = {};
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'include'
      });
      const data = await response.json();
      resultsWithoutFilter[endpoint] = {
        success: response.ok,
        count: Array.isArray(data) ? data.length : (data ? 1 : 0),
        sample: Array.isArray(data) && data.length > 0 ? data[0] : data
      };
      console.log(`  ✅ ${endpoint}: ${resultsWithoutFilter[endpoint].count} itens`);
    } catch (error) {
      resultsWithoutFilter[endpoint] = {
        success: false,
        error: error.message
      };
      console.error(`  ❌ ${endpoint}: ${error.message}`);
    }
  }
  
  // Teste 3: Verificar endpoints COM filtro
  console.log(`\n📊 Testando endpoints COM filtro (${testMonth}):`);
  const resultsWithFilter = {};
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}?meses=${encodeURIComponent(testMonth)}`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      const data = await response.json();
      resultsWithFilter[endpoint] = {
        success: response.ok,
        count: Array.isArray(data) ? data.length : (data ? 1 : 0),
        sample: Array.isArray(data) && data.length > 0 ? data[0] : data
      };
      console.log(`  ✅ ${url}: ${resultsWithFilter[endpoint].count} itens`);
    } catch (error) {
      resultsWithFilter[endpoint] = {
        success: false,
        error: error.message
      };
      console.error(`  ❌ ${endpoint}: ${error.message}`);
    }
  }
  
  // Teste 4: Comparar resultados
  console.log('\n📊 Comparando resultados:');
  let allDifferent = true;
  for (const endpoint of endpoints) {
    const without = resultsWithoutFilter[endpoint];
    const withFilter = resultsWithFilter[endpoint];
    
    if (without.success && withFilter.success) {
      if (without.count === withFilter.count && without.count > 0) {
        console.warn(`  ⚠️  ${endpoint}: Mesmo número de itens (${without.count})`);
        // Verificar se os dados são diferentes
        const withoutStr = JSON.stringify(without.sample);
        const withStr = JSON.stringify(withFilter.sample);
        if (withoutStr === withStr) {
          console.error(`    ❌ Dados são idênticos - filtro pode não estar funcionando`);
          allDifferent = false;
        } else {
          console.log(`    ✅ Dados são diferentes - filtro pode estar funcionando`);
        }
      } else if (withFilter.count < without.count) {
        console.log(`  ✅ ${endpoint}: Filtro funcionando (${without.count} → ${withFilter.count})`);
      } else {
        console.warn(`  ⚠️  ${endpoint}: Resultado inesperado (${without.count} → ${withFilter.count})`);
      }
    }
  }
  
  // Teste 5: Testar mudança de filtro no select
  console.log('\n📊 Testando mudança de filtro no select:');
  const originalValue = selectMes.value;
  
  // Verificar se o mês de teste está disponível no select
  let testMonthAvailable = false;
  for (let i = 0; i < selectMes.options.length; i++) {
    if (selectMes.options[i].value === testMonth) {
      testMonthAvailable = true;
      break;
    }
  }
  
  if (testMonthAvailable) {
    console.log(`  ✅ Mês de teste (${testMonth}) está disponível no select`);
    
    // Simular mudança de filtro
    console.log(`  🔄 Simulando mudança de filtro para ${testMonth}...`);
    selectMes.value = testMonth;
    
    // Disparar evento change
    const event = new Event('change', { bubbles: true });
    selectMes.dispatchEvent(event);
    
    console.log('  ✅ Evento change disparado');
    console.log('  ⏳ Aguardando 3 segundos para verificar se os dados foram atualizados...');
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se os gráficos foram atualizados
    const chartTempoMedio = window.Chart?.getChart('chartTempoMedio');
    const chartTempoMedioDia = window.Chart?.getChart('chartTempoMedioDia');
    const chartTempoMedioSemana = window.Chart?.getChart('chartTempoMedioSemana');
    
    if (chartTempoMedio) {
      console.log('  ✅ Gráfico principal (chartTempoMedio) existe');
    } else {
      console.warn('  ⚠️  Gráfico principal (chartTempoMedio) não encontrado');
    }
    
    if (chartTempoMedioDia) {
      console.log('  ✅ Gráfico diário (chartTempoMedioDia) existe');
    } else {
      console.warn('  ⚠️  Gráfico diário (chartTempoMedioDia) não encontrado');
    }
    
    if (chartTempoMedioSemana) {
      console.log('  ✅ Gráfico semanal (chartTempoMedioSemana) existe');
    } else {
      console.warn('  ⚠️  Gráfico semanal (chartTempoMedioSemana) não encontrado');
    }
    
    // Restaurar valor original
    selectMes.value = originalValue;
    selectMes.dispatchEvent(new Event('change', { bubbles: true }));
    console.log('  ✅ Valor original restaurado');
  } else {
    console.warn(`  ⚠️  Mês de teste (${testMonth}) não está disponível no select`);
    console.log('  💡 Tente selecionar um mês manualmente e verificar se os gráficos atualizam');
  }
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('%c📊 RESUMO DOS TESTES', 'color: blue; font-size: 14px; font-weight: bold');
  console.log('='.repeat(60));
  
  const totalTests = endpoints.length * 2;
  let passedTests = 0;
  
  for (const endpoint of endpoints) {
    if (resultsWithoutFilter[endpoint].success) passedTests++;
    if (resultsWithFilter[endpoint].success) passedTests++;
  }
  
  console.log(`Total de testes: ${totalTests}`);
  console.log(`✅ Passou: ${passedTests}`);
  console.log(`❌ Falhou: ${totalTests - passedTests}`);
  
  if (allDifferent && passedTests === totalTests) {
    console.log('%c\n🎉 Todos os testes passaram!', 'color: green; font-size: 14px; font-weight: bold');
  } else {
    console.warn('\n⚠️  Alguns testes falharam ou resultados são inesperados');
    console.log('💡 Verifique os logs acima para mais detalhes');
  }
  
  console.log('\n💡 Dica: Abra o Network tab do DevTools para verificar as requisições HTTP');
  console.log('   e verifique se os parâmetros ?meses= estão sendo enviados corretamente');
})();

