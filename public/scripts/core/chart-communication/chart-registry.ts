/**
 * Chart Registry - Registro e Mapeamento de Gráficos
 * 
 * REFATORAÇÃO: Extraído de chart-communication.js
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Responsabilidade: Registrar gráficos, mapear campos e fornecer feedback visual
 */

/// <reference path="./global.d.ts" />

(function() {
  'use strict';

  // REFATORAÇÃO FASE 3: Usar APENAS window.eventBus global (único event bus)
  // event-bus.js é carregado antes deste módulo no HTML
  const win = window as Window & { eventBus?: EventBus };
  if (!win.eventBus) {
    if ((window as any).Logger) {
      (window as any).Logger.error('eventBus global não encontrado. Verifique se event-bus.js está carregado antes de chart-registry.js');
    }
    throw new Error('eventBus global não encontrado. Carregue event-bus.js antes de chart-registry.js');
  }
  const eventBus: EventBus = win.eventBus;

  // ============================================
  // CHART FIELD MAP - Mapeamento de Campos
  // ============================================
  
  const chartFieldMap: Record<string, FieldMapping> = {
    // Overview
    'chartStatus': { field: 'Status', op: 'eq' },
    'chartStatusPage': { field: 'Status', op: 'eq' },
    'chartStatusTema': { field: 'Status', op: 'eq' },
    'chartStatusAssunto': { field: 'Status', op: 'eq' },
    'chartTrend': { field: 'Data', op: 'contains' },
    'chartTopOrgaos': { field: 'Orgaos', op: 'contains' },
    'chartTopOrgaosBar': { field: 'Orgaos', op: 'contains' },
    'chartTopTemas': { field: 'Tema', op: 'eq' },
    'chartFunnelStatus': { field: 'Status', op: 'eq' },
    'chartSlaOverview': { field: null, op: null },
    'chartSLA': { field: null, op: null }, // SLA não deve filtrar
    'chartTiposManifestacao': { field: 'Tipo', op: 'eq' },
    'chartCanais': { field: 'Canal', op: 'eq' },
    'chartPrioridades': { field: 'Prioridade', op: 'eq' },
    'chartUnidadesCadastro': { field: 'Unidade', op: 'contains' },
    'chartDailyDistribution': { field: 'Data', op: 'contains' },
    
    // Status
    'chartStatusMes': { field: 'Data', op: 'contains' },
    
    // Tema
    'chartTema': { field: 'Tema', op: 'eq' },
    'chartTemaMes': { field: 'Data', op: 'contains' },
    
    // Assunto
    'chartAssunto': { field: 'Assunto', op: 'contains' },
    'chartAssuntoMes': { field: 'Data', op: 'contains' },
    
    // Tipo
    'chartTipo': { field: 'Tipo', op: 'eq' },
    
    // Órgão e Mês
    'chartOrgaoMes': { field: 'Data', op: 'contains' }, // Filtra por mês quando clicado
    'chartOrgaos': { field: 'Orgaos', op: 'contains' }, // Filtra por órgão quando clicado
    
    // Secretaria
    'chartSecretaria': { field: 'Secretaria', op: 'contains' },
    'chartSecretariaMes': { field: 'Data', op: 'contains' },
    'chartSecretariasDistritos': { field: 'Secretaria', op: 'contains' },
    
    // Setor
    'chartSetor': { field: 'Setor', op: 'contains' },
    
    // Categoria
    'chartCategoria': { field: 'Categoria', op: 'eq' },
    'chartCategoriaMes': { field: 'Data', op: 'contains' },
    
    // Bairro
    'chartBairro': { field: 'Bairro', op: 'contains' },
    'chartBairroMes': { field: 'Data', op: 'contains' },
    
    // UAC
    'chartUAC': { field: 'UAC', op: 'contains' },
    
    // Responsável
    'chartResponsavel': { field: 'Responsavel', op: 'contains' },
    
    // Canal
    'chartCanal': { field: 'Canal', op: 'eq' },
    
    // Prioridade
    'chartPrioridade': { field: 'Prioridade', op: 'eq' },
    
    // Tempo Médio
    'chartTempoMedio': { field: 'Orgaos', op: 'contains' },
    'chartTempoMedioMes': { field: 'Data', op: 'contains' },
    'chartTempoMedioDia': { field: 'Data', op: 'contains' },
    'chartTempoMedioSemana': { field: 'Data', op: 'contains' },
    'chartTempoMedioUnidade': { field: 'Unidade', op: 'contains' },
    'chartTempoMedioUnidadeMes': { field: 'Data', op: 'contains' },
    
    // Cadastrante
    'chartCadastranteMes': { field: 'Data', op: 'contains' },
    
    // Reclamações
    'chartReclamacoesTipo': { field: 'Tipo', op: 'eq' },
    'chartReclamacoesMes': { field: 'Data', op: 'contains' },
    
    // Projeção
    'chartProjecaoMensal': { field: 'Data', op: 'contains' },
    'chartCrescimentoPercentual': { field: 'Data', op: 'contains' },
    'chartComparacaoAnual': { field: 'Data', op: 'contains' },
    'chartSazonalidade': { field: 'Data', op: 'contains' },
    'chartProjecaoTema': { field: 'Tema', op: 'eq' },
    'chartProjecaoTipo': { field: 'Tipo', op: 'eq' },
    
    // Unidades de Saúde (dinâmico)
    'chartUnitTipos': { field: 'Tipo', op: 'eq' },
    
    // Zeladoria
    'zeladoria-chart-status': { field: 'Status', op: 'eq' },
    'zeladoria-chart-categoria': { field: 'Categoria', op: 'eq' },
    'zeladoria-chart-departamento': { field: 'Departamento', op: 'contains' },
    'zeladoria-chart-mensal': { field: 'Data', op: 'contains' },
    'zeladoria-status-chart': { field: 'Status', op: 'eq' },
    'zeladoria-categoria-chart': { field: 'Categoria', op: 'eq' },
    'zeladoria-departamento-chart': { field: 'Departamento', op: 'contains' },
    'zeladoria-bairro-chart': { field: 'Bairro', op: 'contains' },
    'zeladoria-responsavel-chart': { field: 'Responsavel', op: 'contains' },
    'zeladoria-canal-chart': { field: 'Canal', op: 'eq' },
    'zeladoria-tempo-chart': { field: 'Data', op: 'contains' },
    'zeladoria-tempo-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-tempo-distribuicao-chart': { field: null, op: null }, // Distribuição não filtra
    'zeladoria-mensal-chart': { field: 'Data', op: 'contains' },
    'zeladoria-bairro-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-canal-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-responsavel-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-departamento-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-categoria-mes-chart': { field: 'Data', op: 'contains' },
    'zeladoria-categoria-dept-chart': { field: 'Departamento', op: 'contains' },
    'zeladoria-status-mes-chart': { field: 'Data', op: 'contains' },
    'chartZeladoriaStatus': { field: 'Status', op: 'eq' },
    'chartZeladoriaCategoria': { field: 'Categoria', op: 'eq' },
    
    // Outros
    'chartMonth': { field: 'Data', op: 'contains' }
  };

  // ============================================
  // FEEDBACK SYSTEM - Sistema de Feedback Visual
  // ============================================
  
  const feedback: Feedback = {
    /**
     * Mostrar feedback visual de clique em gráfico
     * @param chartId - ID do gráfico
     * @param label - Label clicado
     * @param value - Valor clicado
     */
    show(chartId: string, label: string, value: number): void {
      // Criar elemento de feedback se não existir
      let feedbackEl = document.getElementById('chartFeedback');
      if (!feedbackEl) {
        feedbackEl = document.createElement('div');
        feedbackEl.id = 'chartFeedback';
        feedbackEl.className = 'fixed top-4 right-4 bg-slate-800/90 border border-cyan-500/50 rounded-lg px-4 py-2 text-sm text-slate-200 z-50 shadow-lg';
        feedbackEl.style.display = 'none';
        document.body.appendChild(feedbackEl);
      }
      
      // Atualizar conteúdo
      feedbackEl.innerHTML = `
        <div class="font-semibold text-cyan-300">${label}</div>
        <div class="text-xs text-slate-400">${value.toLocaleString('pt-BR')} registros</div>
      `;
      
      // Mostrar
      feedbackEl.style.display = 'block';
      
      // Ocultar após 2 segundos
      setTimeout(() => {
        if (feedbackEl) {
          feedbackEl.style.display = 'none';
        }
      }, 2000);
    }
  };

  // ============================================
  // CHART REGISTRY - Registro de Gráficos
  // ============================================
  
  const chartRegistry: ChartRegistry = {
    charts: new Map<string, ChartRegistryEntry>(),
    
    /**
     * Registrar gráfico
     * @param chartId - ID do gráfico
     * @param config - Configuração do gráfico
     */
    register(chartId: string, config: ChartConfig): void {
      this.charts.set(chartId, {
        ...config,
        id: chartId,
        createdAt: Date.now()
      });
      
      eventBus.emit('chart:registered', { chartId, config });
    },
    
    /**
     * Desregistrar gráfico
     * @param chartId - ID do gráfico
     */
    unregister(chartId: string): void {
      this.charts.delete(chartId);
      eventBus.emit('chart:unregistered', { chartId });
    },
    
    /**
     * Obter gráfico registrado
     * @param chartId - ID do gráfico
     * @returns Configuração do gráfico ou null
     */
    get(chartId: string): ChartRegistryEntry | null {
      return this.charts.get(chartId) || null;
    },
    
    /**
     * Obter todos os gráficos
     * @returns Array de configurações
     */
    getAll(): ChartRegistryEntry[] {
      return Array.from(this.charts.values());
    },
    
    /**
     * Obter gráficos por campo
     * @param field - Campo
     * @returns Array de configurações
     */
    getByField(field: string): ChartRegistryEntry[] {
      return this.getAll().filter(chart => {
        const mapping = chartFieldMap[chart.id];
        return mapping && mapping.field === field;
      });
    },
    
    /**
     * Obter mapeamento de campo para um gráfico
     * @param chartId - ID do gráfico
     * @returns Mapeamento ou null
     */
    getFieldMapping(chartId: string): FieldMapping | null {
      return chartFieldMap[chartId] || null;
    },
    
    /**
     * Obter todos os mapeamentos
     * @returns Objeto com todos os mapeamentos
     */
    getFieldMappings(): Record<string, FieldMapping> {
      return { ...chartFieldMap };
    }
  };

  // Exportar para uso global
  if (typeof window !== 'undefined') {
    window.chartRegistry = chartRegistry;
    window.chartFieldMap = chartFieldMap;
    window.chartFeedback = feedback;
  }

  // Exportar para módulos ES6 (se disponível)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { chartRegistry, chartFieldMap, feedback };
  }

})();

