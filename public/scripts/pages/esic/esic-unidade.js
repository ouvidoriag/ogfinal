/**
 * ============================================================================
 * PÁGINA: e-SIC - POR UNIDADE
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das solicitações de informação
 * agrupadas por unidade de contato.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de solicitações por unidade (gráfico de barras horizontal)
 * - Ranking das unidades com mais solicitações
 * - Estatísticas agregadas
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - unidadeContato: Unidade de contato
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicUnidade = window.loadEsicUnidade || function() { return Promise.resolve(); };

async function loadEsicUnidade() {
  if (window.Logger) {
    window.Logger.debug('🏢 loadEsicUnidade: Iniciando');
  }
  
  const page = document.getElementById('page-esic-unidade');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['esic-chart-unidade-detail']);
    }
    
    const unidadeData = await window.dataLoader?.load('/api/esic/count-by?field=unidadeContato', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(unidadeData) || unidadeData.length === 0) {
      if (window.Logger) {
        window.Logger.warn('🏢 loadEsicUnidade: Dados não são um array válido', unidadeData);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...unidadeData].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    if (labels.length > 0 && values.length > 0) {
      const chartUnidade = await window.chartFactory?.createBarChart('esic-chart-unidade-detail', labels, values, {
        horizontal: true,
        colorIndex: 3,
        onClick: true, // Habilitar interatividade para crossfilter
        field: 'unidade'
      });
      
      // CROSSFILTER: Adicionar sistema de filtros
      if (chartUnidade && sortedData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartUnidade, sortedData, {
          field: 'unidade',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicUnidade) setTimeout(() => window.loadEsicUnidade(), 100);
          },
          onClearFilters: () => {
            if (window.loadEsicUnidade) setTimeout(() => window.loadEsicUnidade(), 100);
          }
        });
      }
    }
    
    // Renderizar ranking
    renderUnidadeRanking(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => {
          if (window.loadEsicUnidade) window.loadEsicUnidade();
        },
        pageLoadFunction: window.loadEsicUnidade
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#esic-unidade-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const unidade = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: unidade,
              field: 'unidade'
            };
          }),
          field: 'unidade',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]');
            return textEl ? textEl.getAttribute('title') : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('🏢 loadEsicUnidade: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Unidade e-SIC:', error);
    }
  }
}

/**
 * Renderizar ranking de unidades
 */
function renderUnidadeRanking(data) {
  const rankEl = document.getElementById('esic-unidade-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  rankEl.innerHTML = data.slice(0, 20).map((item, idx) => {
    const unidade = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${unidade}">${unidade}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-violet-300">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-unidade', loadEsicUnidade, 500);
}

window.loadEsicUnidade = loadEsicUnidade;
