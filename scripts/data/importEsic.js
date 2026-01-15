/**
 * Script de Importação de Dados de e-SIC
 * 
 * Importa dados do arquivo CSV esic.csv para o banco de dados
 * 
 * Uso: node NOVO/scripts/data/importEsic.js
 * 
 * REFATORAÇÃO: Usando Mongoose (não Prisma)
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Esic from '../../src/models/Esic.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converte data DD/MM/YYYY HH:mm para YYYY-MM-DD
 * O CSV tem formato: "16/06/2025 15:30"
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;
  
  // Remover aspas se houver
  let cleaned = dateStr.trim().replace(/^["']|["']$/g, '');
  
  // Formato pode ser: DD/MM/YYYY HH:mm ou DD/MM/YYYY
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
  // Remover aspas se houver
  const cleaned = String(str).trim().replace(/^["']|["']$/g, '');
  return cleaned === '' ? null : cleaned;
}

/**
 * Parse CSV linha por linha (separador: ;)
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  // Primeira linha são os cabeçalhos
  const headers = lines[0].split(';').map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    // Parse manual considerando aspas e vírgulas dentro de campos
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
    values.push(current.trim()); // Último campo
    
    const row = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      row[header] = value.replace(/^["']|["']$/g, '');
    });
    
    // Pular linhas vazias
    if (Object.values(row).every(v => !v || v === '')) continue;
    
    data.push(row);
  }
  
  return data;
}

/**
 * Normaliza dados do CSV para o modelo ESIC
 */
function normalizeEsicData(row) {
  const data = { ...row }; // JSON completo
  
  return {
    data: data,
    // Datas
    dataCriacao: cleanString(row['Data da criação']),
    dataEncerramento: cleanString(row['Data de encerramento']),
    dataCriacaoIso: parseDate(row['Data da criação']),
    dataEncerramentoIso: parseDate(row['Data de encerramento']),
    
    // Status e prioridade
    status: cleanString(row['Status']),
    prioridade: cleanString(row['Prioridade']),
    responsavel: cleanString(row['Responsável']),
    
    // Identificadores
    codigoRastreio: cleanString(row['Código de rastreio']),
    idExterno: cleanString(row['ID']),
    idUsuario: cleanString(row['Id do usuário']),
    
    // Solicitante
    solicitante: cleanString(row['Solicitante']),
    nomeCompleto: cleanString(row['Insira nome completo']),
    nomeSolicitante: cleanString(row['Nome']),
    email: cleanString(row['Nos diga o e-mail']),
    emailSolicitante: cleanString(row['E-mail']),
    telefone: cleanString(row['Qual é o telefone para contato?']),
    telefoneSolicitante: cleanString(row['Telefone']),
    
    // Informações da solicitação
    tipoInformacao: cleanString(row['Qual informação você deseja receber? ']),
    especificacaoInformacao: cleanString(row['Especifique abaixo a informação que você deseja receber']),
    detalhesSolicitacao: cleanString(row['Insira abaixo os detalhes da sua solicitação em detalhes']),
    
    // Metadados
    solicitacaoAnonima: cleanString(row['Você deseja que esta solicitação de informação seja anônima?']),
    preenchidoPor: cleanString(row['Por fim, quem está preenchendo esta manifestação?']),
    criadoPor: cleanString(row['Criado por']),
    atrelarColab: cleanString(row['Você gostaria de atrelar a abertura dessa manifestação ao seu login no Colab?']),
    
    // Servidor
    servidorNome: cleanString(row['Servidor(a), qual o seu nome completo?']),
    servidorMatricula: cleanString(row['Qual a sua matrícula/identificação na prefeitura?']),
    
    // Unidade e canal
    unidadeContato: cleanString(row['Por qual unidade o cidadão entrou em contato?']),
    canal: cleanString(row['Por qual canal o cidadão entrou em contato?']),
    
    // Prazo
    prazo: cleanString(row['Prazo']),
    
    // Localização
    cep: cleanString(row['CEP']),
    bairro: cleanString(row['Bairro']),
    
    // Dados demográficos (opcionais)
    raca: cleanString(row['Raça']),
    escolaridade: cleanString(row['Escolaridade']),
    genero: cleanString(row['Gênero']),
    dataNascimento: cleanString(row['Data de nascimento']),
    
    // Relacionamentos e uploads
    relacionamentos: cleanString(row['Relacionamentos']),
    uploadDocumentos: cleanString(row['Faça o upload de fotos e/ou documentos, se houver'])
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando importação de dados de e-SIC...\n');
  
  try {
    // Conectar ao MongoDB usando Mongoose
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não encontrada no .env');
    }
    
    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('✅ Conectado ao banco de dados MongoDB\n');
    
    // Caminho do arquivo CSV (na raiz do projeto)
    const rootPath = path.join(__dirname, '..', '..', '..');
    const csvPath = path.join(rootPath, 'esic.csv');
    console.log(`📂 Lendo arquivo: ${csvPath}\n`);
    
    // Verificar se arquivo existe
    const fs = await import('fs');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Arquivo não encontrado: ${csvPath}`);
    }
    
    // Ler arquivo CSV
    const csvContent = readFileSync(csvPath, 'utf-8');
    console.log(`📊 Arquivo lido: ${(csvContent.length / 1024).toFixed(2)} KB\n`);
    
    // Parse CSV
    console.log('🔄 Processando CSV...');
    const rows = parseCSV(csvContent);
    console.log(`✅ ${rows.length} linhas encontradas\n`);
    
    if (rows.length === 0) {
      console.log('⚠️  Nenhum dado encontrado no CSV');
      return;
    }
    
    // Contar registros antes
    const countBefore = await Esic.countDocuments();
    console.log(`📊 Registros no banco antes: ${countBefore}\n`);
    
    // Normalizar e inserir dados
    console.log('🔄 Normalizando e inserindo dados...\n');
    let inserted = 0;
    let errors = 0;
    let duplicates = 0;
    const batchSize = 500;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const normalizedBatch = batch.map(normalizeEsicData);
      
      try {
        // Inserir em lote usando insertMany
        const result = await Esic.insertMany(normalizedBatch, {
          ordered: false, // Continuar mesmo se houver erros
          rawResult: false
        });
        
        inserted += result.length;
        const progress = Math.round((inserted / rows.length) * 100);
        console.log(`📦 Processados: ${inserted}/${rows.length} (${progress}%)`);
      } catch (error) {
        // Se houver erro de duplicata ou outros erros, tentar inserir um por um
        if (error.code === 11000 || error.message.includes('duplicate') || error.writeErrors) {
          console.warn(`⚠️ Duplicatas/erros detectados no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
          
          for (const item of normalizedBatch) {
            try {
              // Verificar se já existe pelo código de rastreio ou ID externo
              const exists = await Esic.findOne({
                $or: [
                  { codigoRastreio: item.codigoRastreio },
                  { idExterno: item.idExterno }
                ]
              });
              
              if (exists) {
                duplicates++;
                continue;
              }
              
              await Esic.create(item);
              inserted++;
            } catch (e) {
              if (e.code === 11000 || e.message.includes('duplicate')) {
                duplicates++;
              } else {
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
    console.log(`   - Registros antes: ${countBefore}`);
    console.log(`   - Registros após: ${countAfter}`);
    console.log(`   - Inseridos: ${inserted}`);
    console.log(`   - Duplicatas ignoradas: ${duplicates}`);
    console.log(`   - Erros: ${errors}`);
    console.log(`   - Total de novos registros: ${countAfter - countBefore}`);
    
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

