/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE POR STATUS
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das ocorrências de zeladoria
 * agrupadas por status, permitindo monitorar o estado atual das demandas
 * e identificar gargalos no processo de atendimento.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de ocorrências por status (gráfico de rosca)
 * - Ranking dos status mais frequentes
 * - Evolução mensal das ocorrências por status
 * - Estatísticas agregadas (total, fechados, abertos, taxa de resolução)
 * - Dados adicionais: categoria, departamento, tempo médio por status
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - status: Status atual da demanda (NOVO, ABERTO, ATENDIMENTO, FECHADO, etc.)
 * - categoria: Categoria das demandas
 * - departamento: Departamento responsável
 * - dataCriacao: Data de criação
 * - dataConclusao: Data de conclusão (para cálculo de tempo médio)
 * 
 * ============================================================================
 */

async function loadZeladoriaStatus() {
  if (window.Logger) {
    window.Logger.debug('📊 loadZeladoriaStatus: Iniciando');
  }

  const page = document.getElementById('page-zeladoria-status');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }

  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-status-chart',
        'zeladoria-status-mes-chart',
        'zeladoria-status-departamento-chart'
      ]);
    }

    // Carregar dados por status
    const data = await window.dataLoader?.load('/api/zeladoria/count-by?field=status', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📊 loadZeladoriaStatus: Dados não são um array válido', data);
      }
      return;
    }

    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);

    // Criar gráfico principal (doughnut)
    // PADRONIZAÇÃO: Usar campo 'status' para detecção automática de cores do sistema centralizado
    const legendContainer = document.getElementById('zeladoria-status-legend');
    const chartStatus = await window.chartFactory?.createDoughnutChart('zeladoria-status-chart', labels, values, {
      onClick: true, // Habilitar interatividade para crossfilter
      field: 'status', // Especificar campo para usar cores padronizadas do config.js
      ...(legendContainer && { legendContainer: 'zeladoria-status-legend' })
    });

    // CROSSFILTER: Adicionar sistema de filtros
    if (chartStatus && sortedData && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartStatus, sortedData, {
        field: 'status',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadZeladoriaStatus) setTimeout(() => window.loadZeladoriaStatus(), 100);
        },
        onClearFilters: () => {
          if (window.loadZeladoriaStatus) setTimeout(() => window.loadZeladoriaStatus(), 100);
        }
      });
    }

    // Renderizar ranking de status
    renderStatusRanking(sortedData);

    // Carregar dados mensais por status
    const dataMes = await window.dataLoader?.load('/api/zeladoria/by-status-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (dataMes.length > 0) {
      await renderStatusMesChart(dataMes);
    }

    // Carregar status por departamento
    const statusDepartamento = await window.dataLoader?.load('/api/zeladoria/by-status-departamento', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};

    if (Object.keys(statusDepartamento).length > 0) {
      await renderStatusDepartamentoChart(statusDepartamento);
    }

    // Carregar estatísticas adicionais
    const stats = await window.dataLoader?.load('/api/zeladoria/stats', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};

    renderStatusStats(stats, sortedData);

    // Atualizar KPIs no header
    updateZeladoriaStatusKPIs(stats, sortedData);

    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateZeladoriaStatusKPIs(stats, sortedData),
        pageLoadFunction: window.loadZeladoriaStatus
      });
    }

    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#zeladoria-status-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const status = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: status,
              field: 'status'
            };
          }),
          field: 'status',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]');
            return textEl ? textEl.getAttribute('title') : '';
          }
        });
      }
    }, 500);

    if (window.Logger) {
      window.Logger.success('📊 loadZeladoriaStatus: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Status Zeladoria:', error);
    }
  }
}

/**
 * Renderizar gráfico de status por mês
 */
async function renderStatusMesChart(dataMes) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym || d._id?.month))].sort();
  const statuses = [...new Set(dataMes.map(d => d.status || d._id?.status))];

  const datasets = statuses.map((status, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => {
        const dMonth = d.month || d.ym || d._id?.month;
        const dStatus = d.status || d._id?.status;
        return dMonth === mes && dStatus === status;
      });
      return item?.count || 0;
    });
    return {
      label: status || 'N/A',
      data: data
    };
  });

  const labels = meses.map(m => {
    if (window.dateUtils?.formatMonthYearShort) {
      return window.dateUtils.formatMonthYearShort(m);
    }
    return m;
  });

  const canvas = document.getElementById('zeladoria-status-mes-chart');
  if (canvas) {
    // PADRONIZAÇÃO: Usar campo 'status' para detecção automática de cores
    const chartMes = await window.chartFactory?.createBarChart('zeladoria-status-mes-chart', labels, datasets, {
      field: 'status', // Especificar campo para usar cores padronizadas do config.js
      onClick: true, // Habilitar interatividade para crossfilter
      legendContainer: 'zeladoria-status-mes-legend'
    });

    // CROSSFILTER: Adicionar sistema de filtros ao gráfico mensal
    if (chartMes && dataMes && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartMes, dataMes, {
        field: 'status',
        valueField: 'status',
        onFilterChange: () => {
          if (window.loadZeladoriaStatus) setTimeout(() => window.loadZeladoriaStatus(), 100);
        }
      });
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-status-mes-chart não encontrado');
    }
  }
}


/**
 * Renderizar gráfico de status por departamento (Stacked Bar)
 */
async function renderStatusDepartamentoChart(data) {
  // Converter objeto em array para processamento
  const dataArray = [];
  for (const [departamento, statuses] of Object.entries(data)) {
    for (const [status, count] of Object.entries(statuses)) {
      dataArray.push({ departamento, status, count });
    }
  }

  // Extrair listas únicas
  const departamentos = [...new Set(dataArray.map(d => d.departamento))];
  const statuses = [...new Set(dataArray.map(d => d.status))];

  // Criar datasets para cada status
  const datasets = statuses.map((status, idx) => {
    const dataPoints = departamentos.map(dept => {
      const item = dataArray.find(d => d.departamento === dept && d.status === status);
      return item?.count || 0;
    });

    // Tentar obter cor do status
    const backgroundColor = window.config?.getColorByStatus?.(status);

    return {
      label: status,
      data: dataPoints,
      ...(backgroundColor && { backgroundColor })
    };
  });

  const canvasDept = document.getElementById('zeladoria-status-departamento-chart');
  if (canvasDept) {
    await window.chartFactory?.createBarChart('zeladoria-status-departamento-chart', departamentos, datasets, {
      stacked: true, // Barras empilhadas
      colorIndex: 0, // Fallback se não tiver cor específica
      onClick: true,
      legendContainer: 'zeladoria-status-dept-legend'
    });
  }
}

/**
 * Renderizar ranking de status
 */
function renderStatusRanking(data) {
  const rankEl = document.getElementById('zeladoria-status-ranking');
  if (!rankEl) return;

  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);

  rankEl.innerHTML = data.map((item, idx) => {
    const status = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

    // PADRONIZAÇÃO: Usar sistema centralizado de cores do config.js
    const color = window.config?.getColorByStatus?.(status) || '#94a3b8';

    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></div>
          <span class="text-sm text-slate-300 truncate" title="${status}">${status}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold" style="color: ${color}">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar estatísticas adicionais
 */
function renderStatusStats(stats, statusData) {
  const statsEl = document.getElementById('zeladoria-status-stats');
  if (!statsEl) return;

  const total = stats.total || statusData.reduce((sum, item) => sum + (item.count || 0), 0);
  const fechados = stats.fechados || statusData.find(s => s.key === 'FECHADO' || s._id === 'FECHADO')?.count || 0;
  const abertos = stats.abertos || statusData.find(s => s.key === 'ABERTO' || s._id === 'ABERTO')?.count || 0;
  const emAtendimento = statusData.find(s => s.key === 'ATENDIMENTO' || s._id === 'ATENDIMENTO')?.count || 0;
  const taxaResolucao = total > 0 ? ((fechados / total) * 100).toFixed(1) : 0;

  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Total</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Fechados</div>
        <div class="text-2xl font-bold text-emerald-300">${fechados.toLocaleString('pt-BR')}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Em Aberto</div>
        <div class="text-2xl font-bold text-amber-300">${abertos.toLocaleString('pt-BR')}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Taxa Resolução</div>
        <div class="text-2xl font-bold text-violet-300">${taxaResolucao}%</div>
      </div>
    </div>
  `;
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaStatusKPIs(stats, statusData) {
  if (!statusData || !Array.isArray(statusData) || statusData.length === 0) {
    return;
  }

  const total = stats.total || statusData.reduce((sum, item) => sum + (item.count || 0), 0);
  const fechados = stats.fechados || statusData.find(s => s.key === 'FECHADO' || s._id === 'FECHADO')?.count || 0;
  const abertos = stats.abertos || statusData.find(s => s.key === 'ABERTO' || s._id === 'ABERTO')?.count || 0;
  const taxaResolucao = total > 0 ? ((fechados / total) * 100).toFixed(1) : 0;

  const totalEl = document.getElementById('zeladoria-status-kpi-total');
  const fechadosEl = document.getElementById('zeladoria-status-kpi-fechados');
  const abertosEl = document.getElementById('zeladoria-status-kpi-abertos');
  const taxaEl = document.getElementById('zeladoria-status-kpi-taxa');

  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (fechadosEl) fechadosEl.textContent = fechados.toLocaleString('pt-BR');
  if (abertosEl) abertosEl.textContent = abertos.toLocaleString('pt-BR');
  if (taxaEl) taxaEl.textContent = `${taxaResolucao}%`;
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-status', loadZeladoriaStatus, 500);
}

window.loadZeladoriaStatus = loadZeladoriaStatus;
