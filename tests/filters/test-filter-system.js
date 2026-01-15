/**
 * Testes do Sistema de Filtros
 * 
 * Testa todas as melhorias implementadas:
 * - Normalização de filtros
 * - Validação de filtros
 * - Cache de filtros
 * - Limite MultiSelect
 * - Filtros compostos
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

import { normalizeFilters } from '../../src/utils/normalizeFilters.js';
import { validateFilters, validateConflictingFilters } from '../../src/utils/validateFilters.js';
import { limitMultiSelect } from '../../src/utils/limitMultiSelect.js';
import { CompositeFilter, createORFilter } from '../../src/utils/compositeFilters.js';
import { normalizeToLowercase } from '../../src/utils/normalizeLowercase.js';

/**
 * Classe de testes
 */
class FilterSystemTests {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * Adicionar teste
   */
  test(name, fn) {
    this.tests.push({ name, fn });
  }

  /**
   * Executar todos os testes
   */
  async run() {
    console.log('🧪 Iniciando testes do sistema de filtros...\n');

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
}

// Criar instância de testes
const tests = new FilterSystemTests();

// ============================================
// TESTES DE NORMALIZAÇÃO
// ============================================

tests.test('Normalização: Remove duplicatas exatas', () => {
  const filters = [
    { field: 'status', op: 'eq', value: 'Aberto' },
    { field: 'status', op: 'eq', value: 'Aberto' },
    { field: 'tema', op: 'eq', value: 'Saúde' }
  ];
  
  const normalized = normalizeFilters(filters);
  
  if (normalized.length !== 2) {
    throw new Error(`Esperado 2 filtros, recebido ${normalized.length}`);
  }
  
  const statusFilters = normalized.filter(f => f.field === 'status');
  if (statusFilters.length !== 1) {
    throw new Error(`Esperado 1 filtro de status, recebido ${statusFilters.length}`);
  }
});

tests.test('Normalização: Combina ranges de datas', () => {
  const filters = [
    { field: 'dataCriacaoIso', op: 'gte', value: '2024-01-01' },
    { field: 'dataCriacaoIso', op: 'lte', value: '2024-12-31' },
    { field: 'dataCriacaoIso', op: 'gte', value: '2024-01-01' } // Duplicata
  ];
  
  const normalized = normalizeFilters(filters);
  
  // Deve ter apenas 2 filtros (gte e lte)
  const gteFilters = normalized.filter(f => f.op === 'gte');
  const lteFilters = normalized.filter(f => f.op === 'lte');
  
  if (gteFilters.length !== 1) {
    throw new Error(`Esperado 1 filtro gte, recebido ${gteFilters.length}`);
  }
  
  if (lteFilters.length !== 1) {
    throw new Error(`Esperado 1 filtro lte, recebido ${lteFilters.length}`);
  }
});

tests.test('Normalização: Unifica operadores eq em in', () => {
  const filters = [
    { field: 'status', op: 'eq', value: 'Aberto' },
    { field: 'status', op: 'eq', value: 'Em Andamento' },
    { field: 'tema', op: 'eq', value: 'Saúde' }
  ];
  
  const normalized = normalizeFilters(filters);
  
  const statusFilter = normalized.find(f => f.field === 'status');
  if (!statusFilter) {
    throw new Error('Filtro de status não encontrado');
  }
  
  // Deve ter sido unificado em 'in' com array
  if (statusFilter.op !== 'in' || !Array.isArray(statusFilter.value)) {
    throw new Error(`Esperado op='in' com array, recebido op='${statusFilter.op}'`);
  }
  
  if (statusFilter.value.length !== 2) {
    throw new Error(`Esperado 2 valores, recebido ${statusFilter.value.length}`);
  }
});

// ============================================
// TESTES DE VALIDAÇÃO
// ============================================

tests.test('Validação: Detecta conflitos de data', () => {
  const filters = [
    { field: 'dataCriacaoIso', op: 'gte', value: '2024-12-31' },
    { field: 'dataCriacaoIso', op: 'lte', value: '2024-01-01' }
  ];
  
  const validation = validateConflictingFilters(filters);
  
  if (validation.valid) {
    throw new Error('Esperado conflito de data, mas validação passou');
  }
  
  if (!validation.error || !validation.error.toLowerCase().includes('conflito')) {
    throw new Error(`Erro de validação não menciona conflito: ${validation.error}`);
  }
});

tests.test('Validação: Aceita filtros válidos', () => {
  // validateFilters espera um objeto, não um array
  const filters = {
    status: 'Aberto',
    tema: 'Saúde'
  };
  
  const validation = validateFilters(filters);
  
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.error}`);
  }
});

// ============================================
// TESTES DE LIMITE MULTISELECT
// ============================================

tests.test('Limite MultiSelect: Trunca arrays grandes', () => {
  const filters = [
    {
      field: 'status',
      op: 'in',
      value: Array.from({ length: 50 }, (_, i) => `Status${i}`)
    }
  ];
  
  const limited = limitMultiSelect(filters);
  
  if (limited[0].value.length !== 20) {
    throw new Error(`Esperado 20 valores, recebido ${limited[0].value.length}`);
  }
});

tests.test('Limite MultiSelect: Mantém arrays pequenos', () => {
  const filters = [
    {
      field: 'status',
      op: 'in',
      value: ['Aberto', 'Em Andamento', 'Concluído']
    }
  ];
  
  const limited = limitMultiSelect(filters);
  
  if (limited[0].value.length !== 3) {
    throw new Error(`Esperado 3 valores, recebido ${limited[0].value.length}`);
  }
});

// ============================================
// TESTES DE FILTROS COMPOSTOS
// ============================================

tests.test('Filtros Compostos: Cria filtro OR', () => {
  const filter = createORFilter([
    { field: 'status', op: 'eq', value: 'Aberto' },
    { field: 'status', op: 'eq', value: 'Em Andamento' }
  ]);
  
  const mongoQuery = filter.toMongoQuery();
  
  if (!mongoQuery.$or || !Array.isArray(mongoQuery.$or)) {
    throw new Error('Esperado $or no query MongoDB');
  }
  
  if (mongoQuery.$or.length !== 2) {
    throw new Error(`Esperado 2 condições OR, recebido ${mongoQuery.$or.length}`);
  }
});

tests.test('Filtros Compostos: Valida estrutura', () => {
  const filter = new CompositeFilter('AND', [
    { field: 'status', op: 'eq', value: 'Aberto' }
  ]);
  
  const validation = filter.validate();
  
  if (!validation.valid) {
    throw new Error(`Validação falhou: ${validation.error}`);
  }
});

tests.test('Filtros Compostos: Rejeita estrutura inválida', () => {
  const filter = new CompositeFilter('INVALID', []);
  
  const validation = filter.validate();
  
  if (validation.valid) {
    throw new Error('Esperado erro de validação para operador inválido');
  }
});

tests.test('Filtros Compostos: Serialização JSON', () => {
  const filter = createORFilter([
    { field: 'status', op: 'eq', value: 'Aberto' },
    { field: 'status', op: 'eq', value: 'Em Andamento' }
  ]);
  
  const json = filter.toJSON();
  const restored = CompositeFilter.fromJSON(json);
  
  if (restored.operator !== filter.operator) {
    throw new Error('Operador não foi restaurado corretamente');
  }
  
  if (restored.filters.length !== filter.filters.length) {
    throw new Error('Filtros não foram restaurados corretamente');
  }
});

// ============================================
// TESTES DE NORMALIZAÇÃO LOWERCASE
// ============================================

tests.test('Normalização Lowercase: Remove acentos', () => {
  const result = normalizeToLowercase('São Paulo');
  
  if (result !== 'sao paulo') {
    throw new Error(`Esperado 'sao paulo', recebido '${result}'`);
  }
});

tests.test('Normalização Lowercase: Converte para minúsculas', () => {
  const result = normalizeToLowercase('SAÚDE');
  
  if (result !== 'saude') {
    throw new Error(`Esperado 'saude', recebido '${result}'`);
  }
});

tests.test('Normalização Lowercase: Trata valores nulos', () => {
  const result1 = normalizeToLowercase(null);
  const result2 = normalizeToLowercase(undefined);
  const result3 = normalizeToLowercase('');
  
  if (result1 !== null || result2 !== null || result3 !== null) {
    throw new Error('Valores nulos/vazios devem retornar null');
  }
});

// ============================================
// EXECUTAR TESTES
// ============================================

// Executar se chamado diretamente
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.endsWith('test-filter-system.js') ||
                     process.argv[1]?.includes('test-filter-system');

if (isMainModule) {
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

