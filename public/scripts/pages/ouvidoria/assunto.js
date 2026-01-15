/**
 * Página: Por Assunto
 * Análise de manifestações por assunto
 * 
 * Recriada com estrutura otimizada
 */

let filtroMesAssunto = '';

async function loadAssunto() {
  // PRIORIDADE 1: Verificar dependências
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader', 'chartFactory'],
    () => {
      window.errorHandler?.showNotification('Sistemas não carregados. Recarregue a página.', 'warning');
      return null;
    }
  );
  
  if (!dependencies) return Promise.resolve();
  const { dataLoader, chartFactory } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('📝 loadAssunto: Iniciando');
  }
  
  const page = document.getElementById('page-assunto');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.show('Carregando dados de assuntos...');
  
  return await window.errorHandler?.safeAsync(async () => {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Assunto') || [];
    
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
    if (chartFactory?.destroyCharts) {
      chartFactory.destroyCharts([
        'chartAssunto',
        'chartStatusAssunto',
        'chartAssuntoMes',
        'chartAssuntoPizza',
        'chartAssuntoStatusAgrupadas'
      ]);
    }
    
    // MELHORIA: Integrar cache de filtros e histórico
    let dataAssuntosRaw = [];
    let filtrosAplicados = false;
    const endpoint = '/api/aggregate/by-subject';
    
    if (activeFilters.length > 0) {
      filtrosAplicados = true;
      
      // MELHORIA: Verificar cache de filtros
      const cached = window.filterCache?.get?.(activeFilters, endpoint);
      if (cached) {
        if (window.Logger) {
          window.Logger.debug('📝 loadAssunto: Dados obtidos do cache de filtros');
        }
        dataAssuntosRaw = cached;
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
              // Agrupar por assunto manualmente
              const assuntoMap = new Map();
              filteredData.forEach(record => {
                const assunto = record.assunto || record.data?.assunto || 'N/A';
                if (assunto && assunto !== 'N/A') {
                  assuntoMap.set(assunto, (assuntoMap.get(assunto) || 0) + 1);
                }
              });
              
              dataAssuntosRaw = Array.from(assuntoMap.entries())
                .map(([assunto, count]) => ({ assunto, quantidade: count }))
                .sort((a, b) => b.quantidade - a.quantidade);
              
              // MELHORIA: Salvar no cache de filtros
              if (window.filterCache) {
                window.filterCache.set(activeFilters, endpoint, dataAssuntosRaw);
              }
              
              // MELHORIA: Salvar no histórico de filtros
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
    if (!filtrosAplicados || dataAssuntosRaw.length === 0) {
      dataAssuntosRaw = await dataLoader.load('/api/aggregate/by-subject', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    // PRIORIDADE 1: Validar dados
    const validation = window.dataValidator?.validateApiResponse(dataAssuntosRaw, {
      arrayItem: { types: { assunto: 'string', quantidade: 'number' } }
    });
    
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.error}`);
    }
    
    dataAssuntosRaw = validation.data;
    
    // Normalizar dados (endpoint retorna { assunto, quantidade }, mas código espera { subject, count })
    const dataAssuntos = dataAssuntosRaw.map(item => ({
      subject: item.subject || item.assunto || 'N/A',
      assunto: item.assunto || item.subject || 'N/A',
      count: item.count || item.quantidade || 0,
      quantidade: item.quantidade || item.count || 0,
      _id: item.subject || item.assunto || 'N/A'
    }));
    
    if (window.Logger) {
      window.Logger.debug('📝 loadAssunto: Dados carregados', { 
        raw: dataAssuntosRaw.length, 
        normalized: dataAssuntos.length,
        sample: dataAssuntos[0] 
      });
    }
    
    // Carregar dados mensais de assuntos
    const dataAssuntoMesRaw = await dataLoader.load('/api/aggregate/count-by-status-mes?field=Assunto', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    const mensalValidation = window.dataValidator?.validateApiResponse(dataAssuntoMesRaw, {
      arrayItem: { types: { subject: 'string', count: 'number' } }
    });
    
    const dataAssuntoMes = mensalValidation.valid ? mensalValidation.data : [];
    
    // Renderizar gráfico principal
    await renderAssuntoChart(dataAssuntos);
    
    // Renderizar status por assunto
    await renderStatusAssuntoChart(dataAssuntos);
    
    // Renderizar assuntos por mês
    await renderAssuntoMesChart(dataAssuntoMes);
    
    // Renderizar gráficos adicionais
    await renderAssuntoPizzaChart(dataAssuntos);
    await renderAssuntoStatusAgrupadasChart(dataAssuntos);
    
    // Renderizar lista completa
    renderAssuntosList(dataAssuntos);
    
    // Atualizar KPIs
    updateAssuntoKPIs(dataAssuntos);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateAssuntoKPIs(dataAssuntos),
        pageLoadFunction: window.loadAssunto
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-assunto', {
          fieldMap: {
            'chartAssunto': 'assunto',
            'chartStatusAssunto': 'status',
            'chartAssuntoMes': 'assunto'
          },
          defaultField: 'assunto',
          kpiUpdateFunction: () => updateAssuntoKPIs(dataAssuntos),
          pageLoadFunction: window.loadAssunto
        });
      }
    }, 600);
    
    // MELHORIA: Renderizar banner de filtros
    if (window.filterBanner && activeFilters.length > 0) {
      const pageContainer = document.getElementById('page-assunto');
      if (pageContainer) {
        window.filterBanner.render('page-assunto', activeFilters, {
          showClearAll: true,
          showCount: true,
          position: 'top'
        });
      }
    }
    
    if (window.Logger) {
      window.Logger.success('📝 loadAssunto: Concluído');
    }
    
    // PRIORIDADE 2: Esconder loading
    window.loadingManager?.hide();
    
    return { success: true, dataAssuntos, dataAssuntoMes };
  }, 'loadAssunto', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hide();
      
      return { success: false, dataAssuntos: [], dataAssuntoMes: [] };
    }
  });
}

/**
 * Inicializar listeners de filtro para a página Assunto
 * Usa o helper reutilizável baseado no padrão da Overview
 */
function initAssuntoFilterListeners() {
  // Usar helper reutilizável (mesmo padrão da Overview)
  if (window.createPageFilterListener) {
    window.createPageFilterListener({
      pageId: 'page-assunto',
      listenerKey: '_assuntoListenerRegistered',
      loadFunction: loadAssunto,
      updateFunction: async (filteredData, hasActiveFilters) => {
        // Mostrar loading
        window.loadingManager?.show('Aplicando filtros...');
        
        try {
          // Sempre recarregar para garantir que todos os gráficos sejam atualizados
          // O loadAssunto já aplica os filtros corretamente
          await loadAssunto();
          
          if (window.Logger) {
            window.Logger.success('📝 Assunto: Dados atualizados com filtros aplicados');
          }
        } catch (error) {
          window.loadingManager?.hide();
          if (window.Logger) {
            window.Logger.error('📝 Assunto: Erro ao atualizar com filtros:', error);
          }
        }
      }
    });
  } else {
    // Fallback: método antigo
    if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-assunto', loadAssunto, 500);
    }
  }
  
  if (window.Logger) {
    window.Logger.success('✅ Listeners de filtro para Assunto inicializados');
  }
}

// Exportar função imediatamente
/**
 * Renderizar gráfico de pizza: Distribuição percentual dos assuntos
 */
async function renderAssuntoPizzaChart(dataAssuntos) {
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    const canvas = document.getElementById('chartAssuntoPizza');
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
    const top10 = dataAssuntos.slice(0, 10);
    const labels = top10.map(a => {
      const assunto = a.subject || a.assunto || a._id || 'N/A';
      return assunto.length > 25 ? assunto.substring(0, 25) + '...' : assunto;
    });
    const values = top10.map(a => a.count || a.quantidade || 0);
    const total = values.reduce((sum, v) => sum + v, 0);
    
    if (total === 0) return;
    
    const chart = await window.chartFactory?.createDoughnutChart('chartAssuntoPizza', labels, values, {
      field: 'assunto',
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
    
    window.chartAssuntoPizza = chart;
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderAssuntoPizzaChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de barras agrupadas: Assuntos por Status
 */
async function renderAssuntoStatusAgrupadasChart(dataAssuntos) {
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    const canvas = document.getElementById('chartAssuntoStatusAgrupadas');
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
    // Buscar dados de assuntos por status
    const assuntoStatusData = await window.dataLoader?.load('/api/aggregate/count-by-status?field=Assunto', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(assuntoStatusData) && assuntoStatusData.length > 0) {
      const top5 = dataAssuntos.slice(0, 5);
      const top5Keys = new Set(top5.map(a => a.subject || a.assunto || a._id));
      
      // Agrupar por assunto e status
      const assuntoStatusMap = new Map();
      const statusSet = new Set();
      
      assuntoStatusData.forEach(item => {
        const assunto = item.subject || item.assunto || item._id || 'Não informado';
        const status = item.status || item.statusDemanda || 'N/A';
        
        if (!top5Keys.has(assunto)) return;
        
        statusSet.add(status);
        
        if (!assuntoStatusMap.has(assunto)) {
          assuntoStatusMap.set(assunto, new Map());
        }
        
        assuntoStatusMap.get(assunto).set(status, item.count || 0);
      });
      
      const statuses = Array.from(statusSet);
      const labels = top5.map(a => {
        const assunto = a.subject || a.assunto || a._id;
        return assunto.length > 20 ? assunto.substring(0, 20) + '...' : assunto;
      });
      
      const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa'];
      const datasets = statuses.map((status, idx) => {
        const values = top5.map(a => {
          const assunto = a.subject || a.assunto || a._id;
          const statusMap = assuntoStatusMap.get(assunto) || new Map();
          return statusMap.get(status) || 0;
        });
        
        return {
          label: status,
          data: values,
          backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.7)'),
          borderColor: colors[idx % colors.length],
          borderWidth: 1
        };
      });
      
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartAssuntoStatusAgrupadas');
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
        
        window.chartAssuntoStatusAgrupadas = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderAssuntoStatusAgrupadasChart', { showToUser: false });
  }
}

window.loadAssunto = loadAssunto;

// Inicializar listeners quando o script carregar
function initAssuntoPage() {
  initAssuntoFilterListeners();
  
  // Usar o novo helper que suporta mês e status
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Assunto',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadAssunto();
      },
      mesSelecionado: filtroMesAssunto
    });
  } else {
    // Tentar novamente após um delay se o helper não estiver disponível
    setTimeout(initAssuntoPage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAssuntoPage);
} else {
  initAssuntoPage();
}

async function renderAssuntoChart(dataAssuntos) {
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderAssuntoChart: dados inválidos ou vazios', dataAssuntos);
    }
    return;
  }
  
  const top15 = dataAssuntos.slice(0, 15);
  const labels = top15.map(a => a.subject || a.assunto || a._id || 'N/A');
  const values = top15.map(a => a.count || a.quantidade || 0);
  
  if (window.Logger) {
    window.Logger.debug('📊 renderAssuntoChart:', { total: dataAssuntos.length, top15: top15.length, sample: top15[0] });
  }
  
  const assuntoChart = await window.chartFactory?.createBarChart('chartAssunto', labels, values, {
    horizontal: true,
    colorIndex: 3,
    label: 'Manifestações',
      onClick: false
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de assunto
  // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
  setTimeout(() => {
    if (assuntoChart && top15 && assuntoChart.canvas && assuntoChart.canvas.ownerDocument) {
      try {
        window.addCrossfilterToChart(assuntoChart, top15, {
          field: 'assunto',
          valueField: 'subject',
          onFilterChange: () => {
            if (window.loadAssunto) window.loadAssunto();
          },
          onClearFilters: () => {
            if (window.loadAssunto) window.loadAssunto();
          }
        });
        
        if (window.Logger) {
          window.Logger.debug('✅ Gráfico chartAssunto conectado ao crossfilter');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao adicionar crossfilter ao gráfico assunto:', error);
        }
      }
    }
  }, 100);
}

async function renderStatusAssuntoChart(dataAssuntos) {
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderStatusAssuntoChart: dados inválidos ou vazios');
    }
    return;
  }
  
  // Se os dados não têm statusCounts, buscar status geral
  // Usar dashboard-data que já tem os dados de status
  try {
    const dashboardData = await window.dataLoader?.load('/api/dashboard-data', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};
    
    const statusData = dashboardData.manifestationsByStatus || [];
    
    if (statusData.length > 0) {
      const labels = statusData.map(s => s.status || s._id || 'N/A');
      const values = statusData.map(s => s.count || 0);
      
      const statusChart = await window.chartFactory?.createDoughnutChart('chartStatusAssunto', labels, values, {
        type: 'doughnut',
        onClick: false,
        legendContainer: 'legendStatusAssunto'
      });
      
      // CROSSFILTER: Adicionar filtros ao gráfico de status
      // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
      setTimeout(() => {
        if (statusChart && statusData && statusChart.canvas && statusChart.canvas.ownerDocument) {
          try {
            window.addCrossfilterToChart(statusChart, statusData, {
              field: 'status',
              valueField: 'status',
              onFilterChange: () => {
                if (window.loadAssunto) window.loadAssunto();
              },
              onClearFilters: () => {
                if (window.loadAssunto) window.loadAssunto();
              }
            });
            
            if (window.Logger) {
              window.Logger.debug('✅ Gráfico chartStatusAssunto conectado ao crossfilter');
            }
          } catch (error) {
            if (window.Logger) {
              window.Logger.warn('Erro ao adicionar crossfilter ao gráfico status assunto:', error);
            }
          }
        }
      }, 100);
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar status por assunto:', error);
    }
  }
}

async function renderAssuntoMesChart(dataAssuntoMes) {
  if (!dataAssuntoMes || !Array.isArray(dataAssuntoMes) || dataAssuntoMes.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderAssuntoMesChart: dados inválidos ou vazios');
    }
    return;
  }
  
  const meses = [...new Set(dataAssuntoMes.map(d => d.month || d.ym))].sort();
  const assuntos = [...new Set(dataAssuntoMes.map(d => d.subject || d.assunto || d._id))].slice(0, 20);
  
  if (meses.length === 0 || assuntos.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderAssuntoMesChart: sem meses ou assuntos para renderizar');
    }
    return;
  }
  
  const datasets = assuntos.map((assunto, idx) => {
    const data = meses.map(mes => {
      const item = dataAssuntoMes.find(d => 
        (d.month === mes || d.ym === mes) && (d.subject === assunto || d.assunto === assunto || d._id === assunto)
      );
      return item?.count || 0;
    });
    return {
      label: assunto,
      data: data
    };
  });
  
  const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
  
  const assuntoMesChart = await window.chartFactory?.createBarChart('chartAssuntoMes', labels, datasets, {
    colorIndex: 0,
    legendContainer: 'legendAssuntoMes'
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de assunto por mês
  if (assuntoMesChart && assuntos) {
    if (assuntoMesChart.options) {
      const originalOnClick = assuntoMesChart.options.onClick;
      assuntoMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          
          if (datasetIndex >= 0 && datasetIndex < assuntos.length) {
            const assunto = assuntos[datasetIndex];
            const multiSelect = event.native?.ctrlKey || event.native?.metaKey || false;
            
            if (window.crossfilterOverview) {
              // Não há filtro de assunto no crossfilterOverview, usar chartCommunication
              if (window.chartCommunication && window.chartCommunication.filters) {
                const existingFilters = window.chartCommunication.filters.filters || [];
                const newFilter = { field: 'Assunto', op: 'eq', value: assunto };
                
                if (multiSelect) {
                  const exists = existingFilters.some(f => f.field === 'Assunto' && f.value === assunto);
                  if (!exists) {
                    window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                  }
                } else {
                  window.chartCommunication.filters.filters = [
                    ...existingFilters.filter(f => f.field !== 'Assunto'),
                    newFilter
                  ];
                }
                
                if (window.chartCommunication.onFilterChange) {
                  window.chartCommunication.onFilterChange();
                }
              }
            } else if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'Assunto', op: 'eq', value: assunto };
              
              if (multiSelect) {
                const exists = existingFilters.some(f => f.field === 'Assunto' && f.value === assunto);
                if (!exists) {
                  window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                }
              } else {
                window.chartCommunication.filters.filters = [
                  ...existingFilters.filter(f => f.field !== 'Assunto'),
                  newFilter
                ];
              }
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadAssunto) {
              setTimeout(() => window.loadAssunto(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (assuntoMesChart.canvas) {
      const container = assuntoMesChart.canvas.parentElement;
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
          if (window.loadAssunto) setTimeout(() => window.loadAssunto(), 100);
        });
      }
    }
  }
}

/**
 * Atualizar KPIs da página Assunto
 */
function updateAssuntoKPIs(dataAssuntos) {
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    return;
  }
  
  const total = dataAssuntos.reduce((sum, item) => sum + (item.count || item.quantidade || 0), 0);
  const assuntosUnicos = dataAssuntos.length;
  const mediaAssunto = assuntosUnicos > 0 ? Math.round(total / assuntosUnicos) : 0;
  const assuntoMaisComum = dataAssuntos.length > 0 ? (dataAssuntos[0].subject || dataAssuntos[0].assunto || dataAssuntos[0]._id || 'N/A') : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalAssunto');
  const kpiUnicos = document.getElementById('kpiAssuntosUnicos');
  const kpiMedia = document.getElementById('kpiMediaAssunto');
  const kpiMaisComum = document.getElementById('kpiAssuntoMaisComum');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = assuntosUnicos.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaAssunto.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = assuntoMaisComum.length > 20 ? assuntoMaisComum.substring(0, 20) + '...' : assuntoMaisComum;
    kpiMaisComum.title = assuntoMaisComum; // Tooltip com nome completo
  }
}

function renderAssuntosList(dataAssuntos) {
  const listaAssuntos = document.getElementById('listaAssuntos');
  if (!listaAssuntos) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderAssuntosList: elemento listaAssuntos não encontrado');
    }
    return;
  }
  
  if (!dataAssuntos || !Array.isArray(dataAssuntos) || dataAssuntos.length === 0) {
    listaAssuntos.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum assunto encontrado</div>';
    if (window.Logger) {
      window.Logger.warn('⚠️ renderAssuntosList: dados inválidos ou vazios', dataAssuntos);
    }
    return;
  }
  
  if (window.Logger) {
    window.Logger.debug('📊 renderAssuntosList:', { total: dataAssuntos.length, sample: dataAssuntos[0] });
  }
  
  listaAssuntos.innerHTML = dataAssuntos.map((item, idx) => {
    const assunto = item.subject || item.assunto || item._id || 'N/A';
    const count = item.count || item.quantidade || 0;
    return `
      <div class="assunto-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
           data-assunto="${assunto}" 
           data-value="${assunto}"
           title="Clique para filtrar por ${assunto} | Clique direito para limpar filtros">
        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-400 w-8">${idx + 1}.</span>
          <span class="text-sm text-slate-300">${assunto}</span>
        </div>
        <span class="text-sm font-bold text-emerald-300">${count.toLocaleString('pt-BR')}</span>
      </div>
    `;
  }).join('');
  
  // CROSSFILTER: Tornar itens da lista clicáveis
  setTimeout(() => {
    const assuntoItems = listaAssuntos.querySelectorAll('.assunto-item');
    if (assuntoItems.length > 0 && window.makeCardsClickable) {
      window.makeCardsClickable({
        cards: Array.from(assuntoItems).map(item => ({
          selector: `.assunto-item[data-assunto="${item.dataset.assunto}"]`,
          value: item.dataset.assunto,
          field: 'assunto'
        })),
        field: 'assunto',
        getValueFromCard: (card) => card.dataset.assunto
      });
    }
  }, 100);
}

