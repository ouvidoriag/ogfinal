/**
 * Model: ESIC (e-SIC - Sistema Eletrônico de Informações ao Cidadão)
 * 
 * Collection: esic
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Campos baseados no CSV de e-SIC, ignorando:
 * - pix, tipo de pix, cpf
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Schema ESIC - Solicitações de Informação (e-SIC)
 */
const esicSchema = new Schema({
  // Campo JSON completo (mantido para compatibilidade)
  data: {
    type: Schema.Types.Mixed,
    required: false
  },
  
  // Campos normalizados baseados nas colunas do CSV
  // Datas
  dataCriacao: {
    type: String,
    required: false
  },
  
  dataEncerramento: {
    type: String,
    required: false
  },
  
  dataCriacaoIso: {
    type: String,
    required: false,
    index: true
  },
  
  dataEncerramentoIso: {
    type: String,
    required: false,
    index: true
  },
  
  // Status e prioridade
  status: {
    type: String,
    required: false,
    index: true
  },
  
  prioridade: {
    type: String,
    required: false,
    index: true
  },
  
  responsavel: {
    type: String,
    required: false,
    index: true
  },
  
  // Identificadores
  codigoRastreio: {
    type: String,
    required: false,
    index: true
  },
  
  idExterno: {
    type: String,
    required: false,
    index: true
  },
  
  idUsuario: {
    type: String,
    required: false
  },
  
  // Solicitante
  solicitante: {
    type: String,
    required: false
  },
  
  nomeCompleto: {
    type: String,
    required: false
  },
  
  nomeSolicitante: {
    type: String,
    required: false
  },
  
  email: {
    type: String,
    required: false
  },
  
  emailSolicitante: {
    type: String,
    required: false
  },
  
  telefone: {
    type: String,
    required: false
  },
  
  telefoneSolicitante: {
    type: String,
    required: false
  },
  
  // Informações da solicitação
  tipoInformacao: {
    type: String,
    required: false,
    index: true
  },
  
  especificacaoInformacao: {
    type: String,
    required: false
  },
  
  detalhesSolicitacao: {
    type: String,
    required: false
  },
  
  // Metadados
  solicitacaoAnonima: {
    type: String,
    required: false
  },
  
  preenchidoPor: {
    type: String,
    required: false
  },
  
  criadoPor: {
    type: String,
    required: false
  },
  
  atrelarColab: {
    type: String,
    required: false
  },
  
  // Servidor
  servidorNome: {
    type: String,
    required: false
  },
  
  servidorMatricula: {
    type: String,
    required: false
  },
  
  // Unidade e canal
  unidadeContato: {
    type: String,
    required: false,
    index: true
  },
  
  canal: {
    type: String,
    required: false,
    index: true
  },
  
  // Prazo
  prazo: {
    type: String,
    required: false
  },
  
  // Localização
  cep: {
    type: String,
    required: false
  },
  
  bairro: {
    type: String,
    required: false,
    index: true
  },
  
  // Dados demográficos (opcionais)
  raca: {
    type: String,
    required: false
  },
  
  escolaridade: {
    type: String,
    required: false
  },
  
  genero: {
    type: String,
    required: false
  },
  
  dataNascimento: {
    type: String,
    required: false
  },
  
  // Relacionamentos e uploads (armazenados como string ou referência)
  relacionamentos: {
    type: String,
    required: false
  },
  
  uploadDocumentos: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  collection: 'esic'
});

// Índices compostos para queries comuns
esicSchema.index({ status: 1, prioridade: 1 });
esicSchema.index({ dataCriacaoIso: 1, status: 1 });
esicSchema.index({ dataCriacaoIso: 1, tipoInformacao: 1 });
esicSchema.index({ responsavel: 1, status: 1 });
esicSchema.index({ unidadeContato: 1, status: 1 });
esicSchema.index({ canal: 1, status: 1 });
esicSchema.index({ bairro: 1, status: 1 });

// Métodos estáticos úteis
esicSchema.statics.findByStatus = function(status) {
  return this.find({ status });
};

esicSchema.statics.findByTipoInformacao = function(tipoInformacao) {
  return this.find({ tipoInformacao });
};

esicSchema.statics.findByResponsavel = function(responsavel) {
  return this.find({ responsavel });
};

esicSchema.statics.findByBairro = function(bairro) {
  return this.find({ bairro });
};

esicSchema.statics.findEncerrados = function() {
  return this.find({ 
    status: { $regex: /encerrada|fechada|arquivada/i },
    dataEncerramentoIso: { $ne: null }
  });
};

esicSchema.statics.findEmAberto = function() {
  return this.find({ 
    status: { $not: { $regex: /encerrada|fechada|arquivada/i } }
  });
};

// Método de instância: Formatar para resposta API
esicSchema.methods.toAPIFormat = function() {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  return obj;
};

const Esic = mongoose.models.Esic || mongoose.model('Esic', esicSchema);

export default Esic;

