/**
 * Serviço de Integração com Gmail API
 * Envia emails usando a Gmail API do Google
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolver caminho do arquivo de configuração
 * Tenta múltiplos caminhos possíveis para funcionar tanto no servidor quanto nos scripts
 */
function resolveConfigPath(filename) {
  // Tentar caminho relativo ao módulo (servidor)
  const modulePath = path.join(__dirname, '../../..', 'config', filename);
  if (fs.existsSync(modulePath)) {
    return modulePath;
  }
  
  // Tentar caminho relativo ao diretório de trabalho atual (scripts)
  const cwdPath = path.join(process.cwd(), 'config', filename);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  
  // Tentar caminho relativo ao NOVO (se executado da raiz)
  const novoPath = path.join(process.cwd(), 'NOVO', 'config', filename);
  if (fs.existsSync(novoPath)) {
    return novoPath;
  }
  
  // Se não encontrou, retornar o caminho padrão (relativo ao módulo)
  return modulePath;
}

// Configuração OAuth2
// Escopos necessários:
// - gmail.send: para enviar emails
// - gmail.settings.basic: para verificar/configurar vacation settings (resposta automática de férias)
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];
const TOKEN_PATH = resolveConfigPath('gmail-token.json');
const CREDENTIALS_PATH = resolveConfigPath('gmail-credentials.json');

let oauth2Client = null;
let gmail = null;

/**
 * Carregar credenciais do arquivo
 */
function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error('❌ Arquivo de credenciais não encontrado em:', CREDENTIALS_PATH);
      console.error('💡 Verifique se o arquivo config/gmail-credentials.json existe');
      console.error('💡 Diretório de trabalho atual:', process.cwd());
      throw new Error(`Arquivo de credenciais não encontrado: ${CREDENTIALS_PATH}`);
    }
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    
    // CORREÇÃO: Google descontinuou urn:ietf:wg:oauth:2.0:oob
    // Usar http://localhost para scripts CLI (o usuário copia o código da URL)
    // Para aplicações web, usar o callback da API
    const redirectUri = redirect_uris && redirect_uris.length > 0 
      ? redirect_uris.find(uri => uri.startsWith('http://localhost')) || redirect_uris[0]
      : 'http://localhost';
    
    oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );
    
    return oauth2Client;
  } catch (error) {
    console.error('❌ Erro ao carregar credenciais do Gmail:', error);
    throw error;
  }
}

/**
 * Carregar token salvo
 */
function loadToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      
      // Verificar se o token tem refresh_token
      if (!token.refresh_token) {
        console.warn('⚠️ Token não possui refresh_token. Pode ser necessário reautorizar.');
      }
      
      oauth2Client.setCredentials(token);
      return token;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erro ao carregar token:', error);
    console.error('💡 Caminho do token:', TOKEN_PATH);
    return null;
  }
}

/**
 * Salvar token
 */
function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('✅ Token salvo com sucesso');
  } catch (error) {
    console.error('❌ Erro ao salvar token:', error);
    throw error;
  }
}

/**
 * Obter URL de autorização
 * @param {string} redirectUri - URI de redirecionamento (opcional)
 *   - Se não fornecido, usa o padrão das credenciais
 *   - Para scripts CLI: 'http://localhost' (Google descontinuou OOB)
 *   - Para web: 'http://localhost:3000/api/notifications/auth/callback'
 */
export function getAuthUrl(redirectUri = null) {
  // Se um redirect_uri específico foi fornecido, criar novo cliente OAuth
  if (redirectUri) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id } = credentials.installed || credentials.web;
    
    oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );
  } else {
    // Usar o cliente padrão (carregado com redirect_uri das credenciais)
    loadCredentials();
  }
  
  const options = {
    access_type: 'offline', // Importante: permite refresh_token
    scope: SCOPES,
    prompt: 'consent' // Forçar tela de consentimento para garantir refresh_token
  };
  
  return oauth2Client.generateAuthUrl(options);
}

