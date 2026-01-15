/**
 * Controller de Autenticação
 * Gerencia login, logout e verificação de sessão
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import User from '../../models/User.model.js';
import logger from '../../utils/logger.js';

/**
 * Verificar se conexão Mongoose está pronta
 */
function ensureConnection() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Conexão com banco de dados não está pronta. Aguarde alguns instantes e tente novamente.');
  }
}

/**
 * POST /api/auth/register
 * Registra um novo usuário
 */
export async function register(req, res) {
  try {
    // Verificar conexão antes de executar query
    ensureConnection();

    const {
      username,
      password,
      nomeCompleto,
      dataNascimento,
      matriculaPrefeitura,
      email,
      telefone,
      cargo
    } = req.body;

    // Validação de campos obrigatórios
    if (!username || !password || !nomeCompleto || !dataNascimento ||
      !matriculaPrefeitura || !email || !telefone || !cargo) {
      return res.status(400).json({
        success: false,
        message: 'Todos os campos são obrigatórios'
      });
    }

    // Validar formato de email
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Email inválido'
      });
    }

    // Verificar se usuário já existe
    const existingUser = await User.findByUsername(username.toLowerCase());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Usuário já cadastrado'
      });
    }

    // Verificar se email já existe
    const existingEmail = await User.findByEmail(email.toLowerCase());
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado'
      });
    }

    // Verificar se matrícula já existe
    const existingMatricula = await User.findByMatricula(matriculaPrefeitura);
    if (existingMatricula) {
      return res.status(400).json({
        success: false,
        message: 'Matrícula já cadastrada'
      });
    }

    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter no mínimo 6 caracteres'
      });
    }

    // Hash da senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Validar data de nascimento
    const dataNasc = new Date(dataNascimento);
    if (isNaN(dataNasc.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Data de nascimento inválida'
      });
    }

    // Criar novo usuário
    const newUser = new User({
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      nomeCompleto: nomeCompleto.trim(),
      dataNascimento: dataNasc,
      matriculaPrefeitura: matriculaPrefeitura.trim().toUpperCase(),
      email: email.toLowerCase().trim(),
      telefone: telefone.trim(),
      cargo: cargo.trim()
    });

    await newUser.save();

    logger.info(`Novo usuário cadastrado: ${newUser.username} (${newUser.email})`);

    res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso',
      user: {
        id: newUser._id.toString(),
        username: newUser.username,
        nomeCompleto: newUser.nomeCompleto,
        email: newUser.email
      }
    });
  } catch (error) {
    logger.error('Erro no cadastro:', error);

    // Tratar erros de duplicidade do MongoDB
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'Dados já cadastrados';

      if (field === 'username') message = 'Usuário já cadastrado';
      else if (field === 'email') message = 'Email já cadastrado';
      else if (field === 'matriculaPrefeitura') message = 'Matrícula já cadastrada';

      return res.status(400).json({
        success: false,
        message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /api/auth/login
 * Autentica um usuário
 */
export async function login(req, res) {
  try {
    // Verificar conexão antes de executar query
    ensureConnection();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuário e senha são obrigatórios'
      });
    }

    // Buscar usuário no banco
    const user = await User.findByUsername(username.toLowerCase());

    if (!user) {
      logger.warn(`Tentativa de login com usuário inexistente: ${username.toLowerCase()}`);
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos'
      });
    }

    // Verificar senha
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      logger.warn(`Senha incorreta para usuário: ${username.toLowerCase()}`);
      return res.status(401).json({
        success: false,
        message: 'Usuário ou senha inválidos'
      });
    }

    // Criar sessão
    req.session.userId = user._id.toString();
    req.session.username = user.username;
    req.session.role = user.role || 'viewer'; // Default seguro
    req.session.isAuthenticated = true;

    // IMPORTANTE: Salvar sessão explicitamente antes de enviar resposta
    // Isso garante que a sessão seja persistida antes do redirect
    req.session.save((err) => {
      if (err) {
        logger.error('Erro ao salvar sessão:', err);
        return res.status(500).json({
          success: false,
          message: 'Erro ao criar sessão'
        });
      }

      logger.info(`Login realizado com sucesso: ${user.username} (sessão: ${req.sessionID})`);

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role || 'viewer'
        }
      });
    });
  } catch (error) {
    logger.error('Erro no login:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

/**
 * POST /api/auth/logout
 * Encerra a sessão do usuário
 */
export async function logout(req, res) {
  try {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Erro ao destruir sessão:', err);
        return res.status(500).json({
          success: false,
          message: 'Erro ao fazer logout'
        });
      }

      res.clearCookie('ouvidoria.sid');
      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    });
  } catch (error) {
    logger.error('Erro no logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

/**
 * GET /api/auth/me
 * Retorna informações do usuário autenticado
 * Não requer autenticação - apenas verifica se está autenticado
 */
export async function getCurrentUser(req, res) {
  try {
    // Verificar conexão antes de executar query
    ensureConnection();

    // Verificar se está autenticado (sem usar requireAuth para evitar loops)
    if (!req.session || !req.session.isAuthenticated) {
      return res.status(401).json({
        success: false,
        message: 'Não autenticado'
      });
    }

    const user = await User.findById(req.session.userId)
      .select('_id username role createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role || 'viewer',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
}

