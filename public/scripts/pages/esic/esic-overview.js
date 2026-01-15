/**
 * ============================================================================
 * PÁGINA: e-SIC - VISÃO GERAL
 * ============================================================================
 * 
 * Esta página apresenta uma visão consolidada e abrangente de todas as
 * solicitações de informação (e-SIC), fornecendo um dashboard executivo com os
 * principais indicadores e gráficos de síntese.
 * 
 * DADOS EXIBIDOS:
 * - KPIs principais (total, encerradas, em aberto, tempo médio)
 * - Distribuição por status (gráfico de rosca)
 * - Top tipos de informação (gráfico de barras horizontal)
 * - Distribuição por responsável (gráfico de barras horizontal)
 * - Evolução mensal (gráfico de linha)
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - status: Status atual da solicitação
 * - tipoInformacao: Tipo de informação solicitada
 * - responsavel: Responsável pela solicitação
 * - unidadeContato: Unidade de contato
 * - canal: Canal de entrada
 * - dataCriacaoIso: Data de criação normalizada
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicOverview = window.loadEsicOverview || function () { return Promise.resolve(); };

async function loadEsicOverview() {
  if (window.Logger) {
    window.Logger.debug('📋 loadEsicOverview: Iniciando');
  }

  const page = document.getElementById('page-esic-overview');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }

  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'esic-chart-status',
        'esic-chart-tipo-informacao',
        'esic-chart-responsavel',
        'esic-chart-mensal'
      ]);
    }

    // Carregar estatísticas
    const stats = await window.dataLoader?.load('/api/esic/stats', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};

    // Atualizar KPIs
    const kpiTotal = document.getElementById('esic-kpi-total');
    const kpiEncerradas = document.getElementById('esic-kpi-encerradas');
    const kpiAbertas = document.getElementById('esic-kpi-abertas');
    const kpiTempo = document.getElementById('esic-kpi-tempo');

    if (kpiTotal) kpiTotal.textContent = stats.total?.toLocaleString('pt-BR') || '—';
    if (kpiEncerradas) kpiEncerradas.textContent = stats.encerrados?.toLocaleString('pt-BR') || '—';
    if (kpiAbertas) kpiAbertas.textContent = stats.emAberto?.toLocaleString('pt-BR') || '—';
    if (kpiTempo) kpiTempo.textContent = stats.tempoMedioResolucao ? `${stats.tempoMedioResolucao} dias` : '—';

    // Carregar dados por status
    const statusData = await window.dataLoader?.load('/api/esic/count-by?field=status', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (statusData.length > 0) {
      const labels = statusData.map(d => d.key || d._id || 'N/A');
      const values = statusData.map(d => d.count || 0);
      // PADRONIZAÇÃO: Usar campo 'status' para cores padronizadas
      const chartStatus = await window.chartFactory?.createDoughnutChart('esic-chart-status', labels, values, {
        onClick: true, // Habilitar interatividade para crossfilter
        field: 'status' // Especificar campo para usar cores padronizadas do config.js
      });

      // CROSSFILTER: Adicionar sistema de filtros
      if (chartStatus && statusData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartStatus, statusData, {
          field: 'status',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicOverview) setTimeout(() => window.loadEsicOverview(), 100);
          }
        });
      }
    }

    // Carregar dados por tipo de informação
    const tipoInformacaoData = await window.dataLoader?.load('/api/esic/count-by?field=tipoInformacao', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (tipoInformacaoData.length > 0) {
      const labels = tipoInformacaoData.slice(0, 10).map(d => d.key || d._id || 'N/A');
      const values = tipoInformacaoData.slice(0, 10).map(d => d.count || 0);
      const chartTipo = await window.chartFactory?.createBarChart('esic-chart-tipo-informacao', labels, values, {
        horizontal: true,
        colorIndex: 1,
        field: 'tipoInformacao',
        onClick: true // Habilitar interatividade para crossfilter
      });

      // CROSSFILTER: Adicionar sistema de filtros
      if (chartTipo && tipoInformacaoData.slice(0, 10) && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartTipo, tipoInformacaoData.slice(0, 10), {
          field: 'tipoInformacao',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicOverview) setTimeout(() => window.loadEsicOverview(), 100);
          }
        });
      }
    }

    // Carregar Canais por Unidade (Stacked Bar)
    const canalUnidadeData = await window.dataLoader?.load('/api/esic/by-canal-unidade', {
      useDataStore: true,
      ttl: 15 * 60 * 1000
    }) || {};

    if (Object.keys(canalUnidadeData).length > 0) {
      const canais = Object.keys(canalUnidadeData);
      const unidades = [...new Set(canais.flatMap(c => Object.keys(canalUnidadeData[c])))];

      const datasets = unidades.slice(0, 8).map((unidade, idx) => ({
        label: unidade,
        data: canais.map(c => canalUnidadeData[c][unidade] || 0),
        colorIndex: idx
      }));

      await window.chartFactory?.createBarChart('esic-chart-canal-unidade', canais, datasets, {
        horizontal: true,
        chartOptions: {
          scales: {
            x: { stacked: true },
            y: { stacked: true }
          }
        }
      });
    }

    // Carregar Categorias Temáticas (via categorias-por-assunto)
    const temaData = await window.dataLoader?.load('/api/esic/categorias-por-assunto?limit=10', {
      useDataStore: true,
      ttl: 30 * 60 * 1000
    }) || {};

    if (temaData.tipos && temaData.tipos.length > 0) {
      const labels = temaData.tipos.map(t => t.tipoInformacao);
      const values = temaData.tipos.map(t => t.total || 0);
      await window.chartFactory?.createBarChart('esic-chart-tematico', labels, values, {
        horizontal: true,
        colorIndex: 5,
        label: 'Ocorrências'
      });
    }

    // Carregar SLA Compliance
    const slaData = await window.dataLoader?.load('/api/esic/sla', {
      useDataStore: true,
      ttl: 15 * 60 * 1000
    }) || { percentual: 0 };

    const slaValue = document.getElementById('esic-sla-value');
    if (slaValue) {
      slaValue.textContent = `${slaData.percentual}%`;
      // Mudar cor baseado no valor
      if (slaData.percentual >= 80) slaValue.className = 'text-4xl font-bold text-emerald-400 neon';
      else if (slaData.percentual >= 50) slaValue.className = 'text-4xl font-bold text-amber-400 neon';
      else slaValue.className = 'text-4xl font-bold text-rose-400 neon';
    }

    // Carregar dados mensais
    const mensalData = await window.dataLoader?.load('/api/esic/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (mensalData.length > 0) {
      const labels = mensalData.map(d => {
        const month = d.month || d.ym || d._id?.month || '';
        if (month.includes('-')) {
          const [year, monthNum] = month.split('-');
          return `${monthNum}/${year}`;
        }
        return month;
      });
      const values = mensalData.map(d => d.count || 0);
      await window.chartFactory?.createLineChart('esic-chart-mensal', labels, values, {
        colorIndex: 3
      });
    }

    if (window.Logger) {
      window.Logger.success('📋 loadEsicOverview: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Visão Geral e-SIC:', error);
    }
  }
}

// Expor função completa
window.loadEsicOverview = loadEsicOverview;

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-overview', loadEsicOverview, 500);
}

