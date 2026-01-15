/**
 * Script de Migração: Popular Campo Responsavel
 * 
 * Preenche o campo normalizado 'responsavel' a partir do campo 'data'
 * quando o campo normalizado está vazio/null mas existe no data
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { logger } from '../../src/utils/logger.js';
import { connectDatabase } from '../../src/config/database.js';
import { normalizeToLowercase } from '../../src/utils/normalizeLowercase.js';

/**
 * Buscar responsável em variações do campo data
 * @param {Object} record - Registro do MongoDB
 * @returns {string|null} Valor do responsável encontrado
 */
function findResponsavelInData(record) {
  if (!record.data || typeof record.data !== 'object') {
    return null;
  }
  
  const data = record.data;
  
  // Tentar todas as variações possíveis
  const variations = [
    'responsavel',
    'Responsavel',
    'responsável',
    'Responsável',
    'RESPONSAVEL',
    'Responsável',
    'responsavel',
    'Responsavel',
    'RESPONSAVEL'
  ];
  
  for (const variation of variations) {
    if (data[variation] && typeof data[variation] === 'string') {
      const value = data[variation].trim();
      if (value && value !== '' && value !== 'null' && value !== 'undefined') {
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Migrar um registro
 * @param {Object} record - Registro do MongoDB
 * @returns {Object} Campos a atualizar
 */
function migrateRecord(record) {
  const updates = {};
  
  // Se o campo responsavel já está preenchido, não precisa migrar
  if (record.responsavel && 
      record.responsavel.trim() !== '' && 
      record.responsavel !== 'null' && 
      record.responsavel !== 'undefined') {
    return updates;
  }
  
  // Buscar responsável no campo data
  const responsavelFromData = findResponsavelInData(record);
  
  if (responsavelFromData) {
    updates.responsavel = responsavelFromData;
    
    // Também atualizar o campo lowercase se necessário
    const lowercaseValue = normalizeToLowercase(responsavelFromData);
    if (lowercaseValue && record.responsavelLowercase !== lowercaseValue) {
      updates.responsavelLowercase = lowercaseValue;
    }
  }
  
  return updates;
}

/**
 * Executar migração
 */
async function runMigration() {
  try {
    console.log('🚀 Iniciando migração de campo responsavel...\n');

    // Conectar ao banco
    await connectDatabase();
    console.log('✅ Conectado ao MongoDB\n');

    // Contar registros que precisam de migração
    const total = await Record.countDocuments({});
    console.log(`📊 Total de registros: ${total}\n`);

    if (total === 0) {
      console.log('⚠️ Nenhum registro encontrado. Migração não necessária.');
      return;
    }

    // Processar em lotes
    const batchSize = 1000;
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log('🔄 Processando registros...\n');

    for (let skip = 0; skip < total; skip += batchSize) {
      const records = await Record.find({})
        .select('responsavel responsavelLowercase data')
        .skip(skip)
        .limit(batchSize)
        .lean();

      const updatePromises = records.map(async (record) => {
        try {
          const updates = migrateRecord(record);

          if (Object.keys(updates).length > 0) {
            await Record.updateOne(
              { _id: record._id },
              { $set: updates }
            );
            updated++;
            return true;
          } else {
            skipped++;
            return false;
          }
        } catch (error) {
          errors++;
          logger.error(`Erro ao migrar registro ${record._id}:`, error);
          return false;
        }
      });

      await Promise.all(updatePromises);
      processed += records.length;

      const progress = Math.round((processed / total) * 100);
      console.log(`📦 Processados: ${processed}/${total} (${progress}%) | Atualizados: ${updated} | Ignorados: ${skipped} | Erros: ${errors}`);
    }

    console.log('\n✅ Migração concluída!');
    console.log(`📊 Resumo:`);
    console.log(`   - Total processado: ${processed}`);
    console.log(`   - Atualizados: ${updated}`);
    console.log(`   - Ignorados: ${skipped}`);
    console.log(`   - Erros: ${errors}`);

    // Verificar resultado
    const totalComResponsavel = await Record.countDocuments({
      responsavel: { $exists: true, $ne: null, $ne: '' }
    });
    const totalSemResponsavel = await Record.countDocuments({
      $or: [
        { responsavel: { $exists: false } },
        { responsavel: null },
        { responsavel: '' }
      ]
    });
    
    console.log('\n📈 Estatísticas finais:');
    console.log(`   - Registros COM responsável: ${totalComResponsavel}`);
    console.log(`   - Registros SEM responsável: ${totalSemResponsavel}`);

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    logger.error('Erro na migração de campo responsavel:', error);
    throw error;
  } finally {
    // Fechar conexão
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('\n🔌 Conexão fechada');
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Migração finalizada com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migração falhou:', error);
      process.exit(1);
    });
}

export { runMigration };

