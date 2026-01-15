/**
 * Script de Análise de Duplicatas - e-SIC
 * 
 * Analisa o arquivo CSV e identifica registros duplicados
 * 
 * Uso: node NOVO/scripts/data/analisarDuplicatasEsic.js
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Função principal
 */
async function main() {
  console.log('🔍 Iniciando análise de duplicatas no CSV e-SIC...\n');
  
  try {
    // Caminho do arquivo CSV (na raiz do projeto)
    const rootPath = path.join(__dirname, '..', '..', '..');
    const csvPath = path.join(rootPath, 'esic.csv');
    console.log(`📂 Lendo arquivo: ${csvPath}\n`);
    
    // Ler arquivo CSV
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
    
    // Analisar duplicatas por diferentes campos
    console.log('🔍 Analisando duplicatas...\n');
    
    // 1. Por Código de Rastreio
    const porCodigoRastreio = new Map();
    const porId = new Map();
    const porIdUsuario = new Map();
    const porCombinacao = new Map(); // Código + Data + Solicitante
    
    rows.forEach((row, index) => {
      const codigoRastreio = row['Código de rastreio']?.trim() || '';
      const id = row['ID']?.trim() || '';
      const idUsuario = row['Id do usuário']?.trim() || '';
      const dataCriacao = row['Data da criação']?.trim() || '';
      const solicitante = row['Solicitante']?.trim() || '';
      
      // Por código de rastreio
      if (codigoRastreio && codigoRastreio !== '-') {
        if (!porCodigoRastreio.has(codigoRastreio)) {
          porCodigoRastreio.set(codigoRastreio, []);
        }
        porCodigoRastreio.get(codigoRastreio).push({ index: index + 2, row }); // +2 porque linha 1 é header
      }
      
      // Por ID
      if (id && id !== '-') {
        if (!porId.has(id)) {
          porId.set(id, []);
        }
        porId.get(id).push({ index: index + 2, row });
      }
      
      // Por ID do usuário
      if (idUsuario && idUsuario !== '-') {
        if (!porIdUsuario.has(idUsuario)) {
          porIdUsuario.set(idUsuario, []);
        }
        porIdUsuario.get(idUsuario).push({ index: index + 2, row });
      }
      
      // Por combinação (Código + Data + Solicitante)
      const chaveCombinacao = `${codigoRastreio}|${dataCriacao}|${solicitante}`;
      if (codigoRastreio || dataCriacao || solicitante) {
        if (!porCombinacao.has(chaveCombinacao)) {
          porCombinacao.set(chaveCombinacao, []);
        }
        porCombinacao.get(chaveCombinacao).push({ index: index + 2, row });
      }
    });
    
    // Encontrar duplicatas
    const duplicatasCodigo = Array.from(porCodigoRastreio.entries())
      .filter(([_, ocorrencias]) => ocorrencias.length > 1);
    
    const duplicatasId = Array.from(porId.entries())
      .filter(([_, ocorrencias]) => ocorrencias.length > 1);
    
    const duplicatasIdUsuario = Array.from(porIdUsuario.entries())
      .filter(([_, ocorrencias]) => ocorrencias.length > 1);
    
    const duplicatasCombinacao = Array.from(porCombinacao.entries())
      .filter(([_, ocorrencias]) => ocorrencias.length > 1);
    
    // Relatório
    console.log('📊 RELATÓRIO DE DUPLICATAS\n');
    console.log('═'.repeat(60));
    
    console.log(`\n1️⃣ Duplicatas por Código de Rastreio: ${duplicatasCodigo.length}`);
    if (duplicatasCodigo.length > 0) {
      console.log(`   Total de registros duplicados: ${duplicatasCodigo.reduce((sum, [_, ocorrencias]) => sum + ocorrencias.length, 0)}`);
      console.log(`   Exemplos (primeiros 5):`);
      duplicatasCodigo.slice(0, 5).forEach(([codigo, ocorrencias]) => {
        console.log(`   - Código "${codigo}": ${ocorrencias.length} ocorrências (linhas: ${ocorrencias.map(o => o.index).join(', ')})`);
      });
    }
    
    console.log(`\n2️⃣ Duplicatas por ID: ${duplicatasId.length}`);
    if (duplicatasId.length > 0) {
      console.log(`   Total de registros duplicados: ${duplicatasId.reduce((sum, [_, ocorrencias]) => sum + ocorrencias.length, 0)}`);
      console.log(`   Exemplos (primeiros 5):`);
      duplicatasId.slice(0, 5).forEach(([id, ocorrencias]) => {
        console.log(`   - ID "${id}": ${ocorrencias.length} ocorrências (linhas: ${ocorrencias.map(o => o.index).join(', ')})`);
      });
    }
    
    console.log(`\n3️⃣ Duplicatas por ID do Usuário: ${duplicatasIdUsuario.length}`);
    if (duplicatasIdUsuario.length > 0) {
      console.log(`   Total de registros duplicados: ${duplicatasIdUsuario.reduce((sum, [_, ocorrencias]) => sum + ocorrencias.length, 0)}`);
      console.log(`   Exemplos (primeiros 5):`);
      duplicatasIdUsuario.slice(0, 5).forEach(([idUsuario, ocorrencias]) => {
        console.log(`   - ID Usuário "${idUsuario}": ${ocorrencias.length} ocorrências (linhas: ${ocorrencias.map(o => o.index).join(', ')})`);
      });
    }
    
    console.log(`\n4️⃣ Duplicatas por Combinação (Código + Data + Solicitante): ${duplicatasCombinacao.length}`);
    if (duplicatasCombinacao.length > 0) {
      console.log(`   Total de registros duplicados: ${duplicatasCombinacao.reduce((sum, [_, ocorrencias]) => sum + ocorrencias.length, 0)}`);
      console.log(`   Exemplos (primeiros 5):`);
      duplicatasCombinacao.slice(0, 5).forEach(([chave, ocorrencias]) => {
        const [codigo, data, solicitante] = chave.split('|');
        console.log(`   - Código "${codigo}", Data "${data}", Solicitante "${solicitante}": ${ocorrencias.length} ocorrências (linhas: ${ocorrencias.map(o => o.index).join(', ')})`);
      });
    }
    
    // Calcular registros únicos
    const indicesDuplicados = new Set();
    
    // Marcar duplicatas por código de rastreio (manter primeira ocorrência)
    duplicatasCodigo.forEach(([_, ocorrencias]) => {
      ocorrencias.slice(1).forEach(oc => indicesDuplicados.add(oc.index - 2)); // -2 porque index começa em +2
    });
    
    // Marcar duplicatas por ID (manter primeira ocorrência)
    duplicatasId.forEach(([_, ocorrencias]) => {
      ocorrencias.slice(1).forEach(oc => indicesDuplicados.add(oc.index - 2));
    });
    
    // Marcar duplicatas por combinação (manter primeira ocorrência)
    duplicatasCombinacao.forEach(([_, ocorrencias]) => {
      ocorrencias.slice(1).forEach(oc => indicesDuplicados.add(oc.index - 2));
    });
    
    const totalDuplicados = indicesDuplicados.size;
    const totalUnicos = rows.length - totalDuplicados;
    
    console.log('\n═'.repeat(60));
    console.log('\n📈 RESUMO FINAL\n');
    console.log(`   Total de linhas no CSV: ${rows.length}`);
    console.log(`   Registros únicos: ${totalUnicos}`);
    console.log(`   Registros duplicados: ${totalDuplicados}`);
    console.log(`   Taxa de duplicação: ${((totalDuplicados / rows.length) * 100).toFixed(2)}%`);
    
    // Sugestão
    console.log('\n💡 RECOMENDAÇÃO:');
    console.log('   Use o campo "Código de rastreio" como chave única para identificar duplicatas.');
    console.log('   Mantenha apenas a primeira ocorrência de cada código.');
    
  } catch (error) {
    console.error('❌ Erro durante análise:', error);
    process.exit(1);
  }
}

// Executar
main()
  .then(() => {
    console.log('\n✨ Análise concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

