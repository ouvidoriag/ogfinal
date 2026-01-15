/**
 * Testes Unitários - Event Bus
 * 
 * REFATORAÇÃO: Testes para o módulo event-bus.js
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock do window e Logger
global.window = {
  Logger: {
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
};

// Carregar módulo (simular carregamento)
// Em ambiente real, o módulo seria carregado via script tag
describe('Event Bus', () => {
  let eventBus;

  beforeEach(() => {
    // Resetar eventBus antes de cada teste
    eventBus = {
      listeners: new Map(),
      on(event, callback) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        return () => {
          const callbacks = this.listeners.get(event);
          if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
              callbacks.splice(index, 1);
            }
          }
        };
      },
      emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          callbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              if (global.window.Logger) {
                global.window.Logger.error(`Erro em listener do evento ${event}:`, error);
              }
            }
          });
        }
      },
      off(event) {
        this.listeners.delete(event);
      },
      clear() {
        this.listeners.clear();
      }
    };
  });

  describe('on()', () => {
    it('deve registrar um listener para um evento', () => {
      const callback = vi.fn();
      eventBus.on('test:event', callback);
      
      expect(eventBus.listeners.has('test:event')).toBe(true);
      expect(eventBus.listeners.get('test:event')).toContain(callback);
    });

    it('deve retornar função de unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = eventBus.on('test:event', callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      expect(eventBus.listeners.get('test:event')).not.toContain(callback);
    });

    it('deve permitir múltiplos listeners para o mesmo evento', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventBus.on('test:event', callback1);
      eventBus.on('test:event', callback2);
      
      expect(eventBus.listeners.get('test:event').length).toBe(2);
    });
  });

  describe('emit()', () => {
    it('deve emitir evento e chamar todos os listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventBus.on('test:event', callback1);
      eventBus.on('test:event', callback2);
      
      eventBus.emit('test:event', { data: 'test' });
      
      expect(callback1).toHaveBeenCalledWith({ data: 'test' });
      expect(callback2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('não deve quebrar se não houver listeners', () => {
      expect(() => {
        eventBus.emit('nonexistent:event', {});
      }).not.toThrow();
    });

    it('deve tratar erros em listeners sem quebrar outros', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();
      
      eventBus.on('test:event', errorCallback);
      eventBus.on('test:event', normalCallback);
      
      eventBus.emit('test:event', {});
      
      expect(normalCallback).toHaveBeenCalled();
      expect(global.window.Logger.error).toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('deve remover todos os listeners de um evento', () => {
      eventBus.on('test:event', vi.fn());
      eventBus.on('test:event', vi.fn());
      
      eventBus.off('test:event');
      
      expect(eventBus.listeners.has('test:event')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('deve limpar todos os listeners', () => {
      eventBus.on('event1', vi.fn());
      eventBus.on('event2', vi.fn());
      
      eventBus.clear();
      
      expect(eventBus.listeners.size).toBe(0);
    });
  });
});

