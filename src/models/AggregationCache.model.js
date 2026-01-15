/**
 * Model: AggregationCache
 * 
 * Substitui: Prisma AggregationCache model
 * Collection: aggregation_cache
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const aggregationCacheSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  
  expiresAt: {
    type: Date,
    required: true
    // Removido index: true aqui para evitar duplicação
  }
}, {
  timestamps: true,
  collection: 'aggregation_cache'
});

// Índice TTL para expiração automática (opcional - MongoDB pode fazer)
aggregationCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Métodos estáticos
aggregationCacheSchema.statics.findByKey = function(key) {
  return this.findOne({ key, expiresAt: { $gt: new Date() } });
};

aggregationCacheSchema.statics.setCache = async function(key, data, ttlSeconds) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  return this.findOneAndUpdate(
    { key },
    { key, data, expiresAt },
    { upsert: true, new: true }
  );
};

aggregationCacheSchema.statics.deleteExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Método de instância: Verificar se está expirado
aggregationCacheSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

const AggregationCache = mongoose.models.AggregationCache || mongoose.model('AggregationCache', aggregationCacheSchema);

export default AggregationCache;

