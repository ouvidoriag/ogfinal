/**
 * Teste Completo de APIs Gemini
 * 
 * Testa:
 * 1. Chaves da API Gemini (diretamente)
 * 2. Endpoint /api/chat/messages (POST) - integração completa
 * 3. Verificação de funcionalidades do helper geminiHelper
 * 
 * Uso: node scripts/test/testGeminiAPI.js
 * 
 * Variáveis de ambiente:
 * - API_URL: URL do servidor (padrão: http://localhost:3000)
 * - GEMINI_API_KEY, GEMINI_API_KEY_2, etc: Chaves da API
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : []).concat(
  process.env.GEMINI_API_KEY_2 ? [process.env.GEMINI_API_KEY_2] : [],
  process.env.GEMINI_API_KEY_3 ? [process.env.GEMINI_API_KEY_3] : [],
  process.env.GEMINI_API_KEY_4 ? [process.env.GEMINI_API_KEY_4] : [],
  process.env.GEMINI_API_KEY_5 ? [process.env.GEMINI_API_KEY_5] : []
).filter(k => k && k.trim());

// Estatísticas
const resultados = {
  chaves: { total: 0, ok: 0, erro: 0, exceptions: 0, detalhes: [] },
  endpoints: { total: 0, ok: 0, erro: 0, detalhes: [] },
  helper: { total: 0, ok: 0, erro: 0, detalhes: [] }
};

/**
 * Testar uma chave diretamente na API Gemini
 */
async function testarChave(key, index) {
  resultados.chaves.total++;
  
  console.log(`\n🔑 Testando Chave ${index + 1}/${GEMINI_API_KEYS.length}...`);
  console.log(`   Prefixo: ${key.substring(0, 15)}...`);
  
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    const payload = {
      contents: [{
        role: 'user',
        parts: [{ text: 'Responda apenas com "OK" se você está funcionando.' }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10
      }
    };
    
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      console.log(`   ✅ SUCESSO! (${responseTime}ms)`);
      console.log(`   📝 Resposta: ${text.substring(0, 50)}`);
      
      resultados.chaves.ok++;
      resultados.chaves.detalhes.push({
        index: index + 1,
        status: 'OK',
        responseTime,
        response: text.substring(0, 50)
      });
      
      return { ok: true, key, responseTime };
    } else {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText.substring(0, 200) } };
      }
      
      const errorMessage = errorData?.error?.message || errorText.substring(0, 200);
      
      console.log(`   ❌ ERRO ${response.status} (${responseTime}ms)`);
      console.log(`   📝 Mensagem: ${errorMessage.substring(0, 150)}`);
      
      resultados.chaves.erro++;
      resultados.chaves.detalhes.push({
        index: index + 1,
        status: 'ERROR',
        statusCode: response.status,
        error: errorMessage.substring(0, 100),
        responseTime
      });
      
      return { ok: false, key, status: response.status, error: errorMessage };
    }
  } catch (error) {
    console.log(`   ❌ EXCEÇÃO: ${error.message}`);
    
    resultados.chaves.exceptions++;
    resultados.chaves.detalhes.push({
      index: index + 1,
      status: 'EXCEPTION',
      error: error.message
    });
    
    return { ok: false, key, error: error.message };
  }
}

/**
 * Testar endpoint /api/chat/messages (POST)
 */
async function testarEndpointChat(pergunta, context = 'ouvidoria') {
  resultados.endpoints.total++;
  
  console.log(`\n📡 Testando endpoint /api/chat/messages...`);
  console.log(`   Pergunta: "${pergunta}"`);
  console.log(`   Contexto: ${context}`);
  
  try {
    const url = `${BASE_URL}/api/chat/messages`;
    const payload = {
      text: pergunta,
      sender: 'user',
      context: context
    };
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    if (response.ok && data.message && data.response) {
      console.log(`   ✅ SUCESSO! (${responseTime}ms)`);
      console.log(`   📝 Resposta da CORA: ${data.response.substring(0, 150)}...`);
      
      resultados.endpoints.ok++;
      resultados.endpoints.detalhes.push({
        pergunta,
        context,
        status: 'OK',
        responseTime,
        respostaLength: data.response?.length || 0,
        temGemini: data.response && data.response.length > 50 // Respostas do Gemini são mais longas
      });
      
      return { ok: true, data, responseTime };
    } else {
      console.log(`   ❌ ERRO ${response.status} (${responseTime}ms)`);
      console.log(`   📝 Detalhes: ${JSON.stringify(data).substring(0, 200)}`);
      
      resultados.endpoints.erro++;
      resultados.endpoints.detalhes.push({
        pergunta,
        context,
        status: 'ERROR',
        statusCode: response.status,
        error: data.error || 'Erro desconhecido'
      });
      
      return { ok: false, status: response.status, data };
    }
  } catch (error) {
    console.log(`   ❌ EXCEÇÃO: ${error.message}`);
    
    resultados.endpoints.erro++;
    resultados.endpoints.detalhes.push({
      pergunta,
      context,
      status: 'EXCEPTION',
      error: error.message
    });
    
    return { ok: false, error: error.message };
  }
}

/**
 * Verificar se servidor está rodando
 */
async function verificarServidor() {
  try {
    const response = await fetch(`${BASE_URL}/api/summary`, {
      method: 'GET',
      timeout: 3000
    });
    return response.ok || response.status < 500;
  } catch (error) {
    return false;
  }
}

/**
 * Testar helper geminiHelper (importar e verificar funções)
 */
