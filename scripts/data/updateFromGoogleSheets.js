/**
 * Script de Atualização de Dados do Google Sheets
 * 
 * Atualiza o banco de dados com dados de uma planilha do Google Sheets
 * - Atualiza registros existentes baseado no protocolo
 * - Insere novos registros
 * - Normaliza campos principais
 * 
 * Uso: node scripts/updateFromGoogleSheets.js
 * OU: npm run update:sheets
 * 
 * Requisitos:
 * - Arquivo JSON de credenciais do Google (GOOGLE_CREDENTIALS_FILE no .env)
 * - ID da planilha do Google Sheets (GOOGLE_SHEET_ID no .env)
 * - Nome da aba (opcional, padrão: primeira aba)
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

/**
 * Normaliza um campo string
 */
function cleanString(str) {
  if (!str || str === '-' || str === '' || str === 'null' || str === 'undefined') return null;
  const cleaned = String(str).trim();
  return cleaned || null;
}

/**
 * Normaliza protocolo para comparação (remove espaços, normaliza)
 */
function normalizeProtocolo(protocolo) {
  if (!protocolo) return null;
  // Converter para string, remover espaços extras, trim
  return String(protocolo).trim().replace(/\s+/g, '') || null;
}

/**
 * Normalizar string para lowercase sem acentos
 */
function normalizeToLowercase(str) {
  if (!str || typeof str !== 'string') {
    return null;
  }
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .toLowerCase()
    .trim();
}

/**
 * Normaliza dados de um registro do Google Sheets
 */
function normalizeRecordData(row) {
  // Extrair protocolo (pode estar em diferentes formatos)
  const protocolo = cleanString(row.protocolo || row.Protocolo || row.PROTOCOLO);

  // Normalizar campos principais conforme schema do Prisma
  const normalized = {
    data: row, // JSON completo
    protocolo: protocolo,
    dataDaCriacao: cleanString(row.data_da_criacao || row.dataDaCriacao || row['Data da Criação'] || row['Data da criação']),
    statusDemanda: cleanString(row.status_demanda || row.statusDemanda || row['Status Demanda'] || row['Status da Demanda']),
    prazoRestante: cleanString(row.prazo_restante || row.prazoRestante || row['Prazo Restante']),
    dataDaConclusao: cleanString(row.data_da_conclusao || row.dataDaConclusao || row['Data da Conclusão'] || row['Data da conclusão']),
    tempoDeResolucaoEmDias: cleanString(row.tempo_de_resolucao_em_dias || row.tempoDeResolucaoEmDias || row['Tempo de Resolução em Dias']),
    prioridade: cleanString(row.prioridade || row.Prioridade || row['Prioridade']),
    tipoDeManifestacao: cleanString(row.tipo_de_manifestacao || row.tipoDeManifestacao || row['Tipo de Manifestação'] || row['Tipo']),
    tema: cleanString(row.tema || row.Tema || row['Tema']),
    assunto: cleanString(row.assunto || row.Assunto || row['Assunto']),
    canal: cleanString(row.canal || row.Canal || row['Canal']),
    endereco: cleanString(row.endereco || row.Endereco || row['Endereço'] || row['Endereco']),
    unidadeCadastro: cleanString(row.unidade_cadastro || row.unidadeCadastro || row['Unidade Cadastro'] || row['Setor'] || row.setor),
    unidadeSaude: cleanString(row.unidade_saude || row.unidadeSaude || row['Unidade Saúde'] || row['Unidade Saude']),
    status: cleanString(row.status || row.Status || row['Status']),
    servidor: cleanString(row.servidor || row.Servidor || row['Servidor']),
    responsavel: cleanString(row.responsavel || row.Responsavel || row['Responsável'] || row['Responsavel']),
    verificado: cleanString(row.verificado || row.Verificado || row['Verificado']),
    orgaos: cleanString(row.orgaos || row.Orgaos || row['Órgãos'] || row['Orgaos'] || row['Secretaria'] || row.secretaria),
  };

  // MELHORIA: Adicionar campos lowercase indexados para otimizar filtros "contains"
  normalized.temaLowercase = normalizeToLowercase(normalized.tema);
  normalized.assuntoLowercase = normalizeToLowercase(normalized.assunto);
  normalized.canalLowercase = normalizeToLowercase(normalized.canal);
  normalized.orgaosLowercase = normalizeToLowercase(normalized.orgaos);
  normalized.statusDemandaLowercase = normalizeToLowercase(normalized.statusDemanda);
  normalized.tipoDeManifestacaoLowercase = normalizeToLowercase(normalized.tipoDeManifestacao);
  normalized.responsavelLowercase = normalizeToLowercase(normalized.responsavel);

  // Normalizar datas ISO (YYYY-MM-DD)
  normalized.dataCriacaoIso = normalizeDate(normalized.dataDaCriacao);
  normalized.dataConclusaoIso = normalizeDate(normalized.dataDaConclusao);

  return normalized;
}

