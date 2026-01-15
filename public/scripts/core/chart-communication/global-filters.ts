/**
 * Global Filters - Sistema de Filtros Globais
 * 
 * REFATORAÇÃO: Extraído de chart-communication.js
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Responsabilidade: Gerenciar filtros globais multi-dimensionais (Power BI style)
 */

/// <reference path="./global.d.ts" />

(function() {
  'use strict';

  // REFATORAÇÃO FASE 3: Usar APENAS window.eventBus global (único event bus)
  // event-bus.js é carregado antes deste módulo no HTML
  const win = window as Window & { eventBus?: EventBus };
  if (!win.eventBus) {
    if ((window as any).Logger) {
      (window as any).Logger.error('eventBus global não encontrado. Verifique se event-bus.js está carregado antes de global-filters.js');
    }
    throw new Error('eventBus global não encontrado. Carregue event-bus.js antes de global-filters.js');
  }
  const eventBus: EventBus = win.eventBus;

  // ============================================
  // GLOBAL FILTERS - Sistema de Filtros Globais
  // ============================================
  
  const globalFilters: GlobalFilters = {
    filters: [],
    activeField: null,
    activeValue: null,
    persist: false, // FILTROS LOCAIS POR PÁGINA: Não persistir entre páginas
    _debounceTimer: null, // Timer para debounce
    _pendingFilter: null, // Filtro pendente durante debounce
    
    /**
     * Aplicar filtro global com debounce
     * @param field - Campo a filtrar
     * @param value - Valor do filtro
     * @param chartId - ID do gráfico que aplicou o filtro
     * @param options - Opções adicionais
     */
    apply(field: string, value: string, chartId: string | null = null, options: FilterOptions = {}): void {
      // OTIMIZAÇÃO: Debounce de 300ms para evitar múltiplas requisições
      const debounceDelay = options.debounce !== undefined ? options.debounce : 300;
      
      // Cancelar timer anterior se existir
      if (this._debounceTimer && window.timerManager?.clearTimeout) {
        window.timerManager.clearTimeout(this._debounceTimer);
      } else if (this._debounceTimer) {
        clearTimeout(this._debounceTimer);
      }
      
      // Guardar filtro pendente
      this._pendingFilter = { field, value, chartId, options };
      
      // Criar novo timer
      const applyFilter = () => {
        this._debounceTimer = null;
        const pending = this._pendingFilter;
        this._pendingFilter = null;
        if (pending) {
          this._applyImmediate(pending.field, pending.value, pending.chartId, pending.options);
        }
      };
      
      if (window.timerManager?.setTimeout) {
        this._debounceTimer = window.timerManager.setTimeout(applyFilter, debounceDelay, 'filter-debounce');
      } else {
        this._debounceTimer = setTimeout(applyFilter, debounceDelay) as any;
      }
    },
    
    /**
     * Aplicar filtro imediatamente (sem debounce)
     * @private
     * 
     * CROSSFILTER MULTI-DIMENSIONAL (Power BI Style):
     * - clearPrevious: false por padrão (permite múltiplos filtros simultâneos)
     * - toggle: true por padrão (clicar novamente remove o filtro)
     * - Suporta múltiplos filtros: Status + Tema + Órgão + etc.
     */
    _applyImmediate(field: string, value: string, chartId: string | null = null, options: FilterOptions = {}): void {
      // MUDANÇA: clearPrevious = false por padrão (sistema Power BI multi-dimensional)
      const { toggle = true, operator = 'eq', clearPrevious = false } = options;
      
      if (window.Logger) {
        window.Logger.debug?.(`Aplicando filtro: ${field} = ${value}`, {
          filtrosAntes: this.filters.length,
          clearPrevious,
          toggle,
          modo: 'crossfilter-multi-dimensional'
        });
      }
      
      // Verificar se já existe filtro para este campo e valor exato
      const existingIndex = this.filters.findIndex(f => f.field === field && f.value === value);
      const filterExists = existingIndex > -1;
      
      // Se clearPrevious estiver habilitado, limpar todos os filtros anteriores
      if (clearPrevious && this.filters.length > 0) {
        if (window.Logger) {
          window.Logger.debug?.(`Limpando ${this.filters.length} filtro(s) anterior(es) (clearPrevious=true)`);
        }
        this.filters = [];
      }
      
      // Se o filtro já existia e toggle está habilitado, remover (comportamento de toggle)
      if (filterExists && toggle) {
        // Remover filtro existente
        this.filters.splice(existingIndex, 1);
        
        // Atualizar activeField/activeValue se necessário
        if (this.filters.length === 0) {
          this.activeField = null;
          this.activeValue = null;
        } else {
          // Manter o último filtro como ativo
          const lastFilter = this.filters[this.filters.length - 1];
          this.activeField = lastFilter.field;
          this.activeValue = lastFilter.value;
        }
        
        if (window.Logger) {
          window.Logger.debug?.(`Filtro removido (toggle). Total de filtros: ${this.filters.length}`);
        }
        
        // Persistir se habilitado
        if (this.persist) {
          this.save();
        }
        
        // Invalidar dados no dataStore
        this.invalidateData();
        
        // Atualizar UI
        this.updateUI();
        
        // Notificar todos os gráficos registrados para se atualizarem
        this.notifyAllCharts();
        
        // Emitir evento apropriado
        if (this.filters.length === 0) {
          eventBus.emit('filter:cleared', {});
        } else {
          eventBus.emit('filter:removed', { field, value, filters: [...this.filters] });
        }
      } else if (!filterExists) {
        // Adicionar novo filtro (não existe ainda)
        this.filters.push({ field, value, operator, chartId });
        this.activeField = field;
        this.activeValue = value;
        
        if (window.Logger) {
          window.Logger.debug?.(`Filtro adicionado. Total de filtros: ${this.filters.length}`);
        }
        
        // Persistir se habilitado
        if (this.persist) {
          this.save();
        }
        
        // Invalidar dados no dataStore
        this.invalidateData();
        
        // Atualizar UI
        this.updateUI();
        
        // Notificar todos os gráficos registrados para se atualizarem
        this.notifyAllCharts();
        
        // Emitir evento de filtro aplicado
        eventBus.emit('filter:applied', { field, value, chartId, filters: [...this.filters] });
      }
    },
    
    /**
     * Limpar todos os filtros
     */
    clear(): void {
      this.filters = [];
      this.activeField = null;
      this.activeValue = null;
      
      // Limpar do localStorage também
      try {
        localStorage.removeItem('dashboardFilters');
      } catch (e) {
        // Ignorar erros
      }
      
      if (this.persist) {
        this.save(); // Salvar estado vazio
      }
      
      eventBus.emit('filter:cleared', {});
      this.invalidateData();
      this.updateUI();
      
      // Notificar todos os gráficos registrados para se atualizarem
      this.notifyAllCharts();
    },
    
    /**
     * Remover filtro específico
     * @param field - Campo do filtro
     * @param value - Valor do filtro
     */
    remove(field: string, value: string): void {
      const index = this.filters.findIndex(f => f.field === field && f.value === value);
      if (index > -1) {
        this.filters.splice(index, 1);
        if (this.activeField === field && this.activeValue === value) {
          this.activeField = null;
          this.activeValue = null;
        }
        
        if (this.persist) {
          this.save();
        }
        
        eventBus.emit('filter:removed', { field, value });
        this.invalidateData();
        this.updateUI();
        
        // Notificar todos os gráficos registrados para se atualizarem
        this.notifyAllCharts();
      }
    },
    
    /**
     * Verificar se um filtro está ativo
     * @param field - Campo
     * @param value - Valor
     * @returns true se o filtro está ativo
     */
    isActive(field: string, value: string): boolean {
      return this.filters.some(f => f.field === field && f.value === value);
    },
    
    /**
     * Salvar filtros no localStorage
     * Só salva se houver filtros ativos (não salva array vazio)
     */
    save(): void {
      try {
        // Se não há filtros, remover do localStorage
        if (this.filters.length === 0) {
          localStorage.removeItem('dashboardFilters');
          return;
        }
        
        // Salvar apenas se houver filtros
        localStorage.setItem('dashboardFilters', JSON.stringify({
          filters: this.filters,
          activeField: this.activeField,
          activeValue: this.activeValue
        }));
      } catch (e) {
        // Ignorar erros de localStorage
      }
    },
    
    /**
     * Carregar filtros do localStorage
     * FILTROS LOCAIS POR PÁGINA: Nunca carregar filtros salvos (sempre limpar)
     */
    load(restoreFilters: boolean = false): void {
      // FILTROS LOCAIS POR PÁGINA: Sempre limpar filtros ao inicializar
      // Não restaurar filtros entre sessões ou páginas
      try {
        // Limpar filtros do localStorage para evitar persistência indesejada
        localStorage.removeItem('dashboardFilters');
        if (window.Logger) {
          window.Logger.debug?.('🔄 Filtros do localStorage limpos (sistema local por página)');
        }
      } catch (e) {
        // Ignorar erros
      }
      
      // Sempre limpar filtros na memória também
      this.filters = [];
      this.activeField = null;
      this.activeValue = null;
    },
    
    /**
     * Invalidar dados no dataStore
     */
    invalidateData(): void {
      if (window.dataStore) {
        const keysToInvalidate = [
          'dashboardData',
          '/api/dashboard-data',
          '/api/summary',
          '/api/aggregate/by-month',
          '/api/aggregate/by-day',
          '/api/aggregate/by-theme',
          '/api/aggregate/by-subject',
          '/api/aggregate/count-by',
          '/api/stats/status-overview'
        ];
        
        window.dataStore.invalidate?.(keysToInvalidate);
        
        // Notificar recarregamento se necessário
        if (window.reloadAllData) {
          setTimeout(() => {
            window.reloadAllData?.();
          }, 100);
        }
      }
    },
    
    /**
     * Atualizar UI (indicadores, títulos, etc.)
     */
    updateUI(): void {
      // Atualizar indicador de filtros
      this.updateFilterIndicator();
      
      // Atualizar título da página
      this.updatePageTitle();
      
      // Atualizar realces visuais
      this.updateHighlights();
    },
    
    /**
     * Atualizar indicador de filtros ativos
     * CROSSFILTER MULTI-DIMENSIONAL: Mostra todos os filtros ativos com pills removíveis
     */
    updateFilterIndicator(): void {
      // Ocultar banner se existir
      const indicator = document.getElementById('filterIndicator');
      if (indicator) {
        indicator.classList.add('hidden');
        indicator.innerHTML = ''; // Limpar conteúdo
      }
      return; // Retornar imediatamente sem atualizar
    },
    
    /**
     * Obter emoji para um campo (para melhor UX visual)
     */
    getFieldEmoji(field: string): string {
      const emojiMap: Record<string, string> = {
        'Status': '📊',
        'Tema': '🏷️',
        'Assunto': '📝',
        'Orgaos': '🏛️',
        'Tipo': '📋',
        'Canal': '📞',
        'Prioridade': '⚡',
        'Setor': '🏢',
        'Categoria': '📂',
        'Bairro': '📍',
        'UAC': '🏘️',
        'Responsavel': '👤',
        'Secretaria': '🏛️',
        'Unidade': '🏥',
        'Data': '📅',
        'Departamento': '🏢'
      };
      return emojiMap[field] || '🔍';
    },
    
    /**
     * Obter label amigável para um campo
     */
    getFieldLabel(field: string): string {
      const fieldLabels: Record<string, string> = {
        'Status': 'Status',
        'Tema': 'Tema',
        'Assunto': 'Assunto',
        'Orgaos': 'Órgão',
        'Tipo': 'Tipo',
        'Canal': 'Canal',
        'Prioridade': 'Prioridade',
        'Setor': 'Setor',
        'Categoria': 'Categoria',
        'Bairro': 'Bairro',
        'UAC': 'UAC',
        'Responsavel': 'Responsável',
        'Secretaria': 'Secretaria',
        'Data': 'Data'
      };
      return fieldLabels[field] || field;
    },
    
    /**
     * Atualizar título da página
     */
    updatePageTitle(): void {
      const pageTitle = document.querySelector('[data-page-title]');
      if (pageTitle && this.filters.length > 0) {
        pageTitle.classList.add('filter-active-title');
      } else if (pageTitle) {
        pageTitle.classList.remove('filter-active-title');
      }
    },
    
    /**
     * Atualizar realces visuais de elementos filtrados
     */
    updateHighlights(): void {
      // Remover realces anteriores
      document.querySelectorAll('[data-filter-highlight]').forEach(el => {
        el.classList.remove('filter-active');
        el.removeAttribute('data-filter-highlight');
      });
      
      // Aplicar realces aos elementos filtrados
      this.filters.forEach(filter => {
        document.querySelectorAll(`[data-filter-field="${filter.field}"][data-filter-value="${filter.value}"]`).forEach(el => {
          el.classList.add('filter-active');
          el.setAttribute('data-filter-highlight', filter.field);
        });
      });
    },
    
    /**
     * Notificar todos os gráficos registrados para se atualizarem
     * FILTROS LOCAIS POR PÁGINA: Só notifica gráficos da página visível
     * OTIMIZADO: Notifica apenas gráficos da página atual
     */
    notifyAllCharts(): void {
      if (window.chartCommunication) {
        // FILTROS LOCAIS POR PÁGINA: Identificar página atual visível
        const visiblePage = this.getCurrentVisiblePage();
        
        if (window.Logger) {
          window.Logger.debug?.(`🔄 Notificando gráficos da página: ${visiblePage || 'todas'}`);
        }
        
        // Emitir evento para que gráficos reativos se atualizem
        // Os listeners de página vão verificar se a página está visível antes de atualizar
        eventBus.emit('charts:update-requested', {
          filters: [...this.filters],
          activeField: this.activeField,
          activeValue: this.activeValue,
          pageId: visiblePage // Informar qual página está visível
        });
        
        // INTERLIGAÇÃO: Atualizar estado visual de KPIs (só se a página estiver visível)
        if (visiblePage) {
          if (typeof (window as any).updateKPIsVisualState === 'function') {
            (window as any).updateKPIsVisualState();
          }
        }
        
        // INTERLIGAÇÃO: Notificar gráficos Chart.js através de elementos canvas
        // O Chart.js não expõe Chart.instances como array, então iteramos sobre os canvas
        if (window.Chart && typeof window.Chart.getChart === 'function') {
          try {
            // Buscar todos os elementos canvas que podem ter gráficos
            // FILTROS LOCAIS: Só atualizar gráficos da página visível
            const selector = visiblePage ? `#${visiblePage} canvas[id]` : 'canvas[id]';
            document.querySelectorAll(selector).forEach(canvas => {
              try {
                const chart = window.Chart!.getChart(canvas as HTMLCanvasElement);
                if (chart && typeof chart.update === 'function') {
                  // Não atualizar aqui, deixar que os dados sejam recarregados primeiro
                  // Os gráficos serão atualizados quando os dados forem recarregados
                  // chart.update('none');
                }
              } catch (e) {
                // Ignorar erros ao acessar gráficos individuais
              }
            });
          } catch (e) {
            // Ignorar erros ao iterar sobre canvas
            if (window.Logger) {
              window.Logger.debug?.('Erro ao acessar instâncias Chart.js:', e);
            }
          }
        }
      }
    },
    
    /**
     * Obter página atual visível
     * FILTROS LOCAIS POR PÁGINA: Identifica qual página está sendo exibida
     * @returns ID da página visível ou null
     */
    getCurrentVisiblePage(): string | null {
      const pagesContainer = document.getElementById('pages');
      if (!pagesContainer) return null;
      
      // Buscar seção visível
      const visiblePage = Array.from(pagesContainer.children).find(page => {
        if (page.tagName !== 'SECTION') return false;
        const style = window.getComputedStyle(page);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      
      return visiblePage ? visiblePage.id : null;
    }
  };

  // Carregar filtros salvos ao inicializar
  globalFilters.load();

  // Exportar para uso global
  if (typeof window !== 'undefined') {
    window.globalFilters = globalFilters;
  }

  // Exportar para módulos ES6 (se disponível)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalFilters;
  }

})();

