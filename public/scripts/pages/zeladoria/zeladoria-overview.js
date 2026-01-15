/**
 * ============================================================================
 * PÁGINA: ZELADORIA - VISÃO GERAL (AVANÇADA)
 * ============================================================================
 */

/**
 * Estado Global do Crossfilter para Zeladoria
 */
window.crossfilterZeladoria = {
  filters: {
    status: null,
    categoria: null,
    departamento: null,
    bairro: null,
    responsavel: null,
    origem: null
  },


  apply(field, value, isToggle = false) {
    if (isToggle) {
      this.filters[field] = this.filters[field] === value ? null : value;
    } else {
      this.filters[field] = value;
    }

    if (window.Logger) {
      window.Logger.debug(`🔄 Crossfilter Zeladoria: ${field} = ${value}`);
    }

    // Recarregar dashboard com filtros
    loadZeladoriaOverview(true);
  },

  clear() {
    Object.keys(this.filters).forEach(k => this.filters[k] = null);
    loadZeladoriaOverview(true);
  }
};

/**
 * Carregar e renderizar a visão geral de Zeladoria
 */
async function loadZeladoriaOverview(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('🏗️ loadZeladoriaOverview: Iniciando carregamento avançado');
  }

  // Mostrar loading
  if (window.loadingManager) window.loadingManager.show('Carregando panorama avançado de zeladoria...');

  try {
    // Coletar filtros ativos (incluindo crossfilter)
    const activeFilters = [];
    Object.entries(window.crossfilterZeladoria.filters).forEach(([f, v]) => {
      if (v) {
        const map = {
          status: 'status',
          categoria: 'categoria',
          departamento: 'departamento',
          bairro: 'bairro',
          responsavel: 'responsavel',
          origem: 'origem'
        };
        activeFilters.push({ field: map[f] || f, op: 'eq', value: v });
      }
    });

    // Nota: Por enquanto, carregamos as agregações separadamente. 
    // Em uma versão futura, podemos usar /api/zeladoria/aggregated passando activeFilters.

    // Carregar dados básicos e avançados em paralelo
    const [stats, byStatus, byCategory, byDept, byMonth, byBairro, byCatDept, avgTime, engagement, funnel, efficiency, recurrence, byResponsavel, byOrigem] = await Promise.all([
      window.dataLoader.load('/api/zeladoria/stats', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=status', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=categoria', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=departamento', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/by-month', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=bairro', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/by-categoria-departamento', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/average-time-category', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/engagement', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/funnel', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/efficiency-by-dept', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/efficiency-by-dept', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/recurrence', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=responsavel', { useDataStore: !forceRefresh }),
      window.dataLoader.load('/api/zeladoria/count-by?field=origem', { useDataStore: !forceRefresh })
    ]);

    // Atualizar KPIs
    if (stats) {
      updateZeladoriaKPIs(stats);
    }

    // Renderizar Gráficos
    await renderZeladoriaCharts({
      byStatus: byStatus || [],
      byCategory: byCategory || [],
      byDept: byDept || [],
      byMonth: byMonth || [],
      byBairro: byBairro || [],
      byCatDept: byCatDept || [],
      avgTime: avgTime || [],
      engagement: engagement || [],
      funnel: funnel || [],
      funnel: funnel || [],
      efficiency: efficiency || [],
      byResponsavel: byResponsavel || [],
      byOrigem: byOrigem || []
    });

    // Renderizar Hotspots (Recorrência)
    renderZeladoriaHotspots(recurrence || []);

    if (window.Logger) window.Logger.success('✅ Zeladoria: Dashboard pronto!');

  } catch (error) {
    console.error('❌ Erro ao carregar Zeladoria:', error);
    if (window.errorHandler) window.errorHandler.showNotification('Erro ao carregar dados de zeladoria.', 'danger');
  } finally {
    if (window.loadingManager) window.loadingManager.hide();
  }
}

/**
 * Atualizar os cards de KPI
 */
function updateZeladoriaKPIs(s) {
  const map = {
    'zeladoria-kpi-total': s.total,
    'zeladoria-kpi-fechados': s.fechados,
    'zeladoria-kpi-abertos': s.abertos,
    'zeladoria-kpi-tempo': s.tempoMedioResolucao
  };

  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'zeladoria-kpi-tempo') {
        el.textContent = val !== undefined ? `${val} dias` : '—';
      } else {
        el.textContent = val !== undefined ? val.toLocaleString('pt-BR') : '—';
      }
    }
  });
}

/**
 * Renderizar todos os gráficos de Zeladoria
 */
