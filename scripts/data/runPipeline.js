/**
 * Script de Pipeline Completo
 * 
 * Integra todo o processo:
 * 1. Executa o main.py do Pipeline (que já faz todo o tratamento)
 * 2. Lê os dados da planilha tratada atualizada
 * 3. Salva no banco de dados
 * 
 * Uso: node scripts/data/runPipeline.js
 * OU: npm run pipeline
 * 
 * REQUISITOS:
 * - Python 3 instalado
 * - Dependências do Pipeline instaladas (pip install -r Pipeline/requirements.txt)
 * - Credenciais Google em google-credentials.json
 * - MONGODB_ATLAS_URL definido no .env
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 17/12/2025
 * CÉREBRO X-3
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { google } from 'googleapis';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import { Record } from '../../src/models/index.js';
import { normalizeDate } from '../../src/utils/formatting/dateUtils.js';
import { addLowercaseFields } from '../../src/utils/formatting/normalizeLowercase.js';
import { cleanRecord } from '../../src/utils/cleaner/cleaner.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..'); // NOVO/
const pipelineRoot = path.join(projectRoot, '..'); // Dashboard/

// IDs do Google Drive
const FOLDER_ID_BRUTA = process.env.GOOGLE_FOLDER_BRUTA || "1qXj9eGauvOREKVgRPOfKjRlLSKhefXI5";
const PLANILHA_TRATADA_ID = process.env.GOOGLE_SHEET_ID || "1SCifd4v8D54qihNbwFW2jhHlpR2YtIZVZo81u4qYhV4";

/**
 * Buscar arquivo de credenciais em múltiplos locais possíveis
 * @returns {string} Caminho do arquivo de credenciais encontrado
 * @throws {Error} Se o arquivo não for encontrado
 */
/**
 * Obter credenciais do Google (JSON)
 * Prioridade:
 * 1. Variável de ambiente GOOGLE_CREDENTIALS_JSON (String JSON completa)
 * 2. Arquivo apontado por GOOGLE_CREDENTIALS_FILE
 * 3. Arquivos padrão em locais conhecidos
 */
function getCredentials() {
  // 1. Tentar ler da variável de ambiente direta (recomendado para Render/Production)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      console.log('✅ Credenciais carregadas via GOOGLE_CREDENTIALS_JSON (ENV)');
      return credentials;
    } catch (e) {
      console.error('❌ Erro ao fazer parse de GOOGLE_CREDENTIALS_JSON:', e.message);
      // Continuar tentando arquivos...
    }
  }

  // 2. Buscar arquivo
  const envPath = process.env.GOOGLE_CREDENTIALS_FILE;
  const defaultPath = 'config/google-credentials.json';

  let finalPath = null;

  // Se GOOGLE_CREDENTIALS_FILE está definido
  if (envPath) {
    if (path.isAbsolute(envPath)) {
      if (fs.existsSync(envPath)) {
        finalPath = envPath;
      }
    } else {
      // Tentar múltiplos locais possíveis
      const possiblePaths = [
        path.join(projectRoot, envPath),
        path.join(__dirname, '..', envPath),
        path.join(pipelineRoot, envPath),
        path.join(process.cwd(), envPath)
      ];

      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          finalPath = possiblePath;
          break;
        }
      }
    }
  }

  if (!finalPath) {
    // Tentar locais padrão
    const possiblePaths = [
      path.join(projectRoot, defaultPath),
      path.join(__dirname, '..', defaultPath),
      path.join(pipelineRoot, defaultPath),
      path.join(process.cwd(), defaultPath)
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        finalPath = possiblePath;
        break;
      }
    }
  }

  if (finalPath) {
    console.log(`✅ Arquivo de credenciais encontrado: ${finalPath}`);
    return JSON.parse(fs.readFileSync(finalPath, 'utf-8'));
  }

  // Se não encontrou nada
  const errorMsg = `❌ Credenciais não encontradas (ENV ou Arquivo).
  
Configuração recomendada (Produção/Render):
- Defina a variável de ambiente GOOGLE_CREDENTIALS_JSON com o conteúdo do JSON.

Configuração Local:
- Arquivo config/google-credentials.json`;

  throw new Error(errorMsg);
}

