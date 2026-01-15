/**
 * Página: Status
 * 
 * Recriada com estrutura otimizada
 */

async function loadStatusPage(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('📊 loadStatusPage: Iniciando');
  }
  
  const page = document.getElementById('page-status');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'chartStatusPage',
        'chartStatusMes',
        'chartStatusTemporal'
      ]);
    }
    
    // Usar endpoint correto para obter lista de status
    const statusCounts = await window.dataLoader?.load('/api/aggregate/count-by?field=Status', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    // Validar que statusCounts é um array
    if (!Array.isArray(statusCounts) || statusCounts.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📊 loadStatusPage: statusCounts não é um array válido', statusCounts);
      }
      // Criar gráfico vazio se não houver dados
      await window.chartFactory?.createDoughnutChart('chartStatusPage', ['Sem dados'], [1], {
        type: 'doughnut',
        onClick: false,
        legendContainer: 'legendStatusPage'
      });
    } else {
      const labels = statusCounts.map(s => s.status || s._id || s.key || 'N/A');
      const values = statusCounts.map(s => s.count || 0);
      
      const statusChart = await window.chartFactory?.createDoughnutChart('chartStatusPage', labels, values, {
        type: 'doughnut',
        field: 'Status', // Campo para cores consistentes
        onClick: false,
        legendContainer: 'legendStatusPage'
      });
      
      // CROSSFILTER: Adicionar filtros ao gráfico de status
      // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
      setTimeout(() => {
        if (statusChart && statusCounts && statusChart.canvas && statusChart.canvas.ownerDocument) {
          try {
            window.addCrossfilterToChart(statusChart, statusCounts, {
              field: 'status',
              valueField: 'status',
              onFilterChange: () => {
                if (window.loadStatusPage) window.loadStatusPage();
              },
              onClearFilters: () => {
                if (window.loadStatusPage) window.loadStatusPage();
              }
            });
            
            if (window.Logger) {
              window.Logger.debug('✅ Gráfico chartStatusPage conectado ao crossfilter');
            }
          } catch (error) {
            if (window.Logger) {
              window.Logger.warn('Erro ao adicionar crossfilter ao gráfico status:', error);
            }
          }
        }
      }, 100);
    }
    
    // Carregar dados mensais
    const dataMes = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Status', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderStatusMesChart(dataMes);
      // Renderizar gráfico de linha múltipla temporal
      await renderStatusTemporalChart(dataMes);
    } else {
      // Criar gráfico vazio se não houver dados mensais
      const canvas = document.getElementById('chartStatusMes');
      if (canvas && window.chartFactory) {
        await window.chartFactory.createBarChart('chartStatusMes', ['Sem dados'], [{ label: 'Sem dados', data: [0] }], {
          colorIndex: 0,
          legendContainer: 'legendStatusMes'
        });
      }
    }
    
    // Atualizar KPIs
    updateStatusKPIs(statusCounts);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateStatusKPIs(statusCounts),
        pageLoadFunction: window.loadStatusPage
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-status', {
          fieldMap: {
            'chartStatusPage': 'status',
            'chartStatusMes': 'status'
          },
          defaultField: 'status',
          kpiUpdateFunction: () => updateStatusKPIs(statusCounts),
          pageLoadFunction: window.loadStatusPage
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('📊 loadStatusPage: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Status:', error);
    }
  }
}

/**
 * Inicializar listeners de filtro para a página Status
 * Usa o helper reutilizável baseado no padrão da Overview
 */
function initStatusFilterListeners() {
  // Usar helper reutilizável (mesmo padrão da Overview)
  if (window.createPageFilterListener) {
    window.createPageFilterListener({
      pageId: 'page-status',
      listenerKey: '_statusListenerRegistered',
      loadFunction: loadStatusPage
    });
  } else {
    // Fallback: método antigo
    if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-status', loadStatusPage, 500);
    }
  }
  
  if (window.Logger) {
    window.Logger.success('✅ Listeners de filtro para Status inicializados');
  }
}

// Inicializar listeners quando o script carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStatusFilterListeners);
} else {
  initStatusFilterListeners();
}

