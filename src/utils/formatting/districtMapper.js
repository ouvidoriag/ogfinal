/**
 * 🗺️ Biblioteca de Mapeamento de Bairros para Distritos
 * Sistema robusto de detecção e mapeamento de bairros para distritos de Duque de Caxias
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Carregar dados dos distritos
let DISTRICTS_DATA = null;
function loadDistrictsData() {
  if (!DISTRICTS_DATA) {
    try {
      // Tentar múltiplos caminhos possíveis
      const possiblePaths = [
        path.join(projectRoot, 'data', 'secretarias-distritos.json'), // NOVO/data/...
        path.join(__dirname, '../../data', 'secretarias-distritos.json'), // Relativo ao utils
        path.join(process.cwd(), 'data', 'secretarias-distritos.json'), // Onde o processo está rodando
        path.join(process.cwd(), 'NOVO', 'data', 'secretarias-distritos.json'), // Se rodando da raiz
      ];
      
      let dataPath = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          dataPath = possiblePath;
          break;
        }
      }
      
      if (!dataPath) {
        console.error('❌ Arquivo secretarias-distritos.json não encontrado em nenhum dos caminhos!');
        DISTRICTS_DATA = {};
        return DISTRICTS_DATA;
      }
      
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      DISTRICTS_DATA = data.distritos || {};
    } catch (error) {
      console.error('❌ Erro ao carregar dados de distritos:', error);
      DISTRICTS_DATA = {};
    }
  }
  return DISTRICTS_DATA;
}

/**
 * Normaliza string para comparação (remove acentos, espaços extras, etc.)
 */
function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Extrai palavras-chave de um endereço
 */
function extractKeywords(endereco) {
  if (!endereco) return [];
  
  const normalized = normalizeString(endereco);
  const stopWords = ['de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'e', 'ou', 'rua', 'avenida', 'av', 'estrada', 'travessa', 'praça', 'largo', 'vila', 'parque', 'jardim'];
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

/**
 * Calcula similaridade entre duas strings
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Contar palavras em comum
  const words1 = s1.split(' ').filter(w => w.length > 2);
  const words2 = s2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Detecta o distrito baseado no endereço/bairro
 * @param {string} endereco - Endereço ou nome do bairro
 * @returns {Object|null} - { distrito, bairro, confidence, method }
 */
export function detectDistrictByAddress(endereco) {
  if (!endereco || typeof endereco !== 'string') {
    return null;
  }
  
  const distritos = loadDistrictsData();
  if (!distritos || Object.keys(distritos).length === 0) {
    return null;
  }
  
  const enderecoNormalizado = normalizeString(endereco);
  const keywords = extractKeywords(endereco);
  
  let bestMatch = null;
  let bestScore = 0;
  let bestMethod = null;
  let matchedBairro = null;
  
  // Estratégia 1: Busca exata (case-insensitive)
  for (const [distritoNome, distritoInfo] of Object.entries(distritos)) {
    for (const bairro of distritoInfo.bairros) {
      const bairroNormalizado = normalizeString(bairro);
      
      if (enderecoNormalizado === bairroNormalizado) {
        return {
          distrito: distritoNome,
          bairro: bairro,
          confidence: 1.0,
          method: 'exact'
        };
      }
      
      // Estratégia 2: Contém (endereço contém bairro ou vice-versa)
      if (enderecoNormalizado.includes(bairroNormalizado) || bairroNormalizado.includes(enderecoNormalizado)) {
        const score = Math.max(
          bairroNormalizado.length / enderecoNormalizado.length,
          enderecoNormalizado.length / bairroNormalizado.length
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = distritoNome;
          bestMethod = 'contains';
          matchedBairro = bairro;
        }
      }
    }
  }
  
  // Estratégia 3: Similaridade por palavras-chave
  if (!bestMatch && keywords.length > 0) {
    for (const [distritoNome, distritoInfo] of Object.entries(distritos)) {
      for (const bairro of distritoInfo.bairros) {
        const similarity = calculateSimilarity(endereco, bairro);
        if (similarity > bestScore && similarity > 0.5) {
          bestScore = similarity;
          bestMatch = distritoNome;
          bestMethod = 'similarity';
          matchedBairro = bairro;
        }
      }
    }
  }
  
  // Estratégia 4: Busca por palavras-chave individuais
  if (!bestMatch && keywords.length > 0) {
    for (const keyword of keywords) {
      for (const [distritoNome, distritoInfo] of Object.entries(distritos)) {
        for (const bairro of distritoInfo.bairros) {
          const bairroNormalizado = normalizeString(bairro);
          if (bairroNormalizado.includes(keyword) || keyword.includes(bairroNormalizado)) {
            const score = keyword.length / Math.max(keyword.length, bairroNormalizado.length);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = distritoNome;
              bestMethod = 'keyword';
              matchedBairro = bairro;
            }
          }
        }
      }
    }
  }
  
  if (bestMatch && bestScore > 0.3) {
    return {
      distrito: bestMatch,
      bairro: matchedBairro,
      confidence: bestScore,
      method: bestMethod
    };
  }
  
  return null;
}

/**
 * Mapeia múltiplos endereços para distritos
 * @param {Array<string>} enderecos - Array de endereços
 * @returns {Object} - Mapa de endereço -> distrito
 */
export function mapAddressesToDistricts(enderecos) {
  const mapa = {};
  const naoMapeados = [];
  
  enderecos.forEach(endereco => {
    const resultado = detectDistrictByAddress(endereco);
    if (resultado) {
      mapa[endereco] = resultado.distrito;
    } else {
      naoMapeados.push(endereco);
    }
  });
  
  return {
    mapeados: mapa,
    naoMapeados: naoMapeados,
    taxaSucesso: enderecos.length > 0 ? (Object.keys(mapa).length / enderecos.length) * 100 : 0
  };
}

/**
 * Obtém estatísticas de mapeamento
 */
export function getMappingStats() {
  const distritos = loadDistrictsData();
  const totalDistritos = Object.keys(distritos).length;
  const totalBairros = Object.values(distritos).reduce((sum, d) => sum + (d.bairros?.length || 0), 0);
  
  return {
    totalDistritos,
    totalBairros,
    distritos: Object.keys(distritos)
  };
}

