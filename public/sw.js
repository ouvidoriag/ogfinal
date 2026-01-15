/**
 * Service Worker
 * DESABILITADO: Cache removido - sempre buscar da rede
 */

const CACHE_NAME = 'ouvidoria-dashboard-v1';

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker instalando...');
  self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('🗑️ Removendo cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptar requisições - sempre buscar da rede (sem cache)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições que não são GET ou que são de outros domínios
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignorar requisições de extensões ou outros protocolos
  if (!event.request.url.startsWith('http://') && !event.request.url.startsWith('https://')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Offline', { status: 503 });
    })
  );
});

// Tratar mensagens para evitar erro de canal fechado
// CORREÇÃO: Não retornar true para mensagens assíncronas - responder imediatamente ou ignorar
self.addEventListener('message', (event) => {
  // IMPORTANTE: Sempre responder imediatamente ou ignorar
  // NUNCA retornar true para indicar resposta assíncrona
  
  // Ignorar completamente mensagens de extensões do navegador ou mensagens inválidas
  if (!event || !event.data) {
    return; // Ignora silenciosamente
  }
  
  // Ignorar mensagens que não são do nosso código
  if (typeof event.data !== 'object' || !event.data.type) {
    return; // Ignora silenciosamente mensagens de extensões
  }
  
  // Processar apenas mensagens conhecidas do nosso código
  if (['SKIP_WAITING', 'CACHE_CLEAR'].includes(event.data.type)) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    
    // Responder imediatamente se há porta disponível
    if (event.ports && event.ports.length > 0 && event.ports[0]) {
      try {
        event.ports[0].postMessage({ success: true });
      } catch (e) {
        // Ignorar erro silenciosamente - porta já está fechada
      }
    } else if (event.source && event.source !== null) {
      // Se não há porta, responder via event.source
      try {
        event.source.postMessage({ success: true }, '*');
      } catch (e) {
        // Ignorar erro silenciosamente
      }
    }
  }
  
  // IMPORTANTE: NÃO retornar true aqui - isso causa o erro de canal fechado
  // O listener não deve indicar resposta assíncrona
  // Não retornar nada (undefined) para indicar que a mensagem foi processada
});
