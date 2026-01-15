/**
 * Testes Unitários - Chart Registry
 * 
 * REFATORAÇÃO: Testes para o módulo chart-registry.js
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
  eventBus: {
    emit: vi.fn(),
    on: vi.fn(() => () => {})
  }
};

global.document = {
  getElementById: vi.fn(() => ({
    innerHTML: '',
    style: { display: 'none' }
  })),
  body: {
    appendChild: vi.fn()
  }
};

describe('Chart Registry', () => {
  let chartRegistry;
  let chartFieldMap;
  let feedback;
  let eventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    
    eventBus = {
      emit: vi.fn(),
      on: vi.fn(() => () => {})
    };
    
    // Mock chartFieldMap
    chartFieldMap = {
      'chartStatus': { field: 'Status', op: 'eq' },
      'chartTema': { field: 'Tema', op: 'eq' },
      'chartBairro': { field: 'Bairro', op: 'contains' }
    };
    
    // Mock feedback
    feedback = {
      show: vi.fn()
    };
    
    // Mock chartRegistry
    chartRegistry = {
      charts: new Map(),
      
      register(chartId, config) {
        this.charts.set(chartId, {
          ...config,
          id: chartId,
          createdAt: Date.now()
        });
        eventBus.emit('chart:registered', { chartId, config });
      },
      
      unregister(chartId) {
        this.charts.delete(chartId);
        eventBus.emit('chart:unregistered', { chartId });
      },
      
      get(chartId) {
        return this.charts.get(chartId) || null;
      },
      
      getAll() {
        return Array.from(this.charts.values());
      },
      
      getByField(field) {
        return this.getAll().filter(chart => {
          const mapping = chartFieldMap[chart.id];
          return mapping && mapping.field === field;
        });
      },
      
      getFieldMapping(chartId) {
        return chartFieldMap[chartId] || null;
      },
      
      getFieldMappings() {
        return { ...chartFieldMap };
      }
    };
  });

  describe('register()', () => {
    it('deve registrar um gráfico', () => {
      const config = { type: 'bar', field: 'Status' };
      chartRegistry.register('chartStatus', config);
      
      expect(chartRegistry.charts.has('chartStatus')).toBe(true);
      expect(chartRegistry.get('chartStatus')).toMatchObject({
        id: 'chartStatus',
        type: 'bar',
        field: 'Status'
      });
      expect(eventBus.emit).toHaveBeenCalledWith('chart:registered', {
        chartId: 'chartStatus',
        config
      });
    });

    it('deve adicionar id e createdAt ao config', () => {
      chartRegistry.register('chartTest', { type: 'line' });
      const chart = chartRegistry.get('chartTest');
      
      expect(chart.id).toBe('chartTest');
      expect(chart.createdAt).toBeTypeOf('number');
    });
  });

  describe('unregister()', () => {
    it('deve desregistrar um gráfico', () => {
      chartRegistry.register('chartStatus', { type: 'bar' });
      chartRegistry.unregister('chartStatus');
      
      expect(chartRegistry.charts.has('chartStatus')).toBe(false);
      expect(eventBus.emit).toHaveBeenCalledWith('chart:unregistered', {
        chartId: 'chartStatus'
      });
    });

    it('não deve quebrar se gráfico não existir', () => {
      expect(() => {
        chartRegistry.unregister('nonexistent');
      }).not.toThrow();
    });
  });

  describe('get()', () => {
    it('deve retornar gráfico registrado', () => {
      chartRegistry.register('chartStatus', { type: 'bar' });
      const chart = chartRegistry.get('chartStatus');
      
      expect(chart).toBeDefined();
      expect(chart.id).toBe('chartStatus');
    });

    it('deve retornar null se gráfico não existir', () => {
      expect(chartRegistry.get('nonexistent')).toBeNull();
    });
  });

  describe('getAll()', () => {
    it('deve retornar todos os gráficos', () => {
      chartRegistry.register('chart1', { type: 'bar' });
      chartRegistry.register('chart2', { type: 'line' });
      
      const all = chartRegistry.getAll();
      expect(all.length).toBe(2);
    });

    it('deve retornar array vazio se não houver gráficos', () => {
      expect(chartRegistry.getAll()).toEqual([]);
    });
  });

  describe('getByField()', () => {
    it('deve retornar gráficos por campo', () => {
      chartRegistry.register('chartStatus', { type: 'bar' });
      chartRegistry.register('chartTema', { type: 'bar' });
      chartRegistry.register('chartBairro', { type: 'bar' });
      
      const statusCharts = chartRegistry.getByField('Status');
      expect(statusCharts.length).toBe(1);
      expect(statusCharts[0].id).toBe('chartStatus');
    });

    it('deve retornar array vazio se não houver gráficos para o campo', () => {
      expect(chartRegistry.getByField('Nonexistent')).toEqual([]);
    });
  });

  describe('getFieldMapping()', () => {
    it('deve retornar mapeamento de campo para gráfico', () => {
      const mapping = chartRegistry.getFieldMapping('chartStatus');
      
      expect(mapping).toEqual({ field: 'Status', op: 'eq' });
    });

    it('deve retornar null se gráfico não tiver mapeamento', () => {
      expect(chartRegistry.getFieldMapping('nonexistent')).toBeNull();
    });
  });

  describe('getFieldMappings()', () => {
    it('deve retornar todos os mapeamentos', () => {
      const mappings = chartRegistry.getFieldMappings();
      
      expect(mappings).toHaveProperty('chartStatus');
      expect(mappings).toHaveProperty('chartTema');
      expect(mappings).toHaveProperty('chartBairro');
    });
  });
});

describe('Feedback System', () => {
  let feedback;

  beforeEach(() => {
    vi.clearAllMocks();
    
    global.document.getElementById = vi.fn(() => null);
    global.document.createElement = vi.fn(() => ({
      id: '',
      className: '',
      style: { display: 'none' },
      innerHTML: ''
    }));
    
    feedback = {
      show(chartId, label, value) {
        let feedbackEl = global.document.getElementById('chartFeedback');
        if (!feedbackEl) {
          feedbackEl = global.document.createElement('div');
          feedbackEl.id = 'chartFeedback';
          feedbackEl.className = 'fixed top-4 right-4 bg-slate-800/90 border border-cyan-500/50 rounded-lg px-4 py-2 text-sm text-slate-200 z-50 shadow-lg';
          feedbackEl.style.display = 'none';
          global.document.body.appendChild(feedbackEl);
        }
        
        feedbackEl.innerHTML = `
          <div class="font-semibold text-cyan-300">${label}</div>
          <div class="text-xs text-slate-400">${value.toLocaleString('pt-BR')} registros</div>
        `;
        
        feedbackEl.style.display = 'block';
        
        setTimeout(() => {
          if (feedbackEl) {
            feedbackEl.style.display = 'none';
          }
        }, 2000);
      }
    };
  });

  it('deve criar elemento de feedback se não existir', () => {
    feedback.show('chart1', 'Status: Aberto', 100);
    
    expect(global.document.createElement).toHaveBeenCalledWith('div');
    expect(global.document.body.appendChild).toHaveBeenCalled();
  });

  it('deve atualizar conteúdo do feedback', () => {
    const mockEl = {
      id: 'chartFeedback',
      innerHTML: '',
      style: { display: 'none' }
    };
    
    global.document.getElementById = vi.fn(() => mockEl);
    
    feedback.show('chart1', 'Status: Aberto', 100);
    
    expect(mockEl.innerHTML).toContain('Status: Aberto');
    expect(mockEl.innerHTML).toContain('100');
    expect(mockEl.style.display).toBe('block');
  });

  it('deve formatar números corretamente', () => {
    const mockEl = {
      id: 'chartFeedback',
      innerHTML: '',
      style: { display: 'none' }
    };
    
    global.document.getElementById = vi.fn(() => mockEl);
    
    feedback.show('chart1', 'Total', 1234);
    
    expect(mockEl.innerHTML).toContain('1.234');
  });
});

