/**
 * ============================================================================
 * PÁGINA: e-SIC - POR RESPONSÁVEL
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das solicitações de informação
 * agrupadas por responsável.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de solicitações por responsável (gráfico de barras horizontal)
 * - Ranking dos responsáveis com mais solicitações
 * - Estatísticas agregadas
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - responsavel: Responsável pela solicitação
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicResponsavel = window.loadEsicResponsavel || function() { return Promise.resolve(); };

async function loadEsicResponsavel() {
  if (window.Logger) {
    window.Logger.debug('👤 loadEsicResponsavel: Iniciando');
  }
  
  const page = document.getElementById('page-esic-responsavel');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['esic-chart-responsavel-detail']);
    }
    
    const responsavelData = await window.dataLoader?.load('/api/esic/count-by?field=responsavel', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(responsavelData) || responsavelData.length === 0) {
      if (window.Logger) {
        window.Logger.warn('👤 loadEsicResponsavel: Dados não são um array válido', responsavelData);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...responsavelData].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    if (labels.length > 0 && values.length > 0) {
      const chartResp = await window.chartFactory?.createBarChart('esic-chart-responsavel-detail', labels, values, {
        horizontal: true,
        colorIndex: 2,
        onClick: true, // Habilitar interatividade para crossfilter
        field: 'responsavel'
      });
      
      // CROSSFILTER: Adicionar sistema de filtros
      if (chartResp && sortedData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartResp, sortedData, {
          field: 'responsavel',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicResponsavel) setTimeout(() => window.loadEsicResponsavel(), 100);
          },
          onClearFilters: () => {
            if (window.loadEsicResponsavel) setTimeout(() => window.loadEsicResponsavel(), 100);
          }
        });
      }
    }
    
    // Renderizar ranking
    renderResponsavelRanking(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => {
          if (window.loadEsicResponsavel) window.loadEsicResponsavel();
        },
        pageLoadFunction: window.loadEsicResponsavel
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#esic-responsavel-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const resp = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: resp,
              field: 'responsavel'
            };
          }),
          field: 'responsavel',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]');
            return textEl ? textEl.getAttribute('title') : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('👤 loadEsicResponsavel: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Responsável e-SIC:', error);
    }
  }
}

/**
 * Renderizar ranking de responsáveis
 */
function renderResponsavelRanking(data) {
  const rankEl = document.getElementById('esic-responsavel-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  rankEl.innerHTML = data.slice(0, 20).map((item, idx) => {
    const responsavel = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${responsavel}">${responsavel}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-emerald-300">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-responsavel', loadEsicResponsavel, 500);
}

window.loadEsicResponsavel = loadEsicResponsavel;
