/**
 * ============================================================================
 * PÁGINA: e-SIC - POR TIPO DE INFORMAÇÃO
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das solicitações de informação
 * agrupadas por tipo de informação solicitada.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de solicitações por tipo de informação (gráfico de barras horizontal)
 * - Ranking dos tipos mais solicitados
 * - Estatísticas agregadas
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - tipoInformacao: Tipo de informação solicitada
 * 
 * ============================================================================
 */

// Expor função globalmente ANTES de definir (para garantir disponibilidade)
window.loadEsicTipoInformacao = window.loadEsicTipoInformacao || function() { return Promise.resolve(); };

async function loadEsicTipoInformacao() {
  if (window.Logger) {
    window.Logger.debug('📑 loadEsicTipoInformacao: Iniciando');
  }
  
  const page = document.getElementById('page-esic-tipo-informacao');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['esic-chart-tipo-informacao-detail']);
    }
    
    const tipoData = await window.dataLoader?.load('/api/esic/count-by?field=tipoInformacao', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(tipoData) || tipoData.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📑 loadEsicTipoInformacao: Dados não são um array válido', tipoData);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...tipoData].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    if (labels.length > 0 && values.length > 0) {
      const chartTipo = await window.chartFactory?.createBarChart('esic-chart-tipo-informacao-detail', labels, values, {
        horizontal: true,
        colorIndex: 1,
        onClick: true, // Habilitar interatividade para crossfilter
        field: 'tipoInformacao'
      });
      
      // CROSSFILTER: Adicionar sistema de filtros
      if (chartTipo && sortedData && window.addCrossfilterToChart) {
        window.addCrossfilterToChart(chartTipo, sortedData, {
          field: 'tipoInformacao',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadEsicTipoInformacao) setTimeout(() => window.loadEsicTipoInformacao(), 100);
          },
          onClearFilters: () => {
            if (window.loadEsicTipoInformacao) setTimeout(() => window.loadEsicTipoInformacao(), 100);
          }
        });
      }
    }
    
    // Renderizar ranking
    renderTipoRanking(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => {
          if (window.loadEsicTipoInformacao) window.loadEsicTipoInformacao();
        },
        pageLoadFunction: window.loadEsicTipoInformacao
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#esic-tipo-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const tipo = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: tipo,
              field: 'tipoInformacao'
            };
          }),
          field: 'tipoInformacao',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]');
            return textEl ? textEl.getAttribute('title') : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('📑 loadEsicTipoInformacao: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Tipo de Informação e-SIC:', error);
    }
  }
}

/**
 * Renderizar ranking de tipos de informação
 */
function renderTipoRanking(data) {
  const rankEl = document.getElementById('esic-tipo-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  rankEl.innerHTML = data.slice(0, 20).map((item, idx) => {
    const tipo = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${tipo}">${tipo}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-cyan-300">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-esic-tipo-informacao', loadEsicTipoInformacao, 500);
}

window.loadEsicTipoInformacao = loadEsicTipoInformacao;
