/**
 * Model: User
 * 
 * Substitui: Prisma User model
 * Collection: users
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },

  password: {
    type: String,
    required: true // Hash bcrypt
  },

  // Dados básicos da prefeitura
  nomeCompleto: {
    type: String,
    required: true,
    trim: true
  },

  dataNascimento: {
    type: Date,
    required: true
  },

  matriculaPrefeitura: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },

  telefone: {
    type: String,
    required: true,
    trim: true
  },

  cargo: {
    type: String,
    required: true,
    trim: true
  },

  // Nível de Acesso (RBAC)
  role: {
    type: String,
    enum: ['admin', 'manager', 'viewer'],
    default: 'viewer',
    required: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Índices únicos criados automaticamente pelo unique: true
// username, matriculaPrefeitura, email são únicos

// Métodos estáticos
userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.toLowerCase() });
};

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByMatricula = function (matricula) {
  return this.findOne({ matriculaPrefeitura: matricula.toUpperCase() });
};

// Método de instância: Formatar para resposta API (sem senha)
userSchema.methods.toAPIFormat = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.password; // NUNCA retornar senha
  return obj;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;

