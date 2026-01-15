/**
 * Página: Reclamações e Denúncias
 * 
 * Recriada com estrutura otimizada
 */

async function loadReclamacoes() {
  if (window.Logger) {
    window.Logger.debug('⚠️ loadReclamacoes: Iniciando');
  }
  
  const page = document.getElementById('page-reclamacoes');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Reclamacoes') || [];
    
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
    
    const [data, dataMensal] = await Promise.all([
      window.dataLoader?.load('/api/complaints-denunciations', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || { assuntos: [], tipos: [] },
      window.dataLoader?.load('/api/aggregate/by-month', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || []
    ]);
    
    const assuntos = data.assuntos || [];
    const tipos = data.tipos || [];
    
    // Renderizar lista de assuntos
    if (assuntos && Array.isArray(assuntos)) {
      renderReclamacoesAssuntosList(assuntos);
    } else {
      if (window.Logger) {
        window.Logger.warn('Assuntos não é um array válido:', assuntos);
      }
      renderReclamacoesAssuntosList([]);
    }
    
    // Renderizar gráfico de tipos
    if (tipos && Array.isArray(tipos) && tipos.length > 0) {
      await renderTiposChart(tipos);
    } else {
      if (window.Logger) {
        window.Logger.warn('Tipos não é um array válido ou está vazio:', tipos);
      }
    }
    
    // Renderizar gráfico mensal
    await renderReclamacoesMesChart(dataMensal);
    
    // Atualizar KPIs
    updateReclamacoesKPIs(assuntos, tipos);
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-reclamacoes', {
          fieldMap: {
            'chartTiposReclamacoes': 'tipo',
            'chartReclamacoesMes': 'tipo'
          },
          defaultField: 'tipo',
          kpiUpdateFunction: () => updateReclamacoesKPIs(assuntos, tipos),
          pageLoadFunction: window.loadReclamacoes
        });
      }
    }, 600);
    
    if (window.Logger) {
      window.Logger.success('⚠️ loadReclamacoes: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Reclamações:', error);
    }
  }
}

