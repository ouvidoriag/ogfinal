/**
 * Página: Por Cadastrante
 * 
 * Recriada com estrutura otimizada
 */

let filtroMesCadastrante = '';

async function loadCadastrante() {
  if (window.Logger) {
    window.Logger.debug('👤 loadCadastrante: Iniciando');
  }
  
  const page = document.getElementById('page-cadastrante');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Cadastrante') || [];
    
    // Combinar com filtros globais
    let activeFilters = filtrosPagina;
    if (window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters?.filters || [];
      activeFilters = [...globalFilters, ...filtrosPagina];
    }
    
    // Aplicar filtros se houver
    let servidores = [], uacs = [], dataMensal = [], summary = { total: 0 };
    let filtrosAplicados = false;
    
    if (activeFilters.length > 0) {
      filtrosAplicados = true;
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: '/api/aggregate/by-server'
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
            // Agrupar por servidor
            const servidorMap = new Map();
            filteredData.forEach(record => {
              const servidor = record.servidor || record.data?.servidor || 'N/A';
              if (servidor && servidor !== 'N/A') {
                servidorMap.set(servidor, (servidorMap.get(servidor) || 0) + 1);
              }
            });
            servidores = Array.from(servidorMap.entries())
              .map(([servidor, count]) => ({ servidor, quantidade: count }))
              .sort((a, b) => b.quantidade - a.quantidade);
            
            // Agrupar por UAC
            const uacMap = new Map();
            filteredData.forEach(record => {
              const uac = record.unidadeCadastro || record.data?.unidade_cadastro || 'N/A';
              if (uac && uac !== 'N/A') {
                uacMap.set(uac, (uacMap.get(uac) || 0) + 1);
              }
            });
            uacs = Array.from(uacMap.entries())
              .map(([key, count]) => ({ key, count }))
              .sort((a, b) => b.count - a.count);
            
            summary = { total: filteredData.length };
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
    if (!filtrosAplicados || servidores.length === 0) {
      [servidores, uacs, dataMensal, summary] = await Promise.all([
        window.dataLoader?.load('/api/aggregate/by-server', {
          useDataStore: true,
          ttl: 10 * 60 * 1000
        }) || [],
        window.dataLoader?.load('/api/aggregate/count-by?field=UAC', {
          useDataStore: true,
          ttl: 10 * 60 * 1000
        }) || [],
        window.dataLoader?.load('/api/aggregate/by-month', {
          useDataStore: true,
          ttl: 10 * 60 * 1000
        }) || [],
        window.dataLoader?.load('/api/summary', {
          useDataStore: true,
          ttl: 5 * 60 * 1000
        }) || { total: 0 }
      ]);
    } else {
      // Carregar dados mensais mesmo com filtro
      dataMensal = await window.dataLoader?.load('/api/aggregate/by-month', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    // Renderizar lista de servidores
    renderServidoresList(servidores);
    
    // Renderizar lista de unidades de cadastro
    renderUnidadesList(uacs);
    
    // Renderizar gráfico mensal
    await renderCadastranteMesChart(dataMensal);
    
    // Renderizar gráficos adicionais
    await renderCadastranteTemporalChart(servidores);
    await renderCadastrantePizzaChart(servidores);
    await renderCadastranteAgrupadasChart(servidores);
    
    // Atualizar KPIs
    updateCadastranteKPIs(servidores, uacs, summary);
    
    // Atualizar total (manter compatibilidade)
    const totalEl = document.getElementById('totalCadastrante');
    if (totalEl) {
      totalEl.textContent = (summary.total || 0).toLocaleString('pt-BR');
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-cadastrante', {
          fieldMap: {
            'chartCadastranteMes': 'cadastrante'
          },
          defaultField: 'cadastrante',
          kpiUpdateFunction: () => updateCadastranteKPIs(servidores, uacs, summary),
          pageLoadFunction: window.loadCadastrante
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('👤 loadCadastrante: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Cadastrante:', error);
    }
  }
}

function renderServidoresList(servidores) {
  const listaServidores = document.getElementById('listaServidores');
  if (!listaServidores) return;
  
  if (servidores.length === 0) {
    listaServidores.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum servidor encontrado</div>';
    return;
  }
  
  const maxValue = Math.max(...servidores.map(d => d.quantidade || d.count || 0), 1);
  listaServidores.innerHTML = servidores.map((item, idx) => {
    const quantidade = item.quantidade || item.count || 0;
    const width = (quantidade / maxValue) * 100;
    const servidor = item.servidor || item.key || item._id || 'N/A';
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all" 
           data-servidor="${servidor.replace(/"/g, '&quot;')}">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-300 truncate font-medium">${servidor}</div>
          <div class="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-cyan-500 to-violet-500" style="width: ${width}%"></div>
          </div>
        </div>
        <div class="text-lg font-bold text-cyan-300 min-w-[80px] text-right">${quantidade.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

function renderUnidadesList(uacs) {
  const listaUnidades = document.getElementById('listaUnidadesCadastro');
  if (!listaUnidades) return;
  
  if (uacs.length === 0) {
    listaUnidades.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhuma unidade encontrada</div>';
    return;
  }
  
  const maxValue = Math.max(...uacs.map(d => d.count || 0), 1);
  listaUnidades.innerHTML = uacs.map((item, idx) => {
    const count = item.count || 0;
    const width = (count / maxValue) * 100;
    const key = item.key || item._id || 'N/A';
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-all" 
           data-unidade="${key.replace(/"/g, '&quot;')}">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-300 truncate font-medium">${key}</div>
          <div class="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-violet-500 to-cyan-500" style="width: ${width}%"></div>
          </div>
        </div>
        <div class="text-lg font-bold text-violet-300 min-w-[80px] text-right">${count.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

/**
 * Atualizar KPIs da página Cadastrante
 */
function updateCadastranteKPIs(servidores, uacs, summary) {
  const total = summary.total || 0;
  const servidoresUnicos = servidores?.length || 0;
  const unidadesUnicas = uacs?.length || 0;
  const servidorMaisAtivo = servidores && servidores.length > 0 
    ? (servidores[0].servidor || servidores[0].key || servidores[0]._id || 'N/A')
    : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalCadastrante');
  const kpiServidores = document.getElementById('kpiServidoresUnicos');
  const kpiUnidades = document.getElementById('kpiUnidadesUnicas');
  const kpiMaisAtivo = document.getElementById('kpiServidorMaisAtivo');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiServidores) kpiServidores.textContent = servidoresUnicos.toLocaleString('pt-BR');
  if (kpiUnidades) kpiUnidades.textContent = unidadesUnicas.toLocaleString('pt-BR');
  if (kpiMaisAtivo) {
    kpiMaisAtivo.textContent = servidorMaisAtivo.length > 20 ? servidorMaisAtivo.substring(0, 20) + '...' : servidorMaisAtivo;
    kpiMaisAtivo.title = servidorMaisAtivo; // Tooltip com nome completo
  }
}

async function renderCadastranteMesChart(dataMensal) {
  if (!dataMensal || dataMensal.length === 0) return;
  
  const labels = dataMensal.map(x => {
    const ym = x.ym || x.month || '';
    return window.dateUtils?.formatMonthYear?.(ym) || ym || 'Data inválida';
  });
  const values = dataMensal.map(x => x.count || 0);
  
  const chartMes = await window.chartFactory?.createBarChart('chartCadastranteMes', labels, values, {
    colorIndex: 1,
    label: 'Quantidade',
    onClick: true // Habilitar interatividade para crossfilter
  });
  
  // CROSSFILTER: Adicionar sistema de filtros (filtro por mês/período)
  if (chartMes && dataMensal && window.addCrossfilterToChart) {
    setTimeout(() => {
      if (chartMes.canvas && chartMes.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(chartMes, dataMensal, {
            field: 'month',
            valueField: 'ym',
            onFilterChange: () => {
              if (window.loadCadastrante) window.loadCadastrante();
            },
            onClearFilters: () => {
              if (window.loadCadastrante) window.loadCadastrante();
            }
          });
          
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartCadastranteMes conectado ao crossfilter');
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao adicionar crossfilter ao gráfico cadastrante:', error);
          }
        }
      }
    }, 100);
  }
}

// Exportar função imediatamente
/**
 * Renderizar gráfico de linha temporal: Evolução dos servidores ao longo do tempo
 */
async function renderCadastranteTemporalChart(servidores) {
  if (!servidores || !Array.isArray(servidores) || servidores.length === 0) {
    const canvas = document.getElementById('chartCadastranteTemporal');
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
    const servidoresMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Servidor', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(servidoresMesData) && servidoresMesData.length > 0) {
      const top5 = servidores.slice(0, 5);
      const top5Keys = new Set(top5.map(s => s.servidor || s.key || s._id));
      
      const servidoresMap = new Map();
      const mesesSet = new Set();
      
      servidoresMesData.forEach(item => {
        const servidor = item.servidor || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(servidor)) return;
        
        mesesSet.add(mes);
        
        if (!servidoresMap.has(servidor)) {
          servidoresMap.set(servidor, new Map());
        }
        
        servidoresMap.get(servidor).set(mes, item.count || 0);
      });
      
      const meses = Array.from(mesesSet).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
      const datasets = top5.map((item, idx) => {
        const servidor = item.servidor || item.key || item._id;
        const mesesMap = servidoresMap.get(servidor) || new Map();
        const values = meses.map(mes => mesesMap.get(mes) || 0);
        
        return {
          label: servidor.length > 20 ? servidor.substring(0, 20) + '...' : servidor,
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
      
      const canvas = document.getElementById('chartCadastranteTemporal');
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
        
        window.chartCadastranteTemporal = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderCadastranteTemporalChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de pizza: Distribuição percentual dos servidores
 */
async function renderCadastrantePizzaChart(servidores) {
  if (!servidores || !Array.isArray(servidores) || servidores.length === 0) {
    const canvas = document.getElementById('chartCadastrantePizza');
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
    const top10 = servidores.slice(0, 10);
    const labels = top10.map(s => {
      const servidor = s.servidor || s.key || s._id || 'N/A';
      return servidor.length > 25 ? servidor.substring(0, 25) + '...' : servidor;
    });
    const values = top10.map(s => s.quantidade || s.count || 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) return;
    
    const chart = await window.chartFactory?.createDoughnutChart('chartCadastrantePizza', labels, values, {
      field: 'servidor',
      chartOptions: {
        plugins: {
          legend: { display: true, position: 'right' },
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
    
    window.chartCadastrantePizza = chart;
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderCadastrantePizzaChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de barras agrupadas: Servidores por mês
 */
async function renderCadastranteAgrupadasChart(servidores) {
  if (!servidores || !Array.isArray(servidores) || servidores.length === 0) {
    const canvas = document.getElementById('chartCadastranteAgrupadas');
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
    const servidoresMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Servidor', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(servidoresMesData) && servidoresMesData.length > 0) {
      const top5 = servidores.slice(0, 5);
      const top5Keys = new Set(top5.map(s => s.servidor || s.key || s._id));
      
      const mesesMap = new Map();
      servidoresMesData.forEach(item => {
        const servidor = item.servidor || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(servidor)) return;
        
        if (!mesesMap.has(mes)) {
          mesesMap.set(mes, new Map());
        }
        
        mesesMap.get(mes).set(servidor, item.count || 0);
      });
      
      const meses = Array.from(mesesMap.keys()).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
      const datasets = top5.map((item, idx) => {
        const servidor = item.servidor || item.key || item._id;
        const values = meses.map(mes => {
          const servidoresMap = mesesMap.get(mes) || new Map();
          return servidoresMap.get(servidor) || 0;
        });
        
        return {
          label: servidor.length > 20 ? servidor.substring(0, 20) + '...' : servidor,
          data: values,
          backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.7)'),
          borderColor: colors[idx % colors.length],
          borderWidth: 1
        };
      });
      
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartCadastranteAgrupadas');
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
        
        window.chartCadastranteAgrupadas = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderCadastranteAgrupadasChart', { showToUser: false });
  }
}

window.loadCadastrante = loadCadastrante;

// Conectar ao sistema global de filtros
// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-cadastrante',
    listenerKey: '_cadastranteListenerRegistered',
    loadFunction: loadCadastrante
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-cadastrante', loadCadastrante, 500);
}

// Inicializar filtros de mês e status
function initCadastrantePage() {
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Cadastrante',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadCadastrante();
      },
      mesSelecionado: filtroMesCadastrante
    });
  } else {
    setTimeout(initCadastrantePage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCadastrantePage);
} else {
  initCadastrantePage();
}

