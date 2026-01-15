/**
 * Script de Normalização de Campos
 * 
 * Este script normaliza os campos categoria e bairro do JSON para colunas separadas
 * 
 * Uso: node scripts/normalizeFields.js
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

/**
 * Normalizar campo categoria
 */
async function normalizeCategoria() {
  console.log('📦 Normalizando campo categoria...');
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Buscar TODOS os registros (MongoDB não suporta bem OR com null)
  // Vamos filtrar em memória para garantir que pegamos todos
  const allRecords = await prisma.record.findMany({
    select: {
      id: true,
      data: true,
      categoria: true
    },
    take: 50000 // Processar em lotes maiores
  });
  
  // Filtrar apenas os que precisam ser atualizados
  const records = allRecords.filter(r => {
    const data = r.data || {};
    const hasCategoriaInJson = data.Categoria || data.categoria || data['Categoria'];
    const categoriaEmpty = !r.categoria || r.categoria.trim() === '';
    return hasCategoriaInJson && categoriaEmpty;
  });
  
  console.log(`📊 Total de registros no banco: ${allRecords.length}`);
  console.log(`📊 Registros com categoria no JSON: ${allRecords.filter(r => {
    const data = r.data || {};
    return data.Categoria || data.categoria || data['Categoria'];
  }).length}`);
  console.log(`📊 Registros que precisam normalização: ${records.length}`);
  
  for (const record of records) {
    try {
      const data = record.data || {};
      
      // Tentar diferentes variações do nome do campo
      const categoriaValue = data.Categoria || 
                            data.categoria || 
                            data['Categoria'] ||
                            null;
      
      if (categoriaValue && typeof categoriaValue === 'string' && categoriaValue.trim()) {
        await prisma.record.update({
          where: { id: record.id },
          data: { categoria: categoriaValue.trim() }
        });
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`  ✅ ${updated} registros atualizados...`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Erro ao processar registro ${record.id}:`, error.message);
    }
  }
  
  console.log(`✅ Categoria: ${updated} atualizados, ${skipped} ignorados, ${errors} erros`);
  return { updated, skipped, errors };
}

/**
 * Normalizar campo bairro
 */
async function normalizeBairro() {
  console.log('📍 Normalizando campo bairro...');
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Buscar TODOS os registros (MongoDB não suporta bem OR com null)
  // Vamos filtrar em memória para garantir que pegamos todos
  const allRecords = await prisma.record.findMany({
    select: {
      id: true,
      data: true,
      bairro: true,
      endereco: true
    },
    take: 50000 // Processar em lotes maiores
  });
  
  // Filtrar apenas os que precisam ser atualizados
  const records = allRecords.filter(r => {
    const data = r.data || {};
    const hasBairroInJson = data.Bairro || data.bairro || data['Bairro'];
    const bairroEmpty = !r.bairro || r.bairro.trim() === '';
    return hasBairroInJson && bairroEmpty;
  });
  
  console.log(`📊 Total de registros no banco: ${allRecords.length}`);
  console.log(`📊 Registros com bairro no JSON: ${allRecords.filter(r => {
    const data = r.data || {};
    return data.Bairro || data.bairro || data['Bairro'];
  }).length}`);
  console.log(`📊 Registros que precisam normalização: ${records.length}`);
  
  for (const record of records) {
    try {
      const data = record.data || {};
      
      // Tentar diferentes variações do nome do campo
      let bairroValue = data.Bairro || 
                       data.bairro || 
                       data['Bairro'] ||
                       null;
      
      // Se não encontrou, tentar extrair do endereço
      if (!bairroValue && record.endereco) {
        // Tentar extrair bairro do endereço (última parte após vírgula)
        const parts = record.endereco.split(',').map(p => p.trim());
        if (parts.length > 1) {
          bairroValue = parts[parts.length - 1];
        }
      }
      
      if (bairroValue && typeof bairroValue === 'string' && bairroValue.trim()) {
        await prisma.record.update({
          where: { id: record.id },
          data: { bairro: bairroValue.trim() }
        });
        updated++;
        
        if (updated % 100 === 0) {
          console.log(`  ✅ ${updated} registros atualizados...`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Erro ao processar registro ${record.id}:`, error.message);
    }
  }
  
  console.log(`✅ Bairro: ${updated} atualizados, ${skipped} ignorados, ${errors} erros`);
  return { updated, skipped, errors };
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando normalização de campos...\n');
  
  try {
    // Verificar conexão
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Normalizar categoria
    const categoriaStats = await normalizeCategoria();
    console.log('');
    
    // Normalizar bairro
    const bairroStats = await normalizeBairro();
    console.log('');
    
    // Estatísticas finais
    console.log('📊 Estatísticas finais:');
    console.log(`  Categoria: ${categoriaStats.updated} atualizados`);
    console.log(`  Bairro: ${bairroStats.updated} atualizados`);
    console.log(`  Total: ${categoriaStats.updated + bairroStats.updated} registros normalizados`);
    
    console.log('\n✅ Normalização concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante normalização:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main()
  .then(() => {
    console.log('🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });

