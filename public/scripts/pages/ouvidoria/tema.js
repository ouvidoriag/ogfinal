/**
 * Página: Por Tema
 * Análise de manifestações por tema
 * 
 * Recriada com estrutura otimizada
 */

let filtroMesTema = '';

// Debounce para evitar múltiplas execuções
let loadTemaDebounceTimer = null;
let loadTemaInProgress = false;

async function loadTema() {
  // Se já está em execução, aguardar
  if (loadTemaInProgress) {
    if (window.Logger) {
      window.Logger.debug('📑 loadTema: Já em execução, aguardando...');
    }
    return Promise.resolve();
  }
  
  // Debounce: cancelar execução anterior se houver
  if (loadTemaDebounceTimer) {
    clearTimeout(loadTemaDebounceTimer);
    loadTemaDebounceTimer = null;
  }
  
  // Executar após 150ms de debounce
  return new Promise((resolve) => {
    loadTemaDebounceTimer = setTimeout(async () => {
      loadTemaDebounceTimer = null;
      loadTemaInProgress = true;
      
      try {
        await _loadTemaInternal();
        resolve();
      } catch (error) {
        if (window.Logger) {
          window.Logger.error('📑 loadTema: Erro na execução', error);
        }
        resolve();
      } finally {
        loadTemaInProgress = false;
      }
    }, 150);
  });
}