/**
 * Converte array de arrays do Google Sheets para array de objetos
 */
function convertSheetToJson(values, headers) {
  if (!values || values.length === 0) return [];

  // Se não foram fornecidos headers, usar a primeira linha
  if (!headers) {
    headers = values[0].map(h => String(h || '').trim());
    values = values.slice(1); // Remover linha de cabeçalho
  }

  return values.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      const value = row[index];
      // Converter para string e limpar
      obj[header] = value !== undefined && value !== null && value !== '' ? String(value).trim() : null;
    });
    return obj;
  });
}

/**
 * Autenticar e obter cliente do Google Sheets
 */
async function getGoogleSheetsClient() {
  const credentialsPath = process.env.GOOGLE_CREDENTIALS_FILE;

  if (!credentialsPath) {
    throw new Error('❌ GOOGLE_CREDENTIALS_FILE não definido no .env');
  }

  // Resolver caminho do arquivo de credenciais
  const rootPath = path.join(__dirname, '../..');
  let credentialsFile = path.isAbsolute(credentialsPath)
    ? credentialsPath
    : path.resolve(rootPath, credentialsPath);

  // Fallback 1: Se não achar, tentar na raiz do projeto
  if (!fs.existsSync(credentialsFile)) {
    const rootFallback = path.join(rootPath, path.basename(credentialsPath));
    if (fs.existsSync(rootFallback)) {
      credentialsFile = rootFallback;
    }
  }

  // Fallback 2: Se ainda não achar, tentar em config/
  if (!fs.existsSync(credentialsFile)) {
    const configFallback = path.join(rootPath, 'config', path.basename(credentialsPath));
    if (fs.existsSync(configFallback)) {
      credentialsFile = configFallback;
    }
  }

  if (!fs.existsSync(credentialsFile)) {
    throw new Error(`❌ Arquivo de credenciais não encontrado em: ${credentialsFile}`);
  }

  console.log(`🔐 Carregando credenciais de: ${credentialsFile}\n`);

  // Ler e parsear credenciais
  const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
  const credentials = JSON.parse(credentialsContent);

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
 * Ler dados do Google Sheets
 */
async function readGoogleSheet(sheets, spreadsheetId, range = null) {
  try {
    // Se range não foi especificado, ler toda a primeira aba
    if (!range) {
      // Primeiro, obter informações da planilha para descobrir o nome da primeira aba
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
      });

      const sheetName = spreadsheet.data.sheets[0].properties.title;
      range = `${sheetName}!A:ZZ`; // Ler todas as colunas até ZZ

      console.log(`📊 Lendo aba: "${sheetName}"\n`);
    }

    console.log(`📥 Baixando dados do Google Sheets...`);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: range,
    });

    const values = response.data.values;

    if (!values || values.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha');
      return [];
    }

    console.log(`✅ ${values.length} linhas baixadas (incluindo cabeçalho)\n`);

    // Converter para JSON
    const json = convertSheetToJson(values);

    return json;
  } catch (error) {
    if (error.code === 404) {
      throw new Error(`❌ Planilha não encontrada. Verifique o GOOGLE_SHEET_ID no .env`);
    } else if (error.code === 403) {
      throw new Error(`❌ Acesso negado. Verifique se as credenciais têm permissão para acessar a planilha`);
    } else {
      throw new Error(`❌ Erro ao ler planilha: ${error.message}`);
    }
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando atualização de dados do Google Sheets...\n');

  try {
    // Conectar ao MongoDB usando Mongoose
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }

    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');

    // Obter ID da planilha
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      throw new Error('❌ GOOGLE_SHEET_ID não definido no .env');
    }

    console.log(`📋 ID da planilha: ${spreadsheetId}\n`);

    // Obter range opcional (ex: "Aba1!A1:Z1000" ou apenas "Aba1")
    const sheetRange = process.env.GOOGLE_SHEET_RANGE || null;

    // Autenticar e obter cliente
    const sheets = await getGoogleSheetsClient();

    // Ler dados da planilha
    const json = await readGoogleSheet(sheets, spreadsheetId, sheetRange);

    if (json.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha');
      return;
    }

    console.log(`✅ ${json.length} linhas de dados processadas\n`);

    // Contar registros antes
    const countBefore = await Record.countDocuments();
    console.log(`📊 Registros no banco antes: ${countBefore}\n`);

    // Buscar protocolos existentes COM DADOS COMPLETOS para comparação
    console.log('🔍 Buscando registros existentes no banco...');
    const existingRecords = await Record.find({
      protocolo: { $ne: null, $exists: true }
    }).lean();

    // Criar mapas para acesso rápido
    const protocolMap = new Map(); // protocolo normalizado -> id
    const existingDataMap = new Map(); // protocolo normalizado -> registro completo

    existingRecords.forEach(record => {
      // Normalizar protocolo para garantir comparação consistente
      const protocoloNormalizado = normalizeProtocolo(record.protocolo);
      if (protocoloNormalizado) {
        protocolMap.set(protocoloNormalizado, record._id.toString());
        existingDataMap.set(protocoloNormalizado, record);
      }
    });

    console.log(`✅ ${protocolMap.size} registros encontrados no banco\n`);

    /**
     * Compara dois valores considerando null/undefined
     */
    function valuesEqual(val1, val2) {
      const v1 = val1 === null || val1 === undefined ? null : String(val1).trim();
      const v2 = val2 === null || val2 === undefined ? null : String(val2).trim();
      return v1 === v2;
    }

    /**
     * Identifica campos que mudaram ou faltam
     */
    function getChangedFields(newData, existingRecord) {
      const changedFields = {};
      let hasChanges = false;

      // Campos normalizados para comparar
      const fieldsToCompare = [
        'protocolo', 'dataDaCriacao', 'statusDemanda', 'prazoRestante',
        'dataDaConclusao', 'tempoDeResolucaoEmDias', 'prioridade',
        'tipoDeManifestacao', 'tema', 'assunto', 'canal', 'endereco',
        'unidadeCadastro', 'unidadeSaude', 'status', 'servidor',
        'responsavel', 'verificado', 'orgaos',
        'dataCriacaoIso', 'dataConclusaoIso'
      ];

      // Comparar cada campo
      for (const field of fieldsToCompare) {
        const newValue = newData[field];
        const existingValue = existingRecord[field];

        if (!valuesEqual(newValue, existingValue)) {
          changedFields[field] = newValue;
          hasChanges = true;
        }
      }

      // Sempre atualizar o campo 'data' (JSON completo) se houver diferenças
      // Comparar chaves principais do JSON
      const newDataJson = newData.data || {};
      const existingDataJson = existingRecord.data || {};

      // Verificar se há diferenças significativas no JSON
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
        changedFields.data = newData.data;
        hasChanges = true;
      }

      return { changedFields, hasChanges };
    }

    // Preparar dados para inserção e atualização
    const toInsert = [];
    const toUpdate = [];
    let skipped = 0;
    let unchanged = 0;
    let duplicatasIgnoradas = 0;

    // Set para rastrear protocolos já processados da planilha (evitar duplicatas)
    const protocolosProcessadosPlanilha = new Set();

    console.log('🔄 Processando e comparando dados...');
    for (const row of json) {
      const normalized = normalizeRecordData(row);

      if (!normalized.protocolo) {
        skipped++;
        continue;
      }

      // Normalizar protocolo para comparação consistente
      const protocoloNormalizado = normalizeProtocolo(normalized.protocolo);

      if (!protocoloNormalizado) {
        skipped++;
        continue;
      }

      // Se já processamos este protocolo nesta execução, ignorar (duplicata na planilha)
      if (protocolosProcessadosPlanilha.has(protocoloNormalizado)) {
        duplicatasIgnoradas++;
        continue;
      }

      // Marcar como processado
      protocolosProcessadosPlanilha.add(protocoloNormalizado);

      const existingRecord = existingDataMap.get(protocoloNormalizado);

      if (existingRecord) {
        // Comparar e identificar mudanças
        const { changedFields, hasChanges } = getChangedFields(normalized, existingRecord);

        if (hasChanges) {
          toUpdate.push({
            _id: existingRecord._id,
            protocolo: protocoloNormalizado,
            changedFields: changedFields
          });
        } else {
          unchanged++;
        }
      } else {
        // Novo registro
        toInsert.push(normalized);
      }
    }

    console.log(`📊 Preparados: ${toUpdate.length} para atualizar, ${toInsert.length} para inserir, ${unchanged} sem mudanças, ${skipped} sem protocolo, ${duplicatasIgnoradas} duplicatas ignoradas na planilha\n`);

    // Processar atualizações (apenas campos que mudaram)
    let updated = 0;
    let fieldsUpdated = 0;
    const batchSize = 500;

    if (toUpdate.length > 0) {
      console.log(`🔄 Atualizando ${toUpdate.length} registros (apenas campos alterados)...`);
      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const slice = toUpdate.slice(i, i + batchSize);

        const updatePromises = slice.map(item => {
          // Atualizar apenas os campos que mudaram
          return Record.findByIdAndUpdate(
            item._id,
            { $set: item.changedFields },
            { new: true }
          ).then(result => {
            fieldsUpdated += Object.keys(item.changedFields).length;
            return result;
          }).catch(error => {
            console.error(`❌ Erro ao atualizar protocolo ${item.protocolo}:`, error.message);
            return null;
          });
        });

        const results = await Promise.all(updatePromises);
        updated += results.filter(r => r !== null).length;

        const processed = Math.min(i + batchSize, toUpdate.length);
        const progress = Math.round((processed / toUpdate.length) * 100);
        console.log(`📦 Atualizados: ${processed}/${toUpdate.length} (${progress}%) - ${fieldsUpdated} campos modificados`);
      }
      console.log('');
    }

    // Processar inserções
    let inserted = 0;

    if (toInsert.length > 0) {
      console.log('➕ Inserindo novos registros...');
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const slice = toInsert.slice(i, i + batchSize);

        try {
          // Verificar duplicatas antes de inserir (proteção adicional)
          const protocolosParaInserir = new Set();
          const sliceSemDuplicatas = [];

          for (const item of slice) {
            const protocoloNorm = normalizeProtocolo(item.protocolo);
            if (protocoloNorm && !protocolosParaInserir.has(protocoloNorm)) {
              // Verificar se já existe no banco (proteção contra race conditions)
              const existe = await Record.findOne({ protocolo: protocoloNorm }).lean();
              if (!existe) {
                protocolosParaInserir.add(protocoloNorm);
                sliceSemDuplicatas.push(item);
              }
            }
          }

          if (sliceSemDuplicatas.length > 0) {
            // Usar insertMany com ordered: false para continuar mesmo com duplicatas
            const result = await Record.insertMany(sliceSemDuplicatas, {
              ordered: false
            });
            inserted += result.length;
          }
        } catch (error) {
          // Se insertMany falhar, inserir um por um com verificação
          if (error.code === 11000 || error.message.includes('duplicate') || error.writeErrors) {
            console.warn(`⚠️ Duplicatas detectadas no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
            for (const item of slice) {
              try {
                const protocoloNorm = normalizeProtocolo(item.protocolo);
                if (protocoloNorm) {
                  // Verificar se já existe antes de inserir
                  const existe = await Record.findOne({ protocolo: protocoloNorm }).lean();
                  if (!existe) {
                    await Record.create(item);
                    inserted++;
                  }
                }
              } catch (e) {
                if (e.code !== 11000 && !e.message.includes('duplicate')) {
                  console.error(`❌ Erro ao inserir protocolo ${item.protocolo}:`, e.message);
                }
              }
            }
          } else {
            console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
            // Tentar inserir um por um com verificação
            for (const item of slice) {
              try {
                const protocoloNorm = normalizeProtocolo(item.protocolo);
                if (protocoloNorm) {
                  const existe = await Record.findOne({ protocolo: protocoloNorm }).lean();
                  if (!existe) {
                    await Record.create(item);
                    inserted++;
                  }
                }
              } catch (e) {
                console.error(`❌ Erro ao inserir protocolo ${item.protocolo}:`, e.message);
              }
            }
          }
        }

        const processed = Math.min(i + batchSize, toInsert.length);
        const progress = Math.round((processed / toInsert.length) * 100);
        console.log(`📦 Inseridos: ${processed}/${toInsert.length} (${progress}%)`);
      }
      console.log('');
    }

    const countAfter = await Record.countDocuments();

    console.log('✅ Atualização concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`   - Registros antes: ${countBefore}`);
    console.log(`   - Registros após: ${countAfter}`);
    console.log(`   - Registros atualizados: ${updated} (apenas campos que mudaram)`);
    console.log(`   - Total de campos modificados: ${fieldsUpdated}`);
    console.log(`   - Registros sem mudanças: ${unchanged}`);
    console.log(`   - Novos registros inseridos: ${inserted}`);
    console.log(`   - Sem protocolo (ignorados): ${skipped}`);
    console.log(`   - Duplicatas ignoradas na planilha: ${duplicatasIgnoradas}`);
    console.log(`   - Total de novos registros: ${countAfter - countBefore}`);
    console.log(`\n💡 Execute: npm run db:normalize para normalizar campos adicionais (se necessário)`);

  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexão com banco de dados fechada');
  }
}

// Executar
main()
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });

