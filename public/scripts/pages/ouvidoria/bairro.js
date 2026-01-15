/**
 * Página: Bairro
 * 
 * Recriada com estrutura otimizada
 */

async function loadBairro(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('📍 loadBairro: Iniciando');
  }
  
  const page = document.getElementById('page-bairro');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Bairro') || [];
    
    // Combinar com filtros globais usando helper reutilizável
    let activeFilters = filtrosPagina;
    
    // Usar helper para obter filtros ativos de todas as fontes
    if (window.getActiveFilters) {
      const globalFilters = window.getActiveFilters();
      activeFilters = [...activeFilters, ...globalFilters];
    } else {
      // Fallback: método manual
      if (window.chartCommunication) {
        const globalFilters = window.chartCommunication.filters?.filters || [];
        activeFilters = [...activeFilters, ...globalFilters];
      }
    }
    
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'chartBairro',
        'chartBairroMes',
        'chartBairroTemporal',
        'chartBairroPizza'
      ]);
    }
    
    // Se houver filtros, usar endpoint filtrado
    let data = [];
    if (activeFilters.length > 0) {
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: '/api/aggregate/count-by?field=Bairro'
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          if (Array.isArray(filteredData) && filteredData.length > 0) {
            const bairroMap = new Map();
            filteredData.forEach(record => {
              const bairro = record.bairro || record.data?.bairro || 'N/A';
              if (bairro && bairro !== 'N/A') {
                bairroMap.set(bairro, (bairroMap.get(bairro) || 0) + 1);
              }
            });
            data = Array.from(bairroMap.entries())
              .map(([bairro, count]) => ({ key: bairro, count }))
              .sort((a, b) => b.count - a.count);
          }
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('Erro ao aplicar filtros:', error);
        }
      }
    }
    
    // Se não tem dados filtrados, carregar normalmente
    if (data.length === 0) {
      data = await window.dataLoader?.load('/api/aggregate/count-by?field=Bairro', {
        useDataStore: !forceRefresh,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📍 loadBairro: Dados não são um array válido', data);
      }
      return;
    }
    
    const top20 = data.slice(0, 20);
    const labels = top20.map(x => x.key || x._id || 'N/A');
    const values = top20.map(x => x.count || 0);
    
    const bairroChart = await window.chartFactory?.createBarChart('chartBairro', labels, values, {
      horizontal: true,
      colorIndex: 5,
      label: 'Manifestações',
      onClick: false
    });
    
    // CROSSFILTER: Adicionar filtros ao gráfico de bairro
    // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
    setTimeout(() => {
      if (bairroChart && top20 && bairroChart.canvas && bairroChart.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(bairroChart, top20, {
            field: 'bairro',
            valueField: 'key',
            onFilterChange: () => {
              if (window.loadBairro) window.loadBairro();
            },
            onClearFilters: () => {
              if (window.loadBairro) window.loadBairro();
            }
          });
          
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartBairro conectado ao crossfilter');
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao adicionar crossfilter ao gráfico bairro:', error);
          }
        }
      }
    }, 100);
    
    // Carregar dados mensais
    const dataMes = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Bairro', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderBairroMesChart(dataMes);
      // Renderizar gráfico de linha temporal
      await renderBairroTemporalChart(dataMes);
    }
    
    // Renderizar gráfico de pizza
    await renderBairroPizzaChart(data);
    
    // Atualizar KPIs
    updateBairroKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateBairroKPIs(data),
        pageLoadFunction: window.loadBairro
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-bairro', {
          fieldMap: {
            'chartBairro': 'bairro',
            'chartBairroMes': 'bairro'
          },
          defaultField: 'bairro',
          kpiUpdateFunction: () => updateBairroKPIs(data),
          pageLoadFunction: window.loadBairro
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('📍 loadBairro: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Bairro:', error);
    }
  }
}