async function _loadTemaInternal() {
  // PRIORIDADE 1: Verificar dependências críticas
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader', 'chartFactory'],
    () => {
      window.errorHandler?.showNotification(
        'Sistemas não carregados. Recarregue a página.',
        'warning'
      );
      return null;
    }
  );
  
  if (!dependencies) {
    return Promise.resolve();
  }
  
  const { dataLoader, chartFactory } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('📑 loadTema: Iniciando');
  }
  
  const page = document.getElementById('page-tema');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.show('Carregando dados de temas...');
  
  // PRIORIDADE 1: Usar safeAsync para tratamento de erros
  return await window.errorHandler?.safeAsync(async () => {
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Tema') || [];
    
    // Combinar com filtros globais usando helper reutilizável
    let activeFilters = filtrosPagina;
    
    // Usar helper para obter filtros ativos de todas as fontes
    if (window.getActiveFilters) {
      const globalFilters = window.getActiveFilters();
      activeFilters = [...activeFilters, ...globalFilters];
    } else {
      // Fallback: método manual
      if (window.crossfilterOverview && window.crossfilterOverview.filters) {
        const crossFilters = window.crossfilterOverview.filters;
        Object.entries(crossFilters).forEach(([field, value]) => {
          if (value !== null && value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => {
                activeFilters.push({ field: field.charAt(0).toUpperCase() + field.slice(1), op: 'eq', value: v });
              });
            } else {
              activeFilters.push({ field: field.charAt(0).toUpperCase() + field.slice(1), op: 'eq', value });
            }
          }
        });
      }
      
      if (window.chartCommunication) {
        const globalFilters = window.chartCommunication.filters?.filters || [];
        activeFilters = [...activeFilters, ...globalFilters];
      }
    }
    
    // Destruir gráficos existentes antes de criar novos
    if (chartFactory?.destroyCharts) {
      chartFactory.destroyCharts([
        'chartTema',
        'chartStatusTema',
        'chartTemaMes',
        'chartTemaTemporal'
      ]);
    }
    
    // MELHORIA: Integrar cache de filtros e histórico
    let dataTemasRaw = [];
    let filtrosAplicados = false;
    const endpoint = '/api/aggregate/by-theme';
    
    if (activeFilters.length > 0) {
      filtrosAplicados = true;
      
      // MELHORIA: Verificar cache de filtros
      const cached = window.filterCache?.get?.(activeFilters, endpoint);
      if (cached) {
        if (window.Logger) {
          window.Logger.debug('📑 loadTema: Dados obtidos do cache de filtros');
        }
        dataTemasRaw = cached;
      } else {
        try {
          const filterRequest = {
            filters: activeFilters,
            originalUrl: endpoint
          };
          
          const response = await fetch('/api/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(filterRequest)
          });
          
          if (response.ok) {
            const filteredData = await response.json();
            if (Array.isArray(filteredData) && filteredData.length > 0) {
              const temaMap = new Map();
              filteredData.forEach(record => {
                const tema = record.tema || record.data?.tema || 'N/A';
                if (tema && tema !== 'N/A') {
                  temaMap.set(tema, (temaMap.get(tema) || 0) + 1);
                }
              });
              
              dataTemasRaw = Array.from(temaMap.entries())
                .map(([tema, count]) => ({ tema, quantidade: count }))
                .sort((a, b) => b.quantidade - a.quantidade);
              
              // MELHORIA: Salvar no cache de filtros
              if (window.filterCache) {
                window.filterCache.set(activeFilters, endpoint, dataTemasRaw);
              }
              
              // MELHORIA: Salvar no histórico de filtros
              if (window.filterHistory) {
                window.filterHistory.saveRecent(activeFilters);
              }
            }
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao aplicar filtros, carregando sem filtros:', error);
          }
          filtrosAplicados = false;
        }
      }
    }
    
    // Se não aplicou filtros ou deu erro, carregar normalmente
    if (!filtrosAplicados || dataTemasRaw.length === 0) {
      dataTemasRaw = await dataLoader.load('/api/aggregate/by-theme', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    // PRIORIDADE 1: Validar dados recebidos
    const validation = window.dataValidator?.validateApiResponse(dataTemasRaw, {
      arrayItem: {
        types: { tema: 'string', quantidade: 'number' }
      }
    });
    
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.error}`);
    }
    
    if (!Array.isArray(validation.data)) {
      throw new Error('Dados não são um array válido');
    }
    
    dataTemasRaw = validation.data;
    
    // Normalizar dados (endpoint retorna { _id, count } ou { key, label, value } após formatGroupByResult)
    const dataTemas = dataTemasRaw.map(item => {
      // formatGroupByResult retorna: { key, label, value, count, _id }
      // Endpoint direto retorna: { _id, count }
      // Compatibilidade com ambos formatos
      const temaValue = item.label || item.key || item.theme || item.tema || item._id || 'N/A';
      const countValue = item.count || item.value || item.quantidade || 0;
      
      return {
        theme: temaValue,
        tema: temaValue,
        count: countValue,
        quantidade: countValue,
        _id: temaValue,
        key: temaValue,
        label: temaValue
      };
    });
    
    if (window.Logger) {
      window.Logger.debug('📑 loadTema: Dados carregados', { 
        raw: dataTemasRaw.length, 
        normalized: dataTemas.length,
        sample: dataTemas[0] 
      });
    }
    
    // Carregar dados mensais de temas (aplicar filtros se houver)
    let dataTemaMesRaw = [];
    if (activeFilters.length > 0) {
      // Aplicar filtros aos dados mensais também
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: '/api/aggregate/count-by-status-mes?field=Tema'
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          if (Array.isArray(filteredData) && filteredData.length > 0) {
            // Agrupar por tema e mês
            const temaMesMap = new Map();
            filteredData.forEach(record => {
              const tema = record.tema || record.data?.tema || 'N/A';
              const mes = record.month || record.ym || record.data?.month || 'N/A';
              const key = `${tema}|${mes}`;
              if (!temaMesMap.has(key)) {
                temaMesMap.set(key, { tema, month: mes, count: 0 });
              }
              temaMesMap.get(key).count += 1;
            });
            dataTemaMesRaw = Array.from(temaMesMap.values());
          }
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao aplicar filtros aos dados mensais, carregando sem filtros:', error);
        }
      }
    }
    
    // Se não aplicou filtros ou deu erro, carregar normalmente
    if (dataTemaMesRaw.length === 0) {
      dataTemaMesRaw = await dataLoader.load('/api/aggregate/count-by-status-mes?field=Tema', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [];
    }
    
    // PRIORIDADE 1: Validar dados mensais
    const mensalValidation = window.dataValidator?.validateApiResponse(dataTemaMesRaw, {
      arrayItem: {
        types: { theme: 'string', count: 'number' }
      }
    });
    
    const dataTemaMes = mensalValidation.valid ? mensalValidation.data : [];
    
    // Renderizar gráfico principal
    await renderTemaChart(dataTemas);
    
    // Renderizar status por tema
    await renderStatusTemaChart(dataTemas);
    
    // Renderizar temas por mês (precisa dos dados para ordenar)
    await renderTemaMesChart(dataTemaMes, dataTemas);
    
    // Renderizar gráfico de linha temporal
    await renderTemaTemporalChart(dataTemas);
    
    // Renderizar lista completa (com checkboxes integrados)
    renderTemasList(dataTemas, dataTemaMes);
    
    // Atualizar KPIs
    updateTemaKPIs(dataTemas);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateTemaKPIs(dataTemas),
        pageLoadFunction: window.loadTema
      });
    }
    
    // CROSSFILTER: Tornar cards de temas clicáveis
    setTimeout(() => {
      const temaCards = document.querySelectorAll('#listaTemas .tema-item');
      if (temaCards.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(temaCards).map(card => ({
            selector: `.tema-item[data-tema="${card.dataset.tema}"]`,
            value: card.dataset.tema,
            field: 'tema'
          })),
          field: 'tema',
          getValueFromCard: (card) => card.dataset.tema
        });
        
        if (window.Logger) {
          window.Logger.debug(`✅ ${temaCards.length} card(s) de temas conectado(s) ao crossfilter`);
        }
      }
    }, 500);
    
    // CROSSFILTER: Conectar TODOS os elementos automaticamente (garantir que nada foi esquecido)
    setTimeout(() => {
      if (window.connectAllElementsInPage) {
        window.connectAllElementsInPage('page-tema', {
          fieldMap: {
            'chartTema': 'tema',
            'chartStatusTema': 'status',
            'chartTemaMes': 'tema'
          },
          defaultField: 'tema',
          kpiUpdateFunction: () => updateTemaKPIs(dataTemas),
          pageLoadFunction: window.loadTema
        });
      } else if (window.connectAllChartsInPage) {
        // Fallback: apenas gráficos
        window.connectAllChartsInPage('page-tema', {
          'chartTema': 'tema',
          'chartStatusTema': 'status',
          'chartTemaMes': 'tema'
        });
      }
    }, 600);
    
    // MELHORIA: Renderizar banner de filtros
    if (window.filterBanner && activeFilters.length > 0) {
      const pageContainer = document.getElementById('page-tema');
      if (pageContainer) {
        window.filterBanner.render('page-tema', activeFilters, {
          showClearAll: true,
          showCount: true,
          position: 'top'
        });
      }
    }
    
    if (window.Logger) {
      window.Logger.success('📑 loadTema: Concluído');
    }
    
    // PRIORIDADE 2: Esconder loading
    window.loadingManager?.hide();
    
    return { success: true, dataTemas, dataTemaMes };
  }, 'loadTema', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hide();
      
      const listaTemas = document.getElementById('listaTemas');
      if (listaTemas) {
        listaTemas.innerHTML = '<div class="text-center text-slate-400 py-4">Erro ao carregar dados. Tente recarregar a página.</div>';
      }
      return { success: false, dataTemas: [], dataTemaMes: [] };
    }
  });
}

/**
 * Inicializar listeners de filtro para a página Tema
 * Usa o helper reutilizável baseado no padrão da Overview
 */
function initTemaFilterListeners() {
  // Usar helper reutilizável (mesmo padrão da Overview)
  if (window.createPageFilterListener) {
    if (window.Logger) {
      window.Logger.debug('📝 Inicializando listeners de filtro para Tema usando helper');
    }
    
    window.createPageFilterListener({
      pageId: 'page-tema',
      listenerKey: '_temaListenerRegistered',
      loadFunction: loadTema,
      updateFunction: async (filteredData, hasActiveFilters) => {
        // Mostrar loading
        window.loadingManager?.show('Aplicando filtros...');
        
        try {
          // Se temos dados filtrados, atualizar diretamente (mesmo padrão da Overview)
          if (filteredData && hasActiveFilters) {
            if (window.Logger) {
              window.Logger.debug('📑 Tema: Processando dados filtrados', {
                keys: Object.keys(filteredData),
                hasByTheme: !!filteredData.manifestationsByTheme,
                totalManifestations: filteredData.totalManifestations
              });
            }
          
          // Extrair dados de temas dos dados filtrados (mesmo formato da Overview)
          let dataTemasRaw = filteredData.manifestationsByTheme || [];
          
          // Se não tem manifestationsByTheme, tentar buscar do endpoint específico
          if (dataTemasRaw.length === 0) {
            // Buscar dados agregados por tema usando os filtros
            const apiFilters = window.convertCrossfilterToAPIFilters?.(
              window.crossfilterOverview?.filters
            ) || [];
            
            if (apiFilters.length > 0) {
              try {
                const response = await fetch('/api/filter', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filters: apiFilters,
                    originalUrl: '/api/aggregate/by-theme'
                  })
                });
                
                if (response.ok) {
                  const filteredRecords = await response.json();
                  if (Array.isArray(filteredRecords) && filteredRecords.length > 0) {
                    // Agrupar por tema manualmente
                    const temaMap = new Map();
                    filteredRecords.forEach(record => {
                      const tema = record.tema || record.data?.tema || 'N/A';
                      if (tema && tema !== 'N/A') {
                        temaMap.set(tema, (temaMap.get(tema) || 0) + 1);
                      }
                    });
                    
                    dataTemasRaw = Array.from(temaMap.entries())
                      .map(([tema, count]) => ({ tema, quantidade: count, count }))
                      .sort((a, b) => b.quantidade - a.quantidade);
                  }
                }
              } catch (error) {
                if (window.Logger) {
                  window.Logger.warn('Erro ao buscar dados filtrados por tema:', error);
                }
              }
            }
          }
          
          // Normalizar dados
          const dataTemas = dataTemasRaw.map(item => {
            const temaValue = item.label || item.key || item.theme || item.tema || item._id || 'N/A';
            const countValue = item.count || item.value || item.quantidade || 0;
            
            return {
              theme: temaValue,
              tema: temaValue,
              count: countValue,
              quantidade: countValue,
              _id: temaValue,
              key: temaValue,
              label: temaValue
            };
          });
          
          // Destruir gráficos existentes antes de criar novos
          if (window.chartFactory?.destroyCharts) {
            window.chartFactory.destroyCharts([
              'chartTema',
              'chartStatusTema',
              'chartTemaMes'
            ]);
          }
          
          // Atualizar gráficos e KPIs
          await renderTemaChart(dataTemas);
          await renderStatusTemaChart(dataTemas);
          
          // Carregar dados mensais também (se necessário)
          const dataTemaMesRaw = filteredData.manifestationsByMonth || [];
          const dataTemaMes = Array.isArray(dataTemaMesRaw) ? dataTemaMesRaw : [];
          
          if (dataTemaMes.length > 0) {
            await renderTemaMesChart(dataTemaMes, dataTemas);
          }
          
          // Atualizar lista e KPIs
          renderTemasList(dataTemas, dataTemaMes);
          updateTemaKPIs(dataTemas);
          
            // Esconder loading
            window.loadingManager?.hide();
            
            if (window.Logger) {
              window.Logger.success('📑 Tema: Dados atualizados com filtros aplicados', {
                temas: dataTemas.length
              });
            }
          } else {
            // Sem filtros: recarregar normalmente
            if (window.Logger) {
              window.Logger.debug('📑 Tema: Sem filtros ativos, recarregando normalmente');
            }
            await loadTema();
          }
        } catch (error) {
          window.loadingManager?.hide();
          if (window.Logger) {
            window.Logger.error('📑 Tema: Erro ao atualizar com filtros:', error);
          }
          // Fallback: recarregar normalmente
          await loadTema();
        }
      }
    });
  } else {
    // Fallback: método antigo
    if (window.crossfilterOverview) {
      window.crossfilterOverview.addListener((filters, count) => {
        const page = document.getElementById('page-tema');
        if (page && page.style.display !== 'none') {
          loadTema();
        }
      });
    }
    
    if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
      window.chartCommunication.createPageFilterListener('page-tema', loadTema, 500);
    }
  }
  
  if (window.Logger) {
    window.Logger.success('✅ Listeners de filtro para Tema inicializados');
  }
}

// Exportar função imediatamente
window.loadTema = loadTema;

// Inicializar listeners quando o script carregar
function initTemaPage() {
  initTemaFilterListeners();
  
  // Usar o novo helper que suporta mês e status
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Tema',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadTema();
      },
      mesSelecionado: filtroMesTema
    });
  } else {
    // Aguardar um pouco se o helper ainda não carregou
    setTimeout(initTemaPage, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTemaPage);
} else {
  initTemaPage();
}

async function renderTemaChart(dataTemas) {
  if (!dataTemas || !Array.isArray(dataTemas) || dataTemas.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTemaChart: dados inválidos ou vazios', dataTemas);
    }
    return;
  }
  
  // Mostrar top 10 temas (ou todos se menos de 10)
  const topTemas = dataTemas.slice(0, Math.min(10, dataTemas.length));
  
  // Extrair labels - tentar múltiplos campos possíveis
  const labels = topTemas.map(t => {
    const label = t.label || t.key || t.theme || t.tema || t._id;
    if (!label || label === 'N/A' || label.trim() === '') {
      if (window.Logger) {
        window.Logger.warn('⚠️ renderTemaChart: Tema sem label válido:', t);
      }
      return 'N/A';
    }
    return label;
  });
  
  const values = topTemas.map(t => t.count || t.quantidade || t.value || 0);
  
  // Calcular total para percentuais
  const total = dataTemas.reduce((sum, item) => sum + (item.count || item.quantidade || 0), 0);
  
  if (window.Logger) {
    window.Logger.debug('📊 renderTemaChart:', { 
      total: dataTemas.length, 
      topTemas: topTemas.length, 
      totalManifestacoes: total,
      sample: topTemas[0] 
    });
  }
  
  // Preparar cores vibrantes (violeta/roxo para temas)
  const canvas = document.getElementById('chartTema');
  if (!canvas) return;
  
  // PADRONIZAÇÃO: Remover cores customizadas e deixar ChartFactory usar sistema centralizado
  // O ChartFactory detectará automaticamente que é 'tema' e usará cores padronizadas
  const chart = await window.chartFactory?.createBarChart('chartTema', labels, values, {
    horizontal: true, // Barras horizontais
    field: 'Tema', // Especificar campo para detecção automática de cores
    label: 'Manifestações',
    onClick: true, // Habilitar interatividade
    chartOptions: {
      indexAxis: 'y', // Horizontal
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: 'rgba(148, 163, 184, 0.9)',
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            drawBorder: false
          }
        },
        y: {
          ticks: {
            font: {
              size: 11,
              weight: '500'
            },
            color: 'rgba(148, 163, 184, 0.9)',
            callback: function(value, index) {
              const label = labels[index];
              // Truncar labels muito longos
              if (label && label.length > 40) {
                return label.substring(0, 37) + '...';
              }
              return label || '';
            }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: 'rgba(196, 181, 253, 1)',
          bodyColor: 'rgba(226, 232, 240, 1)',
          borderColor: 'rgba(139, 92, 246, 0.5)',
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          callbacks: {
            title: function(context) {
              const label = context[0].label;
              return `📌 ${label}`;
            },
            label: function(context) {
              const value = context.parsed.x;
              const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return [
                `Quantidade: ${value.toLocaleString('pt-BR')}`,
                `Percentual: ${percent}%`,
                `Posição: #${context.dataIndex + 1}`
              ];
            },
            footer: function(tooltipItems) {
              if (dataTemas.length > topTemas.length) {
                const outros = dataTemas.slice(topTemas.length);
                const totalOutros = outros.reduce((sum, item) => 
                  sum + (item.count || item.quantidade || 0), 0);
                const percentOutros = total > 0 ? ((totalOutros / total) * 100).toFixed(1) : 0;
                return `\nOutros ${dataTemas.length - topTemas.length} temas: ${totalOutros.toLocaleString('pt-BR')} (${percentOutros}%)`;
              }
              return '';
            }
          }
        },
        legend: {
          display: false
        },
        datalabels: {
          display: false // Desabilitar labels nas barras (vamos usar plugin customizado se necessário)
        }
      },
      layout: {
        padding: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros universal
  // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
  setTimeout(() => {
    if (chart && topTemas && chart.canvas && chart.canvas.ownerDocument) {
      try {
        window.addCrossfilterToChart(chart, topTemas, {
          field: 'tema',
          valueField: 'theme',
          onFilterChange: () => {
            // Recarregar página quando filtro mudar (já tem debounce interno)
            if (window.loadTema) {
              window.loadTema();
            }
          },
          onClearFilters: () => {
            // Recarregar página quando filtros forem limpos
            if (window.loadTema) {
              window.loadTema();
            }
          }
        });
        
        if (window.Logger) {
          window.Logger.debug('✅ Gráfico chartTema conectado ao crossfilter');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao adicionar crossfilter ao gráfico tema:', error);
        }
      }
    }
  }, 100);
  
  return chart;
}

