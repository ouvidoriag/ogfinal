/**
 * ============================================================================
 * PÁGINA: e-SIC - POR CANAL
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das solicitações de informação
 * agrupadas por canal de entrada.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de solicitações por canal (gráfico de barras horizontal)
 * - Ranking dos canais mais utilizados
 * - Estatísticas agregadas
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - canal: Canal de entrada
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicCanal = window.loadEsicCanal || function() { return Promise.resolve(); };

async function loadEsicCanal() {
  if (window.Logger) {
    window.Logger.debug('📞 loadEsicCanal: Iniciando');
  }
  
  const page = document.getElementById('page-esic-canal');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['esic-chart-canal-detail']);
    }
    
    const canalData = await window.dataLoader?.load('/api/esic/count-by?field=canal', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(canalData) || canalData.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📞 loadEsicCanal: Dados não são um array válido', canalData);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...canalData].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    if (labels.length > 0 && values.length > 0) {
      const chartCanal = await window.chartFactory?.createBarChart('esic-chart-canal-detail', labels, values, {
        horizontal: true,
        colorIndex: 4,
        onClick: true, // Habilitar interatividade para crossfilter
        field: 'canal'
      });
      
      // CROSSFILTER: Adicionar sistema de filtros
      if (chartCanal && sortedData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartCanal, sortedData, {
          field: 'canal',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicCanal) setTimeout(() => window.loadEsicCanal(), 100);
          },
          onClearFilters: () => {
            if (window.loadEsicCanal) setTimeout(() => window.loadEsicCanal(), 100);
          }
        });
      }
    }
    
    // Renderizar ranking
    renderCanalRanking(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => {
          if (window.loadEsicCanal) window.loadEsicCanal();
        },
        pageLoadFunction: window.loadEsicCanal
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#esic-canal-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const canal = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: canal,
              field: 'canal'
            };
          }),
          field: 'canal',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]');
            return textEl ? textEl.getAttribute('title') : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('📞 loadEsicCanal: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Canal e-SIC:', error);
    }
  }
}

/**
 * Renderizar ranking de canais
 */
function renderCanalRanking(data) {
  const rankEl = document.getElementById('esic-canal-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  rankEl.innerHTML = data.slice(0, 20).map((item, idx) => {
    const canal = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${canal}">${canal}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-pink-300">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-canal', loadEsicCanal, 500);
}

window.loadEsicCanal = loadEsicCanal;
