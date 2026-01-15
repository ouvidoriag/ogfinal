/**
 * Teste Automatizado: Agregação de Dados Filtrados
 * Executa automaticamente e valida o sistema
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testAggregation() {
  console.log('🧪 Iniciando teste automatizado de agregação...\n');
  
  let passed = 0;
  let failed = 0;
  const issues = [];
  
  try {
    // 1. Buscar dados filtrados da API (simular filtro de canal)
    console.log('1️⃣ Buscando dados filtrados da API...');
    const filterResponse = await fetch(`${API_BASE}/api/filter`, {
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
      return { success: false, reason: 'Nenhum registro retornado' };
    }
    
    passed++;
    
    // 2. Analisar estrutura do primeiro registro
    console.log('\n2️⃣ Analisando estrutura do primeiro registro...');
    const firstRow = filteredRows[0];
    const rowKeys = Object.keys(firstRow);
    console.log(`   Chaves do objeto: ${rowKeys.slice(0, 10).join(', ')}... (${rowKeys.length} total)`);
    console.log(`   Tem campo "data"? ${!!firstRow.data}`);
    
    if (firstRow.data) {
      const dataKeys = Object.keys(firstRow.data);
      console.log(`   Chaves do objeto data: ${dataKeys.slice(0, 10).join(', ')}... (${dataKeys.length} total)`);
    }
    
    // 3. Testar busca de campos
    console.log('\n3️⃣ Testando busca de campos...');
    const testFields = {
      status: firstRow.status || firstRow.data?.status || firstRow.Status || firstRow.data?.Status || null,
      tema: firstRow.tema || firstRow.data?.tema || firstRow.Tema || firstRow.data?.Tema || null,
      orgaos: firstRow.orgaos || firstRow.data?.orgaos || firstRow.Orgaos || firstRow.data?.Orgaos || null,
      tipo: firstRow.tipoDeManifestacao || firstRow.data?.tipoDeManifestacao || firstRow.tipo || firstRow.data?.tipo || null,
      canal: firstRow.canal || firstRow.data?.canal || firstRow.Canal || firstRow.data?.Canal || null,
      prioridade: firstRow.prioridade || firstRow.data?.prioridade || firstRow.Prioridade || firstRow.data?.Prioridade || null,
      unidade: firstRow.unidadeCadastro || firstRow.data?.unidadeCadastro || firstRow.UnidadeCadastro || firstRow.data?.UnidadeCadastro || null
    };
    
    const foundFields = Object.entries(testFields).filter(([_, v]) => v !== null);
    console.log(`   Campos encontrados: ${foundFields.length}/7`);
    foundFields.forEach(([field, value]) => {
      console.log(`   ✅ ${field}: "${value}"`);
    });
    
    const missingFields = Object.entries(testFields).filter(([_, v]) => v === null);
    if (missingFields.length > 0) {
      console.log(`   ⚠️ Campos não encontrados: ${missingFields.map(([f]) => f).join(', ')}`);
      issues.push(`Campos não encontrados no primeiro registro: ${missingFields.map(([f]) => f).join(', ')}`);
    }
    
    // 4. Simular agregação (versão simplificada)
    console.log('\n4️⃣ Simulando agregação de dados...');
    
    const statusMap = new Map();
    const themeMap = new Map();
    const organMap = new Map();
    const typeMap = new Map();
    const channelMap = new Map();
    const priorityMap = new Map();
    const unitMap = new Map();
    
    let fieldsFound = {
      status: 0,
      tema: 0,
      orgaos: 0,
      tipo: 0,
      canal: 0,
      prioridade: 0,
      unidade: 0
    };
    
    for (const row of filteredRows.slice(0, 1000)) { // Limitar para performance
      // Status
      let status = null;
      if (row.status) status = String(row.status).trim();
      else if (row.data?.status) status = String(row.data.status).trim();
      else if (row.Status) status = String(row.Status).trim();
      else if (row.data?.Status) status = String(row.data.Status).trim();
      
      if (status && status !== 'null' && status !== 'undefined' && status !== '' && status !== 'N/A') {
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
        fieldsFound.status++;
      }
      
      // Tema
      let theme = null;
      if (row.tema) theme = String(row.tema).trim();
      else if (row.data?.tema) theme = String(row.data.tema).trim();
      else if (row.Tema) theme = String(row.Tema).trim();
      else if (row.data?.Tema) theme = String(row.data.Tema).trim();
      
      if (theme && theme !== 'null' && theme !== 'undefined' && theme !== '' && theme !== 'N/A') {
        themeMap.set(theme, (themeMap.get(theme) || 0) + 1);
        fieldsFound.tema++;
      }
      
      // Órgãos
      let organ = null;
      if (row.orgaos) organ = String(row.orgaos).trim();
      else if (row.data?.orgaos) organ = String(row.data.orgaos).trim();
      else if (row.Orgaos) organ = String(row.Orgaos).trim();
      else if (row.data?.Orgaos) organ = String(row.data.Orgaos).trim();
      
      if (organ && organ !== 'null' && organ !== 'undefined' && organ !== '' && organ !== 'N/A') {
        organMap.set(organ, (organMap.get(organ) || 0) + 1);
        fieldsFound.orgaos++;
      }
      
      // Tipo
      let type = null;
      if (row.tipoDeManifestacao) type = String(row.tipoDeManifestacao).trim();
      else if (row.data?.tipoDeManifestacao) type = String(row.data.tipoDeManifestacao).trim();
      else if (row.tipo) type = String(row.tipo).trim();
      else if (row.data?.tipo) type = String(row.data.tipo).trim();
      
      if (type && type !== 'null' && type !== 'undefined' && type !== '' && type !== 'N/A') {
        typeMap.set(type, (typeMap.get(type) || 0) + 1);
        fieldsFound.tipo++;
      }
      
      // Canal
      let channel = null;
      if (row.canal) channel = String(row.canal).trim();
      else if (row.data?.canal) channel = String(row.data.canal).trim();
      else if (row.Canal) channel = String(row.Canal).trim();
      else if (row.data?.Canal) channel = String(row.data.Canal).trim();
      
      if (channel && channel !== 'null' && channel !== 'undefined' && channel !== '' && channel !== 'N/A') {
        channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
        fieldsFound.canal++;
      }
      
      // Prioridade
      let priority = null;
      if (row.prioridade) priority = String(row.prioridade).trim();
      else if (row.data?.prioridade) priority = String(row.data.prioridade).trim();
      else if (row.Prioridade) priority = String(row.Prioridade).trim();
      else if (row.data?.Prioridade) priority = String(row.data.Prioridade).trim();
      
      if (priority && priority !== 'null' && priority !== 'undefined' && priority !== '' && priority !== 'N/A') {
        priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1);
        fieldsFound.prioridade++;
      }
      
      // Unidade
      let unit = null;
      if (row.unidadeCadastro) unit = String(row.unidadeCadastro).trim();
      else if (row.data?.unidadeCadastro) unit = String(row.data.unidadeCadastro).trim();
      else if (row.UnidadeCadastro) unit = String(row.UnidadeCadastro).trim();
      else if (row.data?.UnidadeCadastro) unit = String(row.data.UnidadeCadastro).trim();
      
      if (unit && unit !== 'null' && unit !== 'undefined' && unit !== '' && unit !== 'N/A') {
        unitMap.set(unit, (unitMap.get(unit) || 0) + 1);
        fieldsFound.unidade++;
      }
    }
    
    const processedCount = Math.min(filteredRows.length, 1000);
    const aggregated = {
      totalManifestations: filteredRows.length,
      manifestationsByStatus: Array.from(statusMap.entries()).map(([s, c]) => ({ status: s, count: c })),
      manifestationsByTheme: Array.from(themeMap.entries()).map(([t, c]) => ({ theme: t, count: c })),
      manifestationsByOrgan: Array.from(organMap.entries()).map(([o, c]) => ({ organ: o, count: c })),
      manifestationsByType: Array.from(typeMap.entries()).map(([t, c]) => ({ type: t, count: c })),
      manifestationsByChannel: Array.from(channelMap.entries()).map(([c, count]) => ({ channel: c, count })),
      manifestationsByPriority: Array.from(priorityMap.entries()).map(([p, c]) => ({ priority: p, count: c })),
      manifestationsByUnit: Array.from(unitMap.entries()).map(([u, c]) => ({ unit: u, count: c }))
    };
    
    console.log(`   Processados ${processedCount} registros`);
    console.log(`   Campos encontrados:`);
    console.log(`     - Status: ${fieldsFound.status} (${((fieldsFound.status/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Tema: ${fieldsFound.tema} (${((fieldsFound.tema/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Órgãos: ${fieldsFound.orgaos} (${((fieldsFound.orgaos/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Tipo: ${fieldsFound.tipo} (${((fieldsFound.tipo/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Canal: ${fieldsFound.canal} (${((fieldsFound.canal/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Prioridade: ${fieldsFound.prioridade} (${((fieldsFound.prioridade/processedCount)*100).toFixed(1)}%)`);
    console.log(`     - Unidade: ${fieldsFound.unidade} (${((fieldsFound.unidade/processedCount)*100).toFixed(1)}%)`);
    
    // 5. Validar resultados
    console.log('\n5️⃣ Validando resultados...');
    
    if (aggregated.totalManifestations !== filteredRows.length) {
      issues.push(`Total incorreto: esperado ${filteredRows.length}, obtido ${aggregated.totalManifestations}`);
      failed++;
    } else {
      passed++;
    }
    
    if (aggregated.manifestationsByStatus.length === 0 && filteredRows.length > 0) {
      issues.push('⚠️ Nenhum status encontrado (manifestationsByStatus vazio)');
      failed++;
    } else {
      passed++;
      console.log(`   ✅ Status: ${aggregated.manifestationsByStatus.length} grupos`);
    }
    
    if (aggregated.manifestationsByTheme.length === 0 && filteredRows.length > 0) {
      issues.push('⚠️ Nenhum tema encontrado (manifestationsByTheme vazio)');
      failed++;
    } else {
      passed++;
      console.log(`   ✅ Temas: ${aggregated.manifestationsByTheme.length} grupos`);
    }
    
    if (aggregated.manifestationsByOrgan.length === 0 && filteredRows.length > 0) {
      issues.push('⚠️ Nenhum órgão encontrado (manifestationsByOrgan vazio)');
      failed++;
    } else {
      passed++;
      console.log(`   ✅ Órgãos: ${aggregated.manifestationsByOrgan.length} grupos`);
    }
    
    if (aggregated.manifestationsByType.length === 0 && filteredRows.length > 0) {
      issues.push('⚠️ Nenhum tipo encontrado (manifestationsByType vazio)');
      failed++;
    } else {
      passed++;
      console.log(`   ✅ Tipos: ${aggregated.manifestationsByType.length} grupos`);
    }
    
    if (aggregated.manifestationsByChannel.length === 0 && filteredRows.length > 0) {
      issues.push('⚠️ Nenhum canal encontrado (manifestationsByChannel vazio)');
      failed++;
    } else {
      passed++;
      console.log(`   ✅ Canais: ${aggregated.manifestationsByChannel.length} grupos`);
    }
    
    // 6. Resultado final
    console.log('\n' + '='.repeat(60));
    const success = issues.length === 0;
    
    if (success) {
      console.log('✅ TESTE PASSOU: Todos os dados foram agregados corretamente!');
      console.log(`   - Total de registros: ${aggregated.totalManifestations}`);
      console.log(`   - Status encontrados: ${aggregated.manifestationsByStatus.length}`);
      console.log(`   - Temas encontrados: ${aggregated.manifestationsByTheme.length}`);
      console.log(`   - Órgãos encontrados: ${aggregated.manifestationsByOrgan.length}`);
      console.log(`   - Tipos encontrados: ${aggregated.manifestationsByType.length}`);
      console.log(`   - Canais encontrados: ${aggregated.manifestationsByChannel.length}`);
    } else {
      console.log('❌ TESTE FALHOU: Problemas encontrados:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    console.log(`\n   Resultado: ${passed} passou, ${failed} falhou`);
    console.log('='.repeat(60));
    
    return {
      success,
      passed,
      failed,
      issues,
      aggregated,
      fieldsFound,
      testFields
    };
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

// Executar automaticamente
testAggregation().then(result => {
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});

