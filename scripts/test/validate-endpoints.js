/**
 * Script de Validação Final - Verifica se todos os endpoints estão funcionando
 * 
 * Este script faz uma validação rápida de todos os endpoints principais
 * e verifica se a estrutura de dados está correta.
 * 
 * Execução: node scripts/test/validate-endpoints.js
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';

const endpoints = [
  { method: 'GET', path: '/api/dashboard-data', name: 'Dashboard Data' },
  { method: 'GET', path: '/api/summary', name: 'Summary' },
  { method: 'GET', path: '/api/records?page=1&limit=10', name: 'Records' },
  { method: 'POST', path: '/api/filter/aggregated', name: 'Filter Aggregated', body: { filters: [] } },
  { method: 'POST', path: '/api/filter', name: 'Filter', body: { filters: [] } }
];

async function validateEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const options = {
    method: endpoint.method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (endpoint.body) {
    options.body = JSON.stringify(endpoint.body);
  }
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    const data = await response.json();
    
    return {
      name: endpoint.name,
      ok: response.ok,
      status: response.status,
      duration,
      hasData: !!data,
      dataType: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : []
    };
  } catch (error) {
    return {
      name: endpoint.name,
      ok: false,
      error: error.message
    };
  }
}

async function validateAll() {
  console.log('🔍 Validando todos os endpoints...\n');
  
  const results = [];
  for (const endpoint of endpoints) {
    const result = await validateEndpoint(endpoint);
    results.push(result);
    
    if (result.ok) {
      console.log(`✅ ${result.name}: OK (${result.duration}ms)`);
      if (result.keys.length > 0) {
        console.log(`   Chaves: ${result.keys.join(', ')}`);
      }
    } else {
      console.log(`❌ ${result.name}: FAILED (${result.status || result.error})`);
    }
    console.log('');
  }
  
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  
  console.log('═══════════════════════════════════════');
  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log('═══════════════════════════════════════\n');
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('✅ Todos os endpoints estão funcionando!\n');
    process.exit(0);
  }
}

validateAll().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