function renderReclamacoesAssuntosList(assuntos) {
  const listaEl = document.getElementById('listaReclamacoes');
  if (!listaEl) return;
  
  if (assuntos.length === 0) {
    listaEl.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum assunto encontrado</div>';
    return;
  }
  
  const maxValue = Math.max(...assuntos.map(d => d.quantidade || d.count || 0), 1);
  listaEl.innerHTML = assuntos.map((item, idx) => {
    const quantidade = item.quantidade || item.count || 0;
    const width = (quantidade / maxValue) * 100;
    const assunto = item.assunto || item.key || item._id || 'N/A';
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 min-w-0">
          <div class="text-sm text-slate-300 truncate font-medium">${assunto}</div>
          <div class="mt-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-rose-500 to-pink-500" style="width: ${width}%"></div>
          </div>
        </div>
        <div class="text-lg font-bold text-rose-300 min-w-[80px] text-right">${quantidade.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

async function renderTiposChart(tipos) {
  if (!tipos || !Array.isArray(tipos) || tipos.length === 0) {
    if (window.Logger) {
      window.Logger.warn('renderTiposChart: tipos inválido ou vazio');
    }
    return;
  }
  
  const labels = tipos.map(t => t.tipo || t.key || t._id || 'N/A');
  const values = tipos.map(t => t.quantidade || t.count || 0);
  
  const reclamacoesTipoChart = await window.chartFactory?.createBarChart('chartReclamacoesTipo', labels, values, {
    horizontal: true,
    field: 'tipoDeManifestacao',
    colorIndex: 4,
    label: 'Quantidade',
    onClick: false
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de tipo de reclamação
  // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
  setTimeout(() => {
    if (reclamacoesTipoChart && tipos && reclamacoesTipoChart.canvas && reclamacoesTipoChart.canvas.ownerDocument) {
      try {
        window.addCrossfilterToChart(reclamacoesTipoChart, tipos, {
          field: 'tipo',
          valueField: 'tipo',
          onFilterChange: () => {
            if (window.loadReclamacoes) window.loadReclamacoes();
          },
          onClearFilters: () => {
            if (window.loadReclamacoes) window.loadReclamacoes();
          }
        });
        
        if (window.Logger) {
          window.Logger.debug('✅ Gráfico chartReclamacoesTipo conectado ao crossfilter');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao adicionar crossfilter ao gráfico reclamacoes:', error);
        }
      }
    }
  }, 100);
}

/**
 * Atualizar KPIs da página Reclamações e Denúncias
 */
function updateReclamacoesKPIs(assuntos, tipos) {
  const totalReclamacoes = assuntos?.reduce((sum, item) => sum + (item.quantidade || item.count || 0), 0) || 0;
  const totalDenuncias = tipos?.find(t => (t.tipo || t.key || '').toLowerCase().includes('denúncia'))?.quantidade || 0;
  const assuntosUnicos = assuntos?.length || 0;
  const assuntoMaisComum = assuntos && assuntos.length > 0 
    ? (assuntos[0].assunto || assuntos[0].key || assuntos[0]._id || 'N/A')
    : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalReclamacoes');
  const kpiDenuncias = document.getElementById('kpiTotalDenuncias');
  const kpiAssuntos = document.getElementById('kpiAssuntosUnicos');
  const kpiMaisComum = document.getElementById('kpiAssuntoMaisComum');
  
  if (kpiTotal) kpiTotal.textContent = totalReclamacoes.toLocaleString('pt-BR');
  if (kpiDenuncias) kpiDenuncias.textContent = totalDenuncias.toLocaleString('pt-BR');
  if (kpiAssuntos) kpiAssuntos.textContent = assuntosUnicos.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = assuntoMaisComum.length > 20 ? assuntoMaisComum.substring(0, 20) + '...' : assuntoMaisComum;
    kpiMaisComum.title = assuntoMaisComum; // Tooltip com nome completo
  }
}

async function renderReclamacoesMesChart(dataMensal) {
  if (!dataMensal || dataMensal.length === 0) return;
  
  const labels = dataMensal.map(x => {
    const ym = x.ym || x.month || '';
    return window.dateUtils?.formatMonthYear?.(ym) || ym || 'Data inválida';
  });
  const values = dataMensal.map(x => x.count || 0);
  
  const reclamacoesMesChart = await window.chartFactory?.createBarChart('chartReclamacoesMes', labels, values, {
    colorIndex: 4,
    label: 'Quantidade'
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de reclamações por mês (filtrar por mês quando clicar)
  if (reclamacoesMesChart && dataMensal) {
    if (reclamacoesMesChart.options) {
      const originalOnClick = reclamacoesMesChart.options.onClick;
      reclamacoesMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const index = element.index;
          
          if (index >= 0 && index < dataMensal.length) {
            const item = dataMensal[index];
            const ym = item.ym || item.month || '';
            
            // Filtrar por mês usando chartCommunication (não há filtro de data no crossfilterOverview)
            if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'dataCriacaoIso', op: 'contains', value: ym };
              
              window.chartCommunication.filters.filters = [
                ...existingFilters.filter(f => f.field !== 'dataCriacaoIso'),
                newFilter
              ];
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadReclamacoes) {
              setTimeout(() => window.loadReclamacoes(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (reclamacoesMesChart.canvas) {
      const container = reclamacoesMesChart.canvas.parentElement;
      if (container && !container.dataset.crossfilterEnabled) {
        container.dataset.crossfilterEnabled = 'true';
        container.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.clear();
            if (window.chartCommunication.onFilterChange) {
              window.chartCommunication.onFilterChange();
            }
          }
          if (window.loadReclamacoes) setTimeout(() => window.loadReclamacoes(), 100);
        });
      }
    }
  }
}

// Conectar ao sistema global de filtros usando helper reutilizável
if (window.createPageFilterListener) {
  window.createPageFilterListener({
    pageId: 'page-reclamacoes',
    listenerKey: '_reclamacoesListenerRegistered',
    loadFunction: loadReclamacoes
  });
} else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-reclamacoes', loadReclamacoes, 500);
}

// Inicializar filtros de mês e status
function initReclamacoesPage() {
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Reclamacoes',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadReclamacoes();
      },
      mesSelecionado: ''
    });
  } else {
    setTimeout(initReclamacoesPage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReclamacoesPage);
} else {
  initReclamacoesPage();
}

window.loadReclamacoes = loadReclamacoes;