async function renderBairroMesChart(dataMes) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const bairros = [...new Set(dataMes.map(d => d.bairro || d._id))].slice(0, 20);
  
  const datasets = bairros.map((bairro, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => 
        (d.month === mes || d.ym === mes) && (d.bairro === bairro || d._id === bairro)
      );
      return item?.count || 0;
    });
    return {
      label: bairro,
      data: data
    };
  });
  
  const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
  
  const bairroMesChart = await window.chartFactory?.createBarChart('chartBairroMes', labels, datasets, {
    colorIndex: 0,
    legendContainer: 'legendBairroMes'
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de bairro por mês
  if (bairroMesChart && bairros) {
    if (bairroMesChart.options) {
      const originalOnClick = bairroMesChart.options.onClick;
      bairroMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          
          if (datasetIndex >= 0 && datasetIndex < bairros.length) {
            const bairro = bairros[datasetIndex];
            const multiSelect = event.native?.ctrlKey || event.native?.metaKey || false;
            
            if (window.crossfilterOverview) {
              window.crossfilterOverview.setBairroFilter(bairro, multiSelect);
              window.crossfilterOverview.notifyListeners();
            } else if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'Bairro', op: 'eq', value: bairro };
              
              if (multiSelect) {
                const exists = existingFilters.some(f => f.field === 'Bairro' && f.value === bairro);
                if (!exists) {
                  window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                }
              } else {
                window.chartCommunication.filters.filters = [
                  ...existingFilters.filter(f => f.field !== 'Bairro'),
                  newFilter
                ];
              }
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadBairro) {
              setTimeout(() => window.loadBairro(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (bairroMesChart.canvas) {
      const container = bairroMesChart.canvas.parentElement;
      if (container && !container.dataset.crossfilterEnabled) {
        container.dataset.crossfilterEnabled = 'true';
        container.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (window.crossfilterOverview) {
            window.crossfilterOverview.clearAllFilters();
            window.crossfilterOverview.notifyListeners();
          } else if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.clear();
            if (window.chartCommunication.onFilterChange) {
              window.chartCommunication.onFilterChange();
            }
          }
          if (window.loadBairro) setTimeout(() => window.loadBairro(), 100);
        });
      }
    }
  }
}

/**
 * Atualizar KPIs da página Bairro
 */
function updateBairroKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const bairrosUnicos = data.length;
  const mediaBairro = bairrosUnicos > 0 ? Math.round(total / bairrosUnicos) : 0;
  const bairroMaisAtivo = data.length > 0 ? (data[0].key || data[0]._id || 'N/A') : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalBairro');
  const kpiUnicos = document.getElementById('kpiBairrosUnicos');
  const kpiMedia = document.getElementById('kpiMediaBairro');
  const kpiMaisAtivo = document.getElementById('kpiBairroMaisAtivo');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = bairrosUnicos.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaBairro.toLocaleString('pt-BR');
  if (kpiMaisAtivo) {
    kpiMaisAtivo.textContent = bairroMaisAtivo.length > 20 ? bairroMaisAtivo.substring(0, 20) + '...' : bairroMaisAtivo;
    kpiMaisAtivo.title = bairroMaisAtivo; // Tooltip com nome completo
  }
}

// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-bairro',
    listenerKey: '_bairroListenerRegistered',
    loadFunction: loadBairro
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-bairro', loadBairro, 500);
}

// Inicializar filtros de mês e status
function initBairroPage() {
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Bairro',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadBairro(true);
      },
      mesSelecionado: ''
    });
  } else {
    setTimeout(initBairroPage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBairroPage);
} else {
  initBairroPage();
}

/**
 * Renderizar gráfico de linha temporal: Evolução dos bairros ao longo do tempo
 */
async function renderBairroTemporalChart(dataMes) {
  if (!dataMes || !Array.isArray(dataMes) || dataMes.length === 0) {
    const canvas = document.getElementById('chartBairroTemporal');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados disponíveis', canvas.width / 2, canvas.height / 2);
    }
    return;
  }
  
  try {
    const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
    const bairros = [...new Set(dataMes.map(d => d.bairro || d._id))].slice(0, 5); // Top 5
    
    const labels = meses.map(m => {
      if (m.includes('-')) {
        const [year, monthNum] = m.split('-');
        return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
      }
      return m;
    });
    
    const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
    const datasets = bairros.map((bairro, idx) => {
      const data = meses.map(mes => {
        const item = dataMes.find(d => 
          (d.month === mes || d.ym === mes) && (d.bairro === bairro || d._id === bairro)
        );
        return item?.count || 0;
      });
      
      return {
        label: bairro.length > 20 ? bairro.substring(0, 20) + '...' : bairro,
        data: data,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    
    if (window.lazyLibraries?.loadChartJS) {
      await window.lazyLibraries.loadChartJS();
    }
    
    const canvas = document.getElementById('chartBairroTemporal');
    if (canvas && window.Chart) {
      if (window.Chart.getChart) {
        const existingChart = window.Chart.getChart(canvas);
        if (existingChart) {
          existingChart.destroy();
        }
      }
      
      const isLightMode = document.body.classList.contains('light-mode');
      
      const chart = new window.Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: isLightMode ? '#1e293b' : '#e2e8f0',
                font: { size: 11 },
                padding: 10,
                usePointStyle: true
              }
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              ticks: {
                color: isLightMode ? '#64748b' : '#94a3b8',
                maxRotation: 45,
                minRotation: 45
              },
              grid: {
                color: isLightMode ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
              }
            },
            y: {
              beginAtZero: true,
              ticks: {
                color: isLightMode ? '#64748b' : '#94a3b8',
                callback: function(value) {
                  return value.toLocaleString('pt-BR');
                }
              },
              grid: {
                color: isLightMode ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
              }
            }
          }
        }
      });
      
      window.chartBairroTemporal = chart;
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderBairroTemporalChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de pizza: Distribuição percentual dos bairros
 */
async function renderBairroPizzaChart(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    const canvas = document.getElementById('chartBairroPizza');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sem dados disponíveis', canvas.width / 2, canvas.height / 2);
    }
    return;
  }
  
  try {
    const top10 = data.slice(0, 10);
    const labels = top10.map(b => {
      const key = b.key || b._id || 'N/A';
      return key.length > 25 ? key.substring(0, 25) + '...' : key;
    });
    const values = top10.map(b => b.count || 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) return;
    
    const chart = await window.chartFactory?.createDoughnutChart('chartBairroPizza', labels, values, {
      field: 'bairro',
      chartOptions: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                return `${label}: ${value.toLocaleString('pt-BR')} (${percent}%)`;
              }
            }
          }
        }
      }
    });
    
    window.chartBairroPizza = chart;
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderBairroPizzaChart', { showToUser: false });
  }
}

window.loadBairro = loadBairro;

