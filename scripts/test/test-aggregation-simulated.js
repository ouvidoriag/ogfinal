/**
 * Teste Automatizado: Agregação de Dados (Simulado)
 * Testa a lógica de agregação sem precisar da API
 */

// Simular dados como retornados pela API /api/filter
const mockFilteredRows = [
  {
    _id: '1',
    status: 'Em Andamento',
    tema: 'Saúde',
    orgaos: 'Secretaria de Saúde',
    tipoDeManifestacao: 'Reclamação',
    canal: 'Presencial',
    prioridade: 'Alta',
    unidadeCadastro: 'UAC Centro',
    dataCriacaoIso: '2024-11-15T10:00:00',
    data: {
      Status: 'Em Andamento',
      Tema: 'Saúde',
      Orgaos: 'Secretaria de Saúde',
      Tipo: 'Reclamação',
      Canal: 'Presencial',
      Prioridade: 'Alta',
      UnidadeCadastro: 'UAC Centro'
    }
  },
  {
    _id: '2',
    status: 'Concluído',
    tema: 'Educação',
    orgaos: 'Secretaria de Educação',
    tipoDeManifestacao: 'Sugestão',
    canal: 'Presencial',
    prioridade: 'Média',
    unidadeCadastro: 'UAC Centro',
    dataCriacaoIso: '2024-11-14T14:30:00',
    data: {
      Status: 'Concluído',
      Tema: 'Educação',
      Orgaos: 'Secretaria de Educação',
      Tipo: 'Sugestão',
      Canal: 'Presencial',
      Prioridade: 'Média',
      UnidadeCadastro: 'UAC Centro'
    }
  },
  {
    _id: '3',
    // Campos apenas em data (testar fallback)
    data: {
      Status: 'Pendente',
      Tema: 'Infraestrutura',
      Orgaos: 'Secretaria de Obras',
      Tipo: 'Denúncia',
      Canal: 'Presencial',
      Prioridade: 'Baixa',
      UnidadeCadastro: 'UAC Periferia',
      DataDaCriacao: '2024-11-13'
    }
  },
  {
    _id: '4',
    status: 'Em Andamento',
    tema: 'Saúde',
    orgaos: 'Secretaria de Saúde',
    tipoDeManifestacao: 'Reclamação',
    canal: 'Presencial',
    prioridade: 'Alta',
    unidadeCadastro: 'UAC Centro',
    dataCriacaoIso: '2024-11-12T09:00:00'
  }
];

// Função de agregação (cópia da lógica do overview.js)
function aggregateFilteredData(rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return {
      totalManifestations: 0,
      last7Days: 0,
      last30Days: 0,
      manifestationsByMonth: [],
      manifestationsByDay: [],
      manifestationsByStatus: [],
      manifestationsByTheme: [],
      manifestationsByOrgan: [],
      manifestationsByType: [],
      manifestationsByChannel: [],
      manifestationsByPriority: [],
      manifestationsByUnit: []
    };
  }
  
  const statusMap = new Map();
  const themeMap = new Map();
  const organMap = new Map();
  const typeMap = new Map();
  const channelMap = new Map();
  const priorityMap = new Map();
  const unitMap = new Map();
  const monthMap = new Map();
  const dayMap = new Map();
  
  let last7Count = 0;
  let last30Count = 0;
  
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  
  let fieldsFound = {
    status: 0,
    tema: 0,
    orgaos: 0,
    tipo: 0,
    canal: 0,
    prioridade: 0,
    unidade: 0,
    data: 0
  };
  
  for (const row of rows) {
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
    
    // Data
    let dataCriacao = row.dataCriacaoIso || row.data?.dataCriacaoIso || 
                     row.dataDaCriacao || row.data?.dataDaCriacao ||
                     row.data?.DataDaCriacao || row.data?.Data;
    
    if (dataCriacao) {
      fieldsFound.data++;
      let dateStr = String(dataCriacao).trim();
      
      if (!dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr + 'T00:00:00';
      }
      
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1);
        
        const dayKey = date.toISOString().slice(0, 10);
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
        
        if (date >= last7Days) last7Count++;
        if (date >= last30Days) last30Count++;
      }
    }
  }
  
  return {
    totalManifestations: rows.length,
    last7Days: last7Count,
    last30Days: last30Count,
    manifestationsByMonth: Array.from(monthMap.entries()).map(([m, c]) => ({ month: m, count: c })),
    manifestationsByDay: Array.from(dayMap.entries()).map(([d, c]) => ({ date: d, count: c })),
    manifestationsByStatus: Array.from(statusMap.entries()).map(([s, c]) => ({ status: s, count: c })),
    manifestationsByTheme: Array.from(themeMap.entries()).map(([t, c]) => ({ theme: t, count: c })),
    manifestationsByOrgan: Array.from(organMap.entries()).map(([o, c]) => ({ organ: o, count: c })),
    manifestationsByType: Array.from(typeMap.entries()).map(([t, c]) => ({ type: t, count: c })),
    manifestationsByChannel: Array.from(channelMap.entries()).map(([c, count]) => ({ channel: c, count })),
    manifestationsByPriority: Array.from(priorityMap.entries()).map(([p, c]) => ({ priority: p, count: c })),
    manifestationsByUnit: Array.from(unitMap.entries()).map(([u, c]) => ({ unit: u, count: c }))
  };
}