async function renderZeladoriaCharts(data) {
  const f = window.chartFactory;
  if (!f || !f.createPieChart || !f.createDoughnutChart || !f.createBarChart) {
    if (window.Logger) {
      window.Logger.warn('⚠️ chartFactory não está completamente carregado ainda');
    }
    return;
  }

  // 1. Status (Doughnut)
  f.createDoughnutChart('zeladoria-chart-status', data.byStatus.map(x => x.key), data.byStatus.map(x => x.count), {
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('status', data.byStatus[idx].key, true);
      }
    }
  });

  // 2. Categoria (Bar Vertical)
  f.createBarChart('zeladoria-chart-categoria', data.byCategory.slice(0, 10).map(x => x.key), data.byCategory.slice(0, 10).map(x => x.count), {
    colorIndex: 1,
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('categoria', data.byCategory[idx].key, true);
      }
    }
  });

  // 3. Departamento (Pie)
  f.createDoughnutChart('zeladoria-chart-departamento', data.byDept.slice(0, 8).map(x => x.key), data.byDept.slice(0, 8).map(x => x.count), {
    colorIndex: 2,
    chartOptions: { cutout: 0 }, // cutout: 0 makes it a pie chart instead of doughnut
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('departamento', data.byDept[idx].key, true);
      }
    }
  });

  // 4. Bairros (Horizontal Bar)
  f.createBarChart('zeladoria-chart-bairros', data.byBairro.slice(0, 10).map(x => x.key), data.byBairro.slice(0, 10).map(x => x.count), {
    indexAxis: 'y',
    colorIndex: 4,
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('bairro', data.byBairro[idx].key, true);
      }
    }
  });

  // 5. Categoria por Departamento (Stacked)
  renderStackedBar(data.byCatDept);

  // 6. Tempo Médio (Line/Bar)
  f.createBarChart('zeladoria-chart-tempo-categoria', data.avgTime.slice(0, 10).map(x => x.key), data.avgTime.slice(0, 10).map(x => x.average || 0), {
    colorIndex: 6
  });

  // 7. Engajamento (Apoios)
  f.createBarChart('zeladoria-chart-engajamento', data.engagement.map(x => x.key), data.engagement.map(x => x.count), {
    indexAxis: 'y',
    colorIndex: 3
  });

  // 8. Funil
  f.createBarChart('zeladoria-chart-funil', data.funnel.map(x => x.key), data.funnel.map(x => x.count), {
    indexAxis: 'y',
    colorIndex: 2
  });

  // 9. Eficiência (Grouped)
  renderEfficiencyChart(data.efficiency);

  // 10. Evolução + Projeção
  renderEvolutionProjection(data.byMonth);

  // 11. Top Responsáveis
  f.createBarChart('zeladoria-chart-responsavel', data.byResponsavel.slice(0, 10).map(x => x.key), data.byResponsavel.slice(0, 10).map(x => x.count), {
    indexAxis: 'y',
    colorIndex: 5,
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('responsavel', data.byResponsavel[idx].key, true);
      }
    }
  });

  // 12. Origem das Demandas
  f.createDoughnutChart('zeladoria-chart-origem', data.byOrigem.map(x => x.key), data.byOrigem.map(x => x.count), {
    colorIndex: 0,
    onClick: (evt, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        window.crossfilterZeladoria.apply('origem', data.byOrigem[idx].key, true);
      }
    }
  });
}

/**
 * Renderiza gráfico de barras empilhadas (Cat vs Dept)
 */
function renderStackedBar(data) {
  if (!data || !Array.isArray(data)) return;
  const canvas = document.getElementById('zeladoria-chart-categoria-dept');
  if (!canvas) return;

  const labels = data.map(d => d.departamento);
  const categories = [...new Set(data.flatMap(d => Object.keys(d.status || {})))].slice(0, 5);

  const datasets = categories.map((cat, i) => ({
    label: cat,
    data: data.map(d => d.status[cat] || 0),
    backgroundColor: window.chartFactory.getColorPalette()[i % 12]
  }));

  window.chartFactory.createStackedBarChart('zeladoria-chart-categoria-dept', labels, datasets);
}

/**
 * Renderiza gráfico de eficiência (Total vs Concluído)
 */
function renderEfficiencyChart(data) {
  if (!data || !Array.isArray(data)) return;
  const datasets = [
    {
      label: 'Total',
      data: data.map(x => x.total),
      backgroundColor: 'rgba(34, 211, 238, 0.6)',
      borderColor: '#22d3ee',
      borderWidth: 1
    },
    {
      label: 'Concluídos',
      data: data.map(x => x.concluidos),
      backgroundColor: 'rgba(52, 211, 153, 0.6)',
      borderColor: '#34d399',
      borderWidth: 1
    }
  ];
  window.chartFactory.createBarChart('zeladoria-chart-eficiencia-dept', data.map(x => x.key), datasets);
}

/**
 * Renderiza evolução histórica com projeção
 */
function renderEvolutionProjection(history) {
  if (!history || history.length === 0) return;

  const labels = history.map(h => {
    if (!h.month) return '';
    const [y, m] = h.month.split('-');
    return `${m}/${y}`;
  });
  const values = history.map(h => h.count || 0);

  // Cálculo de projeção conservadora para 2026
  const lastYear = history.slice(-12);
  const avg = lastYear.reduce((a, b) => a + (b.count || 0), 0) / lastYear.length || 0;

  const projectionLabels = ['01/2026', '02/2026', '03/2026', '04/2026'];
  const projectionValues = [avg, avg * 1.05, avg * 0.98, avg * 1.1];

  const allLabels = [...labels, ...projectionLabels];
  const datasets = [
    {
      label: 'Histórico',
      data: [...values, ...Array(projectionLabels.length).fill(null)],
      borderColor: '#22d3ee',
      backgroundColor: 'rgba(34, 211, 238, 0.1)',
      fill: true,
      tension: 0.4
    },
    {
      label: 'Projeção 2026',
      data: [...Array(labels.length).fill(null), ...projectionValues],
      borderColor: '#a78bfa',
      borderDash: [5, 5],
      tension: 0.4
    }
  ];

  window.chartFactory.createLineChart('zeladoria-chart-mensal', allLabels, datasets);
}

/**
 * Renderiza ranking de recorrência (Hotspots)
 */
function renderZeladoriaHotspots(data) {
  const container = document.getElementById('zeladoria-recurrence-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">Nenhum hotspot detectado.</div>';
    return;
  }

  const html = data.map(h => `
    <div class="flex items-center justify-between p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-slate-200 truncate">${h.endereco}</div>
        <div class="text-xs text-slate-400">${h.bairro} • ${h.categoria}</div>
      </div>
      <div class="ml-4 flex items-center gap-2">
        <span class="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg">${h.count}x</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

// Exportar para uso no zeladoria-main.js
window.loadZeladoriaOverview = loadZeladoriaOverview;
