/**
 * Script de Sincronização de Datas de Conclusão
 * 
 * Compara a planilha bruta com o banco de dados e atualiza
 * as datas de conclusão no banco com os valores da planilha bruta.
 * 
 * CÉREBRO X-3
 * 
 * Uso: node scripts/maintenance/sincronizar-datas-conclusao.js
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';
import { normalizeDate } from '../../src/utils/formatting/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// ID da pasta bruta no Google Drive
const FOLDER_ID_BRUTA = process.env.GOOGLE_FOLDER_BRUTA || "1qXj9eGauvOREKVgRPOfKjRlLSKhefXI5";

/**
 * Autenticar e obter clientes do Google Drive e Sheets
 */
async function getGoogleClients() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_FILE || 'config/google-credentials.json';
  
  const credentialsFile = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.join(projectRoot, credentialsPath);
  
  if (!fs.existsSync(credentialsFile)) {
    throw new Error(`❌ Arquivo de credenciais não encontrado: ${credentialsFile}`);
  }
  
  console.log(`🔐 Carregando credenciais de: ${credentialsFile}\n`);
  
  const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
  const credentials = JSON.parse(credentialsContent);
  
  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });
  
  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  
  return { drive, sheets };
}

/**
 * Buscar a planilha mais recente na pasta bruta
 */
async function getLatestSpreadsheet(drive, folderId) {
  console.log(`🔍 Buscando planilha mais recente na pasta bruta...\n`);
  
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      orderBy: 'modifiedTime desc',
      pageSize: 1,
      fields: 'files(id, name, modifiedTime)',
    });
    
    const files = response.data.files;
    
    if (!files || files.length === 0) {
      throw new Error(`❌ Nenhuma planilha encontrada na pasta bruta`);
    }
    
    const latest = files[0];
    console.log(`✅ Planilha encontrada: ${latest.name}`);
    console.log(`   ID: ${latest.id}`);
    console.log(`   Última modificação: ${latest.modifiedTime}\n`);
    
    return latest;
  } catch (error) {
    throw new Error(`❌ Erro ao buscar planilha: ${error.message}`);
  }
}

/**
 * Ler dados da planilha do Google Sheets
 */