async function renderStatusTemaChart(dataTemas) {
  // CROSSFILTER: Adicionar filtros quando gráfico for criado
  if (!dataTemas || !Array.isArray(dataTemas) || dataTemas.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderStatusTemaChart: dados inválidos ou vazios');
    }
    return;
  }
  
  // Se os dados não têm statusCounts, buscar status geral
  // Usar dashboard-data que já tem os dados de status
  try {
    const dashboardData = await window.dataLoader?.load('/api/dashboard-data', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};
    
    const statusData = dashboardData.manifestationsByStatus || [];
    
    if (statusData.length > 0) {
      const labels = statusData.map(s => s.status || s._id || 'N/A');
      const values = statusData.map(s => s.count || 0);
      
      const statusChart = await window.chartFactory?.createDoughnutChart('chartStatusTema', labels, values, {
        type: 'doughnut',
        onClick: false,
        legendContainer: 'legendStatusTema'
      });
      
      // CROSSFILTER: Adicionar filtros ao gráfico de status
      // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
      setTimeout(() => {
        if (statusChart && statusData && statusChart.canvas && statusChart.canvas.ownerDocument) {
          try {
            window.addCrossfilterToChart(statusChart, statusData, {
              field: 'status',
              valueField: 'status',
              onFilterChange: () => {
                if (window.loadTema) window.loadTema();
              },
              onClearFilters: () => {
                if (window.loadTema) window.loadTema();
              }
            });
            
            if (window.Logger) {
              window.Logger.debug('✅ Gráfico chartStatusTema conectado ao crossfilter');
            }
          } catch (error) {
            if (window.Logger) {
              window.Logger.warn('Erro ao adicionar crossfilter ao gráfico status:', error);
            }
          }
        }
      }, 100);
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar status por tema:', error);
    }
  }
}

