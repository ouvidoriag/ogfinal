/**
 * Servidor Principal - Dashboard Ouvidoria Duque de Caxias
 * Versão 3.0 - Refatorada e Otimizada
 */

import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import session from 'express-session';
import MongoStore from 'connect-mongo';

// Middlewares de segurança e performance
import {
  configureHelmet,
  globalRateLimiter,
  apiRateLimiter,
  loginRateLimiter,
  chatRateLimiter,
  sanitizeInputs,
  securityLogger
} from './middleware/security.js';
import { configureCompression } from './middleware/compression.js';

import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

// Importar rotas organizadas
import apiRoutes from './api/routes/index.js';
import authRoutes from './api/routes/auth.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

// Importar models Mongoose (para garantir que estão registrados)
import './models/index.js';
import { initializeCache } from './config/cache.js';
import { initializeGemini } from './utils/geminiHelper.js';
import { iniciarScheduler } from './services/email-notifications/scheduler.js';
import { iniciarCronVencimentos } from './cron/vencimentos.cron.js';
import { iniciarSchedulerAtualizacao } from './services/data-sync/scheduler.js';
import { requireAuth } from './api/middleware/authMiddleware.js';
import { startChangeStreamWatcher } from './services/changeStreamWatcher.js';

// Resolver caminho absoluto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

// Verificar MongoDB Atlas connection string
let mongodbUrl = process.env.MONGODB_ATLAS_URL;
if (!mongodbUrl) {
  console.error('❌ ERRO: MONGODB_ATLAS_URL não está definido!');
  process.exit(1);



}

// Adicionar parâmetros de conexão otimizados (apenas se não existirem)
// Extrair query string da URL
const urlParts = mongodbUrl.split('?');
const baseUrl = urlParts[0];
const existingQuery = urlParts[1] || '';

// Parsear parâmetros existentes
const urlParams = new URLSearchParams(existingQuery);
const paramsToAdd = {};

// Verificar e adicionar apenas parâmetros que não existem
if (!urlParams.has('serverSelectionTimeoutMS')) {
  paramsToAdd.serverSelectionTimeoutMS = '30000';
}
if (!urlParams.has('connectTimeoutMS')) {
  paramsToAdd.connectTimeoutMS = '30000';
}
if (!urlParams.has('socketTimeoutMS')) {
  paramsToAdd.socketTimeoutMS = '30000';
}
if (!urlParams.has('retryWrites')) {
  paramsToAdd.retryWrites = 'true';
}
if (!urlParams.has('w')) {
  paramsToAdd.w = 'majority';
}
if (!urlParams.has('tls')) {
  paramsToAdd.tls = 'true';
}

// Reconstruir URL apenas se houver parâmetros para adicionar
if (Object.keys(paramsToAdd).length > 0) {
  // Adicionar novos parâmetros aos existentes
  Object.entries(paramsToAdd).forEach(([key, value]) => {
    urlParams.set(key, value);
  });
  mongodbUrl = `${baseUrl}?${urlParams.toString()}`;
}

// Configurar parâmetros de conexão MongoDB Atlas
logger.info(`📁 MongoDB Atlas: ${mongodbUrl.replace(/:[^:@]+@/, ':****@').substring(0, 80)}...`);

// Mongoose será inicializado abaixo junto com o banco

// MongoDB Client nativo como fallback
let mongoClient = null;

// ChangeStream para invalidação de cache
let changeStream = null;
async function getMongoClient() {
  if (!mongoClient) {
    mongoClient = new MongoClient(mongodbUrl, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      tls: true,
      tlsAllowInvalidCertificates: false
    });
    await mongoClient.connect();
  }
  return mongoClient;
}

// Inicializar aplicação Express
const app = express();

// IMPORTANTE: Configurar trust proxy para Nginx/Render/Heroku funcionar corretamente
// Isso permite que o Express confie nos headers X-Forwarded-* do proxy reverso
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARES DE SEGURANÇA E PERFORMANCE
// ============================================

// Helmet.js - Headers de segurança HTTP
if (process.env.NODE_ENV === 'production') {
  app.use(configureHelmet());
  logger.info('🛡️ Helmet.js ativado (headers de segurança)');
}

// Compressão Gzip otimizada
app.use(configureCompression());
logger.info('📦 Compressão Gzip ativada');

// Rate limiting global
if (process.env.NODE_ENV === 'production') {
  app.use(globalRateLimiter);
  logger.info('🚦 Rate limiting global ativado');
}

// Sanitização de inputs
app.use(sanitizeInputs);

// Log de segurança
app.use(securityLogger);

