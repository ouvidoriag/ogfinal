/**
 * Models Index - Export Centralizado
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

// Importar todos os models
import Record from './Record.model.js';
import Zeladoria from './Zeladoria.model.js';
import Esic from './Esic.model.js';
import ChatMessage from './ChatMessage.model.js';
import AggregationCache from './AggregationCache.model.js';
import NotificacaoEmail from './NotificacaoEmail.model.js';
import SecretariaInfo from './SecretariaInfo.model.js';
import User from './User.model.js';

// Exportar todos os models
export {
  Record,
  Zeladoria,
  Esic,
  ChatMessage,
  AggregationCache,
  NotificacaoEmail,
  SecretariaInfo,
  User
};

// Exportar como default (objeto com todos)
export default {
  Record,
  Zeladoria,
  Esic,
  ChatMessage,
  AggregationCache,
  NotificacaoEmail,
  SecretariaInfo,
  User
};