async function readSpreadsheetData(sheets, spreadsheetId) {
  console.log(`📥 Lendo dados da planilha bruta...`);
  
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
    });
    
    const sheetName = spreadsheet.data.sheets[0].properties.title;
    console.log(`📊 Aba: "${sheetName}"\n`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${sheetName}!A:ZZ`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      throw new Error('❌ Nenhum dado encontrado na planilha');
    }
    
    console.log(`✅ ${values.length} linhas baixadas (incluindo cabeçalho)\n`);
    
    const headers = values[0].map(h => String(h || '').trim());
    const data = values.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || null;
      });
      return obj;
    });
    
    return { headers, data };
  } catch (error) {
    throw new Error(`❌ Erro ao ler planilha: ${error.message}`);
  }
}

/**
 * Normalizar nome de coluna (tentar diferentes variações)
 */
function getColumnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== null && row[name] !== undefined && row[name] !== '' && row[name] !== 'NA') {
      return String(row[name]).trim();
    }
    const foundKey = Object.keys(row).find(key => 
      key.toLowerCase() === name.toLowerCase()
    );
    if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '' && row[foundKey] !== 'NA') {
      return String(row[foundKey]).trim();
    }
  }
  return null;
}

/**
 * Normalizar data do formato DD/MM/YY ou DD/MM/YYYY para ISO
 * Usa a função normalizeDate do sistema, mas também trata formatos específicos da planilha
 */
function normalizeDateFromSheet(dateStr) {
  if (!dateStr || dateStr === 'NA' || dateStr === '') {
    return null;
  }
  
  // Tentar normalizar usando a função do sistema
  const normalized = normalizeDate(dateStr);
  if (normalized) {
    return normalized;
  }
  
  // Tentar parsear formato DD/MM/YY ou DD/MM/YYYY
  const dateMatch = String(dateStr).trim().match(/^(\d{1,2})\/(\d{2})\/(\d{2,4})$/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = parseInt(dateMatch[3], 10);
    
    // Se ano tem 2 dígitos, assumir 2000-2099
    if (year < 100) {
      year = year < 50 ? 2000 + year : 1900 + year;
    }
    
    // Validar data
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }
  
  // Tentar parsear formato ISO com hora (2025-12-01 14:49:15.789)
  const isoWithTimeMatch = String(dateStr).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoWithTimeMatch) {
    return isoWithTimeMatch[1];
  }
  
  return null;
}

/**
 * Função principal
 */
async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 SINCRONIZAÇÃO DE DATAS DE CONCLUSÃO');
    console.log('📋 Planilha Bruta → Banco de Dados');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // Conectar ao MongoDB
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Autenticar Google
    const { drive, sheets } = await getGoogleClients();
    
    // Buscar planilha mais recente
    const latestSpreadsheet = await getLatestSpreadsheet(drive, FOLDER_ID_BRUTA);
    
    // Ler dados da planilha
    const { headers, data } = await readSpreadsheetData(sheets, latestSpreadsheet.id);
    
    console.log(`📊 Total de registros na planilha: ${data.length}\n`);
    
    // Criar mapa de protocolos da planilha bruta
    console.log('🔍 Processando dados da planilha bruta...');
    const planilhaMap = new Map(); // protocolo -> { dataConclusao, dataConclusaoIso }
    
    let planilhaProcessados = 0;
    let planilhaSemProtocolo = 0;
    let planilhaSemDataConclusao = 0;
    
    for (const row of data) {
      const protocolo = getColumnValue(row, ['Protocolo', 'protocolo', 'PROTOCOLO']);
      
      if (!protocolo) {
        planilhaSemProtocolo++;
        continue;
      }
      
      const dataConclusao = getColumnValue(row, [
        'Data da Conclusão',
        'Data da conclusão',
        'data_da_conclusao',
        'dataDaConclusao'
      ]);
      
      if (!dataConclusao || dataConclusao === 'NA') {
        planilhaSemDataConclusao++;
        continue;
      }
      
      const dataConclusaoIso = normalizeDateFromSheet(dataConclusao);
      
      if (dataConclusaoIso) {
        planilhaMap.set(String(protocolo), {
          dataConclusao: dataConclusao,
          dataConclusaoIso: dataConclusaoIso
        });
        planilhaProcessados++;
      }
    }
    
    console.log(`✅ Processados: ${planilhaProcessados} protocolos com data de conclusão`);
    console.log(`   Sem protocolo: ${planilhaSemProtocolo}`);
    console.log(`   Sem data de conclusão: ${planilhaSemDataConclusao}\n`);
    
    // Buscar registros do banco de dados
    console.log('🔍 Buscando registros no banco de dados...');
    const records = await Record.find({
      protocolo: { $ne: null, $exists: true }
    }).select('_id protocolo dataDaConclusao dataConclusaoIso').lean();
    
    console.log(`✅ ${records.length} registros encontrados no banco\n`);
    
    // Comparar e preparar atualizações
    console.log('🔄 Comparando e preparando atualizações...');
    const toUpdate = [];
    let semCorrespondencia = 0;
    let jaAtualizado = 0;
    let divergentes = 0;
    
    for (const record of records) {
      const protocolo = String(record.protocolo);
      const dadosPlanilha = planilhaMap.get(protocolo);
      
      if (!dadosPlanilha) {
        semCorrespondencia++;
        continue;
      }
      
      // Comparar datas
      const dataConclusaoAtual = record.dataConclusaoIso || normalizeDate(record.dataDaConclusao);
      const dataConclusaoPlanilha = dadosPlanilha.dataConclusaoIso;
      
      if (dataConclusaoAtual === dataConclusaoPlanilha) {
        jaAtualizado++;
        continue;
      }
      
      // Datas divergentes - precisa atualizar
      divergentes++;
      toUpdate.push({
        _id: record._id,
        protocolo: protocolo,
        dataConclusaoAtual: dataConclusaoAtual,
        dataConclusaoPlanilha: dataConclusaoPlanilha,
        dataDaConclusao: dadosPlanilha.dataConclusao,
        dataConclusaoIso: dataConclusaoPlanilha
      });
    }
    
    console.log(`📊 Estatísticas:`);
    console.log(`   • Protocolos com correspondência: ${planilhaMap.size - semCorrespondencia}`);
    console.log(`   • Já atualizados (datas iguais): ${jaAtualizado}`);
    console.log(`   • Divergentes (precisam atualização): ${divergentes}`);
    console.log(`   • Sem correspondência na planilha: ${semCorrespondencia}\n`);
    
    if (toUpdate.length === 0) {
      console.log('✅ Nenhuma atualização necessária! Todas as datas estão sincronizadas.\n');
      await mongoose.connection.close();
      return;
    }
    
    // Confirmar atualização
    console.log(`⚠️  ATENÇÃO: ${toUpdate.length} registros serão atualizados.`);
    console.log(`   Exemplos de divergências:`);
    toUpdate.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. Protocolo ${item.protocolo}:`);
      console.log(`      Banco: ${item.dataConclusaoAtual || 'N/A'}`);
      console.log(`      Planilha: ${item.dataConclusaoPlanilha} (${item.dataDaConclusao})`);
    });
    console.log('');
    
    // Atualizar registros
    console.log(`🔄 Atualizando ${toUpdate.length} registros...`);
    let atualizados = 0;
    let erros = 0;
    const batchSize = 500;
    
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const slice = toUpdate.slice(i, i + batchSize);
      
      const updatePromises = slice.map(item => {
        return Record.findByIdAndUpdate(
          item._id,
          {
            $set: {
              dataDaConclusao: item.dataDaConclusao,
              dataConclusaoIso: item.dataConclusaoIso
            }
          },
          { new: true }
        ).then(result => {
          atualizados++;
          return result;
        }).catch(error => {
          console.error(`❌ Erro ao atualizar protocolo ${item.protocolo}:`, error.message);
          erros++;
          return null;
        });
      });
      
      await Promise.all(updatePromises);
      
      const processed = Math.min(i + batchSize, toUpdate.length);
      const progress = Math.round((processed / toUpdate.length) * 100);
      console.log(`📦 Processados: ${processed}/${toUpdate.length} (${progress}%) - ${atualizados} atualizados, ${erros} erros`);
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Resumo:`);
    console.log(`   • Registros atualizados: ${atualizados}`);
    console.log(`   • Erros: ${erros}`);
    console.log(`   • Já estavam sincronizados: ${jaAtualizado}`);
    console.log(`   • Sem correspondência: ${semCorrespondencia}\n`);
    
    // Fechar conexão
    await mongoose.connection.close();
    console.log('✅ Conexão fechada. Sincronização finalizada!');
    
  } catch (error) {
    console.error('\n❌ Erro durante sincronização:', error.message);
    console.error(error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Executar
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