// Middlewares globais
// Logar todas as respostas 504 para facilitar diagnóstico de timeouts
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 504) {
      console.error('❌ TIMEOUT 504 detectado:', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        time: new Date().toISOString()
      });
    }
  });
  next();
});
app.use(cors({
  origin: true,
  credentials: true // Permitir cookies
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurar sessões
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'chave-secreta-padrao-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true apenas em HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 1 dia
  },
  name: 'ouvidoria.sid'
};

// Em produção, usar MongoStore
// Em produção, usar MongoStore
if (process.env.NODE_ENV === 'production') {
  if (!process.env.MONGODB_ATLAS_URL) {
    console.error('❌ ERRO CRÍTICO: MONGODB_ATLAS_URL obrigatório em produção para sessões.');
    process.exit(1);
  }

  try {
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_ATLAS_URL,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60, // 14 dias
      autoRemove: 'native'
    });
    console.log('🔒 Sessão configurada com MongoStore (Produção)');
  } catch (err) {
    console.error('❌ Falha fatal ao configurar MongoStore:', err.message);
    process.exit(1);
  }
}

app.use(session(sessionConfig));

// OTIMIZAÇÃO: Middleware de cache para respostas da API
app.use('/api', (req, res, next) => {
  // Endpoints que mudam frequentemente: cache curto (5 min)
  if (req.path.includes('/dashboard-data') || req.path.includes('/summary')) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.setHeader('ETag', `"${Date.now()}"`);
  }
  // Endpoints estáticos: cache longo (1 hora)
  else if (req.path.includes('/distritos') || req.path.includes('/secretarias')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
  // Outros endpoints: cache médio (10 min)
  else {
    res.setHeader('Cache-Control', 'public, max-age=600, must-revalidate');
  }
  next();
});

// Emergency logout (público) - limpar cookies e sessão
app.get('/api/emergency-logout', (req, res) => {
  req.session.destroy(() => { });
  res.clearCookie('ouvidoria.sid');
  res.clearCookie('token');
  res.json({ success: true, message: 'Cookies e sessão limpos. Faça login novamente.' });
});

// Health check (público) - sem rate limiting
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Alias para /api/health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '3.0.0' });
});

// Endpoint para Chrome DevTools (evita erro 404)
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.json({});
});

// Rotas da API
// Registrar rotas de autenticação primeiro (públicas com rate limiting)
app.use('/api/auth/login', loginRateLimiter); // Rate limiting específico para login
app.use('/api/auth', authRoutes());

// Depois registrar todas as outras rotas da API (protegidas com rate limiting)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/chat', chatRateLimiter); // Rate limiting específico para chat/IA
  app.use('/api', apiRateLimiter); // Rate limiting para API geral
}
app.use('/api', requireAuth, apiRoutes(null, getMongoClient));

