/**
 * Sistema de Logging Centralizado
 * 
 * Substituição de console.logs por sistema profissional de logging
 * com níveis, timestamps, e configuração por ambiente.
 * 
 * Uso:
 * const logger = require('./utils/logger');
 * 
 * logger.error('Erro crítico', { erro: err });
 * logger.warn('Atenção!', { dados });
 * logger.info('Informação importante');
 * logger.debug('Debug detalhado', { obj });
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determinar ambiente
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Formato customizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadata se existir
    if (Object.keys(metadata).length > 0) {
      // Remover campos internos do winston
      delete metadata.timestamp;
      delete metadata.level;
      delete metadata.message;
      
      if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata, null, 2)}`;
      }
    }
    
    return msg;
  })
);

// Configurar transports (onde os logs serão salvos/exibidos)
const transports = [];

// Em desenvolvimento: logs coloridos no console
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug' // Mostrar tudo em desenvolvimento
    })
  );
}

// Em produção: apenas erros no console
if (isProduction) {
  transports.push(
    new winston.transports.Console({
      format: customFormat,
      level: 'error' // Apenas erros no console em produção
    })
  );
}

// Sempre salvar logs em arquivo (erros)
transports.push(
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5
  })
);

// Em produção, salvar todos os logs em arquivo
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: customFormat,
  transports,
  // Não sair do processo em caso de erro não tratado
  exitOnError: false
});

// Adicionar método de log específico para requisições HTTP
logger.http = (method, url, statusCode, responseTime) => {
  logger.info('HTTP Request', {
    method,
    url,
    statusCode,
    responseTime: `${responseTime}ms`
  });
};

// Adicionar método para logs de cache
logger.cache = (action, key, hit = null) => {
  const data = { action, key };
  if (hit !== null) {
    data.hit = hit;
  }
  logger.debug('Cache', data);
};

// Adicionar método para logs de banco de dados
logger.db = (operation, collection, duration = null) => {
  const data = { operation, collection };
  if (duration !== null) {
    data.duration = `${duration}ms`;
  }
  logger.debug('Database', data);
};

// Adicionar método para logs de agregações
logger.aggregation = (pipeline, collection, duration = null, resultCount = null) => {
  const data = { 
    type: 'aggregation',
    collection, 
    stages: pipeline.length 
  };
  if (duration !== null) {
    data.duration = `${duration}ms`;
  }
  if (resultCount !== null) {
    data.results = resultCount;
  }
  logger.debug('Aggregation', data);
};

// Wrapper para erros com contexto
logger.errorWithContext = (message, error, context = {}) => {
  logger.error(message, {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...context
  });
};

// Log de inicialização
logger.info('Logger inicializado', {
  environment: process.env.NODE_ENV || 'development',
  level: logger.level
});

export default logger;
export { logger };

