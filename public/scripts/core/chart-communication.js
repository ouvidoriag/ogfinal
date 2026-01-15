/**
 * Chart Communication System - Sistema Global de Comunicação entre Gráficos
 * 
 * REFATORAÇÃO: Modularizado em 4 módulos separados
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * MIGRAÇÃO TYPESCRIPT: Módulos migrados para TypeScript
 * Módulos:
 * - event-bus.ts: Sistema de eventos global
 * - global-filters.ts: Sistema de filtros globais
 * - chart-registry.ts: Registro de gráficos e mapeamento de campos
 * - auto-connect.ts: Auto-conexão de páginas
 * 
 * Este arquivo agora apenas integra os módulos e mantém compatibilidade
 */

(function() {
  'use strict';

  // REFATORAÇÃO FASE 3: Usar APENAS window.eventBus global (único event bus)
  // Aguardar que os módulos sejam carregados
  // Os módulos são carregados antes deste arquivo no HTML
  
  // Verificar se os módulos foram carregados
  const eventBus = window.eventBus;
  const globalFilters = window.globalFilters;
  const chartRegistry = window.chartRegistry;
  const chartFieldMap = window.chartFieldMap;
  const chartFeedback = window.chartFeedback;
  const createPageFilterListener = window.createPageFilterListener;
  const autoConnectAllPages = window.autoConnectAllPages;

  // Se os módulos não foram carregados, criar fallback básico
  if (!eventBus || !globalFilters || !chartRegistry) {
    if (window.Logger) {
      window.Logger.error('Módulos do chart-communication não foram carregados. Verifique a ordem dos scripts no HTML.');
    }
    return;
  }
  
  // Verificar que estamos usando o eventBus global único
  if (eventBus !== window.eventBus) {
    if (window.Logger) {
      window.Logger.warn('Atenção: eventBus não é o global. Usando window.eventBus.');
    }
  }

  // ============================================
  // EXPORT - Exportar para window
  // ============================================
  
  if (typeof window !== 'undefined') {
    window.chartCommunication = {
      // Event Bus
      on: eventBus.on.bind(eventBus),
      emit: eventBus.emit.bind(eventBus),
      off: eventBus.off.bind(eventBus),
      
      // Global Filters
      filters: globalFilters,
      applyFilter: globalFilters.apply.bind(globalFilters),
      clearFilters: globalFilters.clear.bind(globalFilters),
      removeFilter: globalFilters.remove.bind(globalFilters),
      isFilterActive: globalFilters.isActive.bind(globalFilters),
      
      // Chart Field Map
      chartFieldMap: chartFieldMap || {},
      getFieldMapping: (chartId) => {
        if (chartRegistry && chartRegistry.getFieldMapping) {
          return chartRegistry.getFieldMapping(chartId);
        }
        return (chartFieldMap && chartFieldMap[chartId]) || null;
      },
      
      // Feedback
      showFeedback: chartFeedback ? chartFeedback.show.bind(chartFeedback) : () => {},
      
      // Chart Registry
      registerChart: chartRegistry.register.bind(chartRegistry),
      unregisterChart: chartRegistry.unregister.bind(chartRegistry),
      getChart: chartRegistry.get.bind(chartRegistry),
      getAllCharts: chartRegistry.getAll.bind(chartRegistry),
      getChartsByField: chartRegistry.getByField.bind(chartRegistry),
      
      // Page Filter Listener
      createPageFilterListener: createPageFilterListener || (() => {}),
      
      // Auto-connect
      autoConnectAllPages: autoConnectAllPages || (() => {})
    };
    
    // Expor globalmente para compatibilidade
    window.globalFilters = globalFilters;
    window.chartFieldMap = chartFieldMap || {};
    window.showClickFeedback = chartFeedback ? chartFeedback.show.bind(chartFeedback) : () => {};
    
    if (window.Logger) {
      window.Logger.success('✅ Sistema de Comunicação entre Gráficos inicializado (modularizado)');
    }
    
  }
})();
