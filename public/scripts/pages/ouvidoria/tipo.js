/**
 * Página: Tipos de Manifestação
 * 
 * Recriada com estrutura otimizada
 */

async function loadTipo() {
  if (window.Logger) {
    window.Logger.debug('📋 loadTipo: Iniciando');
  }
  
  const page = document.getElementById('page-tipo');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    const data = await window.dataLoader?.load('/api/aggregate/count-by?field=Tipo', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    const top20 = data.slice(0, 20);
    const labels = top20.map(x => x.key || x._id || 'N/A');
    const values = top20.map(x => x.count || 0);
    
    const tipoChart = await window.chartFactory?.createDoughnutChart('chartTipo', labels, values, {
      type: 'pie',
      field: 'tipoDeManifestacao',
      onClick: false,
      legendContainer: 'legendTipo'
    });
    
    // CROSSFILTER: Adicionar filtros ao gráfico de tipo
    // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
    setTimeout(() => {
      if (tipoChart && top20 && tipoChart.canvas && tipoChart.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(tipoChart, top20, {
            field: 'tipo',
            valueField: 'key',
            onFilterChange: () => {
              if (window.loadTipo) window.loadTipo();
            },
            onClearFilters: () => {
              if (window.loadTipo) window.loadTipo();
            }
          });
          
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartTipo conectado ao crossfilter');
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao adicionar crossfilter ao gráfico tipo:', error);
          }
        }
      }
    }, 100);
    
    // Renderizar ranking com cores por tipo de manifestação
    const rankEl = document.getElementById('rankTipo');
    if (rankEl) {
      rankEl.innerHTML = top20.map((item, idx) => {
        const tipo = item.key || item._id || 'N/A';
        const color = window.config?.getColorByTipoManifestacao?.(tipo);
        const isLight = document.body?.classList.contains('light-mode');
        const defaultBgColor = isLight ? 'rgba(30, 41, 59, 0.2)' : 'rgba(148, 163, 184, 0.2)';
        const defaultTextColor = isLight ? '#334155' : '#cbd5e1';
        const defaultCountColor = isLight ? '#0891b2' : '#22d3ee';
        
        return `
          <li class="rank-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
              data-tipo="${tipo}" 
              data-value="${tipo}"
              title="Clique para filtrar por ${tipo} | Clique direito para limpar filtros">
            <span class="font-mono px-2 py-1 rounded text-sm" style="background-color: ${color ? `${color}20` : defaultBgColor}; color: ${color || defaultTextColor}">${tipo}</span>
            <span class="font-bold" style="color: ${color || defaultCountColor}">${(item.count || 0).toLocaleString('pt-BR')}</span>
          </li>
        `;
      }).join('');
      
      // CROSSFILTER: Tornar itens do ranking clicáveis
      setTimeout(() => {
        const rankItems = rankEl.querySelectorAll('.rank-item');
        if (rankItems.length > 0 && window.makeCardsClickable) {
          window.makeCardsClickable({
            cards: Array.from(rankItems).map(item => ({
              selector: `.rank-item[data-tipo="${item.dataset.tipo}"]`,
              value: item.dataset.tipo,
              field: 'tipo'
            })),
            field: 'tipo',
            getValueFromCard: (card) => card.dataset.tipo
          });
        }
      }, 100);
    }
    
    // Renderizar gráficos adicionais
    await renderTipoTemporalChart(data);
    await renderTipoAgrupadasChart(data);
    
    // Atualizar KPIs
    updateTipoKPIs(data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateTipoKPIs(data),
        pageLoadFunction: window.loadTipo
      });
    }
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-tipo', {
          fieldMap: {
            'chartTipo': 'tipo'
          },
          defaultField: 'tipo',
          kpiUpdateFunction: () => updateTipoKPIs(data),
          pageLoadFunction: window.loadTipo
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('📋 loadTipo: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Tipo:', error);
    }
  }
}

/**
 * Atualizar KPIs da página Tipo
 */
function updateTipoKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const tiposUnicos = data.length;
  const mediaTipo = tiposUnicos > 0 ? Math.round(total / tiposUnicos) : 0;
  const tipoMaisComum = data.length > 0 ? (data[0].key || data[0]._id || 'N/A') : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalTipo');
  const kpiUnicos = document.getElementById('kpiTiposUnicos');
  const kpiMedia = document.getElementById('kpiMediaTipo');
  const kpiMaisComum = document.getElementById('kpiTipoMaisComum');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = tiposUnicos.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaTipo.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = tipoMaisComum.length > 20 ? tipoMaisComum.substring(0, 20) + '...' : tipoMaisComum;
    kpiMaisComum.title = tipoMaisComum; // Tooltip com nome completo
  }
}

// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-tipo',
    listenerKey: '_tipoListenerRegistered',
    loadFunction: loadTipo
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-tipo', loadTipo, 500);
}

window.loadTipo = loadTipo;

