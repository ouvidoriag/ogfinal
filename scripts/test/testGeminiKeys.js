/**
 * Script para testar chaves da API Gemini
 * 
 * Testa todas as chaves configuradas e verifica se estão funcionando
 * 
 * Uso: node scripts/testGeminiKeys.js
 */

import 'dotenv/config';

const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : []).concat(
  process.env.GEMINI_API_KEY_2 ? [process.env.GEMINI_API_KEY_2] : [],
  process.env.GEMINI_API_KEY_3 ? [process.env.GEMINI_API_KEY_3] : [],
  process.env.GEMINI_API_KEY_4 ? [process.env.GEMINI_API_KEY_4] : [],
  process.env.GEMINI_API_KEY_5 ? [process.env.GEMINI_API_KEY_5] : []
).filter(k => k && k.trim());

/**
 * Testar uma chave da API
 */
async function testKey(key, index) {
  console.log(`\n🔑 Testando Chave ${index + 1}/${GEMINI_API_KEYS.length}...`);
  console.log(`   Prefixo: ${key.substring(0, 15)}...`);
  console.log(`   Tamanho: ${key.length} caracteres`);
  
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Olá! Responda apenas com "OK" se você está funcionando.' }]
        }
      ],
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
      
      return {
        index: index + 1,
        key: key.substring(0, 15) + '...',
        status: 'OK',
        responseTime,
        response: text.substring(0, 50)
      };
    } else {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText.substring(0, 200) } };
      }
      
      const errorCode = errorData?.error?.code || response.status;
      const errorMessage = errorData?.error?.message || errorText.substring(0, 200);
      
      console.log(`   ❌ ERRO ${response.status} (${responseTime}ms)`);
      console.log(`   📝 Mensagem: ${errorMessage.substring(0, 150)}`);
      
      if (response.status === 429) {
        console.log(`   ⚠️  Rate limit/quota excedida`);
      } else if (response.status === 400) {
        console.log(`   ⚠️  Chave inválida ou formato incorreto`);
      } else if (response.status === 403) {
        console.log(`   ⚠️  Permissão negada - verifique se a API está habilitada`);
      }
      
      return {
        index: index + 1,
        key: key.substring(0, 15) + '...',
        status: 'ERROR',
        statusCode: response.status,
        error: errorMessage.substring(0, 100),
        responseTime
      };
    }
  } catch (error) {
    console.log(`   ❌ EXCEÇÃO: ${error.message}`);
    return {
      index: index + 1,
      key: key.substring(0, 15) + '...',
      status: 'EXCEPTION',
      error: error.message
    };
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🧪 Teste de Chaves da API Gemini\n');
  console.log('=' .repeat(60));
  
  if (GEMINI_API_KEYS.length === 0) {
    console.log('❌ Nenhuma chave configurada!');
    console.log('\n💡 Configure pelo menos uma das seguintes variáveis de ambiente:');
    console.log('   - GEMINI_API_KEY');
    console.log('   - GEMINI_API_KEY_2');
    console.log('   - GEMINI_API_KEY_3');
    console.log('   - GEMINI_API_KEY_4');
    console.log('   - GEMINI_API_KEY_5');
    process.exit(1);
  }
  
  console.log(`\n📊 Total de chaves encontradas: ${GEMINI_API_KEYS.length}\n`);
  
  const results = [];
  
  // Testar cada chave sequencialmente
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    const result = await testKey(GEMINI_API_KEYS[i], i);
    results.push(result);
    
    // Aguardar um pouco entre testes para evitar rate limit
    if (i < GEMINI_API_KEYS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMO DOS TESTES\n');
  
  const working = results.filter(r => r.status === 'OK');
  const errors = results.filter(r => r.status === 'ERROR');
  const exceptions = results.filter(r => r.status === 'EXCEPTION');
  
  console.log(`✅ Chaves funcionando: ${working.length}`);
  console.log(`❌ Chaves com erro: ${errors.length}`);
  console.log(`⚠️  Chaves com exceção: ${exceptions.length}`);
  
  if (working.length > 0) {
    console.log('\n✅ CHAVES FUNCIONANDO:');
    working.forEach(r => {
      console.log(`   Chave ${r.index}: ${r.key} (${r.responseTime}ms)`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ CHAVES COM ERRO:');
    errors.forEach(r => {
      console.log(`   Chave ${r.index}: ${r.key} - ${r.statusCode} - ${r.error}`);
    });
  }
  
  if (exceptions.length > 0) {
    console.log('\n⚠️  CHAVES COM EXCEÇÃO:');
    exceptions.forEach(r => {
      console.log(`   Chave ${r.index}: ${r.key} - ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (working.length === 0) {
    console.log('\n⚠️  NENHUMA CHAVE ESTÁ FUNCIONANDO!');
    console.log('\n💡 Verifique:');
    console.log('   1. Se as chaves estão corretas no arquivo .env');
    console.log('   2. Se a API Gemini está habilitada no Google Cloud');
    console.log('   3. Se as quotas não foram excedidas');
    console.log('   4. Se as chaves têm permissões adequadas');
    process.exit(1);
  } else {
    console.log('\n✅ Pelo menos uma chave está funcionando!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});

