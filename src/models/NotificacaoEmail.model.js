/**
 * Model: NotificacaoEmail
 * 
 * Substitui: Prisma NotificacaoEmail model
 * Collection: notificacoes_email
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificacaoEmailSchema = new Schema({
  protocolo: {
    type: String,
    required: true,
    index: true
  },
  
  secretaria: {
    type: String,
    required: true,
    index: true
  },
  
  emailSecretaria: {
    type: String,
    required: true
  },
  
  tipoNotificacao: {
    type: String,
    required: true,
    enum: ['15_dias', 'vencimento', '30_dias_vencido', '60_dias_vencido', 'resumo_geral'],
    index: true
  },
  
  dataVencimento: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  
  diasRestantes: {
    type: Number,
    required: true
  },
  
  enviadoEm: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  status: {
    type: String,
    required: true,
    enum: ['enviado', 'erro', 'pendente'],
    default: 'enviado',
    index: true
  },
  
  mensagemErro: {
    type: String,
    required: false
  },
  
  messageId: {
    type: String, // ID da mensagem no Gmail
    required: false
  }
}, {
  timestamps: false, // Usamos enviadoEm ao invés de createdAt
  collection: 'notificacoes_email'
});

// Índice composto para evitar duplicatas
notificacaoEmailSchema.index({ protocolo: 1, tipoNotificacao: 1 }, { unique: true });

// Métodos estáticos
notificacaoEmailSchema.statics.findByProtocolo = function(protocolo) {
  return this.find({ protocolo }).sort({ enviadoEm: -1 });
};

notificacaoEmailSchema.statics.findByTipo = function(tipoNotificacao) {
  return this.find({ tipoNotificacao }).sort({ enviadoEm: -1 });
};

notificacaoEmailSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ enviadoEm: -1 });
};

notificacaoEmailSchema.statics.findBySecretaria = function(secretaria) {
  return this.find({ secretaria }).sort({ enviadoEm: -1 });
};

// Método de instância: Formatar para resposta API
notificacaoEmailSchema.methods.toAPIFormat = function() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

const NotificacaoEmail = mongoose.models.NotificacaoEmail || mongoose.model('NotificacaoEmail', notificacaoEmailSchema);

export default NotificacaoEmail;

