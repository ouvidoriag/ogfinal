/**
 * Script para Verificar se Email foi Enviado
 * Verifica na caixa de saída do Gmail se o email foi enviado
 */

import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveConfigPath(filename) {
  const modulePath = path.join(__dirname, '../../config', filename);
  if (fs.existsSync(modulePath)) {
    return modulePath;
  }
  const cwdPath = path.join(process.cwd(), 'config', filename);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  const novoPath = path.join(process.cwd(), 'NOVO', 'config', filename);
  if (fs.existsSync(novoPath)) {
    return novoPath;
  }
  return modulePath;
}

const TOKEN_PATH = resolveConfigPath('gmail-token.json');
const CREDENTIALS_PATH = resolveConfigPath('gmail-credentials.json');

async function verificarEmailEnviado() {
  console.log('🔍 Verificando emails enviados...\n');
  
  try {
    // Carregar credenciais
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id } = credentials.installed || credentials.web;
    
    // Carregar token
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    
    const auth = new google.auth.OAuth2(
      client_id,
      client_secret,
      'http://localhost'
    );
    
    auth.setCredentials(token);
    
    const gmail = google.gmail({ version: 'v1', auth });
    
    // Buscar emails enviados recentemente (últimas 24 horas)
    const agora = new Date();
    const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const timestamp = Math.floor(ontem.getTime() / 1000);
    
    console.log('📧 Buscando emails enviados nas últimas 24 horas...\n');
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: `from:me after:${timestamp} subject:"RESUMO DIÁRIO"`,
      maxResults: 10
    });
    
    if (!response.data.messages || response.data.messages.length === 0) {
      console.log('⚠️  Nenhum email de resumo encontrado nas últimas 24 horas.\n');
      
      // Buscar qualquer email enviado recentemente
      console.log('🔍 Buscando qualquer email enviado recentemente...\n');
      const response2 = await gmail.users.messages.list({
        userId: 'me',
        q: `from:me after:${timestamp}`,
        maxResults: 5
      });
      
      if (response2.data.messages && response2.data.messages.length > 0) {
        console.log(`✅ Encontrados ${response2.data.messages.length} email(s) enviado(s) recentemente:\n`);
        
        for (const msg of response2.data.messages.slice(0, 5)) {
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'To', 'Date']
          });
          
          const headers = message.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'N/A';
          const to = headers.find(h => h.name === 'To')?.value || 'N/A';
          const date = headers.find(h => h.name === 'Date')?.value || 'N/A';
          
          console.log(`   📧 ${subject}`);
          console.log(`      Para: ${to}`);
          console.log(`      Data: ${date}`);
          console.log(`      ID: ${msg.id}\n`);
        }
      } else {
        console.log('❌ Nenhum email enviado encontrado nas últimas 24 horas.\n');
      }
      
      return;
    }
    
    console.log(`✅ Encontrados ${response.data.messages.length} email(s) de resumo:\n`);
    
    for (const msg of response.data.messages) {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'To', 'Date', 'Message-ID']
      });
      
      const headers = message.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || 'N/A';
      const to = headers.find(h => h.name === 'To')?.value || 'N/A';
      const date = headers.find(h => h.name === 'Date')?.value || 'N/A';
      const messageId = headers.find(h => h.name === 'Message-ID')?.value || msg.id;
      
      console.log(`   📧 ${subject}`);
      console.log(`      Para: ${to}`);
      console.log(`      Data: ${date}`);
      console.log(`      Message-ID: ${messageId}`);
      console.log(`      ID Gmail: ${msg.id}\n`);
    }
    
    // Verificar especificamente o último email enviado
    console.log('🔍 Verificando último email enviado...\n');
    const ultimoEmail = await gmail.users.messages.get({
      userId: 'me',
      id: response.data.messages[0].id,
      format: 'full'
    });
    
    const headers = ultimoEmail.data.payload.headers;
    const to = headers.find(h => h.name === 'To')?.value || 'N/A';
    const subject = headers.find(h => h.name === 'Subject')?.value || 'N/A';
    
    console.log(`📧 Último email de resumo:`);
    console.log(`   Para: ${to}`);
    console.log(`   Assunto: ${subject}`);
    
    if (to.includes('ouvgeral.gestao@gmail.com')) {
      console.log(`\n✅ Email foi enviado para ouvgeral.gestao@gmail.com!`);
      console.log(`   Verifique a caixa de entrada (e spam) do email.\n`);
    } else {
      console.log(`\n⚠️  Email não foi enviado para ouvgeral.gestao@gmail.com`);
      console.log(`   Foi enviado para: ${to}\n`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar:', error.message);
    if (error.message.includes('invalid_grant') || error.message.includes('invalid_token')) {
      console.log('\n💡 Token inválido. Execute: npm run gmail:auth\n');
    }
  }
}

verificarEmailEnviado();



