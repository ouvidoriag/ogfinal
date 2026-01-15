/**
 * Model: SavedFilter
 * Filtros salvos por usuário
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const savedFilterSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isComposite: {
    type: Boolean,
    default: false
  },
  isFavorite: {
    type: Boolean,
    default: false,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para performance
savedFilterSchema.index({ userId: 1, isFavorite: 1 });
savedFilterSchema.index({ userId: 1, lastUsed: -1 });
savedFilterSchema.index({ userId: 1, createdAt: -1 });

// Método para incrementar uso
savedFilterSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  return this.save();
};

// Método estático: buscar por usuário
savedFilterSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ isFavorite: -1, lastUsed: -1 });
};

// Método estático: buscar favoritos
savedFilterSchema.statics.findFavorites = function(userId) {
  return this.find({ userId, isFavorite: true }).sort({ lastUsed: -1 });
};

// Método estático: buscar recentes
savedFilterSchema.statics.findRecent = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ lastUsed: -1 })
    .limit(limit);
};

const SavedFilter = mongoose.model('SavedFilter', savedFilterSchema);

export default SavedFilter;

