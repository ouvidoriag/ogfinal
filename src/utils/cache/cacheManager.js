/**
 * Sistema de Cache Universal Persistente
 * Gerencia cache em arquivo para persistência entre reinicializações
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, '..', '..', 'db-data', 'universal-cache.json');
const CACHE_DIR = path.dirname(CACHE_FILE);

// Garantir que o diretório existe
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let cacheData = null;
let lastUpdate = null;

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      cacheData = parsed.data || {};
      lastUpdate = parsed.lastUpdate || null;
      console.log(`📦 Cache universal carregado: ${Object.keys(cacheData).length} chaves, última atualização: ${lastUpdate || 'Nunca'}`);
      return true;
    }
  } catch (error) {
    console.warn('⚠️ Erro ao carregar cache universal:', error.message);
  }
  cacheData = {};
  return false;
}

function saveCache() {
  try {
    const data = {
      lastUpdate: new Date().toISOString(),
      data: cacheData
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Cache universal salvo: ${Object.keys(cacheData).length} chaves`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar cache universal:', error.message);
    return false;
  }
}

function get(key) {
  if (!cacheData) loadCache();
  return cacheData[key] || null;
}

function set(key, value) {
  if (!cacheData) loadCache();
  cacheData[key] = value;
  saveCache();
}

export default {
  loadCache,
  saveCache,
  get,
  set
};

