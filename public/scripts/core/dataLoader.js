/**
 * Sistema Global de Carregamento de Dados
 * Unifica o carregamento de dados para TODAS as páginas e cards
 * OTIMIZADO: Controle de concorrência, retry com backoff exponencial, timeouts adaptativos
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
/// <reference path="./chart-communication/global.d.ts" />
const pendingRequests = new Map();
const requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 6; // Limite de requisições simultâneas
// Timeouts adaptativos por tipo de endpoint
const TIMEOUT_CONFIG = {
    '/api/summary': 10000, // 10s - rápido
    '/api/distinct': 10000, // 10s - rápido
    '/api/health': 5000, // 5s - muito rápido
    '/api/dashboard-data': 90000, // 90s - muito pesado (usa agregações complexas)
    '/api/aggregate': 60000, // 60s - médio/pesado
    '/api/stats': 60000, // 60s - pesado
    '/api/sla': 90000, // 90s - muito pesado
    default: 30000 // 30s - padrão
};
function getAdaptiveTimeout(endpoint) {
    for (const [pattern, timeout] of Object.entries(TIMEOUT_CONFIG)) {
        if (pattern === 'default')
            continue;
        if (endpoint.includes(pattern)) {
            return timeout;
        }
    }
    return TIMEOUT_CONFIG.default;
}
// Backoff exponencial: baseDelay * (2 ^ attempt)
function getBackoffDelay(attempt, baseDelay = 1000) {
    return baseDelay * Math.pow(2, attempt);
}
// Processar fila de requisições
async function processQueue() {
    if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
        return;
    }
    const { execute, resolve, reject } = requestQueue.shift();
    activeRequests++;
    try {
        await execute();
    }
    catch (error) {
        // Erro já foi tratado em executeRequest
    }
    finally {
        activeRequests--;
        // Processar próximo da fila
        setTimeout(() => processQueue(), 0);
    }
}
window.dataLoader = {
    async load(endpoint, options = {}) {
        const { fallback = null, timeout = null, // null = usar timeout adaptativo
        retries = 1, useDataStore = true, priority = 'normal' // 'high', 'normal', 'low'
         } = options;
        // Usar timeout adaptativo se não especificado
        const effectiveTimeout = timeout !== null ? timeout : getAdaptiveTimeout(endpoint);
        if (useDataStore && window.dataStore) {
            const ttl = options.ttl !== undefined ? options.ttl : window.dataStore.getDefaultTTL();
            if (endpoint === '/api/dashboard-data' || endpoint.includes('/api/dashboard-data')) {
                const cached = window.dataStore.get('dashboardData', ttl);
                if (cached !== null) {
                    if (window.Logger) {
                        window.Logger.debug(`${endpoint}: Dados obtidos do cache`);
                    }
                    return cached;
                }
            }
            else {
                const cached = window.dataStore.get(endpoint, ttl);
                if (cached !== null) {
                    if (window.Logger) {
                        window.Logger.debug(`${endpoint}: Dados obtidos do cache`);
                    }
                    return cached;
                }
            }
        }
        const cacheKey = `${endpoint}_${JSON.stringify(options)}`;
        if (pendingRequests.has(cacheKey)) {
            if (window.Logger) {
                window.Logger.debug(`${endpoint}: Reutilizando requisição pendente`);
            }
            return pendingRequests.get(cacheKey);
        }
        // Criar promise que será executada via fila de concorrência
        const requestPromise = new Promise((resolve, reject) => {
            const executeRequest = async () => {
                try {
                    const data = await this._fetchDirect(endpoint, {
                        fallback,
                        timeout: effectiveTimeout,
                        retries,
                        deepCopy: options.deepCopy
                    });
                    pendingRequests.delete(cacheKey);
                    resolve(data);
                }
                catch (error) {
                    pendingRequests.delete(cacheKey);
                    reject(error);
                }
            };
            const queueItem = {
                endpoint,
                execute: executeRequest,
                resolve,
                reject
            };
            // Se há espaço para mais requisições, executar imediatamente
            if (activeRequests < MAX_CONCURRENT_REQUESTS) {
                activeRequests++;
                executeRequest().finally(() => {
                    activeRequests--;
                    processQueue();
                });
            }
            else {
                // Adicionar à fila (prioridade alta vai para frente)
                if (priority === 'high') {
                    requestQueue.unshift(queueItem);
                }
                else {
                    requestQueue.push(queueItem);
                }
                processQueue();
            }
        });
        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    },
    async _fetchDirect(endpoint, { fallback, timeout, retries, deepCopy = true }) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                const res = await fetch(endpoint, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', // Importante: enviar cookies de sessão
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                clearTimeout(timeoutId);
                if (!res.ok) {
                    // Tratar erros 502, 503, 504 (gateway/timeout) como erros recuperáveis
                    if (res.status === 404 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
                        if (window.Logger) {
                            window.Logger.warn(`${endpoint}: HTTP ${res.status}, retornando fallback`);
                        }
                        // Se for erro de gateway/timeout, tentar limpar cache para forçar nova requisição
                        if ((res.status === 502 || res.status === 503 || res.status === 504) && window.dataStore) {
                            window.dataStore.clear(endpoint);
                        }
                        return fallback;
                    }
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
                const data = await res.json();
                const count = this._countItems(data);
                // Validar dados antes de salvar no cache (especialmente para /api/distritos)
                if (endpoint === '/api/distritos') {
                    if (!data || !data.distritos || Object.keys(data.distritos || {}).length === 0) {
                        console.warn('⚠️ dataLoader: /api/distritos retornou dados vazios, não salvando no cache');
                        console.warn('   Estrutura recebida:', data ? Object.keys(data) : 'null');
                        if (window.Logger) {
                            window.Logger.warn('/api/distritos: Dados vazios recebidos, ignorando cache');
                        }
                        // Limpar cache antigo se existir
                        if (window.dataStore) {
                            window.dataStore.clear('/api/distritos');
                        }
                        return data; // Retornar mesmo assim, mas sem salvar no cache
                    }
                    // Validar que os dados são válidos antes de salvar
                    console.log('✅ dataLoader: /api/distritos validado, salvando no cache');
                    console.log(`   - Distritos: ${Object.keys(data.distritos).length}`);
                }
                // Tratar casos em que o backend retorna dados vazios ou indefinidos
                // para evitar que o frontend quebre com "undefined.value" ou estruturas inesperadas
                let safeData = data;
                if (safeData === null || safeData === undefined) {
                    safeData = fallback !== null ? fallback : null;
                }
                if (window.dataStore) {
                    const useDeepCopy = deepCopy !== false;
                    if (endpoint === '/api/dashboard-data' || endpoint.includes('/api/dashboard-data')) {
                        window.dataStore.set('dashboardData', safeData, useDeepCopy);
                        if (safeData && safeData.manifestationsByMonth) {
                            window.dataStore.set('manifestationsByMonth', safeData.manifestationsByMonth, useDeepCopy);
                            window.dataStore.set('/api/aggregate/by-month', safeData.manifestationsByMonth, useDeepCopy);
                        }
                        if (safeData && safeData.manifestationsByDay) {
                            window.dataStore.set('manifestationsByDay', safeData.manifestationsByDay, useDeepCopy);
                            window.dataStore.set('/api/aggregate/by-day', safeData.manifestationsByDay, useDeepCopy);
                        }
                        if (safeData && safeData.manifestationsByStatus) {
                            window.dataStore.set('manifestationsByStatus', safeData.manifestationsByStatus, useDeepCopy);
                        }
                        if (safeData && safeData.manifestationsByTheme) {
                            window.dataStore.set('manifestationsByTheme', safeData.manifestationsByTheme, useDeepCopy);
                            window.dataStore.set('/api/aggregate/by-theme', safeData.manifestationsByTheme, useDeepCopy);
                        }
                        if (safeData && safeData.manifestationsBySubject) {
                            window.dataStore.set('manifestationsBySubject', safeData.manifestationsBySubject, useDeepCopy);
                            window.dataStore.set('/api/aggregate/by-subject', safeData.manifestationsBySubject, useDeepCopy);
                        }
                        if (safeData && safeData.manifestationsByOrgan) {
                            window.dataStore.set('manifestationsByOrgan', safeData.manifestationsByOrgan, useDeepCopy);
                        }
                    }
                    else {
                        window.dataStore.set(endpoint, safeData, useDeepCopy);
                    }
                    if (window.Logger) {
                        window.Logger.debug(`${endpoint}: Dados armazenados no dataStore${useDeepCopy ? ' (deepCopy)' : ''}`);
                    }
                }
                if (window.Logger) {
                    window.Logger.success(`${endpoint}: ${count} itens`);
                }
                return safeData;
            }
            catch (error) {
                // Backoff exponencial: delay aumenta exponencialmente a cada tentativa
                if (attempt < retries && (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('503') || error.message?.includes('502'))) {
                    const delay = getBackoffDelay(attempt, 1000); // 1s, 2s, 4s, 8s...
                    if (window.Logger) {
                        window.Logger.warn(`${endpoint}: Tentativa ${attempt + 1}/${retries + 1} falhou, tentando novamente em ${delay}ms...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                if (error.name !== 'AbortError') {
                    if (window.Logger) {
                        window.Logger.error(`${endpoint}: ${error.message || error}`);
                    }
                }
                return fallback;
            }
        }
        return fallback;
    },
    async loadMany(endpoints, options = {}) {
        // Carregar com prioridade normal (não bloqueia requisições de alta prioridade)
        const promises = endpoints.map(endpoint => this.load(endpoint, { ...options, priority: options.priority || 'normal' }));
        const results = await Promise.allSettled(promises);
        return results.map((result, index) => ({
            endpoint: endpoints[index],
            data: result.status === 'fulfilled' ? result.value : options.fallback || null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },
    // Métodos para gerenciar fila
    getQueueStats() {
        return {
            active: activeRequests,
            queued: requestQueue.length,
            maxConcurrent: MAX_CONCURRENT_REQUESTS
        };
    },
    clearQueue() {
        requestQueue.length = 0;
        if (window.Logger) {
            window.Logger.info('Fila de requisições limpa');
        }
    },
    _countItems(data) {
        if (data === null || data === undefined)
            return 0;
        if (Array.isArray(data))
            return data.length;
        if (typeof data === 'object') {
            if ('total' in data && typeof data.total === 'number')
                return data.total;
            if ('count' in data && typeof data.count === 'number')
                return data.count;
            return Object.keys(data).length;
        }
        return 0;
    }
};