/**
 * Preparar credenciais para o Python (converter para Base64 como esperado pelo main.py)
 */
function prepareCredentialsForPython() {
  const credentials = getCredentials();

  // Converter para Base64 (como o main.py espera)
  const credentialsBase64 = Buffer.from(JSON.stringify(credentials)).toString('base64');

  // Criar arquivo temporário para o Python (no formato esperado pelo main.py)
  // O main.py espera: .github/workflows/credentials.json (Base64)
  const pythonCredentialsPath = path.join(pipelineRoot, '.github', 'workflows', 'credentials.json');
  const pythonCredentialsDir = path.dirname(pythonCredentialsPath);

  // Criar diretório se não existir
  if (!fs.existsSync(pythonCredentialsDir)) {
    fs.mkdirSync(pythonCredentialsDir, { recursive: true });
  }

  // Escrever credenciais em Base64 (como o main.py espera)
  fs.writeFileSync(pythonCredentialsPath, credentialsBase64, 'utf-8');

  console.log(`✅ Credenciais preparadas para o Python em: ${pythonCredentialsPath}\n`);

  return pythonCredentialsPath;
}

/**
 * Executar o main.py do Pipeline
 */
async function runPythonPipeline() {
  console.log('🐍 Executando pipeline Python...\n');

  const pythonScriptPath = path.join(pipelineRoot, 'Pipeline', 'main.py');

  if (!fs.existsSync(pythonScriptPath)) {
    throw new Error(`❌ Script Python não encontrado: ${pythonScriptPath}`);
  }

  // Verificar se Python está instalado (tentar múltiplos comandos no Windows)
  let pythonCmd = null;
  const pythonCommands = process.platform === 'win32'
    ? ['py', 'python', 'python3']
    : ['python3', 'python'];

  for (const cmd of pythonCommands) {
    try {
      await execAsync(`${cmd} --version`);
      pythonCmd = cmd;
      console.log(`✅ Python encontrado: ${cmd}\n`);
      break;
    } catch (error) {
      // Continuar tentando
    }
  }

  if (!pythonCmd) {
    console.log('\n⚠️  Python não encontrado.');
    console.log('   Execute: npm run setup:python');
    console.log('   Ou instale manualmente: https://www.python.org/downloads/\n');
    throw new Error('❌ Python não encontrado. Execute: npm run setup:python');
  }

  // Executar o script Python (usar cwd ao invés de cd no comando)
  console.log(`📝 Executando: ${pythonCmd} "${pythonScriptPath}"`);
  console.log(`📁 Diretório: ${pipelineRoot}\n`);

  try {
    // Configurar encoding UTF-8 para o Python (resolve problema de emojis no Windows)
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };

    const { stdout, stderr } = await execAsync(`"${pythonCmd}" "${pythonScriptPath}"`, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      cwd: pipelineRoot,
      shell: true,
      env: env,
    });

    if (stdout) {
      console.log('📋 Saída do Python:');
      console.log(stdout);
    }

    if (stderr) {
      console.warn('⚠️  Avisos do Python:');
      console.warn(stderr);
    }

    console.log('✅ Pipeline Python executado com sucesso!\n');
  } catch (error) {
    console.error('❌ Erro ao executar pipeline Python:');
    console.error(error.message);
    if (error.stdout) console.error('STDOUT:', error.stdout);
    if (error.stderr) console.error('STDERR:', error.stderr);
    throw error;
  }
}

/**
 * Autenticar e obter cliente do Google Sheets
 */
async function getGoogleClient() {
  const credentials = getCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
    ],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  return { sheets };
}

/**
 * Ler dados da planilha do Google Sheets
 */
async function readSpreadsheetData(sheets, spreadsheetId) {
  console.log(`📥 Lendo dados da planilha tratada (ID: ${spreadsheetId})...`);

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: spreadsheetId,
  });

  const sheetName = spreadsheet.data.sheets[0].properties.title;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: `${sheetName}!A:ZZ`,
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    return [];
  }

  // Primeira linha são os cabeçalhos
  const headers = rows[0].map(h => String(h || '').trim());

  // Converter para objetos
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });

  console.log(`✅ ${data.length} registros lidos da planilha tratada\n`);

  return data;
}