// IMPORTANTE: Rotas de páginas ANTES do express.static para evitar conflitos
// Rota raiz - página de login (pública)
app.get('/', (_req, res) => {
  // Se já estiver autenticado, redirecionar para dashboard
  if (_req.session && _req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Rota de login (pública) - servir login.html diretamente
app.get('/login', (_req, res) => {
  // Se já estiver autenticado, redirecionar para dashboard
  if (_req.session && _req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(publicDir, 'login.html'));
});

// Rota de cadastro (pública) - servir cadastro.html diretamente
app.get('/cadastro', (_req, res) => {
  // Se já estiver autenticado, redirecionar para dashboard
  if (_req.session && _req.session.isAuthenticated) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(publicDir, 'cadastro.html'));
});

// Rota do dashboard - servir index.html (protegida)
app.get('/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Rota para página de chat (SPA routing) - protegida
app.get('/chat', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Página de impressão de informações de secretarias (A4 vertical)
app.get('/secretarias-print', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'secretarias-print.html'));
});

// OTIMIZAÇÃO: Cache headers para arquivos estáticos
// IMPORTANTE: Colocar DEPOIS das rotas de páginas para não interferir
// index: false para não servir index.html automaticamente na rota /
app.use(express.static(publicDir, {
  index: false, // Não servir index.html automaticamente
  maxAge: '1y', // Cache de 1 ano para arquivos estáticos
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Arquivos JS, CSS, imagens: cache longo
    if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Catch-all: servir index.html para todas as outras rotas (SPA routing) - protegida
// Exceção: não capturar /login e / (já tratadas acima)
app.get('*', requireAuth, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
/**
 * Fechar ChangeStream graciosamente
 */
async function closeChangeStream() {
  if (changeStream) {
    try {
      await changeStream.close();
      logger.info('✅ ChangeStream fechado com sucesso');
      changeStream = null;
    } catch (error) {
      logger.warn('⚠️ Erro ao fechar ChangeStream:', error.message);
    }
  }
}

process.on('beforeExit', async () => {
  await closeChangeStream(); // Fechar ChangeStream primeiro
  await closeDatabase(); // Fechar Mongoose
  if (mongoClient) await mongoClient.close(); // Fechar MongoDB Native por último
});

process.on('SIGINT', async () => {
  logger.info('🛑 Recebido SIGINT, encerrando graciosamente...');
  await closeChangeStream(); // Fechar ChangeStream primeiro
  await closeDatabase(); // Fechar Mongoose
  if (mongoClient) await mongoClient.close(); // Fechar MongoDB Native por último
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Recebido SIGTERM, encerrando graciosamente...');
  await closeChangeStream(); // Fechar ChangeStream primeiro
  await closeDatabase(); // Fechar Mongoose
  if (mongoClient) await mongoClient.close(); // Fechar MongoDB Native por último
  process.exit(0);
});

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================
(async () => {
  try {
    // ============================================
    // Inicializar Mongoose
    // ============================================
    logger.info('🔄 Inicializando Mongoose...');
    const mongooseConnected = await initializeDatabase(mongodbUrl);

    if (!mongooseConnected) {
      logger.error('❌ Falha ao conectar Mongoose. Encerrando servidor...');
      process.exit(1);
    }

    // CRÍTICO: Aguardar conexão estar realmente pronta antes de continuar
    // Verificar estado da conexão
    let connectionReady = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!connectionReady && attempts < maxAttempts) {
      const state = mongoose.connection.readyState;
      if (state === 1) { // 1 = connected
        connectionReady = true;
        logger.info('✅ Mongoose conexão confirmada e pronta!');
      } else {
        attempts++;
        logger.info(`⏳ Aguardando conexão Mongoose... (tentativa ${attempts}/${maxAttempts}, estado: ${state})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!connectionReady) {
      logger.error('❌ Timeout aguardando conexão Mongoose. Encerrando servidor...');
      process.exit(1);
    }

    // Verificar conexão testando um model
    try {
      const { ChatMessage } = await import('./models/index.js');
      const count = await ChatMessage.countDocuments();
      logger.info(`💬 Mensagens no banco (Mongoose): ${count} mensagens`);
    } catch (error) {
      logger.warn('⚠️ Não foi possível contar mensagens com Mongoose:', error.message);
    }

    // ============================================
    // Sistema usando apenas Mongoose
    // ============================================
    logger.info('✅ Sistema usando apenas Mongoose');

    // ============================================
    // Inicializar cache (Mongoose)
    // ============================================
    await initializeCache();

    // ============================================
    // Inicializar Gemini
    // ============================================
    initializeGemini();

    // ============================================
    // Inicializar scheduler de notificações por email
    // ============================================
    try {
      iniciarScheduler();
      logger.info('📧 Scheduler de notificações por email iniciado');
    } catch (error) {
      logger.warn('⚠️ Erro ao iniciar scheduler de notificações:', error.message);
    }

    // ============================================
    // Inicializar cron de vencimentos
    // ============================================
    try {
      iniciarCronVencimentos();
      logger.info('🔔 Cron de vencimentos automático iniciado');
    } catch (error) {
      logger.warn('⚠️ Erro ao iniciar cron de vencimentos:', error.message);
    }

    // ============================================
    // Inicializar scheduler de atualização automática de dados
    // ============================================
    try {
      await iniciarSchedulerAtualizacao();
      logger.info('📊 Scheduler de atualização automática de dados iniciado (execução diária às 10h)');
    } catch (error) {
      logger.warn('⚠️ Erro ao iniciar scheduler de atualização de dados:', error.message);
    }

    // ============================================
    // Inicializar ChangeStream Watcher
    // ============================================
    try {
      changeStream = await startChangeStreamWatcher(null, getMongoClient);
      logger.info('👁️ ChangeStream Watcher ativo - Cache será invalidado automaticamente');
    } catch (error) {
      logger.warn('⚠️ Erro ao iniciar ChangeStream Watcher:', error.message);
      logger.warn('⚠️ Cache não será invalidado automaticamente, mas sistema continuará funcionando');
    }

    // ============================================
    // Iniciar servidor
    // ============================================
    const port = Number(process.env.PORT ?? 3000);
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`🚀 Dashboard running on http://localhost:${port}`);
      logger.info(`📦 Cache híbrido ativo (memória + banco de dados)`);
      logger.info(`🔧 Sistema de otimização global ativo`);
      logger.info(`✨ Versão 3.0 - Refatorada e Otimizada`);
      logger.info(`🔥 Backend Ativo e Otimizado`);
    });

    // Aumentar timeout global do servidor para lidar com agregações pesadas
    server.setTimeout(120000); // 120 segundos
    logger.info('⏱️ Timeout global do servidor configurado para 120s');
  } catch (error) {
    logger.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
})();

export default app;


