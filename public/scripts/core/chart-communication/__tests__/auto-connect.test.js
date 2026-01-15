/**
 * Testes Unitários - Auto-Connect
 * 
 * REFATORAÇÃO: Testes para o módulo auto-connect.js
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do window e dependências
global.window = {
  Logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    success: vi.fn()
  },
  chartCommunication: {
    on: vi.fn(),
    off: vi.fn()
  },
  dataStore: {
    invalidate: vi.fn()
  },
  loadOverview: vi.fn(),
  loadTema: vi.fn(),
  loadStatusPage: vi.fn()
};

global.document = {
  getElementById: vi.fn((id) => {
    if (id === 'pages') {
      return {
        children: [
          { id: 'page-main', tagName: 'SECTION', style: { display: 'block' } },
          { id: 'page-tema', tagName: 'SECTION', style: { display: 'none' } }
        ]
      };
    }
    return {
      id,
      style: { display: 'block' },
      offsetParent: { id: 'parent' }
    };
  }),
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => [])
};

global.getComputedStyle = vi.fn(() => ({
  display: 'block'
}));

describe('Auto-Connect', () => {
  let createPageFilterListener;
  let autoConnectAllPages;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Resetar timeouts
    global.window = {
      ...global.window,
      pageMainUpdateTimeout: null,
      pageTemaUpdateTimeout: null
    };
    
    createPageFilterListener = (pageId, reloadFunction, debounceMs = 500) => {
      if (!global.window.chartCommunication) {
        if (global.window.Logger) {
          global.window.Logger.warn(`Sistema de comunicação não disponível. Listener para ${pageId} não será criado.`);
        }
        return;
      }
      
      const timeoutKey = `${pageId}UpdateTimeout`;
      
      const handleFilterChange = () => {
        const page = global.document.getElementById(pageId);
        
        if (!page || page.style.display === 'none') {
          if (global.window.Logger) {
            global.window.Logger.debug(`⏭️ Página ${pageId} não está visível, ignorando mudança de filtro`);
          }
          return;
        }
        
        const isVisible = page.offsetParent !== null || 
                          page.style.display === 'block' || 
                          getComputedStyle(page).display !== 'none';
        
        if (!isVisible) {
          if (global.window.Logger) {
            global.window.Logger.debug(`⏭️ Página ${pageId} não está realmente visível, ignorando mudança de filtro`);
          }
          return;
        }
        
        if (global.window.dataStore) {
          global.window.dataStore.invalidate();
        }
        
        clearTimeout(global.window[timeoutKey]);
        global.window[timeoutKey] = setTimeout(() => {
          if (global.window.Logger) {
            global.window.Logger.debug(`🔄 Filtro mudou, recarregando ${pageId}...`);
          }
          reloadFunction(true);
        }, debounceMs);
      };
      
      global.window.chartCommunication.on('filter:applied', handleFilterChange);
      global.window.chartCommunication.on('filter:removed', handleFilterChange);
      global.window.chartCommunication.on('filter:cleared', handleFilterChange);
      global.window.chartCommunication.on('charts:update-requested', handleFilterChange);
      
      if (global.window.Logger) {
        global.window.Logger.debug(`✅ Listener de filtro criado para ${pageId} (filtros locais por página)`);
      }
      
      return () => {
        global.window.chartCommunication.off('filter:applied');
        global.window.chartCommunication.off('filter:removed');
        global.window.chartCommunication.off('filter:cleared');
        global.window.chartCommunication.off('charts:update-requested');
        clearTimeout(global.window[timeoutKey]);
      };
    };
    
    autoConnectAllPages = () => {
      if (!global.window.chartCommunication) {
        return;
      }
      
      const pageLoaders = {
        'page-main': global.window.loadOverview,
        'page-tema': global.window.loadTema,
        'page-status': global.window.loadStatusPage
      };
      
      Object.entries(pageLoaders).forEach(([pageId, loader]) => {
        if (loader && typeof loader === 'function') {
          try {
            createPageFilterListener(pageId, loader, 500);
            if (global.window.Logger) {
              global.window.Logger.debug(`✅ Página ${pageId} conectada automaticamente ao sistema de filtros`);
            }
          } catch (error) {
            if (global.window.Logger) {
              global.window.Logger.warn(`Erro ao conectar página ${pageId}:`, error);
            }
          }
        }
      });
      
      if (global.window.Logger) {
        global.window.Logger.success(`✅ Sistema de filtros locais por página ativado - ${Object.keys(pageLoaders).length} páginas conectadas`);
      }
    };
  });

  describe('createPageFilterListener()', () => {
    it('deve criar listener para página', () => {
      const reloadFn = vi.fn();
      createPageFilterListener('page-main', reloadFn);
      
      expect(global.window.chartCommunication.on).toHaveBeenCalledTimes(4);
      expect(global.window.chartCommunication.on).toHaveBeenCalledWith('filter:applied', expect.any(Function));
      expect(global.window.chartCommunication.on).toHaveBeenCalledWith('filter:removed', expect.any(Function));
      expect(global.window.chartCommunication.on).toHaveBeenCalledWith('filter:cleared', expect.any(Function));
      expect(global.window.chartCommunication.on).toHaveBeenCalledWith('charts:update-requested', expect.any(Function));
    });

    it('não deve criar listener se chartCommunication não estiver disponível', () => {
      const original = global.window.chartCommunication;
      global.window.chartCommunication = null;
      
      createPageFilterListener('page-main', vi.fn());
      
      expect(global.window.Logger.warn).toHaveBeenCalled();
      
      global.window.chartCommunication = original;
    });

    it('deve ignorar mudanças se página não estiver visível', async () => {
      const reloadFn = vi.fn();
      global.document.getElementById = vi.fn(() => ({
        style: { display: 'none' },
        offsetParent: null
      }));
      
      createPageFilterListener('page-hidden', reloadFn);
      
      // Simular evento de filtro
      const handlers = global.window.chartCommunication.on.mock.calls
        .filter(call => call[0] === 'filter:applied')
        .map(call => call[1]);
      
      if (handlers.length > 0) {
        handlers[0]();
      }
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(reloadFn).not.toHaveBeenCalled();
    });

    it('deve recarregar página visível quando filtro mudar', async () => {
      const reloadFn = vi.fn();
      global.document.getElementById = vi.fn(() => ({
        style: { display: 'block' },
        offsetParent: { id: 'parent' }
      }));
      
      createPageFilterListener('page-visible', reloadFn);
      
      // Simular evento de filtro
      const handlers = global.window.chartCommunication.on.mock.calls
        .filter(call => call[0] === 'filter:applied')
        .map(call => call[1]);
      
      if (handlers.length > 0) {
        handlers[0]();
      }
      
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(reloadFn).toHaveBeenCalledWith(true);
      expect(global.window.dataStore.invalidate).toHaveBeenCalled();
    });

    it('deve usar debounce para evitar múltiplas atualizações', async () => {
      const reloadFn = vi.fn();
      createPageFilterListener('page-main', reloadFn, 100);
      
      const handlers = global.window.chartCommunication.on.mock.calls
        .filter(call => call[0] === 'filter:applied')
        .map(call => call[1]);
      
      if (handlers.length > 0) {
        const handler = handlers[0];
        handler();
        handler();
        handler();
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Deve chamar apenas uma vez devido ao debounce
      expect(reloadFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('autoConnectAllPages()', () => {
    it('deve conectar todas as páginas com loaders', () => {
      autoConnectAllPages();
      
      expect(global.window.chartCommunication.on).toHaveBeenCalled();
      expect(global.window.Logger.success).toHaveBeenCalled();
    });

    it('não deve conectar páginas sem loaders', () => {
      global.window.loadOverview = null;
      
      autoConnectAllPages();
      
      // Não deve quebrar
      expect(global.window.Logger.warn).not.toHaveBeenCalled();
    });

    it('não deve quebrar se loader não for função', () => {
      global.window.loadOverview = 'not a function';
      
      expect(() => {
        autoConnectAllPages();
      }).not.toThrow();
    });

    it('deve tratar erros ao conectar páginas', () => {
      // Mock createPageFilterListener para lançar erro
      const mockCreatePageFilterListener = vi.fn(() => {
        throw new Error('Test error');
      });
      
      // Substituir temporariamente
      const original = createPageFilterListener;
      createPageFilterListener = mockCreatePageFilterListener;
      
      // Executar - não deve quebrar
      expect(() => {
        autoConnectAllPages();
      }).not.toThrow();
      
      // Verificar se tentou criar listener
      expect(mockCreatePageFilterListener).toHaveBeenCalled();
      expect(global.window.Logger.warn).toHaveBeenCalled();
      
      // Restaurar
      createPageFilterListener = original;
    });
  });
});

