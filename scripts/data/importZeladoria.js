/**
 * Script de Importação de Dados de Zeladoria
 * 
 * Importa dados do arquivo CSV zeladoria.csv para o banco de dados
 * 
 * Uso: node scripts/importZeladoria.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;
  
  // Formato: DD/MM/YYYY
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Limpa e normaliza string
 */
function cleanString(str) {
  if (!str || str === '-' || str === '') return null;
  const cleaned = String(str).trim();
  return cleaned === '' ? null : cleaned;
}

/**
 * Converte string para número inteiro
 */
function parseInteger(str) {
  if (!str || str === '-' || str === '') return null;
  const num = parseInt(String(str).trim().replace(/[^\d-]/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Limpa coordenadas (remove aspas e caracteres especiais)
 */
function cleanCoordinate(str) {
  if (!str || str === '-' || str === '') return null;
  return String(str).trim().replace(/^['"]|['"]$/g, '').replace(/[^\d.-]/g, '') || null;
}

/**
 * Parse CSV linha por linha
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  
  // Primeira linha são os cabeçalhos
  const headers = lines[0].split(';').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    const row = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      row[header] = value;
    });
    
    // Pular linhas vazias
    if (Object.values(row).every(v => !v || v === '')) continue;
    
    data.push(row);
  }
  
  return data;
}

/**
 * Normaliza dados do CSV para o modelo Zeladoria
 */
function normalizeZeladoriaData(row) {
  const data = { ...row }; // JSON completo
  
  return {
    data: data,
    origem: cleanString(row['Origem']),
    status: cleanString(row['Status']),
    protocoloEmpresa: cleanString(row['Protocolo da Empresa']),
    categoria: cleanString(row['Categoria']),
    responsavel: cleanString(row['Responsável']),
    endereco: cleanString(row['Endereço']),
    bairro: cleanString(row['Bairro']),
    cidade: cleanString(row['Cidade']),
    estado: cleanString(row['Estado']),
    dataCriacao: cleanString(row['Data de criação']),
    dataConclusao: cleanString(row['Data de conclusão']),
    apoios: parseInteger(row['Apoios']),
    latitude: cleanCoordinate(row['Latitude']),
    longitude: cleanCoordinate(row['Longitude']),
    departamento: cleanString(row['Departamento']),
    canal: cleanString(row['Canal']),
    prazo: cleanString(row['Prazo']),
    dataCriacaoIso: parseDate(row['Data de criação']),
    dataConclusaoIso: parseDate(row['Data de conclusão']),
  };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando importação de dados de Zeladoria...\n');
  
  try {
    // Verificar conexão
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Caminho do arquivo CSV
    const csvPath = path.join(__dirname, '..', 'zeladoria.csv');
    console.log(`📂 Lendo arquivo: ${csvPath}\n`);
    
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
    const countBefore = await prisma.zeladoria.count();
    console.log(`📊 Registros no banco antes: ${countBefore}\n`);
    
    // Normalizar e inserir dados
    console.log('🔄 Normalizando e inserindo dados...\n');
    let inserted = 0;
    let errors = 0;
    const batchSize = 500;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const normalizedBatch = batch.map(normalizeZeladoriaData);
      
      try {
        // MongoDB não suporta skipDuplicates, então inserimos diretamente
        await prisma.zeladoria.createMany({
          data: normalizedBatch
        });
        inserted += batch.length;
        const progress = Math.round((inserted / rows.length) * 100);
        console.log(`📦 Processados: ${inserted}/${rows.length} (${progress}%)`);
      } catch (error) {
        // Se houver erro de duplicata, tentar inserir um por um
        if (error.code === 11000 || error.message.includes('duplicate')) {
          console.warn(`⚠️ Duplicatas detectadas no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
          for (const item of normalizedBatch) {
            try {
              await prisma.zeladoria.create({ data: item });
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
    
    const countAfter = await prisma.zeladoria.count();
    
    console.log('\n✅ Importação concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`   - Registros antes: ${countBefore}`);
    console.log(`   - Registros após: ${countAfter}`);
    console.log(`   - Inseridos: ${inserted}`);
    console.log(`   - Erros: ${errors}`);
    console.log(`   - Total de novos registros: ${countAfter - countBefore}`);
    
  } catch (error) {
    console.error('❌ Erro durante importação:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
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

