/**
 * Controller para Integração com API do Colab
 * Documentação: https://public-api-doc.colabapp.com/
 * 
 * Nota: Usa fetch nativo do Node.js 18+
 */

// Garantir que dotenv está carregado
import 'dotenv/config';

import logger from '../../utils/logger.js';

// Verificar se fetch está disponível (Node.js 18+)
if (typeof fetch === 'undefined') {
  logger.warn('fetch não está disponível - pode ser necessário node-fetch');
  // Em Node.js < 18, precisaríamos importar node-fetch
  // Mas como o package.json exige Node >= 18, assumimos que fetch está disponível
}

// Configuração da API do Colab
const COLAB_API_BASE = process.env.COLAB_API_BASE || 'https://api.colabapp.com/v2/integration';
const COLAB_STAGING_API_BASE = process.env.COLAB_STAGING_API_BASE || 'https://stg-api.colabapp.com/v2/integration';

// Credenciais (devem estar no .env)
const COLAB_APPLICATION_ID = process.env.COLAB_APPLICATION_ID;
const COLAB_REST_API_KEY = process.env.COLAB_REST_API_KEY;
const COLAB_ADMIN_USER_AUTH_TICKET = process.env.COLAB_ADMIN_USER_AUTH_TICKET;
const COLAB_USE_STAGING = process.env.COLAB_USE_STAGING === 'true';

const API_BASE = COLAB_USE_STAGING ? COLAB_STAGING_API_BASE : COLAB_API_BASE;

// Log de configuração (sem expor credenciais)
logger.info('Colab API configurada', {
  base: API_BASE,
  hasApplicationId: !!COLAB_APPLICATION_ID,
  hasApiKey: !!COLAB_REST_API_KEY,
  hasAuthTicket: !!COLAB_ADMIN_USER_AUTH_TICKET,
  staging: COLAB_USE_STAGING
});

/**
 * Headers padrão para requisições ao Colab
 */
function getColabHeaders() {
  if (!COLAB_APPLICATION_ID || !COLAB_REST_API_KEY || !COLAB_ADMIN_USER_AUTH_TICKET) {
    return null; // Retornar null ao invés de lançar erro
  }
  
  return {
    'x-colab-application-id': COLAB_APPLICATION_ID,
    'x-colab-rest-api-key': COLAB_REST_API_KEY,
    'x-colab-admin-user-auth-ticket': COLAB_ADMIN_USER_AUTH_TICKET,
    'Content-Type': 'application/json'
  };
}

/**
 * GET /api/colab/categories
 * Listar categorias do Colab
 */
