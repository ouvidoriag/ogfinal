/**
 * Script de Migração: Popular Campos Lowercase
 * 
 * Popula campos lowercase indexados em registros existentes
 * Necessário após adicionar campos lowercase ao schema
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';
import Record from '../../src/models/Record.model.js';
import { normalizeToLowercase } from '../../src/utils/normalizeLowercase.js';
import { logger } from '../../src/utils/logger.js';
import { connectDatabase } from '../../src/config/database.js';

/**
 * Migrar um registro
 * @param {Object} record - Registro do MongoDB
 * @returns {Object} Campos lowercase a atualizar
 */
function migrateRecord(record) {
  const updates = {};

  // Campos que devem ter versão lowercase
  const fieldsToLowercase = [
    'tema',
    'assunto',
    'canal',
    'orgaos',
    'statusDemanda',
    'tipoDeManifestacao',
    'responsavel',
    'bairro',
    'unidadeCadastro',
    'unidadeSaude',
    'servidor'
  ];

  for (const field of fieldsToLowercase) {
    const value = record[field];
    if (value && typeof value === 'string') {
      const lowercaseField = `${field}Lowercase`;
      const normalized = normalizeToLowercase(value);
      
      // Só atualizar se o valor mudou ou se o campo lowercase não existe
      if (normalized && record[lowercaseField] !== normalized) {
        updates[lowercaseField] = normalized;
      }
    }
  }

  return updates;
}

/**
 * Executar migração
 */
async function runMigration() {
  try {
    console.log('🚀 Iniciando migração de campos lowercase...\n');

    // Conectar ao banco
    await connectDatabase();
    console.log('✅ Conectado ao MongoDB\n');

    // Contar registros
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

    console.log('🔄 Processando registros...\n');

    for (let skip = 0; skip < total; skip += batchSize) {
      const records = await Record.find({})
        .skip(skip)
        .limit(batchSize)
        .lean();

      const updatePromises = records.map(async (record) => {
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
      });

      await Promise.all(updatePromises);
      processed += records.length;

      const progress = Math.round((processed / total) * 100);
      console.log(`📦 Processados: ${processed}/${total} (${progress}%) | Atualizados: ${updated} | Ignorados: ${skipped}`);
    }

    console.log('\n✅ Migração concluída!');
    console.log(`📊 Resumo:`);
    console.log(`   - Total processado: ${processed}`);
    console.log(`   - Atualizados: ${updated}`);
    console.log(`   - Ignorados: ${skipped}`);

    // Criar índices nos campos lowercase (se ainda não existirem)
    console.log('\n🔍 Verificando índices...');
    try {
      await Record.collection.createIndex({ temaLowercase: 1 });
      await Record.collection.createIndex({ assuntoLowercase: 1 });
      await Record.collection.createIndex({ canalLowercase: 1 });
      await Record.collection.createIndex({ orgaosLowercase: 1 });
      await Record.collection.createIndex({ statusDemandaLowercase: 1 });
      await Record.collection.createIndex({ tipoDeManifestacaoLowercase: 1 });
      await Record.collection.createIndex({ responsavelLowercase: 1 });
      console.log('✅ Índices criados/verificados');
    } catch (indexError) {
      console.log('⚠️ Alguns índices podem já existir:', indexError.message);
    }

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    logger.error('Erro na migração de campos lowercase:', error);
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