async function renderTemaMesChart(dataTemaMes, dataTemas = null) {
  if (!dataTemaMes || !Array.isArray(dataTemaMes) || dataTemaMes.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTemaMesChart: dados inválidos ou vazios');
    }
    return;
  }
  
  // Processar dados para gráfico de barras agrupadas
  const meses = [...new Set(dataTemaMes.map(d => d.month || d.ym))].sort();
  const todosTemas = [...new Set(dataTemaMes.map(d => d.label || d.key || d.theme || d.tema || d._id))];
  
  // Ordenar temas por total de manifestações (maior primeiro)
  const temasComTotal = todosTemas.map(tema => {
    const total = dataTemaMes
      .filter(d => {
        const dTema = d.label || d.key || d.theme || d.tema || d._id || 'N/A';
        return dTema === tema;
      })
      .reduce((sum, d) => sum + (d.count || d.value || 0), 0);
    return { tema, total };
  }).sort((a, b) => b.total - a.total);
  
  const temasOrdenados = temasComTotal.map(t => t.tema);
  
  if (meses.length === 0 || temasOrdenados.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTemaMesChart: sem meses ou temas para renderizar');
    }
    return;
  }
  
  // Obter temas selecionados (por padrão, os 3 primeiros)
  const temasSelecionados = obterTemasSelecionados();
  
  // Criar datasets apenas para temas selecionados
  const datasets = temasSelecionados.map((tema, idx) => {
    const data = meses.map(mes => {
      const item = dataTemaMes.find(d => {
        const dTema = d.label || d.key || d.theme || d.tema || d._id || 'N/A';
        return (d.month === mes || d.ym === mes) && dTema === tema;
      });
      return item?.count || item?.value || 0;
    });
    return {
      label: tema,
      data: data
    };
  });
  
  const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
  
  const temaMesChart = await window.chartFactory?.createBarChart('chartTemaMes', labels, datasets, {
    colorIndex: 0,
    legendContainer: 'legendTemaMes',
    onClick: true // Habilitar interatividade
  });
  
  // CROSSFILTER: Adicionar filtros ao gráfico de tema por mês
  // Aguardar um pouco para garantir que o gráfico está totalmente renderizado
  setTimeout(() => {
    if (temaMesChart && temasSelecionados && temaMesChart.canvas && temaMesChart.canvas.ownerDocument) {
      try {
        // Preparar dados para crossfilter
        const dataArray = temasSelecionados.map((tema, idx) => ({
          tema: tema,
          theme: tema,
          label: tema,
          index: idx
        }));
        
        window.addCrossfilterToChart(temaMesChart, dataArray, {
          field: 'tema',
          valueField: 'tema',
          onFilterChange: () => {
            if (window.loadTema) window.loadTema();
          },
          onClearFilters: () => {
            if (window.loadTema) window.loadTema();
          }
        });
        
        if (window.Logger) {
          window.Logger.debug('✅ Gráfico chartTemaMes conectado ao crossfilter');
        }
      } catch (error) {
        if (window.Logger) {
          window.Logger.warn('Erro ao adicionar crossfilter ao gráfico temaMes:', error);
        }
      }
    }
  }, 100);
  
  // CROSSFILTER: Adicionar filtros ao gráfico de tema por mês (método original para compatibilidade)
  if (temaMesChart && temasSelecionados) {
    // Para gráficos de barras agrupadas, interceptar clique nas séries
    if (temaMesChart.options) {
      const originalOnClick = temaMesChart.options.onClick;
      temaMesChart.options.onClick = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const datasetIndex = element.datasetIndex;
          
          if (datasetIndex >= 0 && datasetIndex < temasSelecionados.length) {
            const tema = temasSelecionados[datasetIndex];
            const multiSelect = event.native?.ctrlKey || event.native?.metaKey || false;
            
            if (window.crossfilterOverview) {
              window.crossfilterOverview.setTemaFilter(tema, multiSelect);
              window.crossfilterOverview.notifyListeners();
            } else if (window.chartCommunication && window.chartCommunication.filters) {
              const existingFilters = window.chartCommunication.filters.filters || [];
              const newFilter = { field: 'Tema', op: 'eq', value: tema };
              
              if (multiSelect) {
                const exists = existingFilters.some(f => f.field === 'Tema' && f.value === tema);
                if (!exists) {
                  window.chartCommunication.filters.filters = [...existingFilters, newFilter];
                }
              } else {
                window.chartCommunication.filters.filters = [
                  ...existingFilters.filter(f => f.field !== 'Tema'),
                  newFilter
                ];
              }
              
              if (window.chartCommunication.onFilterChange) {
                window.chartCommunication.onFilterChange();
              }
            }
            
            if (window.loadTema) {
              setTimeout(() => window.loadTema(), 100);
            }
          }
        }
        if (originalOnClick) originalOnClick(event, elements);
      };
    }
    
    // Adicionar clique direito para limpar
    if (temaMesChart.canvas) {
      const container = temaMesChart.canvas.parentElement;
      if (container && !container.dataset.crossfilterEnabled) {
        container.dataset.crossfilterEnabled = 'true';
        container.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (window.crossfilterOverview) {
            window.crossfilterOverview.clearAllFilters();
            window.crossfilterOverview.notifyListeners();
          } else if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.clear();
            if (window.chartCommunication.onFilterChange) {
              window.chartCommunication.onFilterChange();
            }
          }
          if (window.loadTema) setTimeout(() => window.loadTema(), 100);
        });
      }
    }
  }
}

