/**
 * Script para Testar Envio de Resumo
 * Envia um email de teste para verificar se está funcionando
 */

import 'dotenv/config';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  EMAIL_OUVIDORIA_GERAL,
  EMAIL_REMETENTE,
  NOME_REMETENTE
} from '../../src/services/email-notifications/emailConfig.js';

async function testarEnvio() {
  console.log('📧 Testando envio de resumo...\n');
  
  try {
    const emailDestino = EMAIL_OUVIDORIA_GERAL || 'ouvgeral.gestao@gmail.com';
    const emailRemetente = EMAIL_REMETENTE || 'ouvidoria@duquedecaxias.rj.gov.br';
    
    console.log(`📧 Remetente: ${emailRemetente}`);
    console.log(`📧 Destinatário: ${emailDestino}\n`);
    
    if (emailRemetente === emailDestino) {
      console.log('⚠️  ATENÇÃO: Remetente e destinatário são o mesmo email!');
      console.log('   Isso pode causar problemas. Verifique a configuração.\n');
    }
    
    const subject = '[TESTE] Resumo Diário - Teste de Envio';
    const htmlBody = `
      <html>
        <body>
          <h2>Teste de Envio de Resumo</h2>
          <p>Este é um email de teste para verificar se o envio está funcionando corretamente.</p>
          <p><strong>Remetente:</strong> ${emailRemetente}</p>
          <p><strong>Destinatário:</strong> ${emailDestino}</p>
          <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          <p>Se você recebeu este email, o sistema está funcionando corretamente!</p>
        </body>
      </html>
    `;
    const textBody = `
Teste de Envio de Resumo

Este é um email de teste para verificar se o envio está funcionando corretamente.

Remetente: ${emailRemetente}
Destinatário: ${emailDestino}
Data: ${new Date().toLocaleString('pt-BR')}

Se você recebeu este email, o sistema está funcionando corretamente!
    `;
    
    console.log('📧 Enviando email de teste...\n');
    
    const resultado = await sendEmail(
      emailDestino,
      subject,
      htmlBody,
      textBody,
      emailRemetente,
      NOME_REMETENTE
    );
    
    console.log('✅ Email de teste enviado com sucesso!');
    console.log(`   Message ID: ${resultado.messageId}`);
    console.log(`   Thread ID: ${resultado.threadId}\n`);
    
    console.log('💡 Verifique:');
    console.log(`   1. A caixa de entrada de ${emailDestino}`);
    console.log(`   2. A pasta de spam/lixo eletrônico`);
    console.log(`   3. Se não recebeu, verifique os filtros do Gmail\n`);
    
  } catch (error) {
    console.error('❌ Erro ao enviar email de teste:', error.message);
    if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
      console.log('\n💡 Token inválido. Execute: npm run gmail:auth\n');
    }
  }
}

testarEnvio();



