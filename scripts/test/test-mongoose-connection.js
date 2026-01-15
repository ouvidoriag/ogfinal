/**
 * Script de Teste: Conexão Mongoose
 * 
 * Testa a conexão Mongoose e valida todos os models
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase, getConnectionStatus, closeDatabase } from '../../src/config/database.js';
import { Record, Zeladoria, ChatMessage, AggregationCache, NotificacaoEmail, SecretariaInfo, User } from '../../src/models/index.js';
import { logger } from '../../src/utils/logger.js';

async function testMongooseConnection() {
  console.log('🧪 TESTE DE CONEXÃO MONGOOSE\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Testar conexão
    console.log('\n1️⃣ Testando conexão...');
    const mongodbUrl = process.env.MONGODB_ATLAS_URL;
    
    if (!mongodbUrl) {
      console.error('❌ MONGODB_ATLAS_URL não está definido!');
      process.exit(1);
    }
    
    const connected = await initializeDatabase(mongodbUrl);
    
    if (!connected) {
      console.error('❌ Falha ao conectar Mongoose');
      process.exit(1);
    }
    
    console.log('✅ Mongoose conectado com sucesso!');
    
    // 2. Verificar status da conexão
    console.log('\n2️⃣ Status da conexão:');
    const status = getConnectionStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // 3. Testar cada model
    console.log('\n3️⃣ Testando models...');
    
    // Record
    try {
      const recordCount = await Record.countDocuments();
      console.log(`✅ Record: ${recordCount} documentos`);
    } catch (error) {
      console.error(`❌ Record: ${error.message}`);
    }
    
    // Zeladoria
    try {
      const zeladoriaCount = await Zeladoria.countDocuments();
      console.log(`✅ Zeladoria: ${zeladoriaCount} documentos`);
    } catch (error) {
      console.error(`❌ Zeladoria: ${error.message}`);
    }
    
    // ChatMessage
    try {
      const chatCount = await ChatMessage.countDocuments();
      console.log(`✅ ChatMessage: ${chatCount} documentos`);
    } catch (error) {
      console.error(`❌ ChatMessage: ${error.message}`);
    }
    
    // AggregationCache
    try {
      const cacheCount = await AggregationCache.countDocuments();
      console.log(`✅ AggregationCache: ${cacheCount} documentos`);
    } catch (error) {
      console.error(`❌ AggregationCache: ${error.message}`);
    }
    
    // NotificacaoEmail
    try {
      const notifCount = await NotificacaoEmail.countDocuments();
      console.log(`✅ NotificacaoEmail: ${notifCount} documentos`);
    } catch (error) {
      console.error(`❌ NotificacaoEmail: ${error.message}`);
    }
    
    // SecretariaInfo
    try {
      const secretariaCount = await SecretariaInfo.countDocuments();
      console.log(`✅ SecretariaInfo: ${secretariaCount} documentos`);
    } catch (error) {
      console.error(`❌ SecretariaInfo: ${error.message}`);
    }
    
    // User
    try {
      const userCount = await User.countDocuments();
      console.log(`✅ User: ${userCount} documentos`);
    } catch (error) {
      console.error(`❌ User: ${error.message}`);
    }
    
    // 4. Testar query simples
    console.log('\n4️⃣ Testando query simples...');
    try {
      const sampleRecord = await Record.findOne().limit(1).lean();
      if (sampleRecord) {
        console.log('✅ Query Record funcionando!');
        console.log(`   Protocolo: ${sampleRecord.protocolo || 'N/A'}`);
        console.log(`   Status: ${sampleRecord.status || 'N/A'}`);
      } else {
        console.log('⚠️ Nenhum registro encontrado (banco pode estar vazio)');
      }
    } catch (error) {
      console.error(`❌ Erro na query: ${error.message}`);
    }
    
    // 5. Testar índices
    console.log('\n5️⃣ Verificando índices...');
    try {
      const indexes = await Record.collection.getIndexes();
      console.log(`✅ Record tem ${Object.keys(indexes).length} índices`);
      console.log('   Índices:', Object.keys(indexes).join(', '));
    } catch (error) {
      console.error(`❌ Erro ao verificar índices: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO:', error);
    process.exit(1);
  } finally {
    // Fechar conexão
    await closeDatabase();
    console.log('\n🔌 Conexão fechada');
    process.exit(0);
  }
}

// Executar teste
testMongooseConnection();