function obterTemasSelecionados() {
  // Buscar checkboxes da lista completa de temas
  const checkboxes = document.querySelectorAll('#listaTemas input[type="checkbox"][data-tema-mes]:checked');
  const selecionados = Array.from(checkboxes).map(cb => cb.getAttribute('data-tema-mes'));
  
  // Se nenhum estiver selecionado, retornar os 3 primeiros por padrão
  if (selecionados.length === 0) {
    const todosCheckboxes = document.querySelectorAll('#listaTemas input[type="checkbox"][data-tema-mes]');
    if (todosCheckboxes.length > 0) {
      // Retornar os 3 primeiros e marcá-los
      const primeiros3 = Array.from(todosCheckboxes).slice(0, 3);
      primeiros3.forEach(cb => {
        cb.checked = true;
      });
      return primeiros3.map(cb => cb.getAttribute('data-tema-mes'));
    }
  }
  
  return selecionados;
}

async function atualizarGraficoTemaMes() {
  // Recarregar dados e atualizar gráfico
  try {
    const dataTemaMes = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=Tema', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Carregar também dados de temas para ordenação
    const dataTemasRaw = await window.dataLoader?.load('/api/aggregate/by-theme', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    const dataTemas = dataTemasRaw.map(item => {
      // formatGroupByResult retorna: { key, label, value, count, _id }
      // Endpoint direto pode retornar: { _id, count } ou { theme, count }
      // Compatibilidade com todos os formatos
      const temaValue = item.label || item.key || item.theme || item.tema || item._id || 'N/A';
      const countValue = item.count || item.value || item.quantidade || 0;
      
      return {
        theme: temaValue,
        tema: temaValue,
        count: countValue,
        quantidade: countValue,
        value: countValue,
        _id: temaValue,
        key: temaValue,
        label: temaValue
      };
    });
    
    // Destruir gráfico existente
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts(['chartTemaMes']);
    }
    
    // Re-renderizar com temas selecionados
    await renderTemaMesChart(dataTemaMes, dataTemas);
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderTemaMesChart', {
      showToUser: false
    });
    if (window.Logger) {
      window.Logger.error('Erro ao atualizar gráfico Temas por Mês:', error);
    }
  }
}

