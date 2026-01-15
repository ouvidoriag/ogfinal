/**
 * Página: Canais
 * 
 * Recriada com estrutura otimizada
 * MELHORIA: Integração com cache, banner e histórico de filtros
 */

let filtroMesCanal = '';

async function loadCanal(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('📡 loadCanal: Iniciando');
  }
  
  const page = document.getElementById('page-canal');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'chartCanal',
        'chartCanalMes',
        'chartCanalTemporal'
      ]);
    }
    
    // Coletar filtros de mês
    const filtrosMes = window.MonthFilterHelper?.coletarFiltrosMes?.('filtroMesCanal') || [];
    
    // Combinar com filtros globais usando helper reutilizável
    let activeFilters = filtrosMes;
    
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
    
    // MELHORIA: Verificar cache antes de fazer requisição
    const endpoint = '/api/aggregate/count-by?field=Canal';
    let data = [];
    let filtrosAplicados = false;
    
    if (activeFilters.length > 0) {
      filtrosAplicados = true;
      
      // Verificar cache
      const cached = window.filterCache?.get?.(activeFilters, endpoint);
      if (cached && !forceRefresh) {
        if (window.Logger) {
          window.Logger.debug('📡 loadCanal: Dados do cache');
        }
        data = cached;
      } else {
        try {
          const filterRequest = {
            filters: activeFilters,
            originalUrl: endpoint
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
              const canalMap = new Map();
              filteredData.forEach(record => {
                const canal = record.canal || record.data?.canal || 'N/A';
                if (canal && canal !== 'N/A') {
                  canalMap.set(canal, (canalMap.get(canal) || 0) + 1);
                }
              });
              
              data = Array.from(canalMap.entries())
                .map(([key, count]) => ({ key, count }))
                .sort((a, b) => b.count - a.count);
              
              // MELHORIA: Salvar no cache
              if (window.filterCache) {
                window.filterCache.set(activeFilters, endpoint, data);
              }
              
              // MELHORIA: Salvar no histórico
              if (window.filterHistory) {
                window.filterHistory.saveRecent(activeFilters);
              }
            }
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao aplicar filtros, carregando sem filtros:', error);
          }
          filtrosAplicados = false;
        }
      }
    }
    
    // Se não aplicou filtros ou deu erro, carregar normalmente
    if (!filtrosAplicados || data.length === 0) {
      data = await window.dataLoader?.load(endpoint, {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    const top20 = data.slice(0, 20);
    const labels = top20.map(x => x.key || x._id || 'N/A');
    const values = top20.map(x => x.count || 0);
    
    const canalChart = await window.chartFactory?.createDoughnutChart('chartCanal', labels, values, {
      type: 'doughnut',
      field: 'Canal', // Campo para cores consistentes
      onClick: false,
      legendContainer: 'legendCanal'
    });
    
    // CROSSFILTER: Adicionar filtros ao gráfico de canal
    // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
    setTimeout(() => {
      if (canalChart && top20 && canalChart.canvas && canalChart.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(canalChart, top20, {
            field: 'canal',
            valueField: 'key',
            onFilterChange: () => {
              if (window.loadCanal) window.loadCanal();
            },
            onClearFilters: () => {
              if (window.loadCanal) window.loadCanal();
            }
          });
          
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartCanal conectado ao crossfilter');
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao adicionar crossfilter ao gráfico canal:', error);
          }
        }
      }
    }, 100);
    
    // Renderizar ranking
    const rankEl = document.getElementById('rankCanal');
    if (rankEl) {
      rankEl.innerHTML = top20.map((item, idx) => {
        const canal = item.key || item._id || 'N/A';
        return `
          <li class="rank-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
              data-canal="${canal}" 
              data-value="${canal}"
              title="Clique para filtrar por ${canal} | Clique direito para limpar filtros">
            <span class="text-emerald-300">${canal}</span>
            <span class="font-bold text-cyan-300">${(item.count || 0).toLocaleString('pt-BR')}</span>
          </li>
        `;
      }).join('');
      
      // CROSSFILTER: Tornar itens do ranking clicáveis
      setTimeout(() => {
        const rankItems = rankEl.querySelectorAll('.rank-item');
        if (rankItems.length > 0 && window.makeCardsClickable) {
          window.makeCardsClickable({
            cards: Array.from(rankItems).map(item => ({
              selector: `.rank-item[data-canal="${item.dataset.canal}"]`,
              value: item.dataset.canal,
              field: 'canal'
            })),
            field: 'canal',
            getValueFromCard: (card) => card.dataset.canal
          });
        }
      }, 100);
    }
    
    // Carregar dados mensais
    const dataMes = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Canal', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderCanalMesChart(dataMes);
      // Renderizar gráfico de linha temporal
      await renderCanalTemporalChart(dataMes);
    }
    
    // Atualizar KPIs
    updateCanalKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateCanalKPIs(data),
        pageLoadFunction: window.loadCanal
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-canal', {
          fieldMap: {
            'chartCanal': 'canal',
            'chartCanalMes': 'canal'
          },
          defaultField: 'canal',
          kpiUpdateFunction: () => updateCanalKPIs(data),
          pageLoadFunction: window.loadCanal
        });
      }
    }, 600);
    
    // MELHORIA: Renderizar banner de filtros
    if (window.filterBanner && activeFilters.length > 0) {
      window.filterBanner.render('page-canal', activeFilters, {
        onClear: () => {
          if (window.chartCommunication) {
            window.chartCommunication.filters.clear();
          }
          loadCanal(true);
        }
      });
    }
    
    if (window.Logger) {
      window.Logger.success('📡 loadCanal: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Canal:', error);
    }
  }
}

async function renderCanalMesChart(dataMes) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const canais = [...new Set(dataMes.map(d => d.canal || d._id))].slice(0, 20);
  
  const datasets = canais.map((canal, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => 
        (d.month === mes || d.ym === mes) && (d.canal === canal || d._id === canal)
      );
      return item?.count || 0;
    });
    return {
      label: canal,
      data: data
    };
  });
  
  const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
  
  const canalMesChart = await window.chartFactory?.createBarChart('chartCanalMes', labels, datasets, {
    colorIndex: 0,
    legendContainer: 'legendCanalMes'
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de canal por mês
  if (canalMesChart && canais) {
    if (canalMesChart.options) {
      const originalOnClick = canalMesChart.options.onClick;
      canalMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          
          if (datasetIndex >= 0 && datasetIndex < canais.length) {
            const canal = canais[datasetIndex];
            const multiSelect = event.native?.ctrlKey || event.native?.metaKey || false;
            
            if (window.crossfilterOverview) {
              window.crossfilterOverview.setCanalFilter(canal, multiSelect);
              window.crossfilterOverview.notifyListeners();
            } else if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'Canal', op: 'eq', value: canal };
              
              if (multiSelect) {
                const exists = existingFilters.some(f => f.field === 'Canal' && f.value === canal);
                if (!exists) {
                  window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                }
              } else {
                window.chartCommunication.filters.filters = [
                  ...existingFilters.filter(f => f.field !== 'Canal'),
                  newFilter
                ];
              }
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadCanal) {
              setTimeout(() => window.loadCanal(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (canalMesChart.canvas) {
      const container = canalMesChart.canvas.parentElement;
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
          if (window.loadCanal) setTimeout(() => window.loadCanal(), 100);
        });
      }
    }
  }
}

/**
 * Atualizar KPIs da página Canal
 */
function updateCanalKPIs(data) {
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const canaisUnicos = data.length;
  const mediaCanal = canaisUnicos > 0 ? Math.round(total / canaisUnicos) : 0;
  
  const totalEl = document.getElementById('totalCanal');
  const kpiTotalEl = document.getElementById('kpiTotalCanal');
  const kpiUnicosEl = document.getElementById('kpiCanaisUnicos');
  const kpiMediaEl = document.getElementById('kpiMediaCanal');
  
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (kpiTotalEl) kpiTotalEl.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicosEl) kpiUnicosEl.textContent = canaisUnicos.toLocaleString('pt-BR');
  if (kpiMediaEl) kpiMediaEl.textContent = mediaCanal.toLocaleString('pt-BR');
}

/**
 * Inicializar listeners de filtro para a página Canal
 * Usa o helper reutilizável baseado no padrão da Overview
 */
function initCanalFilterListeners() {
  // Usar helper reutilizável (mesmo padrão da Overview)
  if (window.createPageFilterListener) {
    window.createPageFilterListener({
      pageId: 'page-canal',
      listenerKey: '_canalListenerRegistered',
      loadFunction: loadCanal
    });
  } else {
    // Fallback: método antigo
    if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-canal', loadCanal, 500);
    }
  }
  
  if (window.Logger) {
    window.Logger.success('✅ Listeners de filtro para Canal inicializados');
  }
}

// Inicializar listeners quando o script carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanalFilterListeners);
} else {
  initCanalFilterListeners();
}

// Exportar função principal
if (typeof window !== 'undefined') {
  /**
 * Renderizar gráfico de linha temporal: Evolução dos canais ao longo do tempo
 */
async function renderCanalTemporalChart(dataMes) {
  if (!dataMes || !Array.isArray(dataMes) || dataMes.length === 0) {
    const canvas = document.getElementById('chartCanalTemporal');
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
    const canais = [...new Set(dataMes.map(d => d.canal || d._id))].slice(0, 5); // Top 5
    
    const labels = meses.map(m => {
      if (m.includes('-')) {
        const [year, monthNum] = m.split('-');
        return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
      }
      return m;
    });
    
    const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
    const datasets = canais.map((canal, idx) => {
      const data = meses.map(mes => {
        const item = dataMes.find(d => 
          (d.month === mes || d.ym === mes) && (d.canal === canal || d._id === canal)
        );
        return item?.count || 0;
      });
      
      return {
        label: canal.length > 20 ? canal.substring(0, 20) + '...' : canal,
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
    
    const canvas = document.getElementById('chartCanalTemporal');
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
      
      window.chartCanalTemporal = chart;
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderCanalTemporalChart', { showToUser: false });
  }
}

window.loadCanal = loadCanal;
}
