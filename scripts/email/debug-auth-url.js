/**
 * Script de Debug: Verificar URI de Redirecionamento
 * Mostra exatamente qual URI está sendo usado na autorização
 */

import 'dotenv/config';
import { getAuthUrl } from '../../src/services/email-notifications/gmailService.js';

console.log('🔍 DEBUG: Verificando URI de Redirecionamento\n');
console.log('='.repeat(60));

try {
  // Testar com diferentes URIs
  console.log('\n📋 Testando diferentes URIs:\n');
  
  // 1. URI padrão (das credenciais)
  const urlPadrao = getAuthUrl();
  console.log('1️⃣ URI Padrão (das credenciais):');
  console.log('   URL:', urlPadrao);
  const uriPadrao = new URL(urlPadrao).searchParams.get('redirect_uri');
  console.log('   redirect_uri usado:', decodeURIComponent(uriPadrao || 'NÃO ENCONTRADO'));
  console.log('');
  
  // 2. URI OOB (out-of-band para scripts CLI)
  const urlOOB = getAuthUrl('urn:ietf:wg:oauth:2.0:oob');
  console.log('2️⃣ URI OOB (urn:ietf:wg:oauth:2.0:oob):');
  console.log('   URL:', urlOOB);
  const uriOOB = new URL(urlOOB).searchParams.get('redirect_uri');
  console.log('   redirect_uri usado:', decodeURIComponent(uriOOB || 'NÃO ENCONTRADO'));
  console.log('');
  
  // 3. URI callback da API
  const urlCallback = getAuthUrl('http://localhost:3000/api/notifications/auth/callback');
  console.log('3️⃣ URI Callback API (http://localhost:3000/api/notifications/auth/callback):');
  console.log('   URL:', urlCallback);
  const uriCallback = new URL(urlCallback).searchParams.get('redirect_uri');
  console.log('   redirect_uri usado:', decodeURIComponent(uriCallback || 'NÃO ENCONTRADO'));
  console.log('');
  
  console.log('='.repeat(60));
  console.log('\n✅ INSTRUÇÕES:\n');
  console.log('1. Copie o redirect_uri que aparece acima');
  console.log('2. Vá no Google Cloud Console');
  console.log('3. Adicione EXATAMENTE esse URI em "URIs de redirecionamento autorizados"');
  console.log('4. Salve e aguarde 30-60 segundos');
  console.log('5. Teste novamente\n');
  
  // Mostrar qual URI o script de autorização vai usar
  console.log('📌 O script autorizar-gmail.js usa:');
  console.log('   redirect_uri: urn:ietf:wg:oauth:2.0:oob');
  console.log('\n💡 Certifique-se de que este URI está no Google Cloud Console!\n');
  
} catch (error) {
  console.error('\n❌ Erro:', error.message);
  console.error('\n💡 Verifique se:');
  console.error('   - O arquivo config/gmail-credentials.json existe');
  console.error('   - As credenciais estão corretas');
  process.exit(1);
}

