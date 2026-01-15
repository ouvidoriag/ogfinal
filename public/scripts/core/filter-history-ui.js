/**
 * UI para Histórico de Filtros
 * 
 * Interface visual para visualizar e aplicar filtros salvos
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Sistema de UI para Histórico de Filtros
   */
  window.filterHistoryUI = {
    /**
     * Criar dropdown de histórico
     * @param {String} containerId - ID do container onde inserir
     * @param {Object} options - Opções de configuração
     */
    createDropdown(containerId, options = {}) {
      const {
        position = 'top-right', // 'top-right', 'top-left', 'bottom-right', 'bottom-left'
        showRecent = true,
        showFavorites = true,
        maxRecent = 10,
        maxFavorites = 20
      } = options;

      const container = document.getElementById(containerId);
      if (!container) {
        if (window.Logger) {
          window.Logger.warn(`FilterHistoryUI: Container '${containerId}' não encontrado`);
        }
        return;
      }

      // Remover dropdown existente
      const existing = container.querySelector('.filter-history-dropdown');
      if (existing) {
        existing.remove();
      }

      // Criar botão toggle
      const button = document.createElement('button');
      button.className = 'filter-history-toggle';
      button.innerHTML = '📋 Histórico';
      button.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s;
      `;
      button.onmouseover = () => {
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
      };
      button.onmouseout = () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      };

      // Criar dropdown
      const dropdown = document.createElement('div');
      dropdown.className = 'filter-history-dropdown';
      dropdown.style.cssText = `
        display: none;
        position: absolute;
        ${position.includes('right') ? 'right: 0;' : 'left: 0;'}
        ${position.includes('top') ? 'top: 100%; margin-top: 8px;' : 'bottom: 100%; margin-bottom: 8px;'}
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        min-width: 300px;
        max-width: 400px;
        max-height: 500px;
        overflow-y: auto;
        z-index: 1000;
      `;

      // Toggle dropdown
      let isOpen = false;
      button.onclick = async (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        dropdown.style.display = isOpen ? 'block' : 'none';
        if (isOpen) {
          // Carregar do backend primeiro, depois mesclar com localStorage
          if (window.filterHistory && window.filterHistory.syncWithBackend) {
            try {
              await window.filterHistory.syncWithBackend();
            } catch (error) {
              // Continuar mesmo se backend falhar
            }
          }
          this.updateDropdown(dropdown, { showRecent, showFavorites, maxRecent, maxFavorites });
        }
      };

      // Fechar ao clicar fora
      document.addEventListener('click', (e) => {
        if (isOpen && !dropdown.contains(e.target) && !button.contains(e.target)) {
          isOpen = false;
          dropdown.style.display = 'none';
        }
      });

      // Criar wrapper
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: relative; display: inline-block;';
      wrapper.appendChild(button);
      wrapper.appendChild(dropdown);

      // Inserir no container
      container.appendChild(wrapper);

      if (window.Logger) {
        window.Logger.debug('FilterHistoryUI: Dropdown criado');
      }
    },

    /**
     * Atualizar conteúdo do dropdown
     * @param {HTMLElement} dropdown - Elemento dropdown
     * @param {Object} options - Opções
     */
    async updateDropdown(dropdown, options = {}) {
      const { showRecent = true, showFavorites = true, maxRecent = 10, maxFavorites = 20 } = options;

      dropdown.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">Carregando...</div>';

      try {
        // Carregar do backend primeiro
        let recent = [];
        let favorites = [];

        if (window.filterHistory) {
          if (showRecent) {
            try {
              const backendRecent = await window.filterHistory.loadFromBackend({ recent: true, limit: maxRecent });
              recent = backendRecent.map(f => ({
                id: f.id,
                name: f.name,
                filters: f.filters,
                isFavorite: false,
                timestamp: f.lastUsed ? new Date(f.lastUsed).getTime() : Date.now()
              }));
            } catch (error) {
              // Fallback: usar localStorage
              recent = window.filterHistory.getRecent().slice(0, maxRecent);
            }
          }

          if (showFavorites) {
            try {
              const backendFavorites = await window.filterHistory.loadFromBackend({ favorite: true });
              favorites = backendFavorites.map(f => ({
                id: f.id,
                name: f.name,
                filters: f.filters,
                isFavorite: true,
                timestamp: f.lastUsed ? new Date(f.lastUsed).getTime() : Date.now()
              }));
            } catch (error) {
              // Fallback: usar localStorage
              favorites = window.filterHistory.getFavorites().slice(0, maxFavorites);
            }
          }
        }

        dropdown.innerHTML = '';

        // Seção de Favoritos
        if (favorites.length > 0) {
          const favoritesSection = this.createSection('⭐ Favoritos', favorites, async (item) => {
            // Marcar como usado no backend
            if (item.id && window.filterHistory && window.filterHistory.markAsUsed) {
              await window.filterHistory.markAsUsed(item.id).catch(() => {});
            }
            window.filterHistory.apply(item.filters);
            dropdown.style.display = 'none';
          }, async (item) => {
            // Deletar do backend
            if (item.id && window.filterHistory && window.filterHistory.deleteFromBackend) {
              try {
                await window.filterHistory.deleteFromBackend(item.id);
              } catch (error) {
                // Fallback: deletar do localStorage
                window.filterHistory.removeFavorite(item.id);
              }
            } else {
              window.filterHistory.removeFavorite(item.id);
            }
            this.updateDropdown(dropdown, options);
          });
          dropdown.appendChild(favoritesSection);
        }

        // Seção de Recentes
        if (recent.length > 0) {
          const recentSection = this.createSection('🕒 Recentes', recent, async (item) => {
            // Marcar como usado no backend
            if (item.id && window.filterHistory && window.filterHistory.markAsUsed) {
              await window.filterHistory.markAsUsed(item.id).catch(() => {});
            }
            window.filterHistory.apply(item.filters);
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(recentSection);
        }

        // Se vazio
        if (favorites.length === 0 && recent.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding: 20px; text-align: center; color: #666;';
          empty.textContent = 'Nenhum filtro salvo';
          dropdown.appendChild(empty);
        }

        // Botão limpar histórico
        if (recent.length > 0) {
          const clearButton = document.createElement('button');
          clearButton.textContent = 'Limpar Histórico';
          clearButton.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-top: 8px;
            background: #f0f0f0;
            border: none;
            border-top: 1px solid #e0e0e0;
            color: #666;
            cursor: pointer;
            font-size: 12px;
          `;
          clearButton.onclick = () => {
            if (window.filterHistory) {
              window.filterHistory.clearRecent();
              this.updateDropdown(dropdown, options);
            }
          };
          dropdown.appendChild(clearButton);
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('FilterHistoryUI: Erro ao atualizar dropdown:', error);
        }
        dropdown.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff4444;">Erro ao carregar filtros</div>';
      }
    },

    /**
     * Criar seção do dropdown
     * @param {String} title - Título da seção
     * @param {Array} items - Itens da seção
     * @param {Function} onApply - Callback ao aplicar filtro
     * @param {Function} onRemove - Callback ao remover (opcional)
     * @returns {HTMLElement} Seção
     */
    createSection(title, items, onApply, onRemove = null) {
      const section = document.createElement('div');
      section.style.cssText = 'padding: 8px;';

      // Título
      const titleEl = document.createElement('div');
      titleEl.textContent = title;
      titleEl.style.cssText = 'font-weight: 600; font-size: 12px; color: #333; padding: 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 4px;';
      section.appendChild(titleEl);

      // Itens
      items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px;
          margin: 2px 0;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        `;
        itemEl.onmouseover = () => {
          itemEl.style.background = '#f0f0f0';
        };
        itemEl.onmouseout = () => {
          itemEl.style.background = 'transparent';
        };

        // Nome do filtro
        const nameEl = document.createElement('span');
        nameEl.textContent = item.name || 'Filtro sem nome';
        nameEl.style.cssText = 'font-size: 13px; color: #333; flex: 1;';
        itemEl.appendChild(nameEl);

        // Botão aplicar
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Aplicar';
        applyButton.style.cssText = `
          background: #667eea;
          color: white;
          border: none;
          padding: 4px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          margin-left: 8px;
        `;
        applyButton.onclick = (e) => {
          e.stopPropagation();
          onApply(item);
        };
        itemEl.appendChild(applyButton);

        // Botão remover (se fornecido)
        if (onRemove) {
          const removeButton = document.createElement('button');
          removeButton.textContent = '×';
          removeButton.style.cssText = `
            background: transparent;
            color: #999;
            border: none;
            padding: 4px 8px;
            font-size: 18px;
            cursor: pointer;
            margin-left: 4px;
          `;
          removeButton.onclick = (e) => {
            e.stopPropagation();
            onRemove(item);
          };
          itemEl.appendChild(removeButton);
        }

        section.appendChild(itemEl);
      });

      return section;
    },

    /**
     * Criar botão flutuante
     * @param {Object} options - Opções
     */
    createFloatingButton(options = {}) {
      const {
        position = 'bottom-right' // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
      } = options;

      const button = document.createElement('button');
      button.className = 'filter-history-floating';
      button.innerHTML = '📋';
      button.title = 'Histórico de Filtros';
      button.style.cssText = `
        position: fixed;
        ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 999;
        transition: all 0.2s;
      `;
      button.onmouseover = () => {
        button.style.transform = 'scale(1.1)';
        button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
      };
      button.onmouseout = () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      };

      // Criar modal ao clicar
      button.onclick = () => {
        this.showModal();
      };

      document.body.appendChild(button);

      if (window.Logger) {
        window.Logger.debug('FilterHistoryUI: Botão flutuante criado');
      }
    },

    /**
     * Mostrar modal de histórico
     */
    async showModal() {
      // Remover modal existente
      const existing = document.getElementById('filter-history-modal');
      if (existing) {
        existing.remove();
      }

      // Criar modal
      const modal = document.createElement('div');
      modal.id = 'filter-history-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      `;

      // Título
      const title = document.createElement('h2');
      title.textContent = 'Histórico de Filtros';
      title.style.cssText = 'margin: 0 0 16px 0; font-size: 20px; color: #333;';
      content.appendChild(title);

      // Conteúdo (carregar do backend)
      let recent = [];
      let favorites = [];
      
      if (window.filterHistory) {
        try {
          const synced = await window.filterHistory.syncWithBackend();
          recent = synced.recent || [];
          favorites = synced.favorites || [];
        } catch (error) {
          // Fallback: usar localStorage
          recent = window.filterHistory.getRecent();
          favorites = window.filterHistory.getFavorites();
        }
      }

      if (favorites.length > 0) {
        const favoritesSection = this.createSection('⭐ Favoritos', favorites, async (item) => {
          // Marcar como usado no backend
          if (item.id && window.filterHistory && window.filterHistory.markAsUsed) {
            await window.filterHistory.markAsUsed(item.id).catch(() => {});
          }
          window.filterHistory.apply(item.filters);
          modal.remove();
        }, async (item) => {
          // Deletar do backend
          if (item.id && window.filterHistory && window.filterHistory.deleteFromBackend) {
            try {
              await window.filterHistory.deleteFromBackend(item.id);
            } catch (error) {
              // Fallback: deletar do localStorage
              window.filterHistory.removeFavorite(item.id);
            }
          } else {
            window.filterHistory.removeFavorite(item.id);
          }
          this.showModal(); // Recarregar modal
        });
        content.appendChild(favoritesSection);
      }

      if (recent.length > 0) {
        const recentSection = this.createSection('🕒 Recentes', recent, async (item) => {
          // Marcar como usado no backend
          if (item.id && window.filterHistory && window.filterHistory.markAsUsed) {
            await window.filterHistory.markAsUsed(item.id).catch(() => {});
          }
          window.filterHistory.apply(item.filters);
          modal.remove();
        });
        content.appendChild(recentSection);
      }

      if (favorites.length === 0 && recent.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 40px; text-align: center; color: #999;';
        empty.textContent = 'Nenhum filtro salvo ainda';
        content.appendChild(empty);
      }

      // Botão fechar
      const closeButton = document.createElement('button');
      closeButton.textContent = 'Fechar';
      closeButton.style.cssText = `
        width: 100%;
        margin-top: 16px;
        padding: 10px;
        background: #f0f0f0;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      `;
      closeButton.onclick = () => {
        modal.remove();
      };
      content.appendChild(closeButton);

      modal.appendChild(content);
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      };

      document.body.appendChild(modal);

      if (window.Logger) {
        window.Logger.debug('FilterHistoryUI: Modal exibido');
      }
    }
  };

  if (window.Logger) {
    window.Logger.debug('FilterHistoryUI: Sistema de UI para histórico de filtros inicializado');
  }
})();

