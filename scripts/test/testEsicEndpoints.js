/**
 * Script de Teste dos Endpoints de e-SIC
 * 
 * Testa todos os endpoints da API de e-SIC
 * 
 * Uso: node NOVO/scripts/test/testEsicEndpoints.js
 */

import 'dotenv/config';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

/**
 * Testar endpoint
 */
async function testEndpoint(name, url) {
  try {
    console.log(`\n🧪 Testando: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Dados recebidos:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      return { success: true, data };
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ⚠️  Erro:`, data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`   ❌ Erro na requisição:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando testes dos endpoints de e-SIC...\n');
  console.log(`📍 Base URL: ${BASE_URL}\n`);
  
  const endpoints = [
    { name: 'Summary', url: `${BASE_URL}/api/esic/summary` },
    { name: 'Stats', url: `${BASE_URL}/api/esic/stats` },
    { name: 'Count by Status', url: `${BASE_URL}/api/esic/count-by?field=status` },
    { name: 'Count by Tipo Informação', url: `${BASE_URL}/api/esic/count-by?field=tipoInformacao` },
    { name: 'Count by Responsável', url: `${BASE_URL}/api/esic/count-by?field=responsavel` },
    { name: 'By Month', url: `${BASE_URL}/api/esic/by-month` },
    { name: 'Time Series', url: `${BASE_URL}/api/esic/time-series` },
    { name: 'Records (paginated)', url: `${BASE_URL}/api/esic/records?page=1&limit=10` },
    { name: 'By Status Month', url: `${BASE_URL}/api/esic/by-status-month` },
    { name: 'By Tipo Responsável', url: `${BASE_URL}/api/esic/by-tipo-responsavel` },
    { name: 'By Canal Unidade', url: `${BASE_URL}/api/esic/by-canal-unidade` }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint.name, endpoint.url);
    results.push({ ...endpoint, ...result });
    
    // Pequeno delay entre requisições
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Resumo
  console.log('\n\n📊 RESUMO DOS TESTES\n');
  console.log('═'.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
  });
  
  console.log('═'.repeat(60));
  console.log(`\n✅ Sucessos: ${successful}/${results.length}`);
  console.log(`❌ Falhas: ${failed}/${results.length}`);
  
  if (failed === 0) {
    console.log('\n🎉 Todos os testes passaram!');
  } else {
    console.log('\n⚠️  Alguns testes falharam. Verifique os logs acima.');
  }
}

// Executar
main()
  .then(() => {
    console.log('\n✨ Testes finalizados!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal nos testes:', error);
    process.exit(1);
  });

