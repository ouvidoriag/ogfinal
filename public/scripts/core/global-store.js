/**
 * Global Data Store - Repositório Central de Dados
 * Única fonte de verdade para dados consumidos pelos gráficos
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
/// <reference path="./chart-communication/global.d.ts" />
const dataStore = {
    dashboardData: null,
    dashboardDataTimestamp: null,
    dataCache: new Map(),
    dataTimestamps: new Map(),
    listeners: new Map(),
    defaultTTL: 5000,
    persistentPrefix: 'dashboard_cache_',
    ttlConfig: {
        static: 30 * 60 * 1000,
        '/api/distritos': 30 * 60 * 1000,
        '/api/unit/*': 30 * 60 * 1000,
        semiStatic: 10 * 60 * 1000,
        '/api/aggregate/by-month': 10 * 60 * 1000,
        dynamic: 5000,
        '/api/dashboard-data': 5000,
        '/api/summary': 5000
    }
};
function createDeepCopy(data) {
    if (data === null || data === undefined)
        return data;
    // Proteção básica: verificar se contém objetos Chart.js antes de tentar serializar
    function hasChartObjects(obj, depth = 0) {
        if (depth > 10)
            return true; // Limite de profundidade
        if (!obj || typeof obj !== 'object')
            return false;
        // Verificar se é Chart.js
        if (obj.canvas || obj.config || (obj.constructor && obj.constructor.name === 'Chart')) {
            return true;
        }
        // Verificar propriedades recursivamente (limitado)
        for (const key in obj) {
            if (obj.hasOwnProperty(key) && hasChartObjects(obj[key], depth + 1)) {
                return true;
            }
        }
        return false;
    }
    // Se contém objetos Chart.js, não tentar fazer deep copy
    if (hasChartObjects(data)) {
        if (window.Logger) {
            window.Logger.debug('dataStore.createDeepCopy: Dados contêm objetos Chart.js, retornando referência original');
        }
        return data;
    }
    try {
        return JSON.parse(JSON.stringify(data, (key, value) => {
            // Ignorar objetos Chart.js
            if (value && typeof value === 'object' && value.constructor) {
                if (value.canvas || value.config || value.constructor.name === 'Chart') {
                    return undefined; // Remover do JSON
                }
            }
            return value;
        }));
    }
    catch (error) {
        if (window.Logger) {
            window.Logger.warn('dataStore.createDeepCopy: Erro ao criar cópia, retornando referência original:', error.message);
        }
        // Se houver erro (referência circular, objeto não serializável), retornar referência original
        return data;
    }
}
function getEffectiveTTL(key) {
    for (const [pattern, ttl] of Object.entries(dataStore.ttlConfig)) {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            if (regex.test(key))
                return ttl;
        }
        else if (key === pattern || key.includes(pattern)) {
            return ttl;
        }
    }
    return dataStore.defaultTTL;
}
function getPersistent(key, ttl = null) {
    try {
        const storageKey = dataStore.persistentPrefix + key;
        const cached = localStorage.getItem(storageKey);
        if (cached) {
            const { data, timestamp, ttl: storedTTL } = JSON.parse(cached);
            const effectiveTTL = ttl !== null ? ttl : (storedTTL || dataStore.defaultTTL);
            const age = Date.now() - timestamp;
            if (age < effectiveTTL) {
                if (window.Logger) {
                    window.Logger.debug(`Cache persistente hit: ${key}`);
                }
                return data;
            }
            localStorage.removeItem(storageKey);
        }
    }
    catch (e) {
        if (window.Logger) {
            window.Logger.debug(`Erro ao ler cache persistente para ${key}:`, e.message);
        }
    }
    return null;
}
function setPersistent(key, data, ttl = null) {
    try {
        const storageKey = dataStore.persistentPrefix + key;
        const effectiveTTL = ttl !== null ? ttl : getEffectiveTTL(key);
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            ttl: effectiveTTL
        };
        localStorage.setItem(storageKey, JSON.stringify(cacheData));
    }
    catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            clearOldPersistent();
        }
    }
}
function clearOldPersistent() {
    try {
        const keys = Object.keys(localStorage);
        const now = Date.now();
        keys.forEach(k => {
            if (k.startsWith(dataStore.persistentPrefix)) {
                try {
                    const cached = JSON.parse(localStorage.getItem(k) || 'null');
                    if (cached && cached.timestamp && cached.ttl) {
                        const age = now - cached.timestamp;
                        if (age > cached.ttl) {
                            localStorage.removeItem(k);
                        }
                    }
                }
                catch (e) {
                    localStorage.removeItem(k);
                }
            }
        });
    }
    catch (e) {
        if (window.Logger) {
            window.Logger.warn('Erro ao limpar cache persistente antigo:', e.message);
        }
    }
}
function get(key, ttl = null, returnCopy = false) {
    if (typeof key !== 'string' || !key.trim())
        return null;
    const effectiveTTL = ttl !== null ? ttl : getEffectiveTTL(key);
    if (effectiveTTL >= 10 * 60 * 1000) {
        const persistentData = getPersistent(key, effectiveTTL);
        if (persistentData !== null) {
            if (key === 'dashboardData') {
                dataStore.dashboardData = persistentData;
                dataStore.dashboardDataTimestamp = Date.now();
            }
            else {
                dataStore.dataCache.set(key, persistentData);
                dataStore.dataTimestamps.set(key, Date.now());
            }
            return returnCopy ? createDeepCopy(persistentData) : persistentData;
        }
    }
    if (key === 'dashboardData') {
        if (dataStore.dashboardData && dataStore.dashboardDataTimestamp) {
            const age = Date.now() - dataStore.dashboardDataTimestamp;
            if (age < effectiveTTL) {
                return returnCopy ? createDeepCopy(dataStore.dashboardData) : dataStore.dashboardData;
            }
        }
        return null;
    }
    if (key.startsWith('dashboardData.')) {
        const subKey = key.replace('dashboardData.', '');
        if (dataStore.dashboardData && dataStore.dashboardDataTimestamp) {
            const age = Date.now() - dataStore.dashboardDataTimestamp;
            if (age < effectiveTTL && dataStore.dashboardData[subKey] !== undefined) {
                const value = dataStore.dashboardData[subKey];
                return returnCopy ? createDeepCopy(value) : value;
            }
        }
        return null;
    }
    const cached = dataStore.dataCache.get(key);
    const timestamp = dataStore.dataTimestamps.get(key);
    if (cached && timestamp) {
        const age = Date.now() - timestamp;
        if (age < effectiveTTL) {
            return returnCopy ? createDeepCopy(cached) : cached;
        }
        else {
            dataStore.dataCache.delete(key);
            dataStore.dataTimestamps.delete(key);
        }
    }
    return null;
}
function set(key, data, deepCopy = false) {
    if (typeof key !== 'string' || !key.trim()) {
        if (window.Logger) {
            window.Logger.warn('dataStore.set: key deve ser uma string não vazia');
        }
        return;
    }
    let dataToStore = data;
    if (deepCopy && data !== null && data !== undefined) {
        // Usar createDeepCopy que tem proteção contra referências circulares
        dataToStore = createDeepCopy(data);
        // Se createDeepCopy retornou null ou erro, usar referência original
        if (dataToStore === null && data !== null) {
            if (window.Logger) {
                window.Logger.warn('dataStore.set: Dados contêm objetos não serializáveis (Chart.js?), usando referência original');
            }
            dataToStore = data;
        }
    }
    if (key === 'dashboardData') {
        dataStore.dashboardData = dataToStore;
        dataStore.dashboardDataTimestamp = Date.now();
    }
    else {
        dataStore.dataCache.set(key, dataToStore);
        dataStore.dataTimestamps.set(key, Date.now());
    }
    const effectiveTTL = getEffectiveTTL(key);
    if (effectiveTTL >= 10 * 60 * 1000) {
        setPersistent(key, dataToStore, effectiveTTL);
    }
    notifyListeners(key, dataToStore);
}
function notifyListeners(key, data) {
    const listeners = dataStore.listeners.get(key);
    if (listeners) {
        listeners.forEach(callback => {
            try {
                callback(data, key);
            }
            catch (error) {
                if (window.Logger) {
                    window.Logger.error(`Erro em listener do dataStore para ${key}:`, error);
                }
            }
        });
    }
    const globalListeners = dataStore.listeners.get('*');
    if (globalListeners) {
        globalListeners.forEach(callback => {
            try {
                callback(data, key);
            }
            catch (error) {
                if (window.Logger) {
                    window.Logger.error(`Erro em listener global do dataStore:`, error);
                }
            }
        });
    }
}
function subscribe(key, callback) {
    if (!dataStore.listeners.has(key)) {
        dataStore.listeners.set(key, new Set());
    }
    dataStore.listeners.get(key).add(callback);
    return () => {
        const listeners = dataStore.listeners.get(key);
        if (listeners) {
            listeners.delete(callback);
            if (listeners.size === 0) {
                dataStore.listeners.delete(key);
            }
        }
    };
}
function clear(key = null) {
    if (key === null) {
        dataStore.dashboardData = null;
        dataStore.dashboardDataTimestamp = null;
        dataStore.dataCache.clear();
        dataStore.dataTimestamps.clear();
        clearPersistent(null);
    }
    else {
        if (key === 'dashboardData') {
            dataStore.dashboardData = null;
            dataStore.dashboardDataTimestamp = null;
        }
        else {
            dataStore.dataCache.delete(key);
            dataStore.dataTimestamps.delete(key);
        }
        clearPersistent(key);
    }
    notifyListeners(key || '*', null);
}
function clearPersistent(key = null) {
    try {
        if (key === null) {
            const keys = Object.keys(localStorage);
            keys.forEach(k => {
                if (k.startsWith(dataStore.persistentPrefix)) {
                    localStorage.removeItem(k);
                }
            });
        }
        else {
            const storageKey = dataStore.persistentPrefix + key;
            localStorage.removeItem(storageKey);
        }
    }
    catch (e) {
        if (window.Logger) {
            window.Logger.warn('Erro ao limpar cache persistente:', e.message);
        }
    }
}
function invalidate(keys) {
    if (!keys) {
        clear(null);
        return;
    }
    if (Array.isArray(keys)) {
        keys.forEach(key => {
            if (typeof key === 'string') {
                clear(key);
            }
        });
    }
    else if (typeof keys === 'string') {
        clear(keys);
    }
}
function getStats() {
    return {
        dashboardDataAge: dataStore.dashboardDataTimestamp
            ? Date.now() - dataStore.dashboardDataTimestamp
            : null,
        cacheSize: dataStore.dataCache.size,
        listenersCount: Array.from(dataStore.listeners.values())
            .reduce((sum, set) => sum + set.size, 0),
        keys: Array.from(dataStore.dataCache.keys())
    };
}
if (typeof window !== 'undefined') {
    clearOldPersistent();
    setInterval(() => {
        clearOldPersistent();
    }, 5 * 60 * 1000);
    window.dataStore = {
        get,
        set,
        clear,
        invalidate,
        subscribe,
        getStats,
        getDefaultTTL: () => dataStore.defaultTTL,
        setDefaultTTL: (ttl) => { dataStore.defaultTTL = ttl; },
        getPersistent,
        setPersistent,
        clearPersistent,
        clearOldPersistent
    };
    if (window.Logger) {
        window.Logger.debug('✅ Global Data Store inicializado (com cache persistente)');
    }
}
