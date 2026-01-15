/**
 * Script de Importação de Dados de e-SIC (COM REMOÇÃO DE DUPLICATAS)
 * 
 * Importa dados do arquivo CSV esic.csv para o banco de dados
 * Remove duplicatas baseado no código de rastreio
 * 
 * Uso: node NOVO/scripts/data/importEsicLimpo.js
 * 
 * REFATORAÇÃO: Usando Mongoose (não Prisma)
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Esic from '../../src/models/Esic.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converte data DD/MM/YYYY HH:mm para YYYY-MM-DD
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;
  
  let cleaned = dateStr.trim().replace(/^["']|["']$/g, '');
  
  const parts = cleaned.split(' ');
  const datePart = parts[0];
  
  const dateComponents = datePart.split('/');
  if (dateComponents.length === 3) {
    const day = dateComponents[0].padStart(2, '0');
    const month = dateComponents[1].padStart(2, '0');
    const year = dateComponents[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Limpa e normaliza string
 */
function cleanString(str) {
  if (!str || str === '-' || str === '') return null;
  const cleaned = String(str).trim().replace(/^["']|["']$/g, '');
  return cleaned === '' ? null : cleaned;
}

/**
 * Parse CSV linha por linha (separador: ;)
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(';').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      row[header] = value.replace(/^["']|["']$/g, '');
    });
    
    if (Object.values(row).every(v => !v || v === '')) continue;
    
    data.push(row);
  }
  
  return data;
}

/**
 * Remove duplicatas baseado no código de rastreio
 */
function removerDuplicatas(rows) {
  const visto = new Map();
  const unicos = [];
  const duplicatas = [];
  
  rows.forEach((row, index) => {
    const codigoRastreio = row['Código de rastreio']?.trim() || '';
    const id = row['ID']?.trim() || '';
    
    // Usar código de rastreio como chave primária, fallback para ID
    const chave = codigoRastreio && codigoRastreio !== '-' ? codigoRastreio : (id && id !== '-' ? id : null);
    
    if (!chave) {
      // Se não tem código nem ID, usar combinação de campos
      const dataCriacao = row['Data da criação']?.trim() || '';
      const solicitante = row['Solicitante']?.trim() || '';
      const email = row['Nos diga o e-mail']?.trim() || '';
      const chaveCombinada = `${dataCriacao}|${solicitante}|${email}`;
      
      if (chaveCombinada !== '||' && !visto.has(chaveCombinada)) {
        visto.set(chaveCombinada, true);
        unicos.push(row);
      } else if (chaveCombinada !== '||') {
        duplicatas.push({ index: index + 2, row, motivo: 'Combinação de campos' });
      } else {
        // Linha completamente vazia ou inválida
        duplicatas.push({ index: index + 2, row, motivo: 'Sem identificador válido' });
      }
    } else if (!visto.has(chave)) {
      visto.set(chave, true);
      unicos.push(row);
    } else {
      duplicatas.push({ index: index + 2, row, motivo: chave.startsWith('C') ? 'Código de rastreio' : 'ID' });
    }
  });
  
  return { unicos, duplicatas };
}

/**
 * Normaliza dados do CSV para o modelo ESIC
 */
function normalizeEsicData(row) {
  const data = { ...row };
  
  return {
    data: data,
    dataCriacao: cleanString(row['Data da criação']),
    dataEncerramento: cleanString(row['Data de encerramento']),
    dataCriacaoIso: parseDate(row['Data da criação']),
    dataEncerramentoIso: parseDate(row['Data de encerramento']),
    status: cleanString(row['Status']),
    prioridade: cleanString(row['Prioridade']),
    responsavel: cleanString(row['Responsável']),
    codigoRastreio: cleanString(row['Código de rastreio']),
    idExterno: cleanString(row['ID']),
    idUsuario: cleanString(row['Id do usuário']),
    solicitante: cleanString(row['Solicitante']),
    nomeCompleto: cleanString(row['Insira nome completo']),
    nomeSolicitante: cleanString(row['Nome']),
    email: cleanString(row['Nos diga o e-mail']),
    emailSolicitante: cleanString(row['E-mail']),
    telefone: cleanString(row['Qual é o telefone para contato?']),
    telefoneSolicitante: cleanString(row['Telefone']),
    tipoInformacao: cleanString(row['Qual informação você deseja receber? ']),
    especificacaoInformacao: cleanString(row['Especifique abaixo a informação que você deseja receber']),
    detalhesSolicitacao: cleanString(row['Insira abaixo os detalhes da sua solicitação em detalhes']),
    solicitacaoAnonima: cleanString(row['Você deseja que esta solicitação de informação seja anônima?']),
    preenchidoPor: cleanString(row['Por fim, quem está preenchendo esta manifestação?']),
    criadoPor: cleanString(row['Criado por']),
    atrelarColab: cleanString(row['Você gostaria de atrelar a abertura dessa manifestação ao seu login no Colab?']),
    servidorNome: cleanString(row['Servidor(a), qual o seu nome completo?']),
    servidorMatricula: cleanString(row['Qual a sua matrícula/identificação na prefeitura?']),
    unidadeContato: cleanString(row['Por qual unidade o cidadão entrou em contato?']),
    canal: cleanString(row['Por qual canal o cidadão entrou em contato?']),
    prazo: cleanString(row['Prazo']),
    cep: cleanString(row['CEP']),
    bairro: cleanString(row['Bairro']),
    raca: cleanString(row['Raça']),
    escolaridade: cleanString(row['Escolaridade']),
    genero: cleanString(row['Gênero']),
    dataNascimento: cleanString(row['Data de nascimento']),
    relacionamentos: cleanString(row['Relacionamentos']),
    uploadDocumentos: cleanString(row['Faça o upload de fotos e/ou documentos, se houver'])
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando importação LIMPA de dados de e-SIC...\n');
  
  try {
    // Conectar ao MongoDB
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não encontrada no .env');
    }
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('✅ Conectado ao banco de dados MongoDB\n');
    
    // Caminho do arquivo CSV
    const rootPath = path.join(__dirname, '..', '..', '..');
    const csvPath = path.join(rootPath, 'esic.csv');
    console.log(`📂 Lendo arquivo: ${csvPath}\n`);
    
    const fs = await import('fs');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Arquivo não encontrado: ${csvPath}`);
    }
    
    const csvContent = readFileSync(csvPath, 'utf-8');
    console.log(`📊 Arquivo lido: ${(csvContent.length / 1024).toFixed(2)} KB\n`);
    
    // Parse CSV
    console.log('🔄 Processando CSV...');
    const rows = parseCSV(csvContent);
    console.log(`✅ ${rows.length} linhas encontradas no CSV\n`);
    
    if (rows.length === 0) {
      console.log('⚠️  Nenhum dado encontrado no CSV');
      return;
    }
    
    // Remover duplicatas
    console.log('🧹 Removendo duplicatas...');
    const { unicos, duplicatas } = removerDuplicatas(rows);
    console.log(`✅ ${unicos.length} registros únicos encontrados`);
    console.log(`⚠️  ${duplicatas.length} duplicatas removidas\n`);
    
    if (duplicatas.length > 0) {
      console.log('📋 Primeiras 10 duplicatas removidas:');
      duplicatas.slice(0, 10).forEach(dup => {
        const codigo = dup.row['Código de rastreio'] || dup.row['ID'] || 'N/A';
        console.log(`   - Linha ${dup.index}: ${dup.motivo} - ${codigo}`);
      });
      console.log('');
    }
    
    // Contar registros antes
    const countBefore = await Esic.countDocuments();
    console.log(`📊 Registros no banco antes: ${countBefore}\n`);
    
    // Limpar banco (opcional - descomente se quiser limpar antes de importar)
    console.log('🧹 Limpando collection esic...');
    await Esic.deleteMany({});
    console.log('✅ Collection limpa\n');
    
    // Normalizar e inserir dados
    console.log('🔄 Normalizando e inserindo dados...\n');
    let inserted = 0;
    let errors = 0;
    const batchSize = 500;
    
    for (let i = 0; i < unicos.length; i += batchSize) {
      const batch = unicos.slice(i, i + batchSize);
      const normalizedBatch = batch.map(normalizeEsicData);
      
      try {
        const result = await Esic.insertMany(normalizedBatch, {
          ordered: false,
          rawResult: false
        });
        
        inserted += result.length;
        const progress = Math.round((inserted / unicos.length) * 100);
        console.log(`📦 Processados: ${inserted}/${unicos.length} (${progress}%)`);
      } catch (error) {
        if (error.code === 11000 || error.message.includes('duplicate') || error.writeErrors) {
          console.warn(`⚠️ Duplicatas/erros detectados no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
          
          for (const item of normalizedBatch) {
            try {
              const exists = await Esic.findOne({
                $or: [
                  { codigoRastreio: item.codigoRastreio },
                  { idExterno: item.idExterno }
                ]
              });
              
              if (exists) {
                continue; // Já existe, pular
              }
              
              await Esic.create(item);
              inserted++;
            } catch (e) {
              if (e.code !== 11000 && !e.message.includes('duplicate')) {
                errors++;
                console.error(`❌ Erro ao inserir registro:`, e.message);
              }
            }
          }
        } else {
          console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
          errors += batch.length;
        }
      }
    }
    
    const countAfter = await Esic.countDocuments();
    
    console.log('\n✅ Importação concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`   - Linhas no CSV: ${rows.length}`);
    console.log(`   - Duplicatas removidas: ${duplicatas.length}`);
    console.log(`   - Registros únicos processados: ${unicos.length}`);
    console.log(`   - Registros no banco antes: ${countBefore}`);
    console.log(`   - Registros no banco após: ${countAfter}`);
    console.log(`   - Inseridos: ${inserted}`);
    console.log(`   - Erros: ${errors}`);
    console.log(`   - Total de novos registros: ${countAfter}`);
    
  } catch (error) {
    console.error('❌ Erro durante importação:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexão fechada');
  }
}

// Executar
main()
  .then(() => {
    console.log('\n✨ Processo finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