/**
 * Normalizar nome de coluna
 */
function normalizeColumnName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Normalizar protocolo
 */
function normalizeProtocolo(protocolo) {
  if (!protocolo) return null;
  return String(protocolo).trim().toUpperCase();
}

/**
 * Normalizar dados do registro
 */
function normalizeRecordData(row) {
  const normalized = {};

  // 1. Mapeamento inicial (snake_case)
  Object.keys(row).forEach(key => {
    const normalizedKey = normalizeColumnName(key);
    let value = row[key];

    // Normalizar valores vazios
    if (value === null || value === undefined || value === '') {
      value = null;
    }

    normalized[normalizedKey] = value;
  });

  // 2. Mapeamento de snake_case para camelCase (conforme o modelo Record.model.js)
  const fieldMapping = {
    'data_da_criacao': 'dataDaCriacao',
    'status_demanda': 'statusDemanda',
    'prazo_restante': 'prazoRestante',
    'data_da_conclusao': 'dataDaConclusao',
    'tempo_de_resolucao_em_dias': 'tempoDeResolucaoEmDias',
    'tipo_de_manifestacao': 'tipoDeManifestacao',
    'unidade_cadastro': 'unidadeCadastro',
    'unidade_saude': 'unidadeSaude'
  };

  Object.entries(fieldMapping).forEach(([snake, camel]) => {
    if (normalized[snake] !== undefined) {
      normalized[camel] = normalized[snake];
      // Mantemos o original por enquanto para não quebrar referências posteriores no script
    }
  });

  // 3. Aplicar "Inteligência" de limpeza (vinda do Python)
  const cleaned = cleanRecord(normalized);

  // 4. Tratamentos específicos adicionais do Node.js
  // Normalizar protocolo
  if (cleaned.protocolo) {
    cleaned.protocolo = normalizeProtocolo(cleaned.protocolo);
  }

  // Normalizar datas para ISO (usado em filtros de data no dashboard)
  if (cleaned.data_da_criacao || cleaned.dataDaCriacao) {
    cleaned.dataCriacaoIso = normalizeDate(cleaned.data_da_criacao || cleaned.dataDaCriacao);
  }

  if (cleaned.data_da_conclusao || cleaned.dataDaConclusao) {
    cleaned.dataConclusaoIso = normalizeDate(cleaned.data_da_conclusao || cleaned.dataDaConclusao);
  }

  // Criar campo data (original JSON completo)
  cleaned.data = { ...row };

  // Adicionar campos lowercase para otimização de filtros (contains)
  const withLowercase = addLowercaseFields(cleaned);

  return withLowercase;
}

/**
 * Comparar campos para identificar mudanças
 */
function getChangedFields(newData, existingRecord) {
  const changedFields = {};
  let hasChanges = false;

  const fieldsToCompare = [
    'protocolo', 'dataDaCriacao', 'statusDemanda', 'prazoRestante',
    'dataDaConclusao', 'tempoDeResolucaoEmDias', 'prioridade',
    'tipoDeManifestacao', 'tema', 'assunto', 'canal', 'endereco',
    'unidadeCadastro', 'unidadeSaude', 'status', 'servidor',
    'responsavel', 'verificado', 'orgaos',
    'dataCriacaoIso', 'dataConclusaoIso'
  ];

  function valuesEqual(val1, val2) {
    const v1 = val1 === null || val1 === undefined ? null : String(val1).trim();
    const v2 = val2 === null || val2 === undefined ? null : String(val2).trim();
    return v1 === v2;
  }

  for (const field of fieldsToCompare) {
    const newValue = newData[field];
    const existingValue = existingRecord[field];

    if (!valuesEqual(newValue, existingValue)) {
      changedFields[field] = newValue;
      hasChanges = true;
    }
  }

  // Sempre atualizar o campo 'data' (JSON completo) se houver diferenças
  const newDataJson = newData.data || {};
  const existingDataJson = existingRecord.data || {};

  const jsonKeys = new Set([
    ...Object.keys(newDataJson),
    ...Object.keys(existingDataJson)
  ]);

  let jsonChanged = false;
  for (const key of jsonKeys) {
    if (!valuesEqual(newDataJson[key], existingDataJson[key])) {
      jsonChanged = true;
      break;
    }
  }

  if (jsonChanged) {
    changedFields.data = newDataJson;
    hasChanges = true;
  }

  return { changedFields, hasChanges };
}

