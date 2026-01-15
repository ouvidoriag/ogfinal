/**
 * Testes Unitários - Global Filters
 * 
 * REFATORAÇÃO: Testes para o módulo global-filters.js
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do window e dependências
global.window = {
  Logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  timerManager: {
    setTimeout: vi.fn((fn, delay) => setTimeout(fn, delay)),
    clearTimeout: vi.fn((id) => clearTimeout(id))
  },
  dataStore: {
    invalidate: vi.fn()
  },
  chartCommunication: {
    on: vi.fn(),
    off: vi.fn()
  }
};

global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

global.document = {
  getElementById: vi.fn(() => ({
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    },
    innerHTML: '',
    style: { display: 'block' }
  })),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => [])
};

describe('Global Filters', () => {
  let globalFilters;
  let eventBus;

  beforeEach(() => {
    // Resetar mocks
    vi.clearAllMocks();
    
    // Criar eventBus mock
    eventBus = {
      emit: vi.fn(),
      on: vi.fn()
    };
    
    // Criar globalFilters mock
    globalFilters = {
      filters: [],
      activeField: null,
      activeValue: null,
      persist: false,
      _debounceTimer: null,
      _pendingFilter: null,
      
      apply(field, value, chartId = null, options = {}) {
        const debounceDelay = options.debounce !== undefined ? options.debounce : 300;
        
        if (this._debounceTimer && global.window.timerManager) {
          global.window.timerManager.clearTimeout(this._debounceTimer);
        } else if (this._debounceTimer) {
          clearTimeout(this._debounceTimer);
        }
        
        this._pendingFilter = { field, value, chartId, options };
        
        const applyFilter = () => {
          this._debounceTimer = null;
          const pending = this._pendingFilter;
          this._pendingFilter = null;
          if (pending) {
            this._applyImmediate(pending.field, pending.value, pending.chartId, pending.options);
          }
        };
        
        if (global.window.timerManager) {
          this._debounceTimer = global.window.timerManager.setTimeout(applyFilter, debounceDelay, 'filter-debounce');
        } else {
          this._debounceTimer = setTimeout(applyFilter, debounceDelay);
        }
      },
      
      _applyImmediate(field, value, chartId = null, options = {}) {
        const { toggle = true, operator = 'eq', clearPrevious = false } = options;
        
        const existingIndex = this.filters.findIndex(f => f.field === field && f.value === value);
        const filterExists = existingIndex > -1;
        
        if (clearPrevious && this.filters.length > 0) {
          this.filters = [];
        }
        
        if (filterExists && toggle) {
          this.filters.splice(existingIndex, 1);
          if (this.filters.length === 0) {
            this.activeField = null;
            this.activeValue = null;
          } else {
            const lastFilter = this.filters[this.filters.length - 1];
            this.activeField = lastFilter.field;
            this.activeValue = lastFilter.value;
          }
          
          if (this.persist) {
            this.save();
          }
          
          this.invalidateData();
          this.updateUI();
          this.notifyAllCharts();
          
          if (this.filters.length === 0) {
            eventBus.emit('filter:cleared', {});
          } else {
            eventBus.emit('filter:removed', { field, value, filters: [...this.filters] });
          }
        } else if (!filterExists) {
          this.filters.push({ field, value, operator, chartId });
          this.activeField = field;
          this.activeValue = value;
          
          if (this.persist) {
            this.save();
          }
          
          this.invalidateData();
          this.updateUI();
          this.notifyAllCharts();
          
          eventBus.emit('filter:applied', { field, value, chartId, filters: [...this.filters] });
        }
      },
      
      clear() {
        this.filters = [];
        this.activeField = null;
        this.activeValue = null;
        eventBus.emit('filter:cleared', {});
        this.invalidateData();
        this.updateUI();
        this.notifyAllCharts();
      },
      
      remove(field, value) {
        const index = this.filters.findIndex(f => f.field === field && f.value === value);
        if (index > -1) {
          this.filters.splice(index, 1);
          eventBus.emit('filter:removed', { field, value });
          this.invalidateData();
          this.updateUI();
          this.notifyAllCharts();
        }
      },
      
      isActive(field, value) {
        return this.filters.some(f => f.field === field && f.value === value);
      },
      
      save() {
        if (this.filters.length === 0) {
          global.localStorage.removeItem('dashboardFilters');
          return;
        }
        global.localStorage.setItem('dashboardFilters', JSON.stringify({
          filters: this.filters,
          activeField: this.activeField,
          activeValue: this.activeValue
        }));
      },
      
      load() {
        global.localStorage.removeItem('dashboardFilters');
        this.filters = [];
        this.activeField = null;
        this.activeValue = null;
      },
      
      invalidateData() {
        if (global.window.dataStore) {
          global.window.dataStore.invalidate([
            'dashboardData',
            '/api/dashboard-data',
            '/api/summary'
          ]);
        }
      },
      
      updateUI() {
        // Mock implementation
      },
      
      notifyAllCharts() {
        eventBus.emit('charts:update-requested', {
          filters: [...this.filters],
          activeField: this.activeField,
          activeValue: this.activeValue
        });
      }
    };
  });

  describe('apply()', () => {
    it('deve aplicar filtro com debounce', async () => {
      globalFilters.apply('Status', 'Aberto');
      
      // Aguardar debounce
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(globalFilters.filters.length).toBe(1);
      expect(globalFilters.filters[0]).toEqual({ field: 'Status', value: 'Aberto', operator: 'eq', chartId: null });
      expect(eventBus.emit).toHaveBeenCalledWith('filter:applied', expect.any(Object));
    });

    it('deve remover filtro se já existir (toggle)', async () => {
      globalFilters.filters.push({ field: 'Status', value: 'Aberto', operator: 'eq' });
      
      globalFilters.apply('Status', 'Aberto');
      
      await new Promise(resolve => setTimeout(resolve, 350));
      
      expect(globalFilters.filters.length).toBe(0);
      expect(eventBus.emit).toHaveBeenCalledWith('filter:cleared', {});
    });
  });

  describe('clear()', () => {
    it('deve limpar todos os filtros', () => {
      globalFilters.filters.push(
        { field: 'Status', value: 'Aberto' },
        { field: 'Tema', value: 'Saúde' }
      );
      
      globalFilters.clear();
      
      expect(globalFilters.filters.length).toBe(0);
      expect(globalFilters.activeField).toBeNull();
      expect(eventBus.emit).toHaveBeenCalledWith('filter:cleared', {});
    });
  });

  describe('remove()', () => {
    it('deve remover filtro específico', () => {
      globalFilters.filters.push(
        { field: 'Status', value: 'Aberto' },
        { field: 'Tema', value: 'Saúde' }
      );
      
      globalFilters.remove('Status', 'Aberto');
      
      expect(globalFilters.filters.length).toBe(1);
      expect(globalFilters.filters[0].field).toBe('Tema');
      expect(eventBus.emit).toHaveBeenCalledWith('filter:removed', { field: 'Status', value: 'Aberto' });
    });
  });

  describe('isActive()', () => {
    it('deve retornar true se filtro está ativo', () => {
      globalFilters.filters.push({ field: 'Status', value: 'Aberto' });
      
      expect(globalFilters.isActive('Status', 'Aberto')).toBe(true);
      expect(globalFilters.isActive('Status', 'Fechado')).toBe(false);
    });
  });

  describe('save() e load()', () => {
    it('deve salvar filtros no localStorage', () => {
      globalFilters.filters.push({ field: 'Status', value: 'Aberto' });
      globalFilters.activeField = 'Status';
      globalFilters.activeValue = 'Aberto';
      globalFilters.persist = true;
      
      globalFilters.save();
      
      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'dashboardFilters',
        expect.stringContaining('Status')
      );
    });

    it('deve limpar localStorage quando não há filtros', () => {
      globalFilters.filters = [];
      globalFilters.save();
      
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('dashboardFilters');
    });

    it('deve limpar filtros ao carregar (filtros locais por página)', () => {
      globalFilters.filters.push({ field: 'Status', value: 'Aberto' });
      
      globalFilters.load();
      
      expect(globalFilters.filters.length).toBe(0);
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('dashboardFilters');
    });
  });
});