// Tornar função acessível globalmente
window.atualizarGraficoTemaMes = atualizarGraficoTemaMes;

/**
 * Renderizar gráfico de linha temporal: Evolução dos temas ao longo do tempo
 */
async function renderTemaTemporalChart(dataTemas) {
  if (!dataTemas || !Array.isArray(dataTemas) || dataTemas.length === 0) {
    const canvas = document.getElementById('chartTemaTemporal');
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
    // Buscar dados de temas por mês
    const temasMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=tema', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(temasMesData) && temasMesData.length > 0) {
      // Top 5 temas
      const top5 = dataTemas.slice(0, 5);
      const top5Keys = new Set(top5.map(t => t.tema || t.theme || t._id));
      
      // Agrupar dados por tema e mês
      const temasMap = new Map();
      const mesesSet = new Set();
      
      temasMesData.forEach(item => {
        const tema = item.tema || item.theme || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(tema)) return;
        
        mesesSet.add(mes);
        
        if (!temasMap.has(tema)) {
          temasMap.set(tema, new Map());
        }
        
        temasMap.get(tema).set(mes, item.count || 0);
      });
      
      // Ordenar meses
      const meses = Array.from(mesesSet).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      // Preparar datasets
      const datasets = top5.map((item, idx) => {
        const tema = item.tema || item.theme || item._id;
        const mesesMap = temasMap.get(tema) || new Map();
        const values = meses.map(mes => mesesMap.get(mes) || 0);
        
        const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
        const color = colors[idx % colors.length];
        
        return {
          label: tema.length > 25 ? tema.substring(0, 25) + '...' : tema,
          data: values,
          borderColor: color,
          backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          pointHoverRadius: 5
        };
      });
      
      // Garantir que Chart.js está carregado
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartTemaTemporal');
      if (canvas && window.Chart) {
        // Destruir gráfico existente
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
        
        window.chartTemaTemporal = chart;
        
        // Atualizar info box
        const infoBox = document.getElementById('temaTemporalInfo');
        if (infoBox && top5.length > 0) {
          const topTema = top5[0];
          infoBox.innerHTML = `
            <div class="text-xs text-slate-400 mb-1">Tema líder</div>
            <div class="text-sm font-bold text-cyan-300">${topTema.tema || topTema.theme}</div>
            <div class="text-xs text-slate-500 mt-1">Total: ${(topTema.quantidade || topTema.count || 0).toLocaleString('pt-BR')} manifestações</div>
          `;
        }
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderTemaTemporalChart', { showToUser: false });
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar gráfico temporal de temas:', error);
    }
  }
}

