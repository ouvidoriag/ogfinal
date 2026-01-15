/**
 * Página: Responsáveis
 * 
 * Recriada com estrutura otimizada
 */

// Usar helper global
const coletarFiltrosMes = window.MonthFilterHelper?.coletarFiltrosMes || (() => []);
const inicializarFiltroMes = window.MonthFilterHelper?.inicializarFiltroMes || (() => {});

let filtroMesResponsavel = '';

async function loadResponsavel() {
  if (window.Logger) {
    window.Logger.debug('👥 loadResponsavel: Iniciando');
  }
  
  const page = document.getElementById('page-responsavel');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Coletar filtros de mês
    const filtrosMes = coletarFiltrosMes('filtroMesResponsavel');
    
    // Combinar com filtros globais
    let activeFilters = filtrosMes;
    if (window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters?.filters || [];
      activeFilters = [...globalFilters, ...filtrosMes];
    }
    
    // Aplicar filtros se houver
    let data = [];
    if (activeFilters.length > 0) {
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: '/api/aggregate/count-by?field=Responsavel'
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          const responsavelMap = new Map();
          filteredData.forEach(record => {
            const responsavel = record.responsavel || record.data?.responsavel || 'N/A';
            responsavelMap.set(responsavel, (responsavelMap.get(responsavel) || 0) + 1);
          });
          
          data = Array.from(responsavelMap.entries())
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count);
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao aplicar filtros, carregando sem filtros:', error);
        }
      }
    }
    
    // Se não aplicou filtros, carregar normalmente
    if (data.length === 0) {
      data = await window.dataLoader?.load('/api/aggregate/count-by?field=Responsavel', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    const top20 = data.slice(0, 20);
    const labels = top20.map(x => x.key || x._id || 'N/A');
    const values = top20.map(x => x.count || 0);
    
    const responsavelChart = await window.chartFactory?.createBarChart('chartResponsavel', labels, values, {
      horizontal: true,
      colorIndex: 7,
      label: 'Manifestações',
      onClick: false
    });
    
    // CROSSFILTER: Adicionar filtros ao gráfico de responsável
    if (responsavelChart && top20) {
      window.addCrossfilterToChart(responsavelChart, top20, {
        field: 'responsavel',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadResponsavel) window.loadResponsavel();
        },
        onClearFilters: () => {
          if (window.loadResponsavel) window.loadResponsavel();
        }
      });
    }
    
    // Renderizar ranking
    const rankEl = document.getElementById('rankResponsavel');
    if (rankEl) {
      rankEl.innerHTML = top20.map((item, idx) => {
        const responsavel = item.key || item._id || 'N/A';
        return `
          <li class="rank-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
              data-responsavel="${responsavel}" 
              data-value="${responsavel}"
              title="Clique para filtrar por ${responsavel} | Clique direito para limpar filtros">
            <span class="text-violet-300">${responsavel}</span>
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
              selector: `.rank-item[data-responsavel="${item.dataset.responsavel}"]`,
              value: item.dataset.responsavel,
              field: 'responsavel'
            })),
            field: 'responsavel',
            getValueFromCard: (card) => card.dataset.responsavel
          });
        }
      }, 100);
    }
    
    // Renderizar gráficos adicionais
    await renderResponsavelTemporalChart(data);
    await renderResponsavelAgrupadasChart(data);
    
    // Atualizar KPIs
    updateResponsavelKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateResponsavelKPIs(data),
        pageLoadFunction: window.loadResponsavel
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-responsavel', {
          fieldMap: {
            'chartResponsavel': 'responsavel'
          },
          defaultField: 'responsavel',
          kpiUpdateFunction: () => updateResponsavelKPIs(data),
          pageLoadFunction: window.loadResponsavel
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('👥 loadResponsavel: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Responsavel:', error);
    }
  }
}

/**
 * Atualizar KPIs da página Responsável
 */
function updateResponsavelKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const responsaveisUnicos = data.length;
  const mediaResponsavel = responsaveisUnicos > 0 ? Math.round(total / responsaveisUnicos) : 0;
  const responsavelMaisAtivo = data.length > 0 ? (data[0].key || data[0]._id || 'N/A') : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalResponsavel');
  const kpiUnicos = document.getElementById('kpiResponsaveisUnicos');
  const kpiMedia = document.getElementById('kpiMediaResponsavel');
  const kpiMaisAtivo = document.getElementById('kpiResponsavelMaisAtivo');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = responsaveisUnicos.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaResponsavel.toLocaleString('pt-BR');
  if (kpiMaisAtivo) {
    kpiMaisAtivo.textContent = responsavelMaisAtivo.length > 20 ? responsavelMaisAtivo.substring(0, 20) + '...' : responsavelMaisAtivo;
    kpiMaisAtivo.title = responsavelMaisAtivo; // Tooltip com nome completo
  }
}

/**
 * Renderizar gráfico de linha temporal: Evolução dos responsáveis ao longo do tempo
 */
async function renderResponsavelTemporalChart(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    const canvas = document.getElementById('chartResponsavelTemporal');
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
    const responsaveisMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Responsavel', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(responsaveisMesData) && responsaveisMesData.length > 0) {
      const top5 = data.slice(0, 5);
      const top5Keys = new Set(top5.map(r => r.key || r._id));
      
      const responsaveisMap = new Map();
      const mesesSet = new Set();
      
      responsaveisMesData.forEach(item => {
        const responsavel = item.responsavel || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(responsavel)) return;
        
        mesesSet.add(mes);
        
        if (!responsaveisMap.has(responsavel)) {
          responsaveisMap.set(responsavel, new Map());
        }
        
        responsaveisMap.get(responsavel).set(mes, item.count || 0);
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
        const responsavel = item.key || item._id;
        const mesesMap = responsaveisMap.get(responsavel) || new Map();
        const values = meses.map(mes => mesesMap.get(mes) || 0);
        
        return {
          label: responsavel.length > 20 ? responsavel.substring(0, 20) + '...' : responsavel,
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
      
      const canvas = document.getElementById('chartResponsavelTemporal');
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
        
        window.chartResponsavelTemporal = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderResponsavelTemporalChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de barras agrupadas: Responsáveis por mês
 */
async function renderResponsavelAgrupadasChart(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    const canvas = document.getElementById('chartResponsavelAgrupadas');
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
    const responsaveisMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Responsavel', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(responsaveisMesData) && responsaveisMesData.length > 0) {
      const top5 = data.slice(0, 5);
      const top5Keys = new Set(top5.map(r => r.key || r._id));
      
      const mesesMap = new Map();
      responsaveisMesData.forEach(item => {
        const responsavel = item.responsavel || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(responsavel)) return;
        
        if (!mesesMap.has(mes)) {
          mesesMap.set(mes, new Map());
        }
        
        mesesMap.get(mes).set(responsavel, item.count || 0);
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
        const responsavel = item.key || item._id;
        const values = meses.map(mes => {
          const responsaveisMap = mesesMap.get(mes) || new Map();
          return responsaveisMap.get(responsavel) || 0;
        });
        
        return {
          label: responsavel.length > 20 ? responsavel.substring(0, 20) + '...' : responsavel,
          data: values,
          backgroundColor: colors[idx % colors.length].replace('rgb', 'rgba').replace(')', ', 0.7)'),
          borderColor: colors[idx % colors.length],
          borderWidth: 1
        };
      });
      
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartResponsavelAgrupadas');
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
        
        window.chartResponsavelAgrupadas = chart;
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderResponsavelAgrupadasChart', { showToUser: false });
  }
}

// Exportar função imediatamente
window.loadResponsavel = loadResponsavel;

// Conectar ao sistema global de filtros
// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-responsavel',
    listenerKey: '_responsavelListenerRegistered',
    loadFunction: loadResponsavel
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-responsavel', loadResponsavel, 500);
}

// Inicializar filtro por mês
function initResponsavelPage() {
  if (window.MonthFilterHelper && window.MonthFilterHelper.inicializarFiltroMes) {
    window.MonthFilterHelper.inicializarFiltroMes({
      selectId: 'filtroMesResponsavel',
      endpoint: '/api/aggregate/by-month',
      mesSelecionado: filtroMesResponsavel,
      onChange: async (novoMes) => {
        filtroMesResponsavel = novoMes;
        await loadResponsavel();
      }
    });
  } else {
    setTimeout(initResponsavelPage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResponsavelPage);
} else {
  initResponsavelPage();
}

