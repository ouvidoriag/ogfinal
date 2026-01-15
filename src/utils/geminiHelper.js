/**
 * Helper para integração com IA
 */

// Sistema de rotação de chaves da API
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : []).concat(
  process.env.GEMINI_API_KEY_2 ? [process.env.GEMINI_API_KEY_2] : [],
  process.env.GEMINI_API_KEY_3 ? [process.env.GEMINI_API_KEY_3] : [],
  process.env.GEMINI_API_KEY_4 ? [process.env.GEMINI_API_KEY_4] : [],
  process.env.GEMINI_API_KEY_5 ? [process.env.GEMINI_API_KEY_5] : []
).filter(k => k && k.trim());

let currentKeyIndex = 0;

// Rastreamento de chaves com quota excedida (cooldown)
const quotaCooldowns = new Map(); // keyIndex -> timestamp de quando pode tentar novamente

/**
 * Obtém a chave atual da IA
 */
export function getCurrentGeminiKey() {
  return GEMINI_API_KEYS[currentKeyIndex] || '';
}

/**
 * Verifica se a chave atual está em cooldown (quota excedida)
 */
export function isCurrentKeyInCooldown() {
  const cooldownUntil = quotaCooldowns.get(currentKeyIndex);
  if (!cooldownUntil) return false;
  
  if (Date.now() < cooldownUntil) {
    return true; // Ainda em cooldown
  } else {
    // Cooldown expirado, remover
    quotaCooldowns.delete(currentKeyIndex);
    return false;
  }
}

/**
 * Marca a chave atual como em cooldown (quota excedida)
 * @param {number} retryAfterSeconds - Segundos até poder tentar novamente (padrão: 60)
 */
export function markCurrentKeyInCooldown(retryAfterSeconds = 60) {
  const cooldownUntil = Date.now() + (retryAfterSeconds * 1000);
  quotaCooldowns.set(currentKeyIndex, cooldownUntil);
  console.log(`⏳ Chave ${currentKeyIndex + 1} em cooldown por ${retryAfterSeconds}s (quota excedida)`);
}

/**
 * Rotaciona para a próxima chave disponível (não em cooldown)
 * @returns {boolean} true se encontrou uma chave disponível, false se todas estão em cooldown
 */
export function rotateToNextKey() {
  if (GEMINI_API_KEYS.length <= 1) {
    return false; // Não há outras chaves para rotacionar
  }
  
  const startIndex = currentKeyIndex;
  let attempts = 0;
  
  // Tentar encontrar uma chave que não está em cooldown
  do {
    currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
    attempts++;
    
    // Se encontrou uma chave não em cooldown, usar ela
    if (!isCurrentKeyInCooldown()) {
      console.log(`🔄 Rotacionando para chave ${currentKeyIndex + 1}/${GEMINI_API_KEYS.length}`);
      return true;
    }
  } while (currentKeyIndex !== startIndex && attempts < GEMINI_API_KEYS.length);
  
  // Todas as chaves estão em cooldown
  console.warn(`⚠️ Todas as chaves estão em cooldown (quota excedida)`);
  return false;
}

/**
 * Verifica se há alguma chave disponível (não em cooldown)
 */
export function hasAvailableKey() {
  for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
    const cooldownUntil = quotaCooldowns.get(i);
    if (!cooldownUntil || Date.now() >= cooldownUntil) {
      return true; // Encontrou uma chave disponível
    }
  }
  return false; // Todas estão em cooldown
}

/**
 * Volta para a primeira chave
 */
export function resetToFirstKey() {
  if (currentKeyIndex !== 0) {
    currentKeyIndex = 0;
    console.log(`🔄 Voltando para primeira chave`);
  }
}

/**
 * Limpa todos os cooldowns (útil para testes ou reset manual)
 */
export function clearAllCooldowns() {
  quotaCooldowns.clear();
  console.log('🔄 Todos os cooldowns limpos');
}

/**
 * Verifica se há chaves configuradas
 */
export function hasGeminiKeys() {
  return GEMINI_API_KEYS.length > 0;
}

/**
 * Retorna o número de chaves configuradas
 */
export function getGeminiKeysCount() {
  return GEMINI_API_KEYS.length;
}

/**
 * Inicializa o sistema de chaves
 */
export function initializeGemini() {
  if (GEMINI_API_KEYS.length > 0) {
    console.log(`🤖 ${GEMINI_API_KEYS.length} chave(s) de IA configurada(s)`);
    GEMINI_API_KEYS.forEach((key, idx) => {
      console.log(`   Chave ${idx + 1}: ${key.substring(0, 15)}... (${key.length} caracteres)`);
    });
  } else {
    // Não mencionar modelo quando IA está desativada
    // console.warn removido para não expor qual modelo seria usado
  }
}

