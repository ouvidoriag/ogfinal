/**
 * Script para Aplicar Índice Único no Campo Protocolo
 * 
 * Este script cria o índice único no campo protocolo para evitar duplicatas futuras.
 * IMPORTANTE: Execute este script APÓS remover todas as duplicatas existentes.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

async function aplicarIndiceUnico() {
  console.log('🔧 Aplicando índice único no campo protocolo...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    // Verificar se já existe índice único
    const indexes = await Record.collection.getIndexes();
    console.log('📊 Índices atuais:');
    Object.keys(indexes).forEach(name => {
      const index = indexes[name];
      if (index.key && index.key.protocolo) {
        console.log(`   - ${name}: ${JSON.stringify(index)}`);
      }
    });
    console.log('');
    
    // Verificar se há duplicatas antes de criar o índice
    const duplicatas = await Record.aggregate([
      {
        $match: { 
          protocolo: { $ne: null, $ne: '' } 
        }
      },
      {
        $group: {
          _id: '$protocolo',
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (duplicatas.length > 0) {
      console.log(`⚠️  ATENÇÃO: Existem ${duplicatas.length} protocolos duplicados!`);
      console.log('   Execute primeiro o script removerDuplicatas.js antes de aplicar o índice único.\n');
      await mongoose.disconnect();
      process.exit(1);
    }
    
    console.log('✅ Nenhuma duplicata encontrada. Prosseguindo...\n');
    
    // Criar índice único
    try {
      await Record.collection.createIndex(
        { protocolo: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'protocolo_1_unique'
        }
      );
      console.log('✅ Índice único criado com sucesso!\n');
    } catch (error) {
      if (error.code === 85 || error.message.includes('duplicate key')) {
        console.log('⚠️  Erro ao criar índice: Existem duplicatas no banco.');
        console.log('   Execute primeiro o script removerDuplicatas.js\n');
      } else if (error.code === 86 || error.message.includes('already exists')) {
        console.log('✅ Índice único já existe no banco de dados.\n');
      } else {
        throw error;
      }
    }
    
    // Verificar índices finais
    const indexesFinais = await Record.collection.getIndexes();
    console.log('📊 Índices após aplicação:');
    Object.keys(indexesFinais).forEach(name => {
      const index = indexesFinais[name];
      if (index.key && index.key.protocolo) {
        console.log(`   - ${name}: ${JSON.stringify(index)}`);
      }
    });
    console.log('');
    
    await mongoose.disconnect();
    console.log('✅ Script finalizado!\n');
    
  } catch (error) {
    console.error('❌ Erro ao aplicar índice único:', error);
    process.exit(1);
  }
}

aplicarIndiceUnico();