/**
 * Atualizar KPIs da página Tema
 */
function updateTemaKPIs(dataTemas) {
  if (!dataTemas || !Array.isArray(dataTemas) || dataTemas.length === 0) {
    return;
  }
  
  const total = dataTemas.reduce((sum, item) => sum + (item.count || item.quantidade || item.value || 0), 0);
  const temasUnicos = dataTemas.length;
  const mediaTema = temasUnicos > 0 ? Math.round(total / temasUnicos) : 0;
  
  // Extrair tema mais comum - tentar múltiplos campos
  const temaMaisComum = dataTemas.length > 0 ? (
    dataTemas[0].label || 
    dataTemas[0].key || 
    dataTemas[0].theme || 
    dataTemas[0].tema || 
    dataTemas[0]._id || 
    'N/A'
  ) : 'N/A';
  
  // Atualizar elementos
  const kpiTotal = document.getElementById('kpiTotalTema');
  const kpiUnicos = document.getElementById('kpiTemasUnicos');
  const kpiMedia = document.getElementById('kpiMediaTema');
  const kpiMaisComum = document.getElementById('kpiTemaMaisComum');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiUnicos) kpiUnicos.textContent = temasUnicos.toLocaleString('pt-BR');
  if (kpiMedia) kpiMedia.textContent = mediaTema.toLocaleString('pt-BR');
  if (kpiMaisComum) {
    kpiMaisComum.textContent = temaMaisComum.length > 20 ? temaMaisComum.substring(0, 20) + '...' : temaMaisComum;
    kpiMaisComum.title = temaMaisComum; // Tooltip com nome completo
  }
}