/**
 * Autorizar com código
 */
export async function authorize(code) {
  try {
    // Garantir que estamos usando o mesmo redirect_uri usado na URL de autorização
    // Para scripts CLI, usar http://localhost
    const redirectUri = 'http://localhost';
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const { client_secret, client_id } = credentials.installed || credentials.web;
    
    // Criar cliente OAuth com o redirect_uri correto
    const auth = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirectUri
    );
    
    console.log(`   Verificando redirect_uri: ${redirectUri}`);
    
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);
    saveToken(tokens);
    
    // Atualizar o cliente global
    oauth2Client = auth;
    gmail = google.gmail({ version: 'v1', auth });
    
    return tokens;
  } catch (error) {
    console.error('❌ Erro ao autorizar:', error.message);
    
    // Se for erro de redirect_uri_mismatch, dar instruções claras
    if (error.message && error.message.includes('redirect_uri_mismatch')) {
      console.error('\n🚨 ERRO: redirect_uri_mismatch');
      console.error('\n💡 SOLUÇÃO:');
      console.error('   1. Vá no Google Cloud Console');
      console.error('   2. Cliente OAuth: 353430763944-tmerll34c4anr8d12vjnpk6bv0c9i3fd');
      console.error('   3. Em "URIs de redirecionamento autorizados"');
      console.error('   4. Adicione EXATAMENTE: http://localhost');
      console.error('   5. Salve e aguarde 30-60 segundos');
      console.error('   6. Teste novamente\n');
    }
    
    throw error;
  }
}

/**
 * Inicializar cliente Gmail com renovação automática de token
 */
function initGmail() {
  if (gmail) return gmail;
  
  try {
    const auth = loadCredentials();
    const token = loadToken();
    
    if (!token) {
      throw new Error('Token não encontrado. Execute a autorização primeiro.');
    }
    
    auth.setCredentials(token);
    
    // Configurar renovação automática de token
    auth.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        // Salvar novo refresh token se fornecido
        const updatedToken = { ...token, ...tokens };
        saveToken(updatedToken);
      } else if (tokens.access_token) {
        // Atualizar apenas o access token
        const updatedToken = { ...token, access_token: tokens.access_token, expiry_date: tokens.expiry_date };
        saveToken(updatedToken);
      }
    });
    
    // Forçar renovação se o token estiver próximo de expirar
    if (token.expiry_date && token.expiry_date <= Date.now() + 60000) {
      auth.refreshAccessToken().catch(err => {
        console.error('❌ Erro ao renovar token:', err);
      });
    }
    
    gmail = google.gmail({ version: 'v1', auth });
    return gmail;
  } catch (error) {
    console.error('❌ Erro ao inicializar Gmail:', error);
    throw error;
  }
}

/**
 * Codificar assunto do email usando RFC 2047 (para suportar emojis e caracteres especiais)
 * @param {string} subject - Assunto do email
 * @returns {string} - Assunto codificado
 */
function encodeSubject(subject) {
  // Verificar se contém caracteres não-ASCII (incluindo emojis)
  const hasNonAscii = /[^\x00-\x7F]/.test(subject);
  
  if (!hasNonAscii) {
    // Se só tem ASCII, retornar como está
    return subject;
  }
  
  // Codificar usando Base64 (RFC 2047)
  const encoded = Buffer.from(subject, 'utf8').toString('base64');
  return `=?UTF-8?B?${encoded}?=`;
}

/**
 * Criar mensagem MIME para envio
 */
