/**
 * Página: Prioridades
 * 
 * Recriada com estrutura otimizada
 */

let filtroMesPrioridade = '';

async function loadPrioridade(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('⚡ loadPrioridade: Iniciando');
  }
  
  const page = document.getElementById('page-prioridade');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Prioridade') || [];
    
    // Combinar com filtros globais
    let activeFilters = filtrosPagina;
    if (window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters?.filters || [];
      activeFilters = [...globalFilters, ...filtrosPagina];
    }
    
    // Aplicar filtros se houver
    let data = [];
    let filtrosAplicados = false;
    
    if (activeFilters.length > 0) {
      filtrosAplicados = true;
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: '/api/aggregate/count-by?field=Prioridade'
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
            const prioridadeMap = new Map();
            filteredData.forEach(record => {
              const prioridade = record.prioridade || record.data?.prioridade || 'N/A';
              if (prioridade && prioridade !== 'N/A') {
                prioridadeMap.set(prioridade, (prioridadeMap.get(prioridade) || 0) + 1);
              }
            });
            
            data = Array.from(prioridadeMap.entries())
              .map(([key, count]) => ({ key, count }))
              .sort((a, b) => b.count - a.count);
          }
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao aplicar filtros, carregando sem filtros:', error);
        }
        filtrosAplicados = false;
      }
    }
    
    // Se não aplicou filtros ou deu erro, carregar normalmente
    if (!filtrosAplicados || data.length === 0) {
      data = await window.dataLoader?.load('/api/aggregate/count-by?field=Prioridade', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    const top20 = data.slice(0, 20);
    const labels = top20.map(x => x.key || x._id || 'N/A');
    const values = top20.map(x => x.count || 0);
    
    const prioridadeChart = await window.chartFactory?.createDoughnutChart('chartPrioridade', labels, values, {
      type: 'doughnut',
      field: 'Prioridade', // Campo para cores consistentes
      onClick: false,
      legendContainer: 'legendPrioridade'
    });
    
    // CROSSFILTER: Adicionar filtros ao gráfico de prioridade
    // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
    setTimeout(() => {
      if (prioridadeChart && top20 && prioridadeChart.canvas && prioridadeChart.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(prioridadeChart, top20, {
            field: 'prioridade',
            valueField: 'key',
            onFilterChange: () => {
              if (window.loadPrioridade) window.loadPrioridade();
            },
            onClearFilters: () => {
              if (window.loadPrioridade) window.loadPrioridade();
            }
          });
          
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartPrioridade conectado ao crossfilter');
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao adicionar crossfilter ao gráfico prioridade:', error);
          }
        }
      }
    }, 100);
    
    // Renderizar gráficos adicionais
    await renderPrioridadeTemporalChart(data);
    await renderPrioridadeAgrupadasChart(data);
    
    // Renderizar ranking
    const rankEl = document.getElementById('rankPrioridade');
    if (rankEl) {
      rankEl.innerHTML = top20.map((item, idx) => {
        const prioridade = item.key || item._id || 'N/A';
        return `
          <li class="rank-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
              data-prioridade="${prioridade}" 
              data-value="${prioridade}"
              title="Clique para filtrar por ${prioridade} | Clique direito para limpar filtros">
            <span class="text-rose-300">${prioridade}</span>
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
              selector: `.rank-item[data-prioridade="${item.dataset.prioridade}"]`,
              value: item.dataset.prioridade,
              field: 'prioridade'
            })),
            field: 'prioridade',
            getValueFromCard: (card) => card.dataset.prioridade
          });
        }
      }, 100);
    }
    
    // Atualizar KPIs
    updatePrioridadeKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updatePrioridadeKPIs(data),
        pageLoadFunction: window.loadPrioridade
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-prioridade', {
          fieldMap: {
            'chartPrioridade': 'prioridade',
            'chartPrioridadeMes': 'prioridade'
          },
          defaultField: 'prioridade',
          kpiUpdateFunction: () => updatePrioridadeKPIs(data),
          pageLoadFunction: window.loadPrioridade
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('⚡ loadPrioridade: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Prioridade:', error);
    }
  }
}

/**
 * Atualizar KPIs da página Prioridade
 */
function updatePrioridadeKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const prioridadesUnicas = data.length;
  const mediaPrioridade = prioridadesUnicas > 0 ? Math.round(total / prioridadesUnicas) : 0;
  const prioridadeMaisComum = data.length > 0 ? (data[0].key || data[0]._id || 'N/A') : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalPrioridade');
  const kpiUnicas = document.getElementById('kpiPrioridadesUnicas');
  const kpiMedia = document.getElementById('kpiMediaPrioridade');
  const kpiMaisComum = document.getElementById('kpiPrioridadeMaisComum');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicas) kpiUnicas.textContent = prioridadesUnicas.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaPrioridade.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = prioridadeMaisComum.length > 20 ? prioridadeMaisComum.substring(0, 20) + '...' : prioridadeMaisComum;
    kpiMaisComum.title = prioridadeMaisComum; // Tooltip com nome completo
  }
}

// Exportar função imediatamente
/**
 * Renderizar gráfico de linha temporal: Evolução das prioridades ao longo do tempo
 */
async function renderPrioridadeTemporalChart(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    const canvas = document.getElementById('chartPrioridadeTemporal');
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
    const prioridadesMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Prioridade', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(prioridadesMesData) && prioridadesMesData.length > 0) {
      const top5 = data.slice(0, 5);
      const top5Keys = new Set(top5.map(p => p.key || p._id));
      
      const prioridadesMap = new Map();
      const mesesSet = new Set();
      
      prioridadesMesData.forEach(item => {
        const prioridade = item.prioridade || item.priority || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(prioridade)) return;
        
        mesesSet.add(mes);
        
        if (!prioridadesMap.has(prioridade)) {
          prioridadesMap.set(prioridade, new Map());
        }
        
        prioridadesMap.get(prioridade).set(mes, item.count || 0);
      });
      
      const meses = Array.from(mesesSet).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
      const datasets = top5.map((item, idx) => {
        const prioridade = item.key || item._id;
        const mesesMap = prioridadesMap.get(prioridade) || new Map();
        const values = meses.map(mes => mesesMap.get(mes) || 0);
        
        return {
          label: prioridade.length > 20 ? prioridade.substring(0, 20) + '...' : prioridade,
          data: values,
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
      
      const canvas = document.getElementById('chartPrioridadeTemporal');
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
        
        window.chartPrioridadeTemporal = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderPrioridadeTemporalChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de barras agrupadas: Prioridades por mês
 */
async function renderPrioridadeAgrupadasChart(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    const canvas = document.getElementById('chartPrioridadeAgrupadas');
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
    const prioridadesMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Prioridade', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(prioridadesMesData) && prioridadesMesData.length > 0) {
      const top5 = data.slice(0, 5);
      const top5Keys = new Set(top5.map(p => p.key || p._id));
      
      const mesesMap = new Map();
      prioridadesMesData.forEach(item => {
        const prioridade = item.prioridade || item.priority || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(prioridade)) return;
        
        if (!mesesMap.has(mes)) {
          mesesMap.set(mes, new Map());
        }
        
        mesesMap.get(mes).set(prioridade, item.count || 0);
      });
      
      const meses = Array.from(mesesMap.keys()).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
      const datasets = top5.map((item, idx) => {
        const prioridade = item.key || item._id;
        const values = meses.map(mes => {
          const prioridadesMap = mesesMap.get(mes) || new Map();
          return prioridadesMap.get(prioridade) || 0;
        });
        
        return {
          label: prioridade.length > 20 ? prioridade.substring(0, 20) + '...' : prioridade,
          data: values,
          backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.7)'),
          borderColor: colors[idx % colors.length],
          borderWidth: 1
        };
      });
      
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartPrioridadeAgrupadas');
      if (canvas && window.Chart) {
        if (window.Chart.getChart) {
          const existingChart = window.Chart.getChart(canvas);
          if (existingChart) {
            existingChart.destroy();
          }
        }
        
        const isLightMode = document.body.classList.contains('light-mode');
        
        const chart = new window.Chart(canvas, {
          type: 'bar',
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
                stacked: false,
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
                stacked: false,
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
        
        window.chartPrioridadeAgrupadas = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderPrioridadeAgrupadasChart', { showToUser: false });
  }
}

window.loadPrioridade = loadPrioridade;

// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-prioridade',
    listenerKey: '_prioridadeListenerRegistered',
    loadFunction: loadPrioridade
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-prioridade', loadPrioridade, 500);
}

// Inicializar filtros de mês e status
function initPrioridadePage() {
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Prioridade',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadPrioridade(true);
      },
      mesSelecionado: filtroMesPrioridade
    });
  } else {
    setTimeout(initPrioridadePage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPrioridadePage);
} else {
  initPrioridadePage();
}