function renderTemasList(dataTemas, dataTemaMes = null) {
  const listaTemas = document.getElementById('listaTemas');
  if (!listaTemas) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTemasList: elemento listaTemas não encontrado');
    }
    return;
  }
  
  if (!dataTemas || !Array.isArray(dataTemas) || dataTemas.length === 0) {
    listaTemas.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum tema encontrado</div>';
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTemasList: dados inválidos ou vazios', dataTemas);
    }
    return;
  }
  
  if (window.Logger) {
    window.Logger.debug('📊 renderTemasList:', { total: dataTemas.length, sample: dataTemas[0] });
  }
  
  // Se temos dados mensais, ordenar por total mensal (para marcar os 3 primeiros)
  let temasOrdenados = dataTemas;
  if (dataTemaMes && Array.isArray(dataTemaMes) && dataTemaMes.length > 0) {
    const temasComTotal = dataTemas.map(item => {
      const tema = item.label || item.key || item.theme || item.tema || item._id || 'N/A';
      const total = dataTemaMes
        .filter(d => {
          const dTema = d.label || d.key || d.theme || d.tema || d._id || 'N/A';
          return dTema === tema;
        })
        .reduce((sum, d) => sum + (d.count || d.value || 0), 0);
      return { ...item, totalMensal: total };
    }).sort((a, b) => b.totalMensal - a.totalMensal);
    temasOrdenados = temasComTotal;
  }
  
  listaTemas.innerHTML = temasOrdenados.map((item, idx) => {
    const tema = item.label || item.key || item.theme || item.tema || item._id || 'N/A';
    const count = item.count || item.quantidade || item.value || 0;
    const checked = idx < 3 ? 'checked' : ''; // Marcar os 3 primeiros por padrão
    const temaId = `tema-mes-${idx}`;
    
    return `
      <div class="tema-item flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer" 
           data-tema="${tema}" 
           data-value="${tema}"
           title="Clique para filtrar por ${tema} | Clique direito para limpar filtros">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <input 
            type="checkbox" 
            id="${temaId}" 
            data-tema-mes="${tema}"
            ${checked}
            class="w-4 h-4 text-violet-500 bg-slate-700 border-slate-600 rounded focus:ring-violet-500 focus:ring-2 flex-shrink-0"
            onchange="atualizarGraficoTemaMes(); event.stopPropagation();"
            title="Selecionar para exibir no gráfico Temas por Mês"
            onclick="event.stopPropagation();"
          >
          <span class="text-xs text-slate-400 w-8 flex-shrink-0">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${tema}">${tema}</span>
        </div>
        <span class="text-sm font-bold text-violet-300 flex-shrink-0 ml-2">${count.toLocaleString('pt-BR')}</span>
      </div>
    `;
  }).join('');
}

