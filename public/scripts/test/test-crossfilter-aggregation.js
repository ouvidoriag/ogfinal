/**
 * Teste Automatizado: Agregação de Dados Filtrados
 * 
 * Este script testa se a função aggregateFilteredData está processando
 * corretamente os dados retornados pela API /api/filter
 * 
 * Execute no console: testAggregation()
 */

(function() {
  'use strict';
  
  async function testAggregation() {
    console.log('🧪 Iniciando teste de agregação...\n');
    
    try {
      // 1. Buscar dados filtrados da API (simular filtro de canal)
      console.log('1️⃣ Buscando dados filtrados da API...');
      const filterResponse = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [
            { field: 'canal', op: 'eq', value: 'Presencial' }
          ]
        })
      });
      
      if (!filterResponse.ok) {
        throw new Error(`API retornou status ${filterResponse.status}`);
      }
      
      const filteredRows = await filterResponse.json();
      console.log(`✅ Recebidos ${filteredRows.length} registros da API`);
      
      if (filteredRows.length === 0) {
        console.warn('⚠️ Nenhum registro retornado. Teste não pode continuar.');
        return;
      }
      
      // 2. Analisar estrutura do primeiro registro
      console.log('\n2️⃣ Analisando estrutura do primeiro registro...');
      const firstRow = filteredRows[0];
      console.log('Chaves do objeto:', Object.keys(firstRow).slice(0, 20));
      console.log('Tem campo "data"?', !!firstRow.data);
      if (firstRow.data) {
        console.log('Chaves do objeto data:', Object.keys(firstRow.data).slice(0, 20));
      }
      
      // 3. Testar busca de campos
      console.log('\n3️⃣ Testando busca de campos...');
      const testFields = {
        status: firstRow.status || firstRow.data?.status || firstRow.Status || firstRow.data?.Status || 'NÃO ENCONTRADO',
        tema: firstRow.tema || firstRow.data?.tema || firstRow.Tema || firstRow.data?.Tema || 'NÃO ENCONTRADO',
        orgaos: firstRow.orgaos || firstRow.data?.orgaos || firstRow.Orgaos || firstRow.data?.Orgaos || 'NÃO ENCONTRADO',
        tipo: firstRow.tipoDeManifestacao || firstRow.data?.tipoDeManifestacao || firstRow.tipo || firstRow.data?.tipo || 'NÃO ENCONTRADO',
        canal: firstRow.canal || firstRow.data?.canal || firstRow.Canal || firstRow.data?.Canal || 'NÃO ENCONTRADO',
        prioridade: firstRow.prioridade || firstRow.data?.prioridade || firstRow.Prioridade || firstRow.data?.Prioridade || 'NÃO ENCONTRADO',
        unidade: firstRow.unidadeCadastro || firstRow.data?.unidadeCadastro || firstRow.UnidadeCadastro || firstRow.data?.UnidadeCadastro || 'NÃO ENCONTRADO'
      };
      
      console.log('Campos encontrados:', testFields);
      
      // 4. Testar função aggregateFilteredData
      console.log('\n4️⃣ Testando função aggregateFilteredData...');
      
      if (typeof window.aggregateFilteredData !== 'function') {
        throw new Error('window.aggregateFilteredData não é uma função!');
      }
      
      const aggregated = window.aggregateFilteredData(filteredRows);
      
      console.log('Resultado da agregação:', {
        total: aggregated.totalManifestations,
        last7Days: aggregated.last7Days,
        last30Days: aggregated.last30Days,
        byStatus: aggregated.manifestationsByStatus?.length || 0,
        byTheme: aggregated.manifestationsByTheme?.length || 0,
        byOrgan: aggregated.manifestationsByOrgan?.length || 0,
        byType: aggregated.manifestationsByType?.length || 0,
        byChannel: aggregated.manifestationsByChannel?.length || 0,
        byPriority: aggregated.manifestationsByPriority?.length || 0,
        byUnit: aggregated.manifestationsByUnit?.length || 0,
        byMonth: aggregated.manifestationsByMonth?.length || 0,
        byDay: aggregated.manifestationsByDay?.length || 0
      });
      
      // 5. Validar resultados
      console.log('\n5️⃣ Validando resultados...');
      const issues = [];
      
      if (aggregated.totalManifestations !== filteredRows.length) {
        issues.push(`Total incorreto: esperado ${filteredRows.length}, obtido ${aggregated.totalManifestations}`);
      }
      
      if (aggregated.manifestationsByStatus.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum status encontrado (manifestationsByStatus vazio)');
      }
      
      if (aggregated.manifestationsByTheme.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum tema encontrado (manifestationsByTheme vazio)');
      }
      
      if (aggregated.manifestationsByOrgan.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum órgão encontrado (manifestationsByOrgan vazio)');
      }
      
      if (aggregated.manifestationsByType.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum tipo encontrado (manifestationsByType vazio)');
      }
      
      if (aggregated.manifestationsByChannel.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum canal encontrado (manifestationsByChannel vazio)');
      }
      
      if (aggregated.manifestationsByMonth.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum mês encontrado (manifestationsByMonth vazio)');
      }
      
      if (aggregated.manifestationsByDay.length === 0 && filteredRows.length > 0) {
        issues.push('⚠️ Nenhum dia encontrado (manifestationsByDay vazio)');
      }
      
      // 6. Resultado final
      console.log('\n' + '='.repeat(60));
      if (issues.length === 0) {
        console.log('✅ TESTE PASSOU: Todos os dados foram agregados corretamente!');
        console.log(`   - Total de registros: ${aggregated.totalManifestations}`);
        console.log(`   - Status encontrados: ${aggregated.manifestationsByStatus.length}`);
        console.log(`   - Temas encontrados: ${aggregated.manifestationsByTheme.length}`);
        console.log(`   - Órgãos encontrados: ${aggregated.manifestationsByOrgan.length}`);
        console.log(`   - Tipos encontrados: ${aggregated.manifestationsByType.length}`);
        console.log(`   - Canais encontrados: ${aggregated.manifestationsByChannel.length}`);
        console.log(`   - Meses encontrados: ${aggregated.manifestationsByMonth.length}`);
        console.log(`   - Dias encontrados: ${aggregated.manifestationsByDay.length}`);
      } else {
        console.log('❌ TESTE FALHOU: Problemas encontrados:');
        issues.forEach(issue => console.log(`   - ${issue}`));
        console.log('\n💡 Dica: Verifique os logs do console para mais detalhes sobre a estrutura dos dados.');
      }
      console.log('='.repeat(60));
      
      return {
        success: issues.length === 0,
        issues,
        aggregated,
        testFields
      };
      
    } catch (error) {
      console.error('❌ Erro no teste:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Expor globalmente
  if (typeof window !== 'undefined') {
    window.testAggregation = testAggregation;
    console.log('✅ Script de teste carregado! Execute: testAggregation()');
  }
})();

