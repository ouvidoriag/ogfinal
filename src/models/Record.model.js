/**
 * Model: Record (Ouvidoria - Principal)
 * 
 * Substitui: Prisma Record model
 * Collection: records
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Schema Record - Manifestações/Ouvidoria
 * 
 * Mantém TODOS os campos e índices do Prisma original
 * Adiciona validações Mongoose e métodos úteis
 */
const recordSchema = new Schema({
  // Campo JSON completo (mantido para compatibilidade)
  data: {
    type: Schema.Types.Mixed,
    required: false
  },
  
  // Campos normalizados baseados nas colunas exatas da planilha
  protocolo: {
    type: String,
    required: false
    // Índice único definido abaixo (evita duplicatas)
  },
  
  dataDaCriacao: {
    type: String,
    required: false
  },
  
  statusDemanda: {
    type: String,
    required: false,
    index: true
  },
  
  prazoRestante: {
    type: String,
    required: false
  },
  
  dataDaConclusao: {
    type: String,
    required: false
  },
  
  tempoDeResolucaoEmDias: {
    type: String,
    required: false
  },
  
  prioridade: {
    type: String,
    required: false,
    index: true
  },
  
  tipoDeManifestacao: {
    type: String,
    required: false,
    index: true
  },
  
  tema: {
    type: String,
    required: false,
    index: true
  },
  
  // MELHORIA: Campo lowercase indexado para otimizar filtros "contains"
  temaLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  assunto: {
    type: String,
    required: false,
    index: true
  },
  
  // MELHORIA: Campo lowercase indexado para otimizar filtros "contains"
  assuntoLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  canal: {
    type: String,
    required: false,
    index: true
  },
  
  // MELHORIA: Campo lowercase indexado para otimizar filtros "contains"
  canalLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  endereco: {
    type: String,
    required: false
  },
  
  unidadeCadastro: {
    type: String,
    required: false,
    index: true
  },
  
  unidadeSaude: {
    type: String,
    required: false,
    index: true
  },
  
  status: {
    type: String,
    required: false,
    index: true
  },
  
  servidor: {
    type: String,
    required: false,
    index: true
  },
  
  responsavel: {
    type: String,
    required: false,
    index: true
  },
  
  verificado: {
    type: String,
    required: false
  },
  
  orgaos: {
    type: String,
    required: false,
    index: true
  },
  
  // MELHORIA: Campo lowercase indexado para otimizar filtros "contains"
  orgaosLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  // MELHORIA: Campo lowercase indexado para outros campos textuais
  statusDemandaLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  tipoDeManifestacaoLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  responsavelLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  bairroLowercase: {
    type: String,
    required: false,
    index: true
  },
  
  // Campos ISO para queries de data (normalizados)
  dataCriacaoIso: {
    type: String,
    required: false,
    index: true
  },
  
  dataConclusaoIso: {
    type: String,
    required: false,
    index: true
  }
}, {
  timestamps: true, // Cria createdAt e updatedAt automaticamente
  collection: 'records' // Nome da collection no MongoDB
});

// ============================================
// ÍNDICES COMPOSTOS (mantendo todos do Prisma)
// ============================================

// Índices compostos para queries comuns (otimização)
recordSchema.index({ dataCriacaoIso: 1, status: 1 });
recordSchema.index({ dataCriacaoIso: 1, tema: 1 });
recordSchema.index({ dataCriacaoIso: 1, orgaos: 1 });
recordSchema.index({ tema: 1, orgaos: 1 });
recordSchema.index({ status: 1, tema: 1 });
recordSchema.index({ unidadeCadastro: 1, dataCriacaoIso: 1 });
recordSchema.index({ servidor: 1, dataCriacaoIso: 1 });

// Índices compostos adicionais para queries frequentes
recordSchema.index({ servidor: 1, dataCriacaoIso: 1, status: 1 });
recordSchema.index({ orgaos: 1, status: 1, dataCriacaoIso: 1 });
recordSchema.index({ tema: 1, dataCriacaoIso: 1, status: 1 });
recordSchema.index({ unidadeCadastro: 1, status: 1, dataCriacaoIso: 1 });

// ÍNDICE ÚNICO PARA PROTOCOLO (evita duplicatas)
// sparse: true permite múltiplos null, mas garante unicidade para valores não-null
recordSchema.index({ protocolo: 1 }, { unique: true, sparse: true });

// ============================================
// MÉTODOS E VIRTUALS ÚTEIS
// ============================================

/**
 * Virtual: Verificar se está vencido
 */
recordSchema.virtual('estaVencido').get(function() {
  if (!this.prazoRestante) return false;
  const dias = parseInt(this.prazoRestante);
  return dias < 0;
});

/**
 * Virtual: Verificar se está próximo do vencimento (15 dias)
 */
recordSchema.virtual('proximoVencimento').get(function() {
  if (!this.prazoRestante) return false;
  const dias = parseInt(this.prazoRestante);
  return dias >= 0 && dias <= 15;
});

/**
 * Método estático: Buscar por protocolo
 */
recordSchema.statics.findByProtocolo = function(protocolo) {
  return this.findOne({ protocolo });
};

/**
 * Método estático: Buscar vencidos
 */
recordSchema.statics.findVencidos = function() {
  return this.find({
    prazoRestante: { $exists: true, $ne: null },
    $expr: { $lt: [{ $toInt: '$prazoRestante' }, 0] }
  });
};

/**
 * Método estático: Buscar próximos do vencimento
 */
recordSchema.statics.findProximosVencimento = function(dias = 15) {
  return this.find({
    prazoRestante: { $exists: true, $ne: null },
    $expr: {
      $and: [
        { $gte: [{ $toInt: '$prazoRestante' }, 0] },
        { $lte: [{ $toInt: '$prazoRestante' }, dias] }
      ]
    }
  });
};

/**
 * Método de instância: Formatar para resposta API
 */
recordSchema.methods.toAPIFormat = function() {
  const obj = this.toObject();
  // Converter _id para id (compatibilidade)
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

// ============================================
// EXPORT
// ============================================

// Exportar model (criar se não existir, usar se existir)
const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);

export default Record;

