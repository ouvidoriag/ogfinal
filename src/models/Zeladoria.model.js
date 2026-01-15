/**
 * Model: Zeladoria
 * 
 * Substitui: Prisma Zeladoria model
 * Collection: zeladoria
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Schema Zeladoria - Dados de Zeladoria
 */
const zeladoriaSchema = new Schema({
  // Campo JSON completo (mantido para compatibilidade)
  data: {
    type: Schema.Types.Mixed,
    required: false
  },
  
  // Campos normalizados baseados nas colunas do CSV
  origem: {
    type: String,
    required: false,
    index: true
  },
  
  status: {
    type: String,
    required: false,
    index: true
  },
  
  protocoloEmpresa: {
    type: String,
    required: false,
    index: true
  },
  
  categoria: {
    type: String,
    required: false,
    index: true
  },
  
  responsavel: {
    type: String,
    required: false,
    index: true
  },
  
  endereco: {
    type: String,
    required: false
  },
  
  bairro: {
    type: String,
    required: false,
    index: true
  },
  
  cidade: {
    type: String,
    required: false
  },
  
  estado: {
    type: String,
    required: false
  },
  
  dataCriacao: {
    type: String,
    required: false
  },
  
  dataConclusao: {
    type: String,
    required: false
  },
  
  apoios: {
    type: Number,
    required: false
  },
  
  latitude: {
    type: String,
    required: false
  },
  
  longitude: {
    type: String,
    required: false
  },
  
  departamento: {
    type: String,
    required: false,
    index: true
  },
  
  canal: {
    type: String,
    required: false,
    index: true
  },
  
  prazo: {
    type: String,
    required: false
  },
  
  // Campos ISO para queries de data
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
  timestamps: true,
  collection: 'zeladoria'
});

// Índices compostos para queries comuns
zeladoriaSchema.index({ status: 1, categoria: 1 });
zeladoriaSchema.index({ dataCriacaoIso: 1, status: 1 });
zeladoriaSchema.index({ dataCriacaoIso: 1, categoria: 1 });
zeladoriaSchema.index({ departamento: 1, status: 1 });
zeladoriaSchema.index({ bairro: 1, categoria: 1 });

// Métodos estáticos úteis
zeladoriaSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

zeladoriaSchema.statics.findByCategoria = function(categoria) {
  return this.find({ categoria });
};

zeladoriaSchema.statics.findByBairro = function(bairro) {
  return this.find({ bairro });
};

// Método de instância: Formatar para resposta API
zeladoriaSchema.methods.toAPIFormat = function() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

const Zeladoria = mongoose.models.Zeladoria || mongoose.model('Zeladoria', zeladoriaSchema);

export default Zeladoria;