async function testarHelper() {
  resultados.helper.total++;
  
  console.log(`\n🔧 Testando helper geminiHelper...`);
  
  try {
    const { 
      hasGeminiKeys, 
      getGeminiKeysCount, 
      getCurrentGeminiKey,
      initializeGemini 
    } = await import('../../src/utils/geminiHelper.js');
    
    // Testar funções
    const temChaves = hasGeminiKeys();
    const numChaves = getGeminiKeysCount();
    const chaveAtual = getCurrentGeminiKey();
    
    console.log(`   ✅ Helper importado com sucesso`);
    console.log(`   📊 Tem chaves: ${temChaves}`);
    console.log(`   📊 Número de chaves: ${numChaves}`);
    console.log(`   📊 Chave atual: ${chaveAtual ? chaveAtual.substring(0, 15) + '...' : 'N/A'}`);
    
    if (temChaves && numChaves > 0 && chaveAtual) {
      resultados.helper.ok++;
      resultados.helper.detalhes.push({
        status: 'OK',
        temChaves,
        numChaves,
        chaveAtualPrefix: chaveAtual.substring(0, 15) + '...'
      });
      
      return { ok: true };
    } else {
      resultados.helper.erro++;
      resultados.helper.detalhes.push({
        status: 'ERROR',
        error: 'Helper não configurado corretamente'
      });
      
      return { ok: false, error: 'Helper não configurado' };
    }
  } catch (error) {
    console.log(`   ❌ EXCEÇÃO: ${error.message}`);
    
    resultados.helper.erro++;
    resultados.helper.detalhes.push({
      status: 'EXCEPTION',
      error: error.message
    });
    
    return { ok: false, error: error.message };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🧪 TESTE COMPLETO DE APIs GEMINI\n');
  console.log('='.repeat(60));
  console.log(`📡 Servidor: ${BASE_URL}`);
  console.log(`🔑 Chaves configuradas: ${GEMINI_API_KEYS.length}`);
  console.log('='.repeat(60));
  
  // 1. Testar chaves diretamente
  console.log('\n' + '='.repeat(60));
  console.log('1️⃣  TESTE DE CHAVES DA API GEMINI');
  console.log('='.repeat(60));
  
  if (GEMINI_API_KEYS.length === 0) {
    console.log('❌ Nenhuma chave configurada!');
    console.log('\n💡 Configure pelo menos uma das seguintes variáveis de ambiente:');
    console.log('   - GEMINI_API_KEY');
    console.log('   - GEMINI_API_KEY_2');
    console.log('   - GEMINI_API_KEY_3');
    console.log('   - GEMINI_API_KEY_4');
    console.log('   - GEMINI_API_KEY_5');
  } else {
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
      await testarChave(GEMINI_API_KEYS[i], i);
      
      // Aguardar entre testes para evitar rate limit
      if (i < GEMINI_API_KEYS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // 2. Testar helper
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣  TESTE DO HELPER geminiHelper');
  console.log('='.repeat(60));
  
  await testarHelper();
  
  // 3. Testar endpoint de chat (se servidor estiver rodando)
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣  TESTE DO ENDPOINT /api/chat/messages');
  console.log('='.repeat(60));
  
  const servidorRodando = await verificarServidor();
  
  if (!servidorRodando) {
    console.log('\n⚠️  Servidor não está rodando!');
    console.log('💡 Para testar o endpoint de chat, inicie o servidor com:');
    console.log('   cd NOVO');
    console.log('   npm start');
    console.log('\n💡 Ou execute em outro terminal enquanto o servidor estiver rodando.');
    resultados.endpoints.detalhes.push({
      status: 'SKIP',
      motivo: 'Servidor não está rodando'
    });
  } else {
    console.log('\n✅ Servidor detectado! Executando testes de endpoint...\n');
    
    // Teste 1: Pergunta simples
    await testarEndpointChat('Quantas manifestações temos no total?', 'ouvidoria');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 2: Pergunta sobre temas
    await testarEndpointChat('Quais são os top 5 temas?', 'ouvidoria');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 3: Pergunta sobre zeladoria (se contexto suportado)
    await testarEndpointChat('Quantas ocorrências de zeladoria temos?', 'zeladoria');
  }
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL DOS TESTES');
  console.log('='.repeat(60));
  
  console.log('\n🔑 TESTES DE CHAVES:');
  console.log(`   Total: ${resultados.chaves.total}`);
  console.log(`   ✅ OK: ${resultados.chaves.ok}`);
  console.log(`   ❌ Erro: ${resultados.chaves.erro}`);
  console.log(`   ⚠️  Exceções: ${resultados.chaves.exceptions}`);
  
  console.log('\n🔧 TESTES DO HELPER:');
  console.log(`   Total: ${resultados.helper.total}`);
  console.log(`   ✅ OK: ${resultados.helper.ok}`);
  console.log(`   ❌ Erro: ${resultados.helper.erro}`);
  
  console.log('\n📡 TESTES DE ENDPOINT:');
  console.log(`   Total: ${resultados.endpoints.total}`);
  console.log(`   ✅ OK: ${resultados.endpoints.ok}`);
  console.log(`   ❌ Erro: ${resultados.endpoints.erro}`);
  
  if (resultados.chaves.ok > 0) {
    console.log('\n✅ Pelo menos uma chave está funcionando!');
  } else {
    console.log('\n⚠️  NENHUMA CHAVE ESTÁ FUNCIONANDO!');
    console.log('\n💡 Verifique:');
    console.log('   1. Se as chaves estão corretas no arquivo .env');
    console.log('   2. Se a API Gemini está habilitada no Google Cloud');
    console.log('   3. Se as quotas não foram excedidas');
    console.log('   4. Se as chaves têm permissões adequadas');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Exit code baseado nos resultados
  if (resultados.chaves.ok === 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});

