/**
 * Script para Verificar Status do Token OAuth
 */

import 'dotenv/config';
import { getAuthClient, sendEmail } from '../../src/services/email-notifications/gmailService.js';

async function verificarToken() {
  console.log('🔍 Verificando status do token OAuth...\n');
  
  try {
    const auth = getAuthClient();
    
    if (!auth) {
      console.log('❌ Cliente OAuth não inicializado');
      console.log('💡 Execute: npm run gmail:auth\n');
      return;
    }
    
    // Tentar fazer uma requisição simples para verificar se o token está válido
    const { google } = await import('googleapis');
    const gmail = google.gmail({ version: 'v1', auth });
    
    console.log('⏳ Testando token...');
    
    // Tentar obter o perfil do usuário (requisição simples)
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    console.log('✅ Token válido!');
    console.log(`   Email: ${profile.data.emailAddress}`);
    console.log(`   Messages Total: ${profile.data.messagesTotal || 'N/A'}`);
    console.log(`   Threads Total: ${profile.data.threadsTotal || 'N/A'}\n`);
    
    console.log('🎉 O token está funcionando corretamente!\n');
    
  } catch (error) {
    console.error('❌ Token inválido ou expirado!');
    console.error(`   Erro: ${error.message}\n`);
    
    if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
      console.log('💡 O token precisa ser renovado.');
      console.log('   Execute: npm run gmail:auth\n');
    } else {
      console.log('💡 Verifique:');
      console.log('   - Se o token existe em config/gmail-token.json');
      console.log('   - Se as credenciais estão corretas');
      console.log('   - Execute: npm run gmail:auth para reautorizar\n');
    }
  }
}

verificarToken();

