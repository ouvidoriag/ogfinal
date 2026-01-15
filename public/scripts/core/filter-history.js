/**
 * Histórico de Filtros
 * 
 * Sistema para salvar e recuperar filtros recentes e favoritos
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    RECENT: 'filterHistory_recent',
    FAVORITES: 'filterHistory_favorites',
    MAX_RECENT: 10,
    MAX_FAVORITES: 20
  };

  /**
   * Sistema de Histórico de Filtros
   */
  window.filterHistory = {
    /**
     * Salvar filtro no histórico recente
     * @param {Array} filters - Array de filtros
     * @param {String} name - Nome opcional do filtro
     */
    saveRecent(filters, name = null) {
      if (!Array.isArray(filters) || filters.length === 0) {
        return;
      }

      try {
        const recent = this.getRecent();
        
        // Remover duplicatas exatas
        const filterKey = this.generateFilterKey(filters);
        const existingIndex = recent.findIndex(item => item.key === filterKey);
        
        if (existingIndex > -1) {
          // Mover para o topo
          recent.splice(existingIndex, 1);
        }

        // Adicionar ao início
        recent.unshift({
          key: filterKey,
          filters: filters,
          name: name || this.generateDefaultName(filters),
          timestamp: Date.now()
        });

        // Limitar tamanho
        if (recent.length > STORAGE_KEYS.MAX_RECENT) {
          recent.splice(STORAGE_KEYS.MAX_RECENT);
        }

        // Salvar no localStorage
        localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(recent));

        if (window.Logger) {
          window.Logger.debug(`FilterHistory: Filtro salvo no histórico recente`, {
            name: recent[0].name,
            total: recent.length
          });
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao salvar histórico:', error);
        }
      }
    },

    /**
     * Obter histórico recente
     * @returns {Array} Array de filtros recentes
     */
    getRecent() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.RECENT);
        if (!stored) {
          return [];
        }
        return JSON.parse(stored);
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao ler histórico:', error);
        }
        return [];
      }
    },

    /**
     * Salvar filtro como favorito
     * @param {Array} filters - Array de filtros
     * @param {String} name - Nome do favorito
     */
    saveFavorite(filters, name) {
      if (!Array.isArray(filters) || filters.length === 0 || !name) {
        return false;
      }

      try {
        const favorites = this.getFavorites();
        
        // Verificar se já existe com mesmo nome
        const existingIndex = favorites.findIndex(fav => fav.name === name);
        
        const favorite = {
          id: existingIndex > -1 ? favorites[existingIndex].id : this.generateId(),
          key: this.generateFilterKey(filters),
          filters: filters,
          name: name,
          timestamp: Date.now()
        };

        if (existingIndex > -1) {
          // Atualizar existente
          favorites[existingIndex] = favorite;
        } else {
          // Adicionar novo
          favorites.push(favorite);
          
          // Limitar tamanho
          if (favorites.length > STORAGE_KEYS.MAX_FAVORITES) {
            favorites.splice(0, favorites.length - STORAGE_KEYS.MAX_FAVORITES);
          }
        }

        // Salvar no localStorage
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));

        if (window.Logger) {
          window.Logger.debug(`FilterHistory: Filtro salvo como favorito`, {
            name: name,
            total: favorites.length
          });
        }

        return true;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao salvar favorito:', error);
        }
        return false;
      }
    },

    /**
     * Obter favoritos
     * @returns {Array} Array de favoritos
     */
    getFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.FAVORITES);
        if (!stored) {
          return [];
        }
        return JSON.parse(stored);
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao ler favoritos:', error);
        }
        return [];
      }
    },

    /**
     * Remover favorito
     * @param {String} id - ID do favorito
     */
    removeFavorite(id) {
      try {
        const favorites = this.getFavorites();
        const filtered = favorites.filter(fav => fav.id !== id);
        
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(filtered));

        if (window.Logger) {
          window.Logger.debug(`FilterHistory: Favorito removido`, { id });
        }

        return true;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao remover favorito:', error);
        }
        return false;
      }
    },

    /**
     * Aplicar filtro do histórico
     * @param {Array} filters - Array de filtros
     */
    apply(filters) {
      if (!Array.isArray(filters) || filters.length === 0) {
        return;
      }

      // Aplicar filtros globais
      if (window.chartCommunication && window.chartCommunication.filters) {
        window.chartCommunication.filters.clear();
        
        filters.forEach(filter => {
          if (filter.field && filter.value) {
            window.chartCommunication.filters.apply(
              filter.field,
              filter.value,
              null,
              { operator: filter.op || 'eq', toggle: false, clearPrevious: false }
            );
          }
        });

        window.chartCommunication.filters.notifyAllCharts();
      }

      // Salvar no histórico recente
      this.saveRecent(filters);
    },

    /**
     * Gerar chave única para filtros
     * @param {Array} filters - Array de filtros
     * @returns {String} Chave
     */
    generateFilterKey(filters) {
      const sorted = [...filters].sort((a, b) => {
        if (a.field !== b.field) {
          return a.field.localeCompare(b.field);
        }
        if (a.op !== b.op) {
          return a.op.localeCompare(b.op);
        }
        return JSON.stringify(a.value).localeCompare(JSON.stringify(b.value));
      });

      return JSON.stringify(sorted);
    },

    /**
     * Gerar nome padrão para filtro
     * @param {Array} filters - Array de filtros
     * @returns {String} Nome
     */
    generateDefaultName(filters) {
      if (filters.length === 0) {
        return 'Filtro vazio';
      }

      if (filters.length === 1) {
        const f = filters[0];
        const fieldLabel = this.getFieldLabel(f.field);
        const value = Array.isArray(f.value) ? f.value.join(', ') : f.value;
        return `${fieldLabel}: ${value}`;
      }

      return `${filters.length} filtros`;
    },

    /**
     * Obter label do campo
     * @param {String} field - Nome do campo
     * @returns {String} Label
     */
    getFieldLabel(field) {
      const labels = {
        'statusDemanda': 'Status',
        'tema': 'Tema',
        'assunto': 'Assunto',
        'secretaria': 'Secretaria',
        'tipoDeManifestacao': 'Tipo',
        'canal': 'Canal',
        'prioridade': 'Prioridade',
        'unidadeCadastro': 'Unidade',
        'bairro': 'Bairro',
        'dataCriacaoIso': 'Data de Criação',
        'dataConclusaoIso': 'Data de Conclusão'
      };
      return labels[field] || field;
    },

    /**
     * Gerar ID único
     * @returns {String} ID
     */
    generateId() {
      return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Limpar histórico recente
     */
    clearRecent() {
      localStorage.removeItem(STORAGE_KEYS.RECENT);
      if (window.Logger) {
        window.Logger.debug('FilterHistory: Histórico recente limpo');
      }
    },

    /**
     * Limpar favoritos
     */
    clearFavorites() {
      localStorage.removeItem(STORAGE_KEYS.FAVORITES);
      if (window.Logger) {
        window.Logger.debug('FilterHistory: Favoritos limpos');
      }
    },

    /**
     * Sincronizar com backend - Salvar filtro no servidor
     * @param {Array|Object} filters - Filtros (simples ou composto)
     * @param {String} name - Nome do filtro
     * @param {String} description - Descrição opcional
     * @param {Boolean} isFavorite - Se é favorito
     * @param {Boolean} isComposite - Se é filtro composto
     * @returns {Promise<Object>} Filtro salvo
     */
    async saveToBackend(filters, name, description = '', isFavorite = false, isComposite = false) {
      try {
        const response = await fetch('/api/saved-filters', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            name,
            description,
            filters,
            isComposite,
            isFavorite
          })
        });

        if (!response.ok) {
          throw new Error(`Erro ao salvar: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (window.Logger) {
          window.Logger.debug('FilterHistory: Filtro salvo no backend', {
            id: data.filter?.id,
            name
          });
        }

        // Também salvar localmente como fallback
        if (isFavorite) {
          this.saveFavorite(filters, name);
        } else {
          this.saveRecent(filters, name);
        }

        return data.filter;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao salvar no backend:', error);
        }
        // Fallback: salvar apenas localmente
        if (isFavorite) {
          this.saveFavorite(filters, name);
        } else {
          this.saveRecent(filters, name);
        }
        throw error;
      }
    },

    /**
     * Carregar filtros do backend
     * @param {Object} options - Opções (favorite, recent, limit)
     * @returns {Promise<Array>} Array de filtros
     */
    async loadFromBackend(options = {}) {
      try {
        const params = new URLSearchParams();
        if (options.favorite) params.append('favorite', 'true');
        if (options.recent) params.append('recent', 'true');
        if (options.limit) params.append('limit', options.limit.toString());

        const response = await fetch(`/api/saved-filters?${params.toString()}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Erro ao carregar: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (window.Logger) {
          window.Logger.debug('FilterHistory: Filtros carregados do backend', {
            count: data.filters?.length || 0
          });
        }

        return data.filters || [];
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao carregar do backend:', error);
        }
        // Fallback: retornar do localStorage
        if (options.favorite) {
          return this.getFavorites();
        } else if (options.recent) {
          return this.getRecent();
        } else {
          return [...this.getFavorites(), ...this.getRecent()];
        }
      }
    },

    /**
     * Deletar filtro do backend
     * @param {String} id - ID do filtro
     * @returns {Promise<Boolean>} Sucesso
     */
    async deleteFromBackend(id) {
      try {
        const response = await fetch(`/api/saved-filters/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Erro ao deletar: ${response.statusText}`);
        }

        if (window.Logger) {
          window.Logger.debug('FilterHistory: Filtro deletado do backend', { id });
        }

        return true;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao deletar do backend:', error);
        }
        throw error;
      }
    },

    /**
     * Marcar filtro como usado no backend
     * @param {String} id - ID do filtro
     * @returns {Promise<Boolean>} Sucesso
     */
    async markAsUsed(id) {
      try {
        const response = await fetch(`/api/saved-filters/${id}/use`, {
          method: 'POST',
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`Erro ao marcar como usado: ${response.statusText}`);
        }

        return true;
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro ao marcar como usado:', error);
        }
        return false;
      }
    },

    /**
     * Sincronizar filtros locais com backend (carregar do backend e mesclar)
     */
    async syncWithBackend() {
      try {
        // Carregar do backend
        const backendFilters = await this.loadFromBackend();
        
        // Mesclar com localStorage (backend tem prioridade)
        const localFavorites = this.getFavorites();
        const localRecent = this.getRecent();

        // Combinar e remover duplicatas
        const allFilters = [...backendFilters, ...localFavorites, ...localRecent];
        const uniqueFilters = [];
        const seenKeys = new Set();

        for (const filter of allFilters) {
          const key = filter.key || this.generateFilterKey(filter.filters);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueFilters.push(filter);
          }
        }

        // Separar favoritos e recentes
        const favorites = uniqueFilters.filter(f => f.isFavorite || localFavorites.find(lf => lf.id === f.id));
        const recent = uniqueFilters.filter(f => !f.isFavorite && !favorites.find(fav => fav.id === f.id));

        // Atualizar localStorage
        if (favorites.length > 0) {
          localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites.slice(0, STORAGE_KEYS.MAX_FAVORITES)));
        }
        if (recent.length > 0) {
          localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(recent.slice(0, STORAGE_KEYS.MAX_RECENT)));
        }

        if (window.Logger) {
          window.Logger.debug('FilterHistory: Sincronização concluída', {
            backend: backendFilters.length,
            favorites: favorites.length,
            recent: recent.length
          });
        }

        return { favorites, recent };
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistory: Erro na sincronização:', error);
        }
        // Retornar apenas do localStorage em caso de erro
        return {
          favorites: this.getFavorites(),
          recent: this.getRecent()
        };
      }
    }
  };

  // Sincronizar automaticamente ao carregar (se usuário autenticado)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (window.filterHistory) {
          window.filterHistory.syncWithBackend().catch(() => {
            // Ignorar erros silenciosamente
          });
        }
      }, 2000); // Aguardar 2s para garantir que usuário está autenticado
    });
  } else {
    setTimeout(() => {
      if (window.filterHistory) {
        window.filterHistory.syncWithBackend().catch(() => {
          // Ignorar erros silenciosamente
        });
      }
    }, 2000);
  }

  if (window.Logger) {
    window.Logger.debug('FilterHistory: Sistema de histórico de filtros inicializado');
  }
})();

