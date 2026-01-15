/**
 * Testes de Integração do Sistema de Filtros
 * 
 * Testa integração completa:
 * - Endpoints da API
 * - Cache de filtros
 * - Banner de filtros
 * - Histórico de filtros
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

/**
 * Testes de integração (requer servidor rodando)
 */
class FilterIntegrationTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.baseUrl = process.env.API_URL || 'http://localhost:3000';
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Iniciando testes de integração do sistema de filtros...\n');
    console.log(`🌐 URL base: ${this.baseUrl}\n`);

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`❌ ${name}: ${error.message}`);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    }

    console.log(`\n📊 Resultados:`);
    console.log(`   ✅ Passou: ${this.passed}`);
    console.log(`   ❌ Falhou: ${this.failed}`);
    console.log(`   📈 Total: ${this.tests.length}`);
    console.log(`   🎯 Taxa de sucesso: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);

    return this.failed === 0;
  }

  async fetch(url, options = {}) {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
}

const tests = new FilterIntegrationTests();

// ============================================
// TESTES DE ENDPOINTS
// ============================================

tests.test('Endpoint /api/filter: Filtro simples', async () => {
  const filters = [
    { field: 'statusDemanda', op: 'eq', value: 'Aberto' }
  ];

  const result = await tests.fetch('/api/filter', {
    method: 'POST',
    body: JSON.stringify({ filters })
  });

  if (!Array.isArray(result)) {
    throw new Error('Resposta deve ser um array');
  }
});

tests.test('Endpoint /api/filter: Filtro com múltiplos valores', async () => {
  const filters = [
    { field: 'statusDemanda', op: 'in', value: ['Aberto', 'Em Andamento'] }
  ];

  const result = await tests.fetch('/api/filter', {
    method: 'POST',
    body: JSON.stringify({ filters })
  });

  if (!Array.isArray(result)) {
    throw new Error('Resposta deve ser um array');
  }
});

tests.test('Endpoint /api/filter: Filtro composto (OR)', async () => {
  const filterRequest = {
    operator: 'OR',
    filters: [
      { field: 'statusDemanda', op: 'eq', value: 'Aberto' },
      { field: 'statusDemanda', op: 'eq', value: 'Em Andamento' }
    ]
  };

  const result = await tests.fetch('/api/filter', {
    method: 'POST',
    body: JSON.stringify(filterRequest)
  });

  if (!Array.isArray(result)) {
    throw new Error('Resposta deve ser um array');
  }
});

tests.test('Endpoint /api/filter/aggregated: Filtro agregado', async () => {
  const filters = [
    { field: 'statusDemanda', op: 'eq', value: 'Aberto' }
  ];

  const result = await tests.fetch('/api/filter/aggregated', {
    method: 'POST',
    body: JSON.stringify({ filters })
  });

  if (!result.totalManifestations && result.totalManifestations !== 0) {
    throw new Error('Resposta deve ter totalManifestations');
  }

  if (!Array.isArray(result.manifestationsByStatus)) {
    throw new Error('manifestationsByStatus deve ser um array');
  }
});

// ============================================
// TESTES DE CACHE (Frontend - simulado)
// ============================================

tests.test('Cache de Filtros: Armazena e recupera', () => {
  // Simular cache do frontend
  if (typeof window === 'undefined') {
    // Ambiente Node.js - pular teste
    return;
  }

  if (!window.filterCache) {
    throw new Error('filterCache não está disponível');
  }

  const filters = [{ field: 'status', op: 'eq', value: 'Aberto' }];
  const endpoint = '/api/filter';
  const data = [{ id: 1, status: 'Aberto' }];

  // Armazenar
  window.filterCache.set(filters, endpoint, data);

  // Recuperar
  const cached = window.filterCache.get(filters, endpoint);

  if (!cached || cached.length !== 1) {
    throw new Error('Cache não armazenou/recuperou corretamente');
  }
});

// ============================================
// TESTES DE HISTÓRICO (Frontend - simulado)
// ============================================

tests.test('Histórico de Filtros: Salva e recupera', () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.filterHistory) {
    throw new Error('filterHistory não está disponível');
  }

  const filters = [{ field: 'status', op: 'eq', value: 'Aberto' }];

  // Salvar
  window.filterHistory.saveRecent(filters);

  // Recuperar
  const recent = window.filterHistory.getRecent();

  if (!Array.isArray(recent) || recent.length === 0) {
    throw new Error('Histórico não salvou/recuperou corretamente');
  }
});

// ============================================
// EXECUTAR TESTES
// ============================================

if (import.meta.url === `file://${process.argv[1]}`) {
  tests.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Erro ao executar testes:', error);
      process.exit(1);
    });
}

export { tests };

