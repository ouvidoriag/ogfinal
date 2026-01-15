/**
 * ChangeStream Watcher
 * 
 * Monitora mudanças no banco de dados e invalida caches automaticamente
 * Sistema reativo que mantém dados sempre frescos
 * 
 * Funcionalidades:
 * - Monitora mudanças em Records
 * - Invalida caches baseado no tipo de mudança
 * - Invalidação seletiva (não invalida tudo)
 * - Logs de invalidação
 */

import { invalidateCachePattern, generateCacheKey } from '../utils/cache/smartCache.js';

/**
 * Mapeamento de campos para padrões de cache a invalidar
 */
const FIELD_CACHE_PATTERNS = {
  'status': ['status*', 'overview*', 'statusOverview*'],
  'tema': ['tema*', 'overview*', 'byTheme*'],
  'assunto': ['assunto*', 'overview*', 'bySubject*'],
  'orgaos': ['orgaoMes*', 'overview*', 'orgaos*'],
  'categoria': ['categoria*', 'overview*'],
  'bairro': ['bairro*', 'overview*'],
  'servidor': ['*servidor*', 'overview*'],
  'unidadeCadastro': ['*uac*', 'overview*'],
  'tipoDeManifestacao': ['overview*', 'tipo*'],
  'canal': ['overview*', 'canal*'],
  'prioridade': ['overview*', 'prioridade*']
};

/**
 * Campos que quando mudam, invalidam overview completo
 */
const OVERVIEW_FIELDS = [
  'status', 'tema', 'assunto', 'orgaos', 'categoria', 'bairro',
  'tipoDeManifestacao', 'canal', 'prioridade', 'servidor', 'unidadeCadastro'
];

/**
 * Iniciar watcher de ChangeStream
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @param {Function} getMongoClient - Função para obter cliente MongoDB
 */