export async function getCategories(req, res) {
  try {
    logger.info('Buscando categorias do Colab');
    const headers = getColabHeaders();
    if (!headers) {
      logger.error('Credenciais do Colab não configuradas', {
        hasApplicationId: !!COLAB_APPLICATION_ID,
        hasApiKey: !!COLAB_REST_API_KEY,
        hasAuthTicket: !!COLAB_ADMIN_USER_AUTH_TICKET
      });
      return res.status(500).json({ 
        error: 'Credenciais do Colab não configuradas',
        message: 'Configure as variáveis de ambiente: COLAB_APPLICATION_ID, COLAB_REST_API_KEY, COLAB_ADMIN_USER_AUTH_TICKET'
      });
    }
    
    const type = req.query.type; // 'post' ou 'event'
    const url = type 
      ? `${API_BASE}/categories?type=${type}`
      : `${API_BASE}/categories`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao buscar categorias do Colab', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar categorias do Colab',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * GET /api/colab/posts
 * Retorna as demandas para a entidade
 */
export async function getPosts(req, res) {
  try {
    const { start_date, end_date, status, category_id, category, page, perPage } = req.query;
    
    logger.info('Buscando posts do Colab', { category, page, perPage });
    const headers = getColabHeaders();
    if (!headers) {
      logger.error('Credenciais do Colab não configuradas', {
        hasApplicationId: !!COLAB_APPLICATION_ID,
        hasApiKey: !!COLAB_REST_API_KEY,
        hasAuthTicket: !!COLAB_ADMIN_USER_AUTH_TICKET
      });
      return res.status(500).json({ 
        error: 'Credenciais do Colab não configuradas',
        message: 'Configure as variáveis de ambiente: COLAB_APPLICATION_ID, COLAB_REST_API_KEY, COLAB_ADMIN_USER_AUTH_TICKET'
      });
    }
    
    if (!start_date || !end_date) {
      return res.status(400).json({ 
        error: 'Parâmetros start_date e end_date são obrigatórios' 
      });
    }
    
    let url = `${API_BASE}/posts?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(end_date)}`;
    
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    
    if (category_id) {
      const categoryIds = Array.isArray(category_id) ? category_id : [category_id];
      url += `&category_id=${JSON.stringify(categoryIds)}`;
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao buscar demandas do Colab', error, { category, page });
    return res.status(500).json({ 
      error: 'Erro ao buscar demandas do Colab',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * GET /api/colab/posts/:id
 * Consultar uma demanda específica (tipo post)
 */
export async function getPostById(req, res) {
  try {
    const headers = getColabHeaders();
    if (!headers) {
      return res.status(500).json({ 
        error: 'Credenciais do Colab não configuradas',
        message: 'Configure as variáveis de ambiente: COLAB_APPLICATION_ID, COLAB_REST_API_KEY, COLAB_ADMIN_USER_AUTH_TICKET'
      });
    }
    
    const { id } = req.params;
    
    const url = `${API_BASE}/post/${id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Demanda não encontrada' });
      }
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao buscar demanda do Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao buscar demanda do Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/posts
 * Cria uma nova demanda a partir da Central de Ocorrências
 */
export async function createPost(req, res) {
  try {
    const { description, address, neighborhood, lat, lng, postCategoryId, pictureUrl, postTags } = req.body;
    
    // Validações obrigatórias
    if (!description || !address || lat === undefined || lng === undefined || !postCategoryId) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: description, address, lat, lng, postCategoryId' 
      });
    }
    
    const payload = {
      description,
      address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      postCategoryId: parseInt(postCategoryId),
      ...(neighborhood && { neighborhood }),
      ...(pictureUrl && { pictureUrl: Array.isArray(pictureUrl) ? pictureUrl : [pictureUrl] }),
      ...(postTags && { postTags: Array.isArray(postTags) ? postTags : [postTags] })
    };
    
    const url = `${API_BASE}/posts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders(),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao criar demanda no Colab', error);
    return res.status(500).json({ 
      error: 'Erro ao criar demanda no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/posts/:id/accept
 * Aceitar uma demanda
 */
export async function acceptPost(req, res) {
  try {
    const { id } = req.params;
    
    const url = `${API_BASE}/post/${id}/accept`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'Sem permissão para aceitar esta demanda' });
      }
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao aceitar demanda no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao aceitar demanda no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/posts/:id/reject
 * Rejeitar demanda
 */
export async function rejectPost(req, res) {
  try {
    const { id } = req.params;
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Campo description é obrigatório' });
    }
    
    const url = `${API_BASE}/post/${id}/reject`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders(),
      body: JSON.stringify({ description })
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'Sem permissão para rejeitar esta demanda' });
      }
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao rejeitar demanda no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao rejeitar demanda no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/posts/:id/solve
 * Finalizar demanda
 */
export async function solvePost(req, res) {
  try {
    const { id } = req.params;
    const { message, pictureUrl } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Campo message é obrigatório' });
    }
    
    const payload = { message };
    if (pictureUrl) {
      payload.pictureUrl = pictureUrl;
    }
    
    const url = `${API_BASE}/post/${id}/solve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders(),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        return res.status(403).json({ error: 'Sem permissão para finalizar esta demanda' });
      }
      if (response.status === 428) {
        return res.status(428).json({ error: 'Mudança de status inválida para esta demanda' });
      }
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao finalizar demanda no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao finalizar demanda no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/posts/:id/comment
 * Criar comentário na demanda
 */
export async function createComment(req, res) {
  try {
    const { id } = req.params;
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Campo description é obrigatório' });
    }
    
    const url = `${API_BASE}/post/${id}/comment`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders(),
      body: JSON.stringify({ description })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao criar comentário no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao criar comentário no Colab',
      message: error.message 
    });
  }
}

/**
 * GET /api/colab/posts/:id/comments
 * Listar comentários da demanda
 */
export async function getComments(req, res) {
  try {
    const { id } = req.params;
    
    const url = `${API_BASE}/post/${id}/comments`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getColabHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao buscar comentários do Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao buscar comentários do Colab',
      message: error.message 
    });
  }
}

/**
 * GET /api/colab/events/:id
 * Consultar uma demanda específica (tipo event)
 */
export async function getEventById(req, res) {
  try {
    const { id } = req.params;
    
    const url = `${API_BASE}/event/${id}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getColabHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'Demanda não encontrada' });
      }
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao buscar evento do Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao buscar evento do Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/events/:id/accept
 * Aceitar demanda (tipo event)
 */
export async function acceptEvent(req, res) {
  try {
    const { id } = req.params;
    
    const url = `${API_BASE}/event/${id}/accept`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao aceitar evento no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao aceitar evento no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/events/:id/solve
 * Finalizar demanda (tipo event)
 */
export async function solveEvent(req, res) {
  try {
    const { id } = req.params;
    const { message, pictureUrl } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Campo message é obrigatório' });
    }
    
    const payload = { message };
    if (pictureUrl) {
      payload.pictureUrl = pictureUrl;
    }
    
    const url = `${API_BASE}/event/${id}/solve`;
    const response = await fetch(url, {
      method: 'POST',
      headers: getColabHeaders(),
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Colab API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error) {
    logger.errorWithContext('Erro ao finalizar evento no Colab', error, { id });
    return res.status(500).json({ 
      error: 'Erro ao finalizar evento no Colab',
      message: error.message 
    });
  }
}

/**
 * POST /api/colab/webhooks
 * Endpoint para receber webhooks do Colab
 */
export async function receiveWebhook(req, res) {
  try {
    const webhookData = req.body;
    const eventType = req.headers['x-colab-event'] || 'unknown';
    
    logger.info('Webhook recebido do Colab', { eventType, data: webhookData });
    
    // Aqui você pode processar o webhook conforme necessário
    // Exemplos: salvar no banco, atualizar cache, notificar usuários, etc.
    
    // Retornar 200 para confirmar recebimento
    return res.status(200).json({ 
      received: true,
      eventType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.errorWithContext('Erro ao processar webhook do Colab', error);
    return res.status(500).json({ 
      error: 'Erro ao processar webhook',
      message: error.message 
    });
  }
}