async function renderStatusMesChart(dataMes) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const statuses = [...new Set(dataMes.map(d => d.status || d._id))];
  
  const datasets = statuses.map((status, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => 
        (d.month === mes || d.ym === mes) && (d.status === status || d._id === status)
      );
      return item?.count || 0;
    });
    return {
      label: status,
      data: data
    };
  });
  
  const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
  
  const statusMesChart = await window.chartFactory?.createBarChart('chartStatusMes', labels, datasets, {
    field: 'Status', // Campo para cores consistentes
    colorIndex: 0,
    legendContainer: 'legendStatusMes'
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de status por mês
  if (statusMesChart && statuses) {
    if (statusMesChart.options) {
      const originalOnClick = statusMesChart.options.onClick;
      statusMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          
          if (datasetIndex >= 0 && datasetIndex < statuses.length) {
            const status = statuses[datasetIndex];
            const multiSelect = event.native?.ctrlKey || event.native?.metaKey || false;
            
            if (window.crossfilterOverview) {
              window.crossfilterOverview.setStatusFilter(status, multiSelect);
              window.crossfilterOverview.notifyListeners();
            } else if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'StatusDemanda', op: 'eq', value: status };
              
              if (multiSelect) {
                const exists = existingFilters.some(f => f.field === 'StatusDemanda' && f.value === status);
                if (!exists) {
                  window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                }
              } else {
                window.chartCommunication.filters.filters = [
                  ...existingFilters.filter(f => f.field !== 'StatusDemanda'),
                  newFilter
                ];
              }
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadStatusPage) {
              setTimeout(() => window.loadStatusPage(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (statusMesChart.canvas) {
      const container = statusMesChart.canvas.parentElement;
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
          if (window.loadStatusPage) setTimeout(() => window.loadStatusPage(), 100);
        });
      }
    }
  }
}

/**
 * Renderizar gráfico de linha múltipla: Evolução temporal de cada status
 */
async function renderStatusTemporalChart(dataMes) {
  if (!dataMes || !Array.isArray(dataMes) || dataMes.length === 0) {
    const canvas = document.getElementById('chartStatusTemporal');
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
    const statuses = [...new Set(dataMes.map(d => d.status || d._id))];
    
    const labels = meses.map(m => {
      if (m.includes('-')) {
        const [year, monthNum] = m.split('-');
        return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
      }
      return m;
    });
    
    const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f472b6', '#84cc16'];
    const datasets = statuses.map((status, idx) => {
      const data = meses.map(mes => {
        const item = dataMes.find(d => 
          (d.month === mes || d.ym === mes) && (d.status === status || d._id === status)
        );
        return item?.count || 0;
      });
      
      return {
        label: status,
        data: data,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.1)'),
        tension: 0.4,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5
      };
    });
    
    // Garantir que Chart.js está carregado
    if (window.lazyLibraries?.loadChartJS) {
      await window.lazyLibraries.loadChartJS();
    }
    
    const canvas = document.getElementById('chartStatusTemporal');
    if (canvas && window.Chart) {
      // Destruir gráfico existente
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
      
      window.chartStatusTemporal = chart;
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderStatusTemporalChart', { showToUser: false });
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar gráfico temporal de status:', error);
    }
  }
}

/**
 * Atualizar KPIs da página Status
 */
function updateStatusKPIs(statusCounts) {
  if (!statusCounts || !Array.isArray(statusCounts) || statusCounts.length === 0) {
    return;
  }
  
  const total = statusCounts.reduce((sum, item) => sum + (item.count || 0), 0);
  const statusUnicos = statusCounts.length;
  const statusMaisComum = statusCounts.length > 0 
    ? (statusCounts[0].status || statusCounts[0]._id || statusCounts[0].key || 'N/A')
    : 'N/A';
  
  // Calcular taxa de conclusão (status que contém "concluído", "finalizado", "resolvido")
  const concluidos = statusCounts.filter(s => {
    const status = (s.status || s._id || s.key || '').toLowerCase();
    return status.includes('concluído') || status.includes('concluido') || 
           status.includes('finalizado') || status.includes('resolvido');
  }).reduce((sum, s) => sum + (s.count || 0), 0);
  
  const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalStatus');
  const kpiUnicos = document.getElementById('kpiStatusUnicos');
  const kpiMaisComum = document.getElementById('kpiStatusMaisComum');
  const kpiTaxa = document.getElementById('kpiTaxaConclusao');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = statusUnicos.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = statusMaisComum.length > 20 ? statusMaisComum.substring(0, 20) + '...' : statusMaisComum;
    kpiMaisComum.title = statusMaisComum; // Tooltip com nome completo
  }
  if (kpiTaxa) kpiTaxa.textContent = `${taxaConclusao}%`;
}

window.loadStatusPage = loadStatusPage;