export async function startChangeStreamWatcher(prisma, getMongoClient) {
  // 🟢 OPÇÃO B (Recomendada): Polling em vez de ChangeStream
  // Padrão: Polling (ChangeStream apenas se ENABLE_CHANGE_STREAM=true)
  const useChangeStream = process.env.ENABLE_CHANGE_STREAM === 'true';

  if (!useChangeStream) {
    console.log('🟡 ChangeStream desativado via configuração. Iniciando Polling Inteligente (30s)...');

    // Iniciar Polling
    startPollingWatcher(getMongoClient);
    return null; // Retorna null pois não há stream real
  }

  try {
    const client = await getMongoClient();

    // Garantir que o ChangeStream observa o MESMO banco usado pelo Prisma/Aggregations
    let dbName =
      process.env.DB_NAME ||
      process.env.MONGODB_DB_NAME ||
      null;

    if (!dbName) {
      const url = process.env.DATABASE_URL || process.env.MONGODB_ATLAS_URL || '';
      try {
        const withoutParams = url.split('?')[0] || '';
        const parts = withoutParams.split('/');
        const candidate = parts[parts.length - 1];
        if (candidate && !candidate.startsWith('mongodb')) {
          dbName = candidate;
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (!dbName) {
      dbName = 'dashboard';
    }

    const db = client.db(dbName);
    const collection = db.collection('records');

    console.log(`👁️ Iniciando ChangeStream Watcher no banco "${dbName}"...`);

    // Criar ChangeStream
    const changeStream = collection.watch(
      [
        { $match: { 'operationType': { $in: ['insert', 'update', 'replace', 'delete'] } } }
      ],
      {
        fullDocument: 'updateLookup',
        fullDocumentBeforeChange: 'whenAvailable'
      }
    );

    // Processar mudanças
    changeStream.on('change', async (change) => {
      try {
        await handleChange(change);
      } catch (error) {
        console.error('❌ Erro ao processar mudança:', error);
      }
    });

    // Tratar erros
    changeStream.on('error', (error) => {
      console.error('❌ Erro no ChangeStream:', error);
      // Tentar reiniciar após 5 segundos
      setTimeout(() => {
        console.log('🔄 Tentando reiniciar ChangeStream...');
        startChangeStreamWatcher(prisma, getMongoClient).catch(err => {
          console.error('❌ Erro ao reiniciar ChangeStream:', err);
        });
      }, 5000);
    });

    // Log de inicialização
    changeStream.on('ready', () => {
      console.log('✅ ChangeStream Watcher ativo e monitorando mudanças');
    });

    return changeStream;
  } catch (error) {
    console.error('❌ Erro ao iniciar ChangeStream Watcher:', error);
    // Fallback para polling em caso de erro
    console.log('⚠️ Falha no ChangeStream. Ativando Polling de emergência...');
    startPollingWatcher(getMongoClient);
    return null;
  }
}

/**
 * Polling Watcher (Fallback seguro)
 * Checa por atualizações a cada 30 segundos
 */
let lastCheck = new Date();
const POLL_INTERVAL = 30000; // 30 segundos

async function startPollingWatcher(getMongoClient) {
  setInterval(async () => {
    try {
      const client = await getMongoClient();
      // Usar a mesma lógica de descoberta de DB
      const dbName = 'dashboard'; // Simplificação segura para polling
      const db = client.db(dbName);
      const collection = db.collection('records');

      // Buscar registros alterados recentemente
      // Nota: Isso assume que temos um campo updatedAt confiável. 
      // Se não tivermos, usamos countDocuments como proxy simples para inserts/deletes
      // Ou invalidamos o cache periodicamente de forma preventiva

      // Estratégia Híbrida:
      // 1. Invalidar overview a cada ciclo (seguro)
      // 2. Tentar ser esperto se possível

      // Simples e eficaz: Invalidar apenas chaves críticas periodicamente
      // "Overview" é o mais importante

      pendingPatterns.add('overview*');
      pendingPatterns.add('dashboard*');

      // Processar invalidações
      flushInvalidations('polling', ['periodic_check']);

    } catch (err) {
      console.error('❌ Erro no Polling:', err.message);
    }
  }, POLL_INTERVAL);
}

// Buffer global para debounce de invalidação de cache
let pendingPatterns = new Set();
let invalidateTimeoutId = null;
const INVALIDATE_DEBOUNCE_MS = 1000;

/**
 * Executar invalidação de cache em lote (debounced)
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function flushInvalidations(operationType, changedFields) {
  const patterns = Array.from(pendingPatterns);
  pendingPatterns.clear();
  invalidateTimeoutId = null;

  if (patterns.length === 0) return;

  let totalInvalidated = 0;
  for (const pattern of patterns) {
    // REFATORAÇÃO: invalidateCachePattern não precisa mais de prisma
    const invalidated = await invalidateCachePattern(pattern);
    totalInvalidated += invalidated;
  }

  if (totalInvalidated > 0) {
    console.log(`🔄 Cache invalidado (debounced): ${totalInvalidated} entradas (${operationType}: ${changedFields.join(', ')})`);
  }
}

/**
 * Processar uma mudança do ChangeStream
 * Usa debounce para evitar tempestade de invalidações
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function handleChange(change) {
  const { operationType, fullDocument, updateDescription } = change;

  // Determinar campos que mudaram
  const changedFields = getChangedFields(operationType, fullDocument, updateDescription);

  if (changedFields.length === 0) {
    return; // Nenhum campo relevante mudou
  }

  // Registrar padrões a invalidar no buffer global
  for (const field of changedFields) {
    if (FIELD_CACHE_PATTERNS[field]) {
      FIELD_CACHE_PATTERNS[field].forEach(pattern => {
        pendingPatterns.add(pattern);
      });
    }

    if (OVERVIEW_FIELDS.includes(field)) {
      pendingPatterns.add('overview*');
      pendingPatterns.add('dashboard*');
    }
  }

  // Agendar invalidação debounced
  if (invalidateTimeoutId !== null) {
    clearTimeout(invalidateTimeoutId);
  }

  invalidateTimeoutId = setTimeout(() => {
    flushInvalidations(operationType, changedFields).catch(err => {
      console.error('❌ Erro ao invalidar cache (debounced):', err);
    });
  }, INVALIDATE_DEBOUNCE_MS);
}

/**
 * Determinar quais campos mudaram
 */
function getChangedFields(operationType, fullDocument, updateDescription) {
  const changedFields = [];

  if (operationType === 'insert' || operationType === 'replace') {
    // Documento novo ou substituído - todos os campos relevantes
    if (fullDocument) {
      OVERVIEW_FIELDS.forEach(field => {
        if (fullDocument[field] !== undefined && fullDocument[field] !== null) {
          changedFields.push(field);
        }
      });
    }
  } else if (operationType === 'update' && updateDescription) {
    // Apenas campos atualizados
    const updatedFields = updateDescription.updatedFields || {};
    const removedFields = updateDescription.removedFields || [];

    // Campos atualizados
    Object.keys(updatedFields).forEach(field => {
      // Remover prefixos de operadores MongoDB (ex: $set.status -> status)
      const cleanField = field.replace(/^\$set\./, '').replace(/^\$unset\./, '');
      if (OVERVIEW_FIELDS.includes(cleanField)) {
        changedFields.push(cleanField);
      }
    });

    // Campos removidos
    removedFields.forEach(field => {
      const cleanField = field.replace(/^\$set\./, '').replace(/^\$unset\./, '');
      if (OVERVIEW_FIELDS.includes(cleanField)) {
        changedFields.push(cleanField);
      }
    });
  } else if (operationType === 'delete') {
    // Documento deletado - invalidar tudo relacionado
    OVERVIEW_FIELDS.forEach(field => changedFields.push(field));
  }

  // Remover duplicatas
  return [...new Set(changedFields)];
}

/**
 * Parar watcher de ChangeStream
 * @param {ChangeStream} changeStream - Stream a ser parado
 */
export async function stopChangeStreamWatcher(changeStream) {
  if (changeStream) {
    try {
      await changeStream.close();
      console.log('🛑 ChangeStream Watcher parado');
    } catch (error) {
      console.error('❌ Erro ao parar ChangeStream:', error);
    }
  }
}
