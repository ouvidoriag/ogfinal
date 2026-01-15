/**
 * Script para verificar duplicatas e inconsistências entre planilha e banco
 * 
 * Uso: node scripts/maintenance/verificarDuplicatas.js
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Autenticar e obter cliente do Google Sheets
 */
async function getGoogleSheetsClient() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_FILE;
  const rootPath = path.join(__dirname, '../..');
  const credentialsFile = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(rootPath, credentialsPath);
  
  const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
  const credentials = JSON.parse(credentialsContent);
  
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

/**
 * Converter array de arrays para array de objetos
 */
function convertSheetToJson(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0].map(h => String(h || '').trim());
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined && row[index] !== null && row[index] !== '' 
        ? String(row[index]).trim() 
        : null;
    });
    return obj;
  });
}

async function main() {
  console.log('🔍 Verificando duplicatas e inconsistências...\n');
  
  try {
    // Conectar ao MongoDB
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // 1. Verificar registros no banco
    const totalBanco = await Record.countDocuments();
    const registrosComProtocolo = await Record.countDocuments({
      protocolo: { $ne: null, $exists: true }
    });
    const registrosSemProtocolo = totalBanco - registrosComProtocolo;
    
    console.log('📊 ESTATÍSTICAS DO BANCO:');
    console.log(`   - Total de registros: ${totalBanco}`);
    console.log(`   - Com protocolo: ${registrosComProtocolo}`);
    console.log(`   - Sem protocolo: ${registrosSemProtocolo}\n`);
    
    // 2. Verificar duplicatas no banco (mesmo protocolo)
    const duplicatasBanco = await Record.aggregate([
      {
        $match: {
          protocolo: { $ne: null, $exists: true }
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    console.log('🔍 DUPLICATAS NO BANCO:');
    if (duplicatasBanco.length === 0) {
      console.log('   ✅ Nenhuma duplicata encontrada\n');
    } else {
      console.log(`   ⚠️  ${duplicatasBanco.length} protocolos duplicados encontrados:`);
      duplicatasBanco.slice(0, 10).forEach(dup => {
        console.log(`      - Protocolo ${dup._id}: ${dup.count} ocorrências`);
      });
      if (duplicatasBanco.length > 10) {
        console.log(`      ... e mais ${duplicatasBanco.length - 10} protocolos duplicados`);
      }
      console.log('');
    }
    
    // 3. Ler dados da planilha
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = spreadsheet.data.sheets[0].properties.title;
    const range = `${sheetName}!A:ZZ`;
    
    console.log(`📥 Lendo planilha: "${sheetName}"...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    
    const values = response.data.values;
    const json = convertSheetToJson(values);
    
    console.log(`✅ ${json.length} linhas de dados na planilha\n`);
    
    // 4. Verificar duplicatas na planilha
    const protocolosPlanilha = new Map();
    const duplicatasPlanilha = [];
    
    json.forEach((row, index) => {
      const protocolo = String(row.protocolo || row.Protocolo || row.PROTOCOLO || '').trim();
      if (protocolo) {
        if (protocolosPlanilha.has(protocolo)) {
          const existing = protocolosPlanilha.get(protocolo);
          existing.count++;
          existing.linhas.push(index + 2); // +2 porque index começa em 0 e tem cabeçalho
        } else {
          protocolosPlanilha.set(protocolo, {
            count: 1,
            linhas: [index + 2]
          });
        }
      }
    });
    
    protocolosPlanilha.forEach((info, protocolo) => {
      if (info.count > 1) {
        duplicatasPlanilha.push({
          protocolo,
          count: info.count,
          linhas: info.linhas
        });
      }
    });
    
    console.log('🔍 DUPLICATAS NA PLANILHA:');
    if (duplicatasPlanilha.length === 0) {
      console.log('   ✅ Nenhuma duplicata encontrada\n');
    } else {
      console.log(`   ⚠️  ${duplicatasPlanilha.length} protocolos duplicados encontrados:`);
      duplicatasPlanilha.slice(0, 10).forEach(dup => {
        console.log(`      - Protocolo ${dup.protocolo}: ${dup.count} ocorrências (linhas: ${dup.linhas.join(', ')})`);
      });
      if (duplicatasPlanilha.length > 10) {
        console.log(`      ... e mais ${duplicatasPlanilha.length - 10} protocolos duplicados`);
      }
      console.log('');
    }
    
    // 5. Comparar contagens
    const protocolosUnicosPlanilha = protocolosPlanilha.size;
    const linhasSemProtocolo = json.length - protocolosUnicosPlanilha - duplicatasPlanilha.reduce((sum, d) => sum + (d.count - 1), 0);
    
    console.log('📊 COMPARAÇÃO:');
    console.log(`   Planilha:`);
    console.log(`      - Total de linhas: ${json.length}`);
    console.log(`      - Protocolos únicos: ${protocolosUnicosPlanilha}`);
    console.log(`      - Protocolos duplicados: ${duplicatasPlanilha.length}`);
    console.log(`      - Linhas sem protocolo: ${linhasSemProtocolo}`);
    console.log(`   Banco:`);
    console.log(`      - Total de registros: ${totalBanco}`);
    console.log(`      - Com protocolo: ${registrosComProtocolo}`);
    console.log(`      - Sem protocolo: ${registrosSemProtocolo}`);
    console.log(`      - Protocolos duplicados: ${duplicatasBanco.length}`);
    console.log('');
    
    // 6. Verificar diferença
    const diferenca = totalBanco - json.length;
    if (diferenca !== 0) {
      console.log(`⚠️  DIFERENÇA ENCONTRADA:`);
      console.log(`   Banco tem ${Math.abs(diferenca)} registro(s) ${diferenca > 0 ? 'a mais' : 'a menos'} que a planilha`);
      console.log('');
      
      if (diferenca > 0) {
        console.log('🔍 Possíveis causas:');
        console.log(`   - ${duplicatasBanco.length} protocolos duplicados no banco`);
        console.log(`   - ${registrosSemProtocolo} registros sem protocolo no banco`);
        console.log(`   - Registros inseridos manualmente ou por outros processos`);
      }
    } else {
      console.log('✅ Contagens coincidem!');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

main()
  .then(() => {
    console.log('\n🎉 Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });



