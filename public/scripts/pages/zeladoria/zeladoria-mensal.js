/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE MENSAL
 * ============================================================================
 * 
 * Esta página apresenta uma análise temporal das ocorrências de zeladoria,
 * mostrando a evolução mensal das demandas ao longo do tempo e permitindo
 * identificar tendências, sazonalidades e picos de demanda.
 * 
 * DADOS EXIBIDOS:
 * - Evolução mensal de ocorrências (gráfico de linha)
 * - Comparação entre meses
 * - Estatísticas de crescimento/declínio
 * - Dados adicionais: status, categoria, departamento por mês
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - dataCriacaoIso: Data de criação normalizada (YYYY-MM-DD)
 * - status: Status atual da demanda
 * - categoria: Categoria da demanda
 * - departamento: Departamento responsável
 * 
 * ============================================================================
 */

/**
 * Função principal de carregamento da página
 * Carrega e renderiza todos os dados relacionados à análise mensal
 */
async function loadZeladoriaMensal() {
  if (window.Logger) {
    window.Logger.debug('📅 loadZeladoriaMensal: Iniciando carregamento da página');
  }
  
  const page = document.getElementById('page-zeladoria-mensal');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // ========================================================================
    // ETAPA 1: Limpeza de gráficos existentes
    // ========================================================================
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-mensal-chart',
        'zeladoria-mensal-status-chart',
        'zeladoria-mensal-categoria-chart'
      ]);
    }
    
    // ========================================================================
    // ETAPA 2: Carregar dados mensais principais
    // ========================================================================
    const data = await window.dataLoader?.load('/api/zeladoria/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📅 loadZeladoriaMensal: Nenhum dado mensal disponível');
      }
      return;
    }
    
    // ========================================================================
    // ETAPA 3: Criar gráfico principal de evolução mensal
    // ========================================================================
    // Formatar labels para exibição amigável (MM/YYYY)
    const labels = data.map(d => {
      const [year, month] = (d.month || '').split('-');
      if (year && month) {
        return `${month}/${year}`;
      }
      return d.month || 'N/A';
    });
    const values = data.map(d => d.count || 0);
    
    // Gráfico de linha mostrando a evolução temporal
    const chartMensal = await window.chartFactory?.createLineChart('zeladoria-mensal-chart', labels, values, {
      colorIndex: 0,
      onClick: true, // Habilitar interatividade para crossfilter
      label: 'Ocorrências',
      legendContainer: 'zeladoria-mensal-legend'
    });
    
    // CROSSFILTER: Adicionar sistema de filtros (filtro por mês/período)
    if (chartMensal && data && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartMensal, data, {
        field: 'month',
        valueField: 'month',
        onFilterChange: () => {
          if (window.loadZeladoriaMensal) setTimeout(() => window.loadZeladoriaMensal(), 100);
        }
      });
    }
    
    // ========================================================================
    // ETAPA 4: Carregar e renderizar dados adicionais por status
    // ========================================================================
    const statusMesData = await window.dataLoader?.load('/api/zeladoria/by-status-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};
    
    if (Object.keys(statusMesData).length > 0) {
      await renderMensalStatusChart(statusMesData, labels);
    }
    
    // ========================================================================
    // ETAPA 5: Renderizar estatísticas mensais
    // ========================================================================
    renderMensalStats(data);
    
    // ========================================================================
    // ETAPA 6: Atualizar KPIs no header
    // ========================================================================
    updateZeladoriaMensalKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateZeladoriaMensalKPIs(data),
        pageLoadFunction: window.loadZeladoriaMensal
      });
    }
    
    if (window.Logger) {
      window.Logger.success('📅 loadZeladoriaMensal: Carregamento concluído com sucesso');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Mensal Zeladoria:', error);
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderMensalStatusChart
 * ========================================================================
 * Renderiza um gráfico de barras agrupadas mostrando a evolução dos
 * status ao longo dos meses, permitindo identificar mudanças no
 * perfil de atendimento.
 * 
 * PARÂMETROS:
 * - statusMesData: Objeto com estrutura {month: {status: count}}
 * - labels: Array de labels dos meses formatados
 * ========================================================================
 */
async function renderMensalStatusChart(statusMesData, labels) {
  // Extrair todos os status únicos
  const statuses = new Set();
  for (const monthData of Object.values(statusMesData)) {
    Object.keys(monthData).forEach(status => statuses.add(status));
  }
  
  const statusArray = Array.from(statuses);
  
  // Criar datasets para cada status
  const datasets = statusArray.map(status => {
    const data = labels.map(label => {
      // Converter label MM/YYYY de volta para YYYY-MM
      const [month, year] = label.split('/');
      const monthKey = `${year}-${month.padStart(2, '0')}`;
      return statusMesData[monthKey]?.[status] || 0;
    });
    return {
      label: status || 'N/A',
      data: data
    };
  });
  
  const canvas = document.getElementById('zeladoria-mensal-status-chart');
  if (canvas) {
    const chartStatus = await window.chartFactory?.createBarChart('zeladoria-mensal-status-chart', labels, datasets, {
      colorIndex: 0,
      onClick: true, // Habilitar interatividade para crossfilter
      field: 'status',
      legendContainer: 'zeladoria-mensal-status-legend'
    });
    
    // CROSSFILTER: Adicionar sistema de filtros ao gráfico de status mensal
    if (chartStatus && statusArray && window.addCrossfilterToChart) {
      const statusData = statusArray.map(status => ({
        status,
        month: labels.map((label, idx) => {
          const [month, year] = label.split('/');
          return `${year}-${month.padStart(2, '0')}`;
        })
      }));
      
      window.addCrossfilterToChart(chartStatus, statusData, {
        field: 'status',
        valueField: 'status',
        onFilterChange: () => {
          if (window.loadZeladoriaMensal) setTimeout(() => window.loadZeladoriaMensal(), 100);
        }
      });
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-mensal-status-chart não encontrado, gráfico não será criado');
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderMensalStats
 * ========================================================================
 * Renderiza cards com estatísticas agregadas sobre a evolução mensal,
 * incluindo crescimento, média mensal e picos de demanda.
 * 
 * PARÂMETROS:
 * - data: Array com dados mensais {month, count}
 * ========================================================================
 */
function renderMensalStats(data) {
  const statsEl = document.getElementById('zeladoria-mensal-stats');
  if (!statsEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const mediaMensal = data.length > 0 ? (total / data.length).toFixed(0) : 0;
  const maxMes = data.reduce((max, item) => (item.count || 0) > (max.count || 0) ? item : max, data[0] || {});
  const minMes = data.reduce((min, item) => (item.count || 0) < (min.count || 0) ? item : min, data[0] || {});
  
  // Calcular crescimento (último mês vs penúltimo)
  let crescimento = '—';
  if (data.length >= 2) {
    const ultimo = data[data.length - 1]?.count || 0;
    const penultimo = data[data.length - 2]?.count || 0;
    if (penultimo > 0) {
      const percent = ((ultimo - penultimo) / penultimo * 100).toFixed(1);
      crescimento = `${percent > 0 ? '+' : ''}${percent}%`;
    }
  }
  
  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Total de ocorrências no período">
        <div class="text-xs text-slate-400 mb-1">Total no Período</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">${data.length} meses</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Média de ocorrências por mês">
        <div class="text-xs text-slate-400 mb-1">Média Mensal</div>
        <div class="text-2xl font-bold text-violet-300">${mediaMensal}</div>
        <div class="text-xs text-slate-500 mt-1">Ocorrências/mês</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Mês com maior número de ocorrências">
        <div class="text-xs text-slate-400 mb-1">Pico de Demanda</div>
        <div class="text-lg font-bold text-amber-300">${maxMes?.count || 0}</div>
        <div class="text-xs text-slate-400 mt-1">${maxMes?.month || 'N/A'}</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Crescimento do último mês">
        <div class="text-xs text-slate-400 mb-1">Crescimento</div>
        <div class="text-2xl font-bold text-emerald-300">${crescimento}</div>
        <div class="text-xs text-slate-500 mt-1">vs mês anterior</div>
      </div>
    </div>
  `;
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaMensalKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const mediaMensal = data.length > 0 ? Math.round(total / data.length) : 0;
  const maxMes = data.reduce((max, item) => (item.count || 0) > (max.count || 0) ? item : max, data[0] || {});
  const pico = maxMes?.count || 0;
  
  // Calcular crescimento
  let crescimento = '—';
  if (data.length >= 2) {
    const ultimo = data[data.length - 1]?.count || 0;
    const penultimo = data[data.length - 2]?.count || 0;
    if (penultimo > 0) {
      const percent = ((ultimo - penultimo) / penultimo * 100).toFixed(1);
      crescimento = `${percent > 0 ? '+' : ''}${percent}%`;
    }
  }
  
  const totalEl = document.getElementById('zeladoria-mensal-kpi-total');
  const mediaEl = document.getElementById('zeladoria-mensal-kpi-media');
  const picoEl = document.getElementById('zeladoria-mensal-kpi-pico');
  const crescimentoEl = document.getElementById('zeladoria-mensal-kpi-crescimento');
  
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (mediaEl) mediaEl.textContent = mediaMensal.toLocaleString('pt-BR');
  if (picoEl) picoEl.textContent = pico.toLocaleString('pt-BR');
  if (crescimentoEl) crescimentoEl.textContent = crescimento;
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-mensal', loadZeladoriaMensal, 500);
}

window.loadZeladoriaMensal = loadZeladoriaMensal;
