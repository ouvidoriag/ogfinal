/**
 * Rotas principais da API
 * Organiza todas as rotas em módulos especializados
 * 
 * Estrutura:
 * - /api/aggregate/* - Agregações e análises de dados
 * - /api/stats/* - Estatísticas e métricas
 * - /api/cache/* - Gerenciamento de cache
 * - /api/chat/* - Sistema de chat
 * - /api/ai/* - Inteligência artificial e insights
 * - /api/* - Dados gerais (summary, records, etc.)
 * - /api/secretarias, /api/distritos, etc. - Dados geográficos
 * - /api/colab/* - Integração com API do Colab
 * 
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB nativo
 * @returns {express.Router} Router configurado com todas as rotas
 */

import express from 'express';
import { requireRole } from '../middleware/authMiddleware.js';
import aggregateRoutes from './aggregate.js';
import statsRoutes from './stats.js';
import cacheRoutes from './cache.js';
import chatRoutes from './chat.js';
import aiRoutes from './ai.js';
import dataRoutes from './data.js';
import geographicRoutes from './geographic.js';
import zeladoriaRoutes from './zeladoria.js';
import esicRoutes from './esic.js';
import notificationRoutes from './notifications.js';
import dataSyncRoutes from './dataSync.js';
import colabRoutes from './colab.js';
import batchRoutes from './batch.js';
import metricsRoutes from './metrics.js';
import centralRoutes from './central.js';
import savedFiltersRoutes from './savedFilters.js';
import configRoutes from './config.js';
import userRoutes from './users.js';

export default function apiRoutes(prisma, getMongoClient) {
  const router = express.Router();

  // Nota: Rotas de autenticação (/api/auth) são registradas separadamente no server.js
  // para que sejam públicas (sem requireAuth)

  // Mapa de rotas carregadas (para debug e documentação)
  const routesMap = {
    aggregate: '/api/aggregate/*',
    stats: '/api/stats/*',
    cache: '/api/cache/*',
    chat: '/api/chat/*',
    ai: '/api/ai/*',
    data: '/api/*',
    geographic: '/api/secretarias, /api/distritos, etc.',
    zeladoria: '/api/zeladoria/*',
    esic: '/api/esic/*',
    notifications: '/api/notifications/*',
    dataSync: '/api/data-sync/*',
    colab: '/api/colab/*',
    batch: '/api/batch/*',
    metrics: '/api/metrics/*',
    central: '/api/central/*',
    savedFilters: '/api/saved-filters/*',
    config: '/api/config/*'
  };

  // Rotas de agregação - Análises e agregações de dados
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/aggregate', aggregateRoutes(null, getMongoClient));

  // Rotas de estatísticas - Métricas e análises estatísticas
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/stats', statsRoutes(null, getMongoClient));

  // Rotas de cache - Gerenciamento de cache híbrido (Mongoose)
  router.use('/cache', cacheRoutes());

  // Rotas de chat - Sistema de mensagens e chat
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/chat', chatRoutes(null));

  // Rotas de IA - Inteligência artificial e insights
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/ai', aiRoutes(null, getMongoClient));

  // Rotas de dados gerais - Endpoints principais (summary, records, etc.)
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/', dataRoutes(null, getMongoClient));

  // Rotas geográficas - Dados de secretarias, distritos, bairros, saúde
  router.use('/', geographicRoutes());

  // Rotas de Zeladoria - Dados de serviços de zeladoria
  router.use('/zeladoria', zeladoriaRoutes());

  // Rotas de ESIC - Dados de e-SIC (Sistema Eletrônico de Informações ao Cidadão)
  router.use('/esic', esicRoutes());

  // Rotas de Notificações - Sistema de notificações por email
  // REFATORAÇÃO: Mongoose (sem prisma)
  router.use('/notifications', requireRole('admin'), notificationRoutes());

  // Rotas de Sincronização de Dados - Atualização automática do Google Sheets
  router.use('/data-sync', requireRole('admin'), dataSyncRoutes());

  // Rotas de Colab - Integração com API do Colab
  router.use('/colab', colabRoutes());

  // Rotas de Batch - Requisições em lote
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/batch', batchRoutes(null, getMongoClient));

  // Rotas de Métricas - Monitoramento do sistema
  // REFATORAÇÃO: Prisma → Mongoose (prisma não usado mais)
  router.use('/metrics', metricsRoutes(null));

  // Rotas do Painel Central - Dados consolidados de todos os sistemas
  router.use('/central', centralRoutes());

  // Rotas de Filtros Salvos - Gerenciamento de filtros salvos por usuário
  router.use('/saved-filters', savedFiltersRoutes());

  // Rotas de Usuários - Gestão de acesso (Admin)
  router.use('/users', userRoutes);

  // Rotas de Configurações - Painel administrativo de configurações
  router.use('/config', requireRole('admin'), configRoutes);

  // Log de carregamento das rotas (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Rotas da API carregadas:', routesMap);
    console.log(`✅ Total de módulos registrados: ${Object.keys(routesMap).length}`);
  }

  // Expor mapa de rotas para documentação automática (opcional)
  router.routesMap = routesMap;

  return router;
}

