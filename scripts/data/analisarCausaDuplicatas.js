/**
 * Script para Analisar a Causa das Duplicatas
 * 
 * Analisa:
 * 1. Se há duplicatas na planilha do Google Sheets
 * 2. Se a lógica de comparação está funcionando corretamente
 * 3. Se há problemas na busca de registros existentes
 * 4. Se há race conditions ou problemas de timing
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
 * Normaliza um campo string
 */
function cleanString(str) {
  if (!str || str === '-' || str === '' || str === 'null' || str === 'undefined') return null;
  const cleaned = String(str).trim();
  return cleaned || null;
}

/**
 * Normaliza dados de um registro do Google Sheets
 */
function normalizeRecordData(row) {
  const protocolo = cleanString(row.protocolo || row.Protocolo || row.PROTOCOLO);
  return {
    protocolo: protocolo,
    data: row
  };
}

async function analisarCausaDuplicatas() {
  console.log('🔍 Analisando causa das duplicatas...\n');

  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }

    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');

    // 1. Verificar duplicatas na planilha do Google Sheets
    console.log('📊 PASSO 1: Verificando duplicatas na planilha do Google Sheets...\n');

    const credentialsPath = path.join(__dirname, '../../config/google-credentials.json');
    if (!fs.existsSync(credentialsPath)) {
      throw new Error(`❌ Arquivo de credenciais não encontrado: ${credentialsPath}`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1SCifd4v8D54qihNbwFW2jhHlpR2YtIZVZo81u4qYhV4';
    const sheetRange = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1:Z10000';

    console.log(`📋 Lendo planilha: ${spreadsheetId}\n`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetRange
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha\n');
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`✅ ${dataRows.length} linhas de dados na planilha\n`);

    // Normalizar e extrair protocolos
    const protocolosPlanilha = [];
    const protocolosMap = new Map();

    for (let i = 0; i < dataRows.length; i++) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = dataRows[i][idx];
      });

      const normalized = normalizeRecordData(row);
      if (normalized.protocolo) {
        const protocolo = String(normalized.protocolo);
        protocolosPlanilha.push({
          protocolo,
          linha: i + 2, // +2 porque linha 1 é header e arrays começam em 0
          dados: normalized
        });

        if (!protocolosMap.has(protocolo)) {
          protocolosMap.set(protocolo, []);
        }
        protocolosMap.get(protocolo).push(i + 2);
      }
    }

    // Encontrar duplicatas na planilha
    const duplicatasPlanilha = [];
    protocolosMap.forEach((linhas, protocolo) => {
      if (linhas.length > 1) {
        duplicatasPlanilha.push({
          protocolo,
          linhas,
          quantidade: linhas.length
        });
      }
    });

    if (duplicatasPlanilha.length > 0) {
      console.log(`🚨 ENCONTRADAS ${duplicatasPlanilha.length} DUPLICATAS NA PLANILHA:\n`);
      duplicatasPlanilha.slice(0, 20).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${dup.protocolo}`);
        console.log(`      Aparece ${dup.quantidade} vezes nas linhas: ${dup.linhas.join(', ')}\n`);
      });

      if (duplicatasPlanilha.length > 20) {
        console.log(`   ... e mais ${duplicatasPlanilha.length - 20} duplicatas na planilha\n`);
      }
    } else {
      console.log('✅ Nenhuma duplicata encontrada na planilha\n');
    }

    // 2. Verificar se a busca de registros existentes está funcionando
    console.log('📊 PASSO 2: Verificando busca de registros existentes...\n');

    const existingRecords = await Record.find({
      protocolo: { $ne: null, $exists: true }
    }).lean();

    console.log(`✅ ${existingRecords.length} registros encontrados no banco\n`);

    // Criar mapa de protocolos do banco
    const protocolMapBanco = new Map();
    const protocolosDuplicadosBanco = [];

    existingRecords.forEach(record => {
      const protocolo = String(record.protocolo);
      if (!protocolMapBanco.has(protocolo)) {
        protocolMapBanco.set(protocolo, []);
      }
      protocolMapBanco.get(protocolo).push(record._id.toString());
    });

    // Verificar duplicatas no banco
    protocolMapBanco.forEach((ids, protocolo) => {
      if (ids.length > 1) {
        protocolosDuplicadosBanco.push({
          protocolo,
          ids,
          quantidade: ids.length
        });
      }
    });

    if (protocolosDuplicadosBanco.length > 0) {
      console.log(`🚨 ENCONTRADAS ${protocolosDuplicadosBanco.length} DUPLICATAS NO BANCO:\n`);
      protocolosDuplicadosBanco.slice(0, 10).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Protocolo: ${dup.protocolo}`);
        console.log(`      Quantidade: ${dup.quantidade} registros`);
        console.log(`      IDs: ${dup.ids.join(', ')}\n`);
      });
    } else {
      console.log('✅ Nenhuma duplicata encontrada no banco\n');
    }

    // 3. Verificar se protocolos da planilha existem no banco
    console.log('📊 PASSO 3: Verificando correspondência planilha ↔ banco...\n');

    const protocolosUnicosPlanilha = new Set(protocolosPlanilha.map(p => p.protocolo));
    const protocolosUnicosBanco = new Set(protocolMapBanco.keys());

    const protocolosNovos = [];
    const protocolosExistentes = [];
    const protocolosFaltando = [];

    protocolosUnicosPlanilha.forEach(protocolo => {
      if (protocolMapBanco.has(protocolo)) {
        protocolosExistentes.push(protocolo);
      } else {
        protocolosNovos.push(protocolo);
      }
    });

    protocolosUnicosBanco.forEach(protocolo => {
      if (!protocolosUnicosPlanilha.has(protocolo)) {
        protocolosFaltando.push(protocolo);
      }
    });

    console.log(`📊 Estatísticas de correspondência:`);
    console.log(`   - Protocolos únicos na planilha: ${protocolosUnicosPlanilha.size}`);
    console.log(`   - Protocolos únicos no banco: ${protocolosUnicosBanco.size}`);
    console.log(`   - Protocolos existentes (planilha → banco): ${protocolosExistentes.length}`);
    console.log(`   - Protocolos novos (só na planilha): ${protocolosNovos.length}`);
    console.log(`   - Protocolos faltando (só no banco): ${protocolosFaltando.length}\n`);

    // 4. Analisar possíveis problemas na lógica
    console.log('📊 PASSO 4: Analisando possíveis problemas na lógica...\n');

    const problemas = [];

    // Problema 1: Duplicatas na planilha não são tratadas corretamente
    if (duplicatasPlanilha.length > 0) {
      problemas.push({
        tipo: 'DUPLICATAS_NA_PLANILHA',
        descricao: `A planilha contém ${duplicatasPlanilha.length} protocolos duplicados. O script deve ignorar duplicatas na planilha, mas pode haver problemas se a primeira ocorrência não for encontrada no banco.`,
        severidade: 'ALTA',
        solucao: 'Garantir que o script processe apenas a primeira ocorrência de cada protocolo na planilha.'
      });
    }

    // Problema 2: Busca de registros existentes pode estar incompleta
    if (protocolosNovos.length > protocolosUnicosPlanilha.size * 0.1) {
      problemas.push({
        tipo: 'MUITOS_PROTOCOLOS_NOVOS',
        descricao: `Muitos protocolos novos (${protocolosNovos.length}). Pode indicar que a busca de registros existentes não está funcionando corretamente.`,
        severidade: 'MEDIA',
        solucao: 'Verificar se a busca de registros existentes está usando o campo protocolo corretamente.'
      });
    }

    // Problema 3: Duplicatas no banco indicam problema na inserção
    if (protocolosDuplicadosBanco.length > 0) {
      problemas.push({
        tipo: 'DUPLICATAS_NO_BANCO',
        descricao: `Existem ${protocolosDuplicadosBanco.length} protocolos duplicados no banco. Isso indica que o script inseriu registros duplicados.`,
        severidade: 'CRITICA',
        solucao: 'Adicionar índice único no campo protocolo e verificar a lógica de inserção.'
      });
    }

    // Problema 4: Comparação de strings pode estar falhando
    const protocolosComVariacoes = [];
    protocolosPlanilha.forEach(p => {
      const protocolo = p.protocolo;
      const variacoes = [
        protocolo.trim(),
        protocolo.toLowerCase(),
        protocolo.toUpperCase(),
        protocolo.replace(/\s+/g, ''),
        protocolo.replace(/[^\w]/g, '')
      ];

      const unicos = new Set(variacoes);
      if (unicos.size < variacoes.length) {
        protocolosComVariacoes.push(protocolo);
      }
    });

    if (protocolosComVariacoes.length > 0) {
      problemas.push({
        tipo: 'VARIACOES_DE_PROTOCOLO',
        descricao: `Alguns protocolos podem ter variações (espaços, maiúsculas/minúsculas) que impedem a comparação correta.`,
        severidade: 'MEDIA',
        solucao: 'Normalizar protocolos antes de comparar (trim, lowercase, remover espaços).'
      });
    }

    // Mostrar problemas encontrados
    if (problemas.length > 0) {
      console.log(`🚨 ${problemas.length} PROBLEMAS IDENTIFICADOS:\n`);
      problemas.forEach((problema, idx) => {
        console.log(`   ${idx + 1}. [${problema.severidade}] ${problema.tipo}`);
        console.log(`      Descrição: ${problema.descricao}`);
        console.log(`      Solução: ${problema.solucao}\n`);
      });
    } else {
      console.log('✅ Nenhum problema crítico identificado na lógica\n');
    }

    // 5. Resumo final
    console.log('='.repeat(60));
    console.log('📊 RESUMO DA ANÁLISE');
    console.log('='.repeat(60));
    console.log(`   Duplicatas na planilha: ${duplicatasPlanilha.length}`);
    console.log(`   Duplicatas no banco: ${protocolosDuplicadosBanco.length}`);
    console.log(`   Protocolos novos: ${protocolosNovos.length}`);
    console.log(`   Problemas identificados: ${problemas.length}`);
    console.log('='.repeat(60) + '\n');

    await mongoose.disconnect();
    console.log('✅ Análise concluída!\n');

  } catch (error) {
    console.error('❌ Erro ao analisar:', error);
    process.exit(1);
  }
}

analisarCausaDuplicatas();