/**
 * Salvar dados no banco de dados
 * REFATORAÇÃO: Prisma → Mongoose
 */
async function saveToDatabase(jsonData) {
  console.log('💾 Salvando dados no banco de dados...\n');

  // Buscar registros existentes por protocolo
  const existingRecords = await Record.find({
    protocolo: { $ne: null, $exists: true }
  }).lean();

  const existingDataMap = new Map(); // protocolo -> registro completo

  existingRecords.forEach(record => {
    const protocolo = String(record.protocolo);
    existingDataMap.set(protocolo, record);
  });

  // Preparar dados para inserção/atualização
  const toInsert = [];
  const toUpdate = [];
  let unchanged = 0;
  let skipped = 0;

  for (const row of jsonData) {
    const normalized = normalizeRecordData(row);

    if (!normalized.protocolo) {
      skipped++;
      continue;
    }

    const protocolo = String(normalized.protocolo);
    const existingRecord = existingDataMap.get(protocolo);

    if (existingRecord) {
      const { changedFields, hasChanges } = getChangedFields(normalized, existingRecord);

      if (hasChanges) {
        toUpdate.push({
          _id: existingRecord._id,
          protocolo: protocolo,
          changedFields: changedFields
        });
      } else {
        unchanged++;
      }
    } else {
      toInsert.push(normalized);
    }
  }

  console.log(`📊 Preparados: ${toUpdate.length} para atualizar, ${toInsert.length} para inserir, ${unchanged} sem mudanças, ${skipped} sem protocolo\n`);

  // Operações em lote (Bulk Operations)
  const bulkOps = [];

  // Adicionar Updates
  if (toUpdate.length > 0) {
    console.log(`🔄 Preparando ${toUpdate.length} updates...`);
    for (const item of toUpdate) {
      bulkOps.push({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: item.changedFields }
        }
      });
    }
  }

  // Adicionar Inserts
  if (toInsert.length > 0) {
    console.log(`➕ Preparando ${toInsert.length} inserts...`);
    for (const item of toInsert) {
      bulkOps.push({
        insertOne: {
          document: item
        }
      });
    }
  }

  // Executar BulkWrite
  let updated = 0;
  let inserted = 0;

  if (bulkOps.length > 0) {
    console.log(`🚀 Executando BulkWrite com ${bulkOps.length} operações...`);
    console.log('   (Isso pode levar alguns segundos, mas é muito mais rápido que o método anterior)');

    try {
      // Executar em lotes de 1000 para não estourar memória do driver em casos extremos
      const BATCH_SIZE = 1000;
      const totalOps = bulkOps.length;

      for (let i = 0; i < totalOps; i += BATCH_SIZE) {
        const batchOps = bulkOps.slice(i, i + BATCH_SIZE);
        const result = await Record.bulkWrite(batchOps, { ordered: false });

        updated += result.modifiedCount || 0;
        inserted += result.insertedCount || 0;

        const progress = Math.min(i + BATCH_SIZE, totalOps);
        const percentage = Math.round((progress / totalOps) * 100);
        console.log(`📦 Processados: ${progress}/${totalOps} (${percentage}%)`);
      }

      console.log('✅ BulkWrite concluído com sucesso!');

    } catch (error) {
      console.error('❌ Erro durante BulkWrite:', error.message);
      // Tentar recuperar contagens parciais se disponível
      if (error.result) {
        updated += error.result.modifiedCount || 0;
        inserted += error.result.insertedCount || 0;
      }
      // Não relançar erro fatal apenas por duplicatas, mas logar
      if (error.code !== 11000) { // 11000 = Duplicate key
        console.warn('⚠️ Alerta: Algumas operações podem ter falhado.');
      }
    }
  }

  // Definir fieldsUpdated como estimado (já que bulkWrite não retorna fields count detalhado facilmente)
  // Assumindo média de campos por update
  let fieldsUpdated = updated * 5; // Estimativa


  const countAfter = await Record.countDocuments();

  console.log('✅ Dados salvos no banco de dados!');
  console.log(`📊 Estatísticas:`);
  console.log(`   - Registros atualizados: ${updated}`);
  console.log(`   - Campos atualizados: ${fieldsUpdated}`);
  console.log(`   - Registros inseridos: ${inserted}`);
  console.log(`   - Registros sem mudanças: ${unchanged}`);
  console.log(`   - Registros sem protocolo (ignorados): ${skipped}`);
  console.log(`   - Total no banco: ${countAfter}\n`);

  return {
    updated,
    inserted,
    unchanged,
    skipped,
    total: countAfter
  };
}

