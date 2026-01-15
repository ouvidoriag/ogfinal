/**
 * Configuração e inicialização do banco de dados
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Inicializar conexão Mongoose com MongoDB Atlas
 * 
 * @param {string} connectionString - MongoDB connection string
 * @returns {Promise<boolean>} - true se conectado com sucesso
 */
export async function initializeDatabase(connectionString) {
  try {
    // Verificar se já está conectado
    if (mongoose.connection.readyState === 1) {
      logger.info('Mongoose já está conectado');
      return true;
    }

    // Configurar opções de conexão otimizadas
    const options = {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10, // Manter até 10 conexões no pool
      minPoolSize: 2, // Manter pelo menos 2 conexões
      retryWrites: true,
      w: 'majority',
      tls: true,
      tlsAllowInvalidCertificates: false,
      // Força IPv4 para contornar problemas de DNS SRV em redes corporativas
      family: 4
    };

    // Conectar ao MongoDB
    await mongoose.connect(connectionString, options);

    // CRÍTICO: Aguardar conexão estar realmente estabelecida
    // mongoose.connect() pode retornar antes da conexão estar totalmente pronta
    // Verificar readyState e aguardar se necessário
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos (50 * 100ms)

    while (mongoose.connection.readyState !== 1 && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Timeout: Conexão Mongoose não estabelecida após 5 segundos');
    }

    logger.info('✅ Mongoose conectado ao MongoDB Atlas com sucesso');

    // Configurar listeners de eventos
    mongoose.connection.on('error', (err) => {
      logger.error('❌ Erro na conexão Mongoose:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ Mongoose desconectado do MongoDB');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('✅ Mongoose reconectado ao MongoDB');
    });

    return true;
  } catch (error) {
    logger.error('❌ Erro ao inicializar banco de dados Mongoose:', error);
    return false;
  }
}

/**
 * Testar conexão com retry
 * 
 * @param {string} connectionString - MongoDB connection string
 * @param {number} maxRetries - Número máximo de tentativas
 * @param {number} delay - Delay entre tentativas (ms)
 * @returns {Promise<boolean>} - true se conectado com sucesso
 */
export async function testConnection(connectionString, maxRetries = 3, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connected = await initializeDatabase(connectionString);
      if (connected) {
        logger.info('✅ Conexão com MongoDB Atlas estabelecida com sucesso!');
        return true;
      }
    } catch (error) {
      logger.error(`❌ Tentativa ${i + 1}/${maxRetries} falhou:`, error.message);
      if (i < maxRetries - 1) {
        logger.info(`⏳ Aguardando ${delay / 1000}s antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
}

/**
 * Fechar conexão Mongoose (graceful shutdown)
 * 
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  try {
    await mongoose.connection.close();
    logger.info('✅ Conexão Mongoose fechada com sucesso');
  } catch (error) {
    logger.error('❌ Erro ao fechar conexão Mongoose:', error);
  }
}

/**
 * Obter status da conexão
 * 
 * @returns {Object} - Status da conexão
 */
export function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
}

