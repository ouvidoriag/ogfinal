/**
 * Model: ChatMessage
 * 
 * Substitui: Prisma ChatMessage model
 * Collection: chat_messages
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const chatMessageSchema = new Schema({
  text: {
    type: String,
    required: true
  },
  
  sender: {
    type: String,
    required: true,
    enum: ['user', 'cora']
  },
  
  // REFATORAÇÃO: Histórico por usuário
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Sempre requerido - sistema requer autenticação
    index: true
  },
  
  // Contexto da conversa (ouvidoria, zeladoria, esic, central)
  context: {
    type: String,
    required: false,
    default: 'ouvidoria',
    enum: ['ouvidoria', 'zeladoria', 'esic', 'central']
  },
  
  // Metadados adicionais para contexto
  metadata: {
    type: Schema.Types.Mixed,
    required: false,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'chat_messages'
});

// Índices para queries eficientes
chatMessageSchema.index({ userId: 1, createdAt: -1 });
chatMessageSchema.index({ userId: 1, context: 1, createdAt: -1 });
chatMessageSchema.index({ createdAt: -1 });

// Métodos estáticos
chatMessageSchema.statics.findBySender = function(sender) {
  return this.find({ sender }).sort({ createdAt: -1 });
};

chatMessageSchema.statics.findRecent = function(limit = 50) {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

// REFATORAÇÃO: Buscar histórico por usuário
chatMessageSchema.statics.findByUserId = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ createdAt: 1 }) // Ordem cronológica para histórico
    .limit(limit)
    .lean();
};

// Buscar histórico por usuário e contexto
chatMessageSchema.statics.findByUserIdAndContext = function(userId, context, limit = 100) {
  return this.find({ userId, context })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
};

// Buscar última conversa do usuário (últimas N mensagens)
chatMessageSchema.statics.findRecentByUserId = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .then(messages => messages.reverse()); // Inverter para ordem cronológica
};

// Método de instância: Formatar para resposta API
chatMessageSchema.methods.toAPIFormat = function() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);

export default ChatMessage;

