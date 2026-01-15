/**
 * Script para autorizar o Gmail API
 * Facilita o processo de autorização OAuth 2.0
 */

import 'dotenv/config';
import { getAuthUrl, authorize } from '../../src/services/email-notifications/gmailService.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Autorização do Gmail API\n');
console.log('Este script vai ajudá-lo a autorizar o acesso ao Gmail.\n');

try {
  // CORREÇÃO: Google descontinuou urn:ietf:wg:oauth:2.0:oob
  // Usar http://localhost para scripts CLI (usuário copia código da URL)
  const redirectUri = 'http://localhost';
  const authUrl = getAuthUrl(redirectUri);
  
  // Extrair o redirect_uri da URL para mostrar ao usuário
  let redirectUriUsado = redirectUri;
  try {
    const urlObj = new URL(authUrl);
    redirectUriUsado = decodeURIComponent(urlObj.searchParams.get('redirect_uri') || redirectUri);
  } catch (e) {
    // Se não conseguir extrair, usar o padrão
  }
  
  console.log('📋 Siga estes passos:\n');
  console.log('1. Acesse esta URL no navegador:');
  console.log(`\n   ${authUrl}\n`);
  console.log('2. Faça login com a conta Gmail que enviará os emails');
  console.log('   Email: ouvidoria020@gmail.com ou ouvgeral.gestao@gmail.com');
  console.log('3. Autorize o acesso ao Gmail');
  console.log('4. Você será redirecionado para: http://localhost/?code=...');
  console.log('5. Copie o código da URL (parte após "code=")\n');
  console.log('   Exemplo de URL após redirecionamento:');
  console.log('   http://localhost/?code=4/0AeanS...');
  console.log('   O código é: 4/0AeanS...\n');
  console.log('   ⚠️  Se a página não carregar, copie o código da barra de endereço do navegador\n');
  
  console.log('🔍 DEBUG INFO:');
  console.log(`   redirect_uri sendo usado: ${redirectUriUsado}`);
  console.log(`\n⚠️  Se der erro redirect_uri_mismatch:`);
  console.log(`   1. Vá no Google Cloud Console`);
  console.log(`   2. Adicione este URI exato: ${redirectUriUsado}`);
  console.log(`   3. Em "URIs de redirecionamento autorizados"`);
  console.log(`   4. Salve e aguarde 30-60 segundos\n`);
  
  rl.question('Cole o código ou a URL completa aqui: ', async (input) => {
    if (!input || input.trim() === '') {
      console.error('\n❌ Código não fornecido!');
      rl.close();
      process.exit(1);
    }
    
    // Extrair código da URL se o usuário colou a URL completa
    let code = input.trim();
    
    // Se contém "code=", extrair apenas o código
    if (code.includes('code=')) {
      try {
        // Se for uma URL completa, extrair o parâmetro code
        if (code.startsWith('http://') || code.startsWith('https://')) {
          const url = new URL(code);
          code = url.searchParams.get('code') || code;
        } else {
          // Se for apenas a parte da query string, extrair manualmente
          // Regex: captura tudo após "code=" até encontrar "&" ou fim da string
          const match = code.match(/code=([^&\s]+)/);
          if (match && match[1]) {
            code = match[1];
          }
        }
        
        // Limpar qualquer espaço ou caractere extra
        code = code.trim();
        
        // Remover qualquer coisa após espaço ou quebra de linha
        if (code.includes(' ')) {
          code = code.split(' ')[0];
        }
        if (code.includes('\n')) {
          code = code.split('\n')[0];
        }
        
        console.log(`\n✅ Código extraído: ${code.substring(0, 30)}...`);
        console.log(`   Tamanho do código: ${code.length} caracteres`);
      } catch (e) {
        // Se falhar, tentar extrair manualmente com regex
        const match = code.match(/code=([^&\s]+)/);
        if (match && match[1]) {
          code = match[1].trim();
          console.log(`\n✅ Código extraído (método alternativo): ${code.substring(0, 30)}...`);
        } else {
          console.warn('\n⚠️  Não foi possível extrair o código automaticamente.');
          console.warn('   Tentando usar a entrada completa...');
        }
      }
    }
    
    if (!code || code.trim() === '') {
      console.error('\n❌ Código não encontrado!');
      console.error('💡 Certifique-se de copiar o código ou a URL completa');
      rl.close();
      process.exit(1);
    }
    
    try {
      console.log('\n⏳ Autorizando...');
      console.log(`   Usando redirect_uri: http://localhost`);
      await authorize(code.trim());
      console.log('\n✅ Autorização concluída com sucesso!');
      console.log('📁 O token foi salvo em: config/gmail-token.json');
      console.log('\n🎉 Agora você pode usar o sistema de notificações!');
      console.log('\n📧 Teste o envio:');
      console.log('   GET http://localhost:3000/api/notifications/test?email=seu_email@gmail.com');
    } catch (error) {
      console.error('\n❌ Erro ao autorizar:', error.message);
      console.log('\n💡 Dicas:');
      console.log('   - Verifique se o código está correto');
      console.log('   - O código expira rapidamente, obtenha um novo se necessário');
      console.log('   - Certifique-se de que o redirect_uri está configurado no Google Cloud Console');
    }
    
    rl.close();
  });
  
} catch (error) {
  console.error('\n❌ Erro ao obter URL de autorização:', error.message);
  console.log('\n💡 Verifique se:');
  console.log('   - O arquivo config/gmail-credentials.json existe');
  console.log('   - As credenciais estão corretas');
  rl.close();
  process.exit(1);
}

