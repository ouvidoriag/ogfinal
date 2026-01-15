/**
 * ============================================================================
 * PÁGINA: e-SIC - ANÁLISE MENSAL
 * ============================================================================
 * 
 * Esta página apresenta uma análise temporal das solicitações de informação,
 * mostrando a evolução mensal das solicitações.
 * 
 * DADOS EXIBIDOS:
 * - Evolução mensal das solicitações (gráfico de linha)
 * - Estatísticas mensais (total, média, pico, tendência)
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - dataCriacaoIso: Data de criação normalizada
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicMensal = window.loadEsicMensal || function() { return Promise.resolve(); };

async function loadEsicMensal() {
  if (window.Logger) {
    window.Logger.debug('📅 loadEsicMensal: Iniciando');
  }
  
  const page = document.getElementById('page-esic-mensal');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['esic-chart-mensal-detail']);
    }
    
    const mensalData = await window.dataLoader?.load('/api/esic/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(mensalData) || mensalData.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📅 loadEsicMensal: Dados não são um array válido', mensalData);
      }
      return;
    }
    
    // Ordenar por mês
    const sortedData = [...mensalData].sort((a, b) => {
      const monthA = a.month || a.ym || a._id?.month || '';
      const monthB = b.month || b.ym || b._id?.month || '';
      return monthA.localeCompare(monthB);
    });
    
    const labels = sortedData.map(d => {
      const month = d.month || d.ym || d._id?.month || '';
      if (month.includes('-')) {
        const [year, monthNum] = month.split('-');
        return `${monthNum}/${year}`;
      }
      return month;
    });
    const values = sortedData.map(d => d.count || 0);
    
    if (labels.length > 0 && values.length > 0) {
      const chartMensal = await window.chartFactory?.createLineChart('esic-chart-mensal-detail', labels, values, {
        colorIndex: 5,
        onClick: true, // Habilitar interatividade para crossfilter
        fill: true,
        tension: 0.4
      });
      
      // CROSSFILTER: Adicionar sistema de filtros (filtro por mês/período)
      if (chartMensal && sortedData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartMensal, sortedData, {
          field: 'month',
          valueField: 'month',
          onFilterChange: () => {
            if (window.loadEsicMensal) setTimeout(() => window.loadEsicMensal(), 100);
          }
        });
      }
    }
    
    // Renderizar estatísticas mensais
    renderMensalStats(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => {
          if (window.loadEsicMensal) window.loadEsicMensal();
        },
        pageLoadFunction: window.loadEsicMensal
      });
    }
    
    if (window.Logger) {
      window.Logger.success('📅 loadEsicMensal: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Análise Mensal e-SIC:', error);
    }
  }
}

/**
 * Renderizar estatísticas mensais
 */
function renderMensalStats(data) {
  const statsEl = document.getElementById('esic-mensal-stats');
  if (!statsEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const media = data.length > 0 ? Math.round(total / data.length) : 0;
  const max = Math.max(...data.map(d => d.count || 0));
  const min = Math.min(...data.map(d => d.count || 0));
  const maxIndex = data.findIndex(d => (d.count || 0) === max);
  const minIndex = data.findIndex(d => (d.count || 0) === min);
  
  const maxMonth = data[maxIndex] ? (data[maxIndex].month || data[maxIndex].ym || 'N/A') : 'N/A';
  const minMonth = data[minIndex] ? (data[minIndex].month || data[minIndex].ym || 'N/A') : 'N/A';
  
  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Total</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Média Mensal</div>
        <div class="text-2xl font-bold text-emerald-300">${media.toLocaleString('pt-BR')}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Mês com Mais</div>
        <div class="text-2xl font-bold text-amber-300">${max.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">${maxMonth}</div>
      </div>
      <div class="glass rounded-lg p-4">
        <div class="text-xs text-slate-400 mb-1">Mês com Menos</div>
        <div class="text-2xl font-bold text-violet-300">${min.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">${minMonth}</div>
      </div>
    </div>
  `;
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-mensal', loadEsicMensal, 500);
}

window.loadEsicMensal = loadEsicMensal;