// Executar teste
console.log('🧪 Teste de Agregação (Simulado)\n');
console.log('='.repeat(60));

const result = aggregateFilteredData(mockFilteredRows);

console.log('\n📊 Resultados da Agregação:');
console.log(`   Total: ${result.totalManifestations}`);
console.log(`   Status: ${result.manifestationsByStatus.length} grupos`);
console.log(`   Temas: ${result.manifestationsByTheme.length} grupos`);
console.log(`   Órgãos: ${result.manifestationsByOrgan.length} grupos`);
console.log(`   Tipos: ${result.manifestationsByType.length} grupos`);
console.log(`   Canais: ${result.manifestationsByChannel.length} grupos`);
console.log(`   Prioridades: ${result.manifestationsByPriority.length} grupos`);
console.log(`   Unidades: ${result.manifestationsByUnit.length} grupos`);
console.log(`   Meses: ${result.manifestationsByMonth.length} grupos`);
console.log(`   Dias: ${result.manifestationsByDay.length} grupos`);

console.log('\n📋 Detalhes:');
console.log('   Status:', result.manifestationsByStatus);
console.log('   Temas:', result.manifestationsByTheme);
console.log('   Órgãos:', result.manifestationsByOrgan);
console.log('   Tipos:', result.manifestationsByType);
console.log('   Canais:', result.manifestationsByChannel);
console.log('   Prioridades:', result.manifestationsByPriority);
console.log('   Unidades:', result.manifestationsByUnit);

// Validação
console.log('\n✅ Validação:');
let allPassed = true;

if (result.totalManifestations !== mockFilteredRows.length) {
  console.log(`   ❌ Total incorreto: esperado ${mockFilteredRows.length}, obtido ${result.totalManifestations}`);
  allPassed = false;
} else {
  console.log(`   ✅ Total correto: ${result.totalManifestations}`);
}

if (result.manifestationsByStatus.length === 0) {
  console.log('   ❌ Nenhum status encontrado');
  allPassed = false;
} else {
  console.log(`   ✅ Status encontrados: ${result.manifestationsByStatus.length}`);
}

if (result.manifestationsByTheme.length === 0) {
  console.log('   ❌ Nenhum tema encontrado');
  allPassed = false;
} else {
  console.log(`   ✅ Temas encontrados: ${result.manifestationsByTheme.length}`);
}

if (result.manifestationsByChannel.length === 0) {
  console.log('   ❌ Nenhum canal encontrado');
  allPassed = false;
} else {
  console.log(`   ✅ Canais encontrados: ${result.manifestationsByChannel.length}`);
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('✅ TESTE PASSOU: Função de agregação está funcionando corretamente!');
  process.exit(0);
} else {
  console.log('❌ TESTE FALHOU: Problemas encontrados na agregação');
  process.exit(1);
}

