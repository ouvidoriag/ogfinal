/**
 * Event Bus - Sistema de Eventos Global
 * 
 * REFATORAÇÃO: Extraído de chart-communication.js
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Responsabilidade: Gerenciar eventos globais entre componentes
 */

/// <reference path="./global.d.ts" />

(function() {
  'use strict';

  const eventBus: EventBus = {
    listeners: new Map<string, EventCallback[]>(),
    
    /**
     * Registrar listener para um evento
     * @param event - Nome do evento
     * @param callback - Função callback
     * @returns Função para remover o listener
     */
    on(event: string, callback: EventCallback): UnsubscribeFunction {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event)!.push(callback);
      
      // Retornar função de unsubscribe
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
    
    /**
     * Emitir evento
     * @param event - Nome do evento
     * @param data - Dados do evento
     */
    emit(event: string, data?: any): void {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            if (window.Logger?.error) {
              window.Logger.error(`Erro em listener do evento ${event}:`, error);
            }
          }
        });
      }
    },
    
    /**
     * Remover todos os listeners de um evento
     * @param event - Nome do evento
     */
    off(event: string): void {
      this.listeners.delete(event);
    },
    
    /**
     * Limpar todos os listeners
     */
    clear(): void {
      this.listeners.clear();
    },
    
    /**
     * Obter número de listeners para um evento
     * @param event - Nome do evento
     * @returns Número de listeners
     */
    listenerCount(event: string): number {
      const callbacks = this.listeners.get(event);
      return callbacks ? callbacks.length : 0;
    },
    
    /**
     * Obter todos os eventos registrados
     * @returns Array de nomes de eventos
     */
    getEvents(): string[] {
      return Array.from(this.listeners.keys());
    }
  };

  // Exportar para uso global
  if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
  }

  // Exportar para módulos ES6 (se disponível)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = eventBus;
  }

})();