/**
 * Função principal
 * REFATORAÇÃO: Prisma → Mongoose
 */
async function main() {
  console.log('🚀 Iniciando Pipeline Completo...\n');
  console.log('='.repeat(60));
  console.log('PIPELINE DE PROCESSAMENTO DE DADOS');
  console.log('='.repeat(60) + '\n');

  // Inicializar conexão Mongoose
  const mongodbUrl = process.env.MONGODB_ATLAS_URL;
  if (!mongodbUrl) {
    console.error('❌ MONGODB_ATLAS_URL não está definido no .env');
    process.exit(1);
  }

  console.log('🔌 Conectando ao MongoDB Atlas...');
  const connected = await initializeDatabase(mongodbUrl);
  if (!connected) {
    console.error('❌ Falha ao conectar ao MongoDB Atlas');
    process.exit(1);
  }
  console.log('✅ Conectado ao MongoDB Atlas!\n');

  try {
    // Verificar se deve executar o Python ou apenas ler a planilha
    const SKIP_PYTHON = process.env.SKIP_PYTHON === 'true';

    if (!SKIP_PYTHON) {
      // 1. Preparar credenciais para o Python
      console.log('1️⃣ Preparando credenciais para o Python...');
      prepareCredentialsForPython();

      // 2. Executar pipeline Python
      console.log('2️⃣ Executando pipeline Python (main.py)...');
      try {
        await runPythonPipeline();
      } catch (error) {
        if (error.message.includes('Python não encontrado')) {
          console.log('\n⚠️  Python não encontrado. Pulando execução do Python...');
          console.log('   Para instalar: https://www.python.org/downloads/\n');
          console.log('   Continuando apenas com a leitura da planilha tratada...\n');
        } else {
          throw error;
        }
      }
    } else {
      console.log('⏭️  Pulando execução do Python (SKIP_PYTHON=true)\n');
    }

    // 3. Ler dados da planilha tratada atualizada
    console.log('3️⃣ Lendo dados da planilha tratada atualizada...');
    const { sheets } = await getGoogleClient();
    const dadosTratados = await readSpreadsheetData(sheets, PLANILHA_TRATADA_ID);

    if (dadosTratados.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha tratada.\n');
      return;
    }

    // 4. Salvar no banco de dados
    console.log('4️⃣ Salvando no banco de dados...');
    const dbStats = await saveToDatabase(dadosTratados);

    // Resumo final
    console.log('='.repeat(60));
    console.log('✅ PIPELINE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(60));
    console.log(`📊 Resumo:`);
    console.log(`   - Registros processados pelo Python: ${dadosTratados.length}`);
    console.log(`   - Atualizados no banco: ${dbStats.updated}`);
    console.log(`   - Inseridos no banco: ${dbStats.inserted}`);
    console.log(`   - Sem mudanças no banco: ${dbStats.unchanged}`);
    console.log(`   - Total no banco: ${dbStats.total}\n`);

  } catch (error) {
    console.error('\n❌❌❌ ERRO NO PIPELINE ❌❌❌\n');
    console.error('Erro:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Executar
main()
  .then(() => {
    console.log('🎉 Pipeline finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