function createMessage(to, subject, htmlBody, textBody, fromEmail, fromName) {
  // Codificar assunto para suportar emojis e caracteres especiais
  const encodedSubject = encodeSubject(subject);
  
  const message = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="boundary123"`,
    ``,
    `--boundary123`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    textBody,
    ``,
    `--boundary123`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    ``,
    `--boundary123--`
  ].join('\n');
  
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Verificar se erro é recuperável (pode tentar novamente)
 * PRIORIDADE 2: Retry automático para erros temporários
 */
function isRetryableError(error) {
  // Erros de rate limit (429)
  if (error.code === 429 || (error.response && error.response.status === 429)) {
    return true;
  }
  
  // Erros de timeout (408, 504)
  if (error.code === 408 || error.code === 504 || 
      (error.response && (error.response.status === 408 || error.response.status === 504))) {
    return true;
  }
  
  // Erros de servidor temporário (500, 502, 503)
  if (error.code === 500 || error.code === 502 || error.code === 503 ||
      (error.response && [500, 502, 503].includes(error.response.status))) {
    return true;
  }
  
  // Erros de rede (ECONNRESET, ETIMEDOUT, etc)
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }
  
  return false;
}

/**
 * Calcular delay para retry com backoff exponencial
 * PRIORIDADE 2: Retry automático
 */
function getRetryDelay(attempt, baseDelay = 1000) {
  // Backoff exponencial: baseDelay * (2 ^ attempt)
  // Máximo de 30 segundos
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
}

/**
 * Enviar email com tratamento de erros de autenticação e retry automático
 * PRIORIDADE 2: Retry automático para erros temporários
 * @param {string} to - Email do destinatário
 * @param {string} subject - Assunto do email
 * @param {string} htmlBody - Corpo HTML do email
 * @param {string} textBody - Corpo texto do email
 * @param {string} fromEmail - Email do remetente (opcional)
 * @param {string} fromName - Nome do remetente (opcional)
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 3)
 * @returns {Promise<{messageId: string, threadId: string}>}
 */
export async function sendEmail(to, subject, htmlBody, textBody, fromEmail = null, fromName = null, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Resetar cliente Gmail para forçar reinicialização se houver erro de auth
      let gmailClient = initGmail();
      
      // Usar configurações padrão se não fornecidas
      const emailRemetente = fromEmail || process.env.EMAIL_REMETENTE || 'ouvidoria@duquedecaxias.rj.gov.br';
      const nomeRemetente = fromName || process.env.NOME_REMETENTE || 'Ouvidoria Geral de Duque de Caxias';
      
      const rawMessage = createMessage(to, subject, htmlBody, textBody, emailRemetente, nomeRemetente);
      
      const response = await gmailClient.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: rawMessage
        }
      });
      
      console.log('✅ Email enviado com sucesso:', {
        to,
        subject,
        messageId: response.data.id,
        threadId: response.data.threadId,
        attempts: attempt + 1
      });
      
      return {
        messageId: response.data.id,
        threadId: response.data.threadId
      };
    } catch (error) {
      lastError = error;
      
      // PRIORIDADE 2: Tratar erros de autenticação (NÃO são recuperáveis)
      if (error.code === 400 && error.message && error.message.includes('invalid_grant')) {
        console.error('❌ Erro de autenticação (invalid_grant): Token expirado ou revogado');
        console.error('   Solução: Execute a autorização novamente usando: npm run gmail:auth');
        
        // Resetar cliente Gmail para forçar nova inicialização na próxima tentativa
        gmail = null;
        
        throw new Error('Token OAuth expirado ou revogado. É necessário reautorizar o serviço Gmail. Execute: npm run gmail:auth');
      }
      
      // Tratar outros erros de autenticação (NÃO são recuperáveis)
      if (error.code === 401 || (error.response && error.response.status === 401)) {
        console.error('❌ Erro de autenticação (401): Token inválido');
        console.error('   Solução: Execute a autorização novamente usando: npm run gmail:auth');
        
        // Resetar cliente Gmail
        gmail = null;
        
        throw new Error('Token OAuth inválido. É necessário reautorizar o serviço Gmail. Execute: npm run gmail:auth');
      }
      
      // PRIORIDADE 2: Retry automático para erros temporários
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = getRetryDelay(attempt);
        console.warn(`⚠️ Erro temporário ao enviar email (tentativa ${attempt + 1}/${maxRetries + 1}):`, {
          error: error.message,
          code: error.code,
          status: error.response?.status,
          retryIn: `${delay}ms`
        });
        
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Resetar cliente Gmail para tentar novamente
        gmail = null;
        
        continue; // Tentar novamente
      }
      
      // Se não é recuperável ou esgotou tentativas, lançar erro
      console.error('❌ Erro ao enviar email:', {
        error: error.message,
        code: error.code,
        status: error.response?.status,
        attempts: attempt + 1
      });
      throw error;
    }
  }
  
  // Se chegou aqui, esgotou todas as tentativas
  throw lastError || new Error('Falha ao enviar email após múltiplas tentativas');
}

/**
 * Verificar se o serviço está autorizado
 */
export function isAuthorized() {
  try {
    return fs.existsSync(TOKEN_PATH) && fs.existsSync(CREDENTIALS_PATH);
  } catch (error) {
    return false;
  }
}

/**
 * Verificar status da autorização
 */
export async function checkAuthStatus() {
  try {
    if (!isAuthorized()) {
      return {
        authorized: false,
        message: 'Serviço não autorizado. Execute a autorização primeiro.'
      };
    }
    
    const gmailClient = initGmail();
    const profile = await gmailClient.users.getProfile({ userId: 'me' });
    
    return {
      authorized: true,
      email: profile.data.emailAddress,
      message: 'Serviço autorizado e funcionando'
    };
  } catch (error) {
    return {
      authorized: false,
      message: `Erro ao verificar autorização: ${error.message}`
    };
  }
}

/**
 * Obter configurações de resposta automática de férias (Vacation Settings)
 * Requer escopo: https://www.googleapis.com/auth/gmail.settings.basic
 * 
 * @param {string} userId - ID do usuário (padrão: 'me' para o usuário autenticado)
 * @returns {Promise<Object>} Configurações de férias
 */
export async function getVacationSettings(userId = 'me') {
  try {
    const gmailClient = initGmail();
    
    const response = await gmailClient.users.settings.getVacation({
      userId: userId
    });
    
    return {
      success: true,
      enabled: response.data.enableAutoReply || false,
      subject: response.data.responseSubject || '',
      message: response.data.responseBodyPlainText || '',
      startTime: response.data.startTime || null,
      endTime: response.data.endTime || null,
      restrictToContacts: response.data.restrictToContacts || false,
      restrictToDomain: response.data.restrictToDomain || false,
      raw: response.data
    };
  } catch (error) {
    console.error('❌ Erro ao obter configurações de férias:', error);
    
    // Se o erro for de escopo insuficiente
    if (error.code === 403 || (error.response && error.response.status === 403)) {
      throw new Error('Escopo insuficiente. É necessário reautorizar com o escopo gmail.settings.basic. Execute: npm run gmail:auth');
    }
    
    throw error;
  }
}

/**
 * Verificar se a resposta automática de férias está ativa
 * Útil para evitar enviar emails quando o remetente está de férias
 * 
 * @param {string} userId - ID do usuário (padrão: 'me')
 * @returns {Promise<boolean>} true se está de férias, false caso contrário
 */
export async function isOnVacation(userId = 'me') {
  try {
    const settings = await getVacationSettings(userId);
    
    if (!settings.enabled) {
      return false;
    }
    
    // Verificar se está dentro do período de férias
    const now = Date.now();
    const startTime = settings.startTime ? parseInt(settings.startTime) : null;
    const endTime = settings.endTime ? parseInt(settings.endTime) : null;
    
    if (startTime && now < startTime) {
      return false; // Ainda não começou
    }
    
    if (endTime && now > endTime) {
      return false; // Já terminou
    }
    
    return true; // Está de férias
  } catch (error) {
    // Se não conseguir verificar, assumir que não está de férias
    console.warn('⚠️ Não foi possível verificar status de férias, assumindo que não está de férias:', error.message);
    return false;
  }
}

