/**
 * Script para enviar email formatado para Secretaria de Saúde
 * Envia um email de teste bem formatado
 */

import 'dotenv/config';
import { sendEmail } from '../src/services/email-notifications/gmailService.js';
import { EMAIL_REMETENTE, NOME_REMETENTE } from '../src/services/email-notifications/emailConfig.js';

const EMAIL_SAUDE = 'ouvgeral.gestao@gmail.com';

/**
 * Template de email formatado para Secretaria de Saúde
 */
function criarEmailFormatado() {
  const hoje = new Date();
  const dataFormatada = hoje.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    subject: '📧 Teste de Notificação - Sistema Automático de Vencimentos',
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
            font-weight: 600;
        }
        .header p {
            font-size: 14px;
            opacity: 0.9;
        }
        .content {
            padding: 30px 20px;
        }
        .greeting {
            font-size: 18px;
            color: #333;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .message {
            font-size: 16px;
            color: #555;
            margin-bottom: 25px;
            line-height: 1.8;
        }
        .info-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 25px 0;
            border-radius: 5px;
        }
        .info-box h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .info-item {
            display: flex;
            margin-bottom: 10px;
            align-items: center;
        }
        .info-label {
            font-weight: 600;
            color: #333;
            min-width: 150px;
        }
        .info-value {
            color: #555;
        }
        .features {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
        }
        .features h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .feature-item {
            display: flex;
            align-items: start;
            margin-bottom: 15px;
        }
        .feature-icon {
            font-size: 20px;
            margin-right: 10px;
            color: #667eea;
        }
        .feature-text {
            flex: 1;
            color: #555;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: 600;
            text-align: center;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
        }
        .footer p {
            margin: 5px 0;
        }
        .badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 25px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Ouvidoria Geral de Duque de Caxias</h1>
            <p>Sistema Automático de Notificações de Vencimentos</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Olá, Secretaria de Saúde! 👋
            </div>
            
            <div class="message">
                Este é um <strong>email de teste</strong> do sistema automático de notificações de vencimentos.
                O sistema está funcionando corretamente e pronto para enviar notificações automáticas!
            </div>
            
            <div class="info-box">
                <h3>📋 Informações do Sistema</h3>
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span class="info-value">✅ Sistema Ativo <span class="badge">OPERACIONAL</span></span>
                </div>
                <div class="info-item">
                    <span class="info-label">Data/Hora:</span>
                    <span class="info-value">${dataFormatada}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email Destinatário:</span>
                    <span class="info-value">${EMAIL_SAUDE}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Remetente:</span>
                    <span class="info-value">${EMAIL_REMETENTE}</span>
                </div>
            </div>
            
            <div class="features">
                <h3>🚀 Funcionalidades do Sistema</h3>
                
                <div class="feature-item">
                    <span class="feature-icon">⏰</span>
                    <div class="feature-text">
                        <strong>Notificação Preventiva:</strong> Envia aviso 15 dias antes do vencimento
                    </div>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">🚨</span>
                    <div class="feature-text">
                        <strong>Notificação Crítica:</strong> Alerta no dia do vencimento
                    </div>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">📅</span>
                    <div class="feature-text">
                        <strong>Notificação de Encerramento:</strong> Aviso 60 dias após vencimento
                    </div>
                </div>
                
                <div class="feature-item">
                    <span class="feature-icon">🔄</span>
                    <div class="feature-text">
                        <strong>Execução Automática:</strong> Verifica e envia emails diariamente às 8h
                    </div>
                </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="message">
                <strong>📧 Próximos Passos:</strong><br><br>
                O sistema está configurado e funcionando. Você receberá emails automaticamente quando houver demandas da Secretaria de Saúde próximas do vencimento.
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <p style="color: #666; font-size: 14px;">
                    Este é um email automático. Por favor, não responda.
                </p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Ouvidoria Geral de Duque de Caxias</strong></p>
            <p>Sistema Automático de Notificações de Vencimentos</p>
            <p style="margin-top: 10px; color: #999;">
                © ${new Date().getFullYear()} - Todos os direitos reservados
            </p>
        </div>
    </div>
</body>
</html>
    `,
    text: `
🏥 Ouvidoria Geral de Duque de Caxias
Sistema Automático de Notificações de Vencimentos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Olá, Secretaria de Saúde!

Este é um email de teste do sistema automático de notificações de vencimentos.
O sistema está funcionando corretamente e pronto para enviar notificações automáticas!

📋 INFORMAÇÕES DO SISTEMA

Status: ✅ Sistema Ativo [OPERACIONAL]
Data/Hora: ${dataFormatada}
Email Destinatário: ${EMAIL_SAUDE}
Remetente: ${EMAIL_REMETENTE}

🚀 FUNCIONALIDADES DO SISTEMA

⏰ Notificação Preventiva: Envia aviso 15 dias antes do vencimento
🚨 Notificação Crítica: Alerta no dia do vencimento
📅 Notificação de Encerramento: Aviso 60 dias após vencimento
🔄 Execução Automática: Verifica e envia emails diariamente às 8h

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 PRÓXIMOS PASSOS

O sistema está configurado e funcionando. Você receberá emails automaticamente quando houver demandas da Secretaria de Saúde próximas do vencimento.

Este é um email automático. Por favor, não responda.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ouvidoria Geral de Duque de Caxias
Sistema Automático de Notificações de Vencimentos

© ${new Date().getFullYear()} - Todos os direitos reservados
    `.trim()
  };
}

/**
 * Enviar email
 */
async function enviarEmail() {
  try {
    console.log('📧 Preparando email para Secretaria de Saúde...\n');
    
    const email = criarEmailFormatado();
    
    console.log('📤 Enviando email...');
    console.log(`   Para: ${EMAIL_SAUDE}`);
    console.log(`   Assunto: ${email.subject}\n`);
    
    const resultado = await sendEmail(
      EMAIL_SAUDE,
      email.subject,
      email.html,
      email.text,
      EMAIL_REMETENTE,
      NOME_REMETENTE
    );
    
    console.log('✅ Email enviado com sucesso!');
    console.log(`📧 Message ID: ${resultado.messageId}`);
    console.log(`🔗 Thread ID: ${resultado.threadId}\n`);
    console.log('🎉 Email formatado enviado para a Secretaria de Saúde!');
    console.log(`📬 Verifique a caixa de entrada de: ${EMAIL_SAUDE}\n`);
    
  } catch (error) {
    console.error('\n❌ Erro ao enviar email:', error.message);
    console.error('\n💡 Verifique:');
    console.error('   - Se o Gmail está autorizado (npm run gmail:auth)');
    console.error('   - Se o servidor está rodando');
    console.error('   - Se as credenciais estão corretas\n');
    process.exit(1);
  }
}

// Executar
enviarEmail();

