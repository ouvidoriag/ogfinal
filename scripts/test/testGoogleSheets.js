/**
 * Script de Teste de Conexão com Google Sheets
 * 
 * Testa se a conexão com o Google Sheets está funcionando corretamente
 * 
 * Uso: node scripts/testGoogleSheets.js
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Autenticar e obter cliente do Google Sheets
 */
async function getGoogleSheetsClient() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_FILE;
  
  if (!credentialsPath) {
    throw new Error('❌ GOOGLE_CREDENTIALS_FILE não definido no .env');
  }
  
  // Resolver caminho do arquivo de credenciais
  const rootPath = path.join(__dirname, '..');
  const credentialsFile = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(rootPath, credentialsPath);
  
  if (!fs.existsSync(credentialsFile)) {
    throw new Error(`❌ Arquivo de credenciais não encontrado: ${credentialsFile}`);
  }
  
  console.log(`🔐 Carregando credenciais de: ${credentialsFile}\n`);
  
  // Ler e parsear credenciais
  const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
  const credentials = JSON.parse(credentialsContent);
  
  console.log(`✅ Credenciais carregadas:`);
  console.log(`   - Project ID: ${credentials.project_id}`);
  console.log(`   - Client Email: ${credentials.client_email}\n`);
  
  // Autenticar usando Service Account
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  
  return sheets;
}

/**
 * Testar conexão
 */
async function testConnection() {
  console.log('🧪 Testando conexão com Google Sheets...\n');
  
  try {
    // Verificar variáveis de ambiente
    console.log('📋 Verificando configurações...');
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('❌ GOOGLE_SHEET_ID não definido no .env');
    }
    
    console.log(`✅ GOOGLE_SHEET_ID: ${spreadsheetId}\n`);
    
    // Autenticar
    console.log('🔐 Autenticando...');
    const sheets = await getGoogleSheetsClient();
    console.log('✅ Autenticação bem-sucedida!\n');
    
    // Obter informações da planilha
    console.log('📊 Obtendo informações da planilha...');
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    const spreadsheetData = spreadsheet.data;
    console.log('✅ Planilha encontrada!');
    console.log(`   - Título: ${spreadsheetData.properties?.title || 'N/A'}`);
    console.log(`   - ID: ${spreadsheetData.spreadsheetId}`);
    console.log(`   - Abas: ${spreadsheetData.sheets?.length || 0}\n`);
    
    // Listar abas
    if (spreadsheetData.sheets && spreadsheetData.sheets.length > 0) {
      console.log('📑 Abas disponíveis:');
      spreadsheetData.sheets.forEach((sheet, index) => {
        const props = sheet.properties;
        console.log(`   ${index + 1}. "${props.title}" (ID: ${props.sheetId}, ${props.gridProperties?.rowCount || 0} linhas, ${props.gridProperties?.columnCount || 0} colunas)`);
      });
      console.log('');
    }
    
    // Testar leitura de dados (primeiras 5 linhas da primeira aba)
    console.log('📥 Testando leitura de dados...');
    const firstSheet = spreadsheetData.sheets[0];
    if (firstSheet) {
      const sheetName = firstSheet.properties.title;
      const range = `${sheetName}!A1:E5`; // Primeiras 5 linhas, colunas A-E
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: range,
      });
      
      const values = response.data.values;
      
      if (values && values.length > 0) {
        console.log(`✅ Dados lidos com sucesso! (${values.length} linhas)`);
        console.log(`\n📋 Primeiras linhas da aba "${sheetName}":\n`);
        
        values.forEach((row, index) => {
          const rowData = row.map(cell => String(cell || '').substring(0, 30)).join(' | ');
          console.log(`   Linha ${index + 1}: ${rowData}${rowData.length > 100 ? '...' : ''}`);
        });
        console.log('');
      } else {
        console.log('⚠️  Nenhum dado encontrado no range especificado');
      }
    }
    
    console.log('✅✅✅ TESTE CONCLUÍDO COM SUCESSO! ✅✅✅\n');
    console.log('💡 A conexão está funcionando corretamente.');
    console.log('💡 Você pode executar: npm run update:sheets\n');
    
  } catch (error) {
    console.error('\n❌❌❌ ERRO NO TESTE ❌❌❌\n');
    
    if (error.code === 404) {
      console.error('❌ Planilha não encontrada!');
      console.error('   - Verifique se o GOOGLE_SHEET_ID está correto');
      console.error('   - Verifique se a planilha foi compartilhada com o Service Account');
      console.error(`   - Email do Service Account: ${process.env.GOOGLE_CREDENTIALS_FILE ? 'verifique no arquivo de credenciais' : 'N/A'}`);
    } else if (error.code === 403) {
      console.error('❌ Acesso negado!');
      console.error('   - Verifique se a planilha foi compartilhada com o Service Account');
      console.error('   - Verifique se o Service Account tem permissão de Visualizador');
      console.error('   - Verifique se a Google Sheets API está habilitada no projeto');
    } else if (error.message.includes('credentials')) {
      console.error('❌ Erro de credenciais!');
      console.error('   - Verifique se o arquivo de credenciais existe');
      console.error('   - Verifique se o GOOGLE_CREDENTIALS_FILE está correto no .env');
    } else {
      console.error('❌ Erro:', error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    }
    
    console.error('\n💡 Dicas:');
    console.error('   1. Verifique se todas as variáveis estão no .env');
    console.error('   2. Verifique se a planilha foi compartilhada com o Service Account');
    console.error('   3. Verifique se a Google Sheets API está habilitada');
    console.error('   4. Consulte GOOGLE_SHEETS_SETUP.md para mais detalhes\n');
    
    process.exit(1);
  }
}

// Executar teste
testConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });

