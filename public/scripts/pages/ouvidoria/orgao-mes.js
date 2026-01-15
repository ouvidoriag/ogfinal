/**
 * Página: Por Órgão e Mês
 * Análise de manifestações por órgão e período mensal
 * 
 * Refatorada para usar o sistema global de filtros
 */

// Variáveis globais para controle de ordenação e busca
let currentOrgaosData = [];
let sortAscending = false;
let searchTerm = '';

/**
 * Extrair valor de um campo de um registro
 * @param {Object} record - Registro do banco
 * @param {string} field - Nome do campo
 * @returns {string|null} Valor do campo ou null
 */
function extractFieldValue(record, field) {
  if (!record) return null;
  
  // Tentar múltiplos caminhos possíveis
  const paths = [
    record[field],
    record[field?.toLowerCase()],
    record.data?.[field],
    record.data?.[field?.toLowerCase()],
    record.data?.[field?.charAt(0).toUpperCase() + field?.slice(1).toLowerCase()]
  ];
  
  for (const value of paths) {
    if (value !== null && value !== undefined && value !== '') {
      return String(value);
    }
  }
  
  return null;
}

/**
 * Extrair data de criação de um registro
 * @param {Object} record - Registro do banco
 * @returns {string|null} Data no formato YYYY-MM-DD ou YYYY-MM
 */
function extractDataCriacao(record) {
  if (!record) return null;
  
  // Tentar múltiplos campos possíveis
  const dateFields = [
    record.dataCriacaoIso,
    record.dataCriacao,
    record.dataDaCriacao,
    record.data?.dataCriacaoIso,
    record.data?.dataCriacao,
    record.data?.dataDaCriacao,
    record.data?.data_da_criacao,
    record.data?.Data,
    record.data?.data
  ];
  
  for (const dateValue of dateFields) {
    if (dateValue) {
      // Se já está no formato YYYY-MM, retornar direto
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}$/.test(dateValue)) {
        return dateValue;
      }
      
      // Tentar usar função global se disponível
      if (window.getDataCriacao) {
        const globalDate = window.getDataCriacao(record);
        if (globalDate) {
          return globalDate;
        }
      }
      
      // Tentar converter para Date
      try {
        let dateStr = String(dateValue);
        if (!dateStr.includes('T')) {
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = dateStr + 'T00:00:00';
          } else if (dateStr.match(/^\d{4}-\d{2}$/)) {
            return dateStr; // Já está no formato correto
          }
        }
        
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      } catch (e) {
        // Continuar tentando outros campos
      }
    }
  }
  
  return null;
}

/**
 * Agregar dados filtrados localmente
 * @param {Array} filteredData - Array de registros filtrados
 * @returns {Object} Objeto com dataOrgaos e dataMensal
 */
function aggregateFilteredData(filteredData) {
  const orgaoMap = new Map();
  const mesMap = new Map();
  
  filteredData.forEach(record => {
    // Extrair órgão
    const orgao = extractFieldValue(record, 'orgaos') || 
                 extractFieldValue(record, 'Orgaos') ||
                 extractFieldValue(record, 'Secretaria') ||
                 'Não informado';
    
    if (orgao && orgao !== 'Não informado' && orgao !== 'null' && orgao !== 'undefined') {
      orgaoMap.set(orgao, (orgaoMap.get(orgao) || 0) + 1);
    }
    
    // Extrair mês
    const dataCriacao = extractDataCriacao(record);
    if (dataCriacao) {
      // Garantir formato YYYY-MM
      const ym = dataCriacao.match(/^(\d{4}-\d{2})/)?.[1] || dataCriacao;
      if (ym && /^\d{4}-\d{2}$/.test(ym)) {
        mesMap.set(ym, (mesMap.get(ym) || 0) + 1);
      }
    }
  });
  
  // Converter para arrays
  const dataOrgaos = Array.from(orgaoMap.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
  
  const dataMensal = Array.from(mesMap.entries())
    .map(([ym, count]) => ({ ym, count }))
    .sort((a, b) => a.ym.localeCompare(b.ym));
  
  return { dataOrgaos, dataMensal };
}

async function loadOrgaoMes(forceRefresh = false) {
  // PRIORIDADE 1: Verificar dependências críticas
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader', 'chartFactory', 'dataStore'],
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
  
  const { dataLoader, chartFactory, dataStore } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('🏢 loadOrgaoMes: Iniciando');
  }
  
  const page = document.getElementById('page-orgao-mes');
  if (!page) {
    if (window.Logger) {
      window.Logger.warn('⚠️ loadOrgaoMes: Página page-orgao-mes não encontrada');
    }
    return Promise.resolve();
  }
  
  // Verificar se a página está visível
  const isPageVisible = page.style.display !== 'none' && 
                        page.offsetParent !== null && 
                        window.getComputedStyle(page).display !== 'none';
  
  if (!isPageVisible) {
    if (window.Logger) {
      window.Logger.debug('🏢 loadOrgaoMes: Página não visível, pulando carregamento', {
        display: page.style.display,
        offsetParent: page.offsetParent,
        computedDisplay: window.getComputedStyle(page).display
      });
    }
    // Mesmo assim, garantir que os KPIs sejam atualizados quando a página se tornar visível
    // Adicionar listener para quando a página se tornar visível
    const observer = new MutationObserver(() => {
      const nowVisible = page.style.display !== 'none' && 
                         page.offsetParent !== null && 
                         window.getComputedStyle(page).display !== 'none';
      if (nowVisible && currentOrgaosData.length > 0) {
        observer.disconnect();
      }
    });
    observer.observe(page, { attributes: true, attributeFilter: ['style'] });
    return Promise.resolve();
  }
  
  // Garantir que a página esteja visível
  if (page.style.display === 'none') {
    page.style.display = '';
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.show('Carregando dados de órgãos...');
  
  // PRIORIDADE 1: Usar safeAsync para tratamento de erros
  return await window.errorHandler?.safeAsync(async () => {
    // Coletar filtros da página (mês e status)
    const pageFilters = collectPageFilters();
    
    // Verificar se há filtros ativos usando o sistema global
    let activeFilters = null;
    if (window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters?.filters || [];
      // Combinar filtros globais com filtros da página
      activeFilters = [...globalFilters, ...pageFilters];
      if (activeFilters.length > 0) {
        if (window.Logger) {
          window.Logger.debug(`🏢 loadOrgaoMes: ${activeFilters.length} filtro(s) ativo(s)`, activeFilters);
        }
      }
    } else if (pageFilters.length > 0) {
      activeFilters = pageFilters;
    }
    
    let dataOrgaos = [];
    let dataMensal = [];
    
    // Se houver filtros ativos, usar endpoint /api/filter/aggregated (mesmo da Overview)
    if (activeFilters && activeFilters.length > 0) {
      try {
        // Invalidar cache quando há filtros ativos
        if (dataStore && forceRefresh) {
          dataStore.invalidate?.();
        }
        
        // Converter filtros para formato da API
        const apiFilters = activeFilters.map(f => ({
          field: f.field,
          op: f.op || 'eq',
          value: f.value
        }));
        
        if (window.Logger) {
          window.Logger.debug('🚀 loadOrgaoMes: Buscando dados agregados da API /api/filter/aggregated', { 
            filters: apiFilters.length,
            apiFilters 
          });
        }
        
        const response = await fetch('/api/filter/aggregated', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ filters: apiFilters })
        });
        
        if (!response.ok) {
          throw new Error(`API retornou status ${response.status}: ${response.statusText}`);
        }
        
        const aggregatedData = await response.json();
        
        // PRIORIDADE 1: Validar dados recebidos
        const validation = window.dataValidator?.validateApiResponse(aggregatedData, {
          arrays: {
            manifestationsByOrgan: {
              required: ['organ', 'count'],
              types: { organ: 'string', count: 'number' }
            },
            manifestationsByMonth: {
              required: ['month', 'count'],
              types: { month: 'string', count: 'number' }
            }
          }
        });
        
        if (!validation.valid) {
          throw new Error(`Dados inválidos: ${validation.error}`);
        }
          
          if (window.Logger) {
            window.Logger.debug('📡 loadOrgaoMes: Dados agregados recebidos', { 
              type: typeof aggregatedData,
              isArray: Array.isArray(aggregatedData),
              keys: aggregatedData ? Object.keys(aggregatedData).slice(0, 10) : [],
              hasByOrgan: !!aggregatedData?.manifestationsByOrgan,
              hasByMonth: !!aggregatedData?.manifestationsByMonth
            });
          }
          
          // Extrair dados de órgãos e meses do formato agregado
          if (aggregatedData?.manifestationsByOrgan) {
            dataOrgaos = aggregatedData.manifestationsByOrgan.map(item => ({
              key: item.organ || item._id || item.key || 'Não informado',
              count: item.count || 0
            })).sort((a, b) => b.count - a.count);
          }
          
          if (aggregatedData?.manifestationsByMonth) {
            dataMensal = aggregatedData.manifestationsByMonth.map(item => ({
              ym: item.month || item.ym || item._id || '',
              count: item.count || 0
            })).filter(m => m.ym).sort((a, b) => a.ym.localeCompare(b.ym));
          }
          
          if (window.Logger) {
            window.Logger.debug(`🏢 loadOrgaoMes: Dados extraídos do formato agregado`, { 
              orgaos: dataOrgaos.length, 
              meses: dataMensal.length,
              totalOrgaos: dataOrgaos.reduce((sum, o) => sum + (o.count || 0), 0),
              totalMeses: dataMensal.reduce((sum, m) => sum + (m.count || 0), 0)
            });
          }
      } catch (filterError) {
        // PRIORIDADE 1: Tratamento de erro com fallback
        window.errorHandler?.handleError(filterError, 'loadOrgaoMes (com filtros)', {
          showToUser: false, // Não mostrar erro, vamos tentar sem filtros
          fallback: async () => {
            // Fallback: carregar sem filtros
            const fallbackOrgaos = await dataLoader?.load('/api/aggregate/count-by?field=Orgaos', {
              useDataStore: !forceRefresh,
              ttl: 10 * 60 * 1000
            }) || [];
            
            const fallbackMensal = await dataLoader?.load('/api/aggregate/by-month', {
              useDataStore: !forceRefresh,
              ttl: 10 * 60 * 1000
            }) || [];
            
            return { dataOrgaos: fallbackOrgaos, dataMensal: fallbackMensal };
          }
        });
        
        // Tentar fallback
        const fallbackResult = await window.errorHandler?.safeAsync(async () => {
          return {
            dataOrgaos: await dataLoader?.load('/api/aggregate/count-by?field=Orgaos', {
              useDataStore: !forceRefresh,
              ttl: 10 * 60 * 1000
            }) || [],
            dataMensal: await dataLoader?.load('/api/aggregate/by-month', {
              useDataStore: !forceRefresh,
              ttl: 10 * 60 * 1000
            }) || []
          };
        }, 'loadOrgaoMes (fallback sem filtros)');
        
        if (fallbackResult) {
          dataOrgaos = fallbackResult.dataOrgaos;
          dataMensal = fallbackResult.dataMensal;
        }
        
        // Normalizar formato de dataMensal
        dataMensal = (dataMensal || []).map(m => ({
          ym: m.month || m.ym || m._id || '',
          count: Number(m.count || m.value || 0)
        })).filter(m => {
          // Garantir formato YYYY-MM válido
          return m.ym && 
                 m.ym.length >= 7 && 
                 /^\d{4}-\d{2}/.test(m.ym) &&
                 !isNaN(m.count);
        });
        
        if (window.Logger) {
          window.Logger.debug('🏢 loadOrgaoMes: Dados mensais do fallback normalizados', {
            count: dataMensal.length,
            sample: dataMensal[0]
          });
        }
      }
    } else {
      // Sem filtros, carregar dados agregados normalmente
      if (window.Logger) {
        window.Logger.debug('🏢 loadOrgaoMes: Carregando dados sem filtros');
      }
      
      // PRIORIDADE 1: Carregar dados com validação
      const orgaosData = await dataLoader?.load('/api/aggregate/count-by?field=Orgaos', {
        useDataStore: !forceRefresh,
        ttl: 10 * 60 * 1000
      }) || [];
      
      // Validar dados de órgãos
      const orgaosValidation = window.dataValidator?.validateApiResponse(orgaosData, {
        arrayItem: {
          required: ['key', 'count'],
          types: { key: 'string', count: 'number' }
        }
      });
      
      if (orgaosValidation.valid) {
        dataOrgaos = (orgaosData || []).map(item => ({
          key: item.key || item.organ || item._id || item.name || 'Não informado',
          count: Number(item.count || item.value || 0)
        })).filter(item => item.key && item.key !== 'Não informado');
      } else {
        window.errorHandler?.handleError(
          new Error(`Dados de órgãos inválidos: ${orgaosValidation.error}`),
          'loadOrgaoMes (validação órgãos)',
          { showToUser: false }
        );
        dataOrgaos = [];
      }
      
      const mensalData = await dataLoader?.load('/api/aggregate/by-month', {
        useDataStore: !forceRefresh,
        ttl: 10 * 60 * 1000
      }) || [];
      
      if (window.Logger) {
        window.Logger.debug('🏢 loadOrgaoMes: Dados mensais recebidos do endpoint', {
          count: mensalData?.length || 0,
          isArray: Array.isArray(mensalData),
          sample: mensalData?.[0],
          first3: mensalData?.slice(0, 3)
        });
      }
      
      // Validar dados mensais (mas não ser muito restritivo)
      const mensalValidation = window.dataValidator?.validateApiResponse(mensalData, {
        arrayItem: {
          required: ['month', 'count'], // O endpoint retorna 'month', não 'ym'
          types: { month: 'string', count: 'number' }
        }
      });
      
      if (mensalValidation.valid) {
        dataMensal = (mensalData || []).map(m => ({
          ym: m.month || m.ym || m._id || '',
          count: Number(m.count || m.value || 0)
        })).filter(m => m.ym && m.ym.length >= 7); // Garantir formato YYYY-MM
      } else {
        // Mesmo se validação falhar, tentar processar os dados
        if (window.Logger) {
          window.Logger.warn('⚠️ Validação mensal falhou, mas tentando processar dados mesmo assim', {
            error: mensalValidation.error,
            dataLength: mensalData?.length || 0
          });
        }
        
        // Tentar processar mesmo com validação falhada
        dataMensal = (mensalData || []).map(m => ({
          ym: m.month || m.ym || m._id || '',
          count: Number(m.count || m.value || 0)
        })).filter(m => {
          // Filtrar apenas itens com ym válido no formato YYYY-MM
          return m.ym && 
                 m.ym.length >= 7 && 
                 /^\d{4}-\d{2}/.test(m.ym) &&
                 !isNaN(m.count);
        });
        
        if (dataMensal.length === 0 && mensalData && mensalData.length > 0) {
          // Se ainda estiver vazio mas havia dados, logar para debug
          window.errorHandler?.handleError(
            new Error(`Dados mensais não puderam ser processados: ${mensalValidation.error}. Dados recebidos: ${JSON.stringify(mensalData.slice(0, 3))}`),
            'loadOrgaoMes (validação mensal)',
            { showToUser: false }
          );
        }
      }
    }
    
    // Normalizar dados de órgãos (garantir formato consistente)
    dataOrgaos = (dataOrgaos || []).map(item => ({
      key: item.key || item.organ || item._id || item.name || 'Não informado',
      count: Number(item.count || item.value || 0)
    })).filter(item => {
      // Manter apenas itens válidos (com key válido e count numérico)
      return item.key && 
             item.key !== 'Não informado' && 
             item.key !== 'null' && 
             item.key !== 'undefined' &&
             !isNaN(item.count);
      // Não filtrar por count > 0 aqui, pois queremos mostrar todos os órgãos
    });
    
    // Normalizar dados mensais (garantir formato consistente)
    dataMensal = (dataMensal || []).map(item => ({
      ym: item.ym || item.month || item._id || '',
      count: Number(item.count || item.value || 0)
    })).filter(item => {
      // Manter apenas itens com ym válido no formato YYYY-MM
      if (!item.ym || item.ym === 'null' || item.ym === 'undefined') {
        return false;
      }
      
      // Garantir formato YYYY-MM (pelo menos 7 caracteres)
      if (item.ym.length < 7 || !/^\d{4}-\d{2}/.test(item.ym)) {
        if (window.Logger) {
          window.Logger.debug('🏢 Filtrando item mensal inválido:', { ym: item.ym, count: item.count });
        }
        return false;
      }
      
      // Garantir que count é um número válido
      if (isNaN(item.count)) {
        if (window.Logger) {
          window.Logger.debug('🏢 Filtrando item mensal com count inválido:', { ym: item.ym, count: item.count });
        }
        return false;
      }
      
      return true;
      // Não filtrar por count > 0 aqui - queremos mostrar todos os meses, mesmo com 0
    });
    
    if (window.Logger) {
      window.Logger.debug('🏢 loadOrgaoMes: Dados normalizados', {
        orgaosCount: dataOrgaos.length,
        mesesCount: dataMensal.length,
        totalOrgaos: dataOrgaos.reduce((sum, o) => sum + (o.count || 0), 0),
        totalMeses: dataMensal.reduce((sum, m) => sum + (m.count || 0), 0),
        sampleOrgao: dataOrgaos[0],
        sampleMes: dataMensal[0],
        first3Meses: dataMensal.slice(0, 3),
        last3Meses: dataMensal.slice(-3)
      });
      
      if (dataMensal.length === 0) {
        window.Logger.warn('⚠️ loadOrgaoMes: dataMensal está VAZIO após normalização!', {
          orgaosCount: dataOrgaos.length,
          totalOrgaos: dataOrgaos.reduce((sum, o) => sum + (o.count || 0), 0)
        });
      }
    }
    
    // Armazenar dados globalmente para busca e ordenação
    currentOrgaosData = dataOrgaos;
    
    // Armazenar dados mensais globalmente para uso posterior
    window._orgaoMesDataMensal = dataMensal;
    
    // Limpar busca e ordenação quando dados mudam
    const searchInput = document.getElementById('searchOrgaos');
    if (searchInput) {
      searchInput.value = '';
      searchTerm = '';
    }
    sortAscending = false;
    const sortModeEl = document.getElementById('sortMode');
    if (sortModeEl) {
      sortModeEl.textContent = 'Maior → Menor';
    }
    
    // Renderizar lista de órgãos (atualizar após renderizar para garantir destaque visual)
    renderOrgaosList(dataOrgaos);
    
    // PRIORIDADE 1: Verificar chartFactory antes de renderizar
    if (!chartFactory) {
      throw new Error('chartFactory não disponível');
    }
    
    // Renderizar gráfico mensal
    await renderOrgaoMesChart(dataMensal);
    
    // Renderizar gráfico de barras dos top órgãos
    await renderTopOrgaosBarChart(dataOrgaos);
    
    // Renderizar gráficos adicionais
    await renderOrgaosPizzaChart(dataOrgaos);
    await renderOrgaosTemporalChart(dataOrgaos, dataMensal);
    await renderOrgaosAgrupadasChart(dataOrgaos, dataMensal);
    
    // CROSSFILTER: Renderizar banner de filtros ativos
    renderOrgaoMesFilterBanner();
    
    // Re-renderizar lista para garantir destaque visual correto após banner ser criado
    renderOrgaosList(dataOrgaos);
    
    // Atualizar info mensal
    const infoMensal = document.getElementById('infoMensal');
    if (infoMensal) {
      if (activeFilters && activeFilters.length > 0) {
        const filterCount = activeFilters.length;
        infoMensal.textContent = `${filterCount} filtro(s) ativo(s) - Clique direito para limpar`;
      } else {
        infoMensal.textContent = 'Clique em um mês ou órgão para filtrar';
      }
    }
    
    if (window.Logger) {
      window.Logger.success('🏢 loadOrgaoMes: Concluído');
    }
    
    // PRIORIDADE 2: Esconder loading
    window.loadingManager?.hide();
    
    return { success: true, dataOrgaos, dataMensal };
  }, 'loadOrgaoMes', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hide();
      
      // Fallback: mostrar página vazia
      const listaOrgaos = document.getElementById('listaOrgaos');
      if (listaOrgaos) {
        listaOrgaos.innerHTML = '<div class="text-center text-slate-400 py-4">Erro ao carregar dados. Tente recarregar a página.</div>';
      }
      return { success: false, dataOrgaos: [], dataMensal: [] };
    }
  });
}

function renderOrgaosList(dataOrgaos) {
  const listaOrgaos = document.getElementById('listaOrgaos');
  if (!listaOrgaos) return;
  
  // Aplicar busca se houver termo de busca
  let filteredData = dataOrgaos;
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filteredData = dataOrgaos.filter(item => {
      const key = (item.key || item.organ || item._id || '').toLowerCase();
      return key.includes(searchLower);
    });
  }
  
  // Aplicar ordenação
  if (sortAscending) {
    filteredData = [...filteredData].sort((a, b) => (a.count || 0) - (b.count || 0));
  } else {
    filteredData = [...filteredData].sort((a, b) => (b.count || 0) - (a.count || 0));
  }
  
  if (!filteredData || filteredData.length === 0) {
    listaOrgaos.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum órgão encontrado</div>';
    return;
  }
  
  const maxValue = Math.max(...filteredData.map(d => d.count || 0), 1);
  listaOrgaos.innerHTML = filteredData.map((item, idx) => {
    const width = ((item.count || 0) / maxValue) * 100;
    const key = item.key || item.organ || item._id || 'Não informado';
    const count = item.count || 0;
    const percent = maxValue > 0 ? ((count / maxValue) * 100).toFixed(1) : '0';
    
    // Destacar se está filtrado
    const isFiltered = window.chartCommunication?.filters?.filters?.some(f => 
      f.field === 'Orgaos' && f.value === key
    );
    
    return `
      <div 
        class="flex items-center gap-3 py-3 border-b border-white/5 hover:bg-white/10 cursor-pointer transition-all rounded-lg px-3 ${isFiltered ? 'bg-cyan-500/10 border-cyan-500/30 ring-2 ring-cyan-500/50' : ''}"
        data-orgao="${key}"
        onclick="filterByOrgao('${key.replace(/'/g, "\\'")}')"
        oncontextmenu="event.preventDefault(); clearAllFiltersOrgaoMes();"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <div class="text-xs font-bold text-slate-500 w-6 text-right">${idx + 1}º</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-200 truncate">${key}</div>
            <div class="mt-1.5 h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div class="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-pink-500 transition-all duration-300" style="width: ${width}%"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[10px] text-slate-300 font-semibold">${percent}%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="text-right min-w-[80px]">
          <div class="text-lg font-bold text-cyan-300">${count.toLocaleString('pt-BR')}</div>
          <div class="text-xs text-slate-500">manifestações</div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderOrgaoMesChart(dataMensal) {
  // PRIORIDADE 1: Verificar dependências
  const chartFactory = window.errorHandler?.requireDependency('chartFactory');
  if (!chartFactory) return;
  
  // Destruir gráfico existente antes de criar novo
  if (chartFactory.destroyCharts) {
    chartFactory.destroyCharts(['chartOrgaoMes']);
  }
  
  if (!dataMensal || dataMensal.length === 0) {
    const canvas = document.getElementById('chartOrgaoMes');
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
  
  // Armazenar mapeamento label -> ym para uso no filtro
  const labelToYmMap = new Map();
  
  const labels = dataMensal.map(x => {
    const ym = x.ym || x.month || '';
    const formattedLabel = window.dateUtils?.formatMonthYear?.(ym) || ym || 'Data inválida';
    labelToYmMap.set(formattedLabel, ym);
    return formattedLabel;
  });
  const values = dataMensal.map(x => x.count || 0);
  
  if (window.Logger) {
    window.Logger.debug('📊 renderOrgaoMesChart: Renderizando', { 
      labels: labels.length, 
      values: values.length,
      total: values.reduce((sum, v) => sum + v, 0)
    });
  }
  
  // Calcular estatísticas
  const total = values.reduce((sum, v) => sum + v, 0);
  const media = values.length > 0 ? Math.round(total / values.length) : 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const maxIndex = values.indexOf(max);
  const minIndex = values.indexOf(min);
  
  // Atualizar informações
  const mesMaxEl = document.getElementById('mesMax');
  const mesMinEl = document.getElementById('mesMin');
  const mesMediaEl = document.getElementById('mesMedia');
  
  if (mesMaxEl) mesMaxEl.textContent = `${labels[maxIndex]}: ${max.toLocaleString('pt-BR')}`;
  if (mesMinEl) mesMinEl.textContent = `${labels[minIndex]}: ${min.toLocaleString('pt-BR')}`;
  if (mesMediaEl) mesMediaEl.textContent = `${media.toLocaleString('pt-BR')}`;
  
  // Armazenar dados para uso no onClick handler
  window._orgaoMesDataMensal = dataMensal;
  window._orgaoMesLabelToYmMap = labelToYmMap;
  
  const chart = await chartFactory.createBarChart('chartOrgaoMes', labels, values, {
    horizontal: false, // Gráfico vertical
    colorIndex: 1,
    label: 'Manifestações',
    onClick: true, // Habilitar interatividade para crossfilter
    chartOptions: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR')}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        }
      }
    },
  });
  
  // CROSSFILTER: Adicionar sistema de filtros (filtro por mês/período)
  // Aguardar um pouco para garantir que o gráfico foi criado completamente
  if (chart && dataMensal && window.addCrossfilterToChart) {
    setTimeout(() => {
      if (chart && chart.canvas && chart.canvas.ownerDocument) {
        window.addCrossfilterToChart(chart, dataMensal, {
          field: 'month',
          valueField: 'ym',
          onFilterChange: () => {
            if (window.loadOrgaoMes) setTimeout(() => window.loadOrgaoMes(), 100);
          }
        });
      }
    }, 100);
  }
  
  // CROSSFILTER: Adicionar handler de clique para filtrar por mês (compatibilidade)
  if (chart && chart.canvas) {
    chart.canvas.style.cursor = 'pointer';
    
    // Adicionar wrapper para clique direito (limpar filtros)
    const chartContainer = chart.canvas.parentElement;
    if (chartContainer && !chartContainer.dataset.crossfilterEnabled) {
      chartContainer.dataset.crossfilterEnabled = 'true';
      chartContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (window.crossfilterOverview) {
          window.crossfilterOverview.clearAllFilters();
          window.crossfilterOverview.notifyListeners();
        } else if (window.chartCommunication && window.chartCommunication.filters) {
          window.chartCommunication.filters.clear();
        }
      });
    }
    
    chart.options.onClick = (event, elements) => {
      if (elements && elements.length > 0) {
        const element = elements[0];
        const index = element.index;
        const label = labels[index];
        const ym = labelToYmMap.get(label) || window._orgaoMesDataMensal?.[index]?.ym || window._orgaoMesDataMensal?.[index]?.month;
        
        if (ym) {
          if (window.Logger) {
            window.Logger.debug('📊 Clique no gráfico chartOrgaoMes (mês):', { ym, label, index });
          }
          
          // Filtrar por mês usando dataCriacaoIso
          // Usar sistema global de filtros (crossfilter não tem filtro de data direto)
          if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.apply('dataCriacaoIso', ym, 'chartOrgaoMes', { operator: 'contains' });
          }
          
          // Atualizar banner
          setTimeout(() => {
            renderOrgaoMesFilterBanner();
          }, 100);
        }
      }
    };
    chart.update('none');
  }
}

/**
 * Renderizar gráfico de barras dos top órgãos
 */
async function renderTopOrgaosBarChart(dataOrgaos) {
  // PRIORIDADE 1: Verificar dependências
  const chartFactory = window.errorHandler?.requireDependency('chartFactory');
  if (!chartFactory) return;
  
  // Destruir gráfico existente antes de criar novo
  if (chartFactory.destroyCharts) {
    chartFactory.destroyCharts(['chartTopOrgaosBar']);
  }
  
  if (!dataOrgaos || dataOrgaos.length === 0) {
    const canvas = document.getElementById('chartTopOrgaosBar');
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
  
  const top5 = dataOrgaos.slice(0, 5); // Top 5 principais
  const labels = top5.map(o => {
    const key = o.key || o.organ || o._id || 'Não informado';
    // Truncar nomes longos
    return key.length > 30 ? key.substring(0, 30) + '...' : key;
  });
  const values = top5.map(o => o.count || 0);
  
  if (window.Logger) {
    window.Logger.debug('📊 renderTopOrgaosBarChart: Renderizando', { 
      labels: labels.length, 
      values: values.length,
      total: values.reduce((sum, v) => sum + v, 0)
    });
  }
  
  const chart = await chartFactory.createBarChart('chartTopOrgaosBar', labels, values, {
    horizontal: true,
    colorIndex: 2,
    label: 'Manifestações',
    onClick: true, // Habilitar interatividade para crossfilter
    field: 'orgaos',
    chartOptions: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.x.toLocaleString('pt-BR')}`;
            }
          }
        }
      }
    },
  });
  
  // CROSSFILTER: Adicionar sistema de filtros usando helper universal
  // Aguardar um pouco para garantir que o gráfico foi criado completamente
  if (chart && dataOrgaos && window.addCrossfilterToChart) {
    setTimeout(() => {
      if (chart && chart.canvas && chart.canvas.ownerDocument) {
        window.addCrossfilterToChart(chart, dataOrgaos, {
          field: 'orgaos',
          valueField: 'key',
          onFilterChange: () => {
            if (window.loadOrgaoMes) setTimeout(() => window.loadOrgaoMes(), 100);
          },
          onClearFilters: () => {
            if (window.loadOrgaoMes) setTimeout(() => window.loadOrgaoMes(), 100);
          }
        });
      }
    }, 100);
  }
  
  // CROSSFILTER: Adicionar handler de clique para filtrar por órgão (compatibilidade)
  if (chart && chart.canvas) {
    chart.canvas.style.cursor = 'pointer';
    
    // Adicionar wrapper para clique direito (limpar filtros)
    const chartContainer = chart.canvas.parentElement;
    if (chartContainer && !chartContainer.dataset.crossfilterEnabled) {
      chartContainer.dataset.crossfilterEnabled = 'true';
      chartContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        clearAllFiltersOrgaoMes();
      });
    }
    
    chart.options.onClick = (event, elements) => {
      if (elements && elements.length > 0) {
        const element = elements[0];
        const index = element.index;
        const orgaoItem = top5[index];
        const orgao = orgaoItem?.key || orgaoItem?.organ || orgaoItem?._id || labels[index] || 'N/A';
        
        if (orgao) {
          if (window.crossfilterOverview) {
            if (window.Logger) {
              window.Logger.debug('📊 Clique no gráfico chartTopOrgaosBar:', { orgao, index, orgaoItem });
            }
            window.crossfilterOverview.setOrgaosFilter(orgao);
            window.crossfilterOverview.notifyListeners();
          } else if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.apply('Orgaos', orgao, 'chartTopOrgaosBar', { operator: 'contains' });
          }
        }
      }
    };
    chart.update('none');
  }
}

/**
 * Renderizar gráfico de pizza: Distribuição percentual dos órgãos
 */
async function renderOrgaosPizzaChart(dataOrgaos) {
  const chartFactory = window.errorHandler?.requireDependency('chartFactory');
  if (!chartFactory) return;
  
  if (chartFactory.destroyCharts) {
    chartFactory.destroyCharts(['chartOrgaosPizza']);
  }
  
  if (!dataOrgaos || dataOrgaos.length === 0) {
    const canvas = document.getElementById('chartOrgaosPizza');
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
  
  // Top 10 órgãos para pizza
  const top10 = dataOrgaos.slice(0, 10);
  const labels = top10.map(o => {
    const key = o.key || o.organ || o._id || 'Não informado';
    return key.length > 25 ? key.substring(0, 25) + '...' : key;
  });
  const values = top10.map(o => o.count || 0);
  const total = values.reduce((sum, v) => sum + v, 0);
  
  if (total === 0) return;
  
  const chart = await chartFactory.createDoughnutChart('chartOrgaosPizza', labels, values, {
    field: 'orgaos',
    chartOptions: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              return `${label}: ${value.toLocaleString('pt-BR')} (${percent}%)`;
            }
          }
        }
      }
    }
  });
  
  // Atualizar info box
  const infoBox = document.getElementById('orgaosPizzaInfo');
  if (infoBox && top10.length > 0) {
    const topOrgao = top10[0];
    const percent = total > 0 ? ((topOrgao.count / total) * 100).toFixed(1) : '0.0';
    infoBox.innerHTML = `
      <div class="text-xs text-slate-400 mb-1">Órgão mais frequente</div>
      <div class="text-sm font-bold text-cyan-300">${topOrgao.key}</div>
      <div class="text-xs text-slate-500 mt-1">${topOrgao.count.toLocaleString('pt-BR')} (${percent}%)</div>
      <div class="text-xs text-slate-400 mt-2">Total: ${total.toLocaleString('pt-BR')} manifestações</div>
    `;
  }
}

/**
 * Renderizar gráfico de linha múltipla: Evolução temporal dos top 5 órgãos
 */
async function renderOrgaosTemporalChart(dataOrgaos, dataMensal) {
  const chartFactory = window.errorHandler?.requireDependency('chartFactory');
  if (!chartFactory) return;
  
  if (chartFactory.destroyCharts) {
    chartFactory.destroyCharts(['chartOrgaosTemporal']);
  }
  
  if (!dataOrgaos || dataOrgaos.length === 0 || !dataMensal || dataMensal.length === 0) {
    const canvas = document.getElementById('chartOrgaosTemporal');
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
  
  // Buscar dados de órgãos por mês
  try {
    const orgaosMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=orgaos', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(orgaosMesData) && orgaosMesData.length > 0) {
      // Top 5 órgãos
      const top5 = dataOrgaos.slice(0, 5);
      const top5Keys = new Set(top5.map(o => o.key || o.organ || o._id));
      
      // Agrupar dados por órgão e mês
      const orgaosMap = new Map();
      const mesesSet = new Set();
      
      orgaosMesData.forEach(item => {
        const orgao = item.orgaos || item.organ || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(orgao)) return;
        
        mesesSet.add(mes);
        
        if (!orgaosMap.has(orgao)) {
          orgaosMap.set(orgao, new Map());
        }
        
        orgaosMap.get(orgao).set(mes, item.count || 0);
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
        const orgao = item.key || item.organ || item._id;
        const mesesMap = orgaosMap.get(orgao) || new Map();
        const values = meses.map(mes => mesesMap.get(mes) || 0);
        
        return {
          label: orgao.length > 20 ? orgao.substring(0, 20) + '...' : orgao,
          data: values,
          borderColor: getColorForIndex(idx),
          backgroundColor: getColorWithAlpha(getColorForIndex(idx), 0.1),
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
      
      const canvas = document.getElementById('chartOrgaosTemporal');
      if (canvas && window.Chart) {
        // Destruir gráfico existente
        if (window.Chart.getChart) {
          const existingChart = window.Chart.getChart(canvas);
          if (existingChart) {
            existingChart.destroy();
          }
        }
        
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
                  color: isLightMode() ? '#1e293b' : '#e2e8f0',
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
                  color: isLightMode() ? '#64748b' : '#94a3b8',
                  maxRotation: 45,
                  minRotation: 45
                },
                grid: {
                  color: isLightMode() ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  color: isLightMode() ? '#64748b' : '#94a3b8',
                  callback: function(value) {
                    return value.toLocaleString('pt-BR');
                  }
                },
                grid: {
                  color: isLightMode() ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                }
              }
            }
          }
        });
        
        window.chartOrgaosTemporal = chart;
        
        // Atualizar info box
        const infoBox = document.getElementById('orgaosTemporalInfo');
        if (infoBox && top5.length > 0) {
          const topOrgao = top5[0];
          infoBox.innerHTML = `
            <div class="text-xs text-slate-400 mb-1">Órgão líder</div>
            <div class="text-sm font-bold text-cyan-300">${topOrgao.key}</div>
            <div class="text-xs text-slate-500 mt-1">Total: ${topOrgao.count.toLocaleString('pt-BR')} manifestações</div>
          `;
        }
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderOrgaosTemporalChart', { showToUser: false });
  }
}

/**
 * Renderizar gráfico de barras agrupadas: Órgãos por mês
 */
async function renderOrgaosAgrupadasChart(dataOrgaos, dataMensal) {
  const chartFactory = window.errorHandler?.requireDependency('chartFactory');
  if (!chartFactory) return;
  
  if (chartFactory.destroyCharts) {
    chartFactory.destroyCharts(['chartOrgaosAgrupadas']);
  }
  
  if (!dataOrgaos || dataOrgaos.length === 0 || !dataMensal || dataMensal.length === 0) {
    const canvas = document.getElementById('chartOrgaosAgrupadas');
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
  
  // Buscar dados de órgãos por mês
  try {
    const orgaosMesData = await window.dataLoader?.load('/api/aggregate/count-by-status-mes?field=orgaos', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || [];
    
    if (Array.isArray(orgaosMesData) && orgaosMesData.length > 0) {
      // Top 5 órgãos
      const top5 = dataOrgaos.slice(0, 5);
      const top5Keys = new Set(top5.map(o => o.key || o.organ || o._id));
      
      // Agrupar dados por mês
      const mesesMap = new Map();
      orgaosMesData.forEach(item => {
        const orgao = item.orgaos || item.organ || item._id || 'Não informado';
        const mes = item.month || item.mes || item.ym || '';
        
        if (!mes || !top5Keys.has(orgao)) return;
        
        if (!mesesMap.has(mes)) {
          mesesMap.set(mes, new Map());
        }
        
        mesesMap.get(mes).set(orgao, item.count || 0);
      });
      
      // Ordenar meses
      const meses = Array.from(mesesMap.keys()).sort();
      const labels = meses.map(m => {
        if (m.includes('-')) {
          const [year, monthNum] = m.split('-');
          return window.dateUtils?.formatMonthYearShort(m) || `${monthNum}/${year.slice(-2)}`;
        }
        return m;
      });
      
      // Preparar datasets para cada órgão
      const datasets = top5.map((item, idx) => {
        const orgao = item.key || item.organ || item._id;
        const values = meses.map(mes => {
          const orgaosMap = mesesMap.get(mes) || new Map();
          return orgaosMap.get(orgao) || 0;
        });
        
        return {
          label: orgao.length > 20 ? orgao.substring(0, 20) + '...' : orgao,
          data: values,
          backgroundColor: getColorWithAlpha(getColorForIndex(idx), 0.7),
          borderColor: getColorForIndex(idx),
          borderWidth: 1
        };
      });
      
      // Garantir que Chart.js está carregado
      if (window.lazyLibraries?.loadChartJS) {
        await window.lazyLibraries.loadChartJS();
      }
      
      const canvas = document.getElementById('chartOrgaosAgrupadas');
      if (canvas && window.Chart) {
        // Destruir gráfico existente
        if (window.Chart.getChart) {
          const existingChart = window.Chart.getChart(canvas);
          if (existingChart) {
            existingChart.destroy();
          }
        }
        
        const chart = new window.Chart(canvas, {
          type: 'bar',
          data: { labels, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: isLightMode() ? '#1e293b' : '#e2e8f0',
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
                stacked: false,
                ticks: {
                  color: isLightMode() ? '#64748b' : '#94a3b8',
                  maxRotation: 45,
                  minRotation: 45
                },
                grid: {
                  color: isLightMode() ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                }
              },
              y: {
                stacked: false,
                beginAtZero: true,
                ticks: {
                  color: isLightMode() ? '#64748b' : '#94a3b8',
                  callback: function(value) {
                    return value.toLocaleString('pt-BR');
                  }
                },
                grid: {
                  color: isLightMode() ? 'rgba(100, 116, 139, 0.1)' : 'rgba(148, 163, 184, 0.1)'
                }
              }
            }
          }
        });
        
        window.chartOrgaosAgrupadas = chart;
        
        // Atualizar info box
        const infoBox = document.getElementById('orgaosAgrupadasInfo');
        if (infoBox) {
          infoBox.innerHTML = `
            <div class="text-xs text-slate-400">Comparação dos top 5 órgãos ao longo do tempo</div>
            <div class="text-xs text-slate-500 mt-1">Total de meses: ${meses.length}</div>
          `;
        }
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderOrgaosAgrupadasChart', { showToUser: false });
  }
}

// Funções auxiliares para cores
function getColorForIndex(idx) {
  const colors = [
    '#22d3ee', '#a78bfa', '#34d399', '#fbbf24', 
    '#fb7185', '#60a5fa', '#f472b6', '#84cc16'
  ];
  return colors[idx % colors.length];
}

function getColorWithAlpha(color, alpha = 0.7) {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d\.]+\)$/g, `${alpha})`);
  }
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function isLightMode() {
  return document.body.classList.contains('light-mode');
}

/**
 * REMOVIDO: Funções updateKPIs e updateKPIsVisualState removidas
 * Os cards de KPIs foram removidos da página conforme solicitado
 */
function updateKPIs(dataOrgaos, dataMensal) {
  // Função removida - cards de KPIs não existem mais
  return;
}

function updateKPIsVisualState() {
  // Função removida - cards de KPIs não existem mais
  return;
}

/**
 * Inicializar listeners de filtro para a página OrgaoMes
 * Usa o sistema global de filtros para atualização automática
 * REFATORADO: Integração completa com sistema global de filtros + crossfilter
 */
function initOrgaoMesFilterListeners() {
  // Conectar ao sistema global de filtros
  if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
    window.chartCommunication.createPageFilterListener('page-orgao-mes', loadOrgaoMes, 500);
    if (window.Logger) {
      window.Logger.success('✅ Listeners de filtro para OrgaoMes inicializados (sistema global)');
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Sistema de comunicação não disponível. Listener de filtros não será criado.');
    }
  }
  
  // CROSSFILTER: Conectar ao sistema crossfilterOverview se disponível
  // IMPORTANTE: Registrar apenas UMA VEZ para evitar múltiplos listeners
  if (window.crossfilterOverview && !window.crossfilterOverview._orgaoMesListenerRegistered) {
    window.crossfilterOverview._orgaoMesListenerRegistered = true;
    
    window.crossfilterOverview.onFilterChange(async () => {
      // Verificar se a página está visível
      const page = document.getElementById('page-orgao-mes');
      if (!page || page.style.display === 'none') {
        return;
      }
      
      // Prevenir múltiplas execuções simultâneas
      if (window.crossfilterOverview._isUpdatingOrgaoMes) {
        if (window.Logger) {
          window.Logger.debug('⏸️ loadOrgaoMes já está executando, pulando...');
        }
        return;
      }
      window.crossfilterOverview._isUpdatingOrgaoMes = true;
      
      try {
        if (window.Logger) {
          window.Logger.debug('🔄 Filtros mudaram, recarregando OrgaoMes...');
        }
        
        // Invalidar cache
        if (window.dataStore) {
          window.dataStore.invalidate?.();
        }
        
        // Recarregar dados quando filtros mudarem (isso vai atualizar os gráficos)
        await loadOrgaoMes(true); // forceRefresh = true para garantir dados atualizados
      } catch (err) {
        window.errorHandler?.handleError(err, 'loadOrgaoMes (recarregar com filtros)', {
          showToUser: false
        });
        if (window.Logger) {
          window.Logger.error('Erro ao recarregar OrgaoMes com filtros:', err);
        }
      } finally {
        window.crossfilterOverview._isUpdatingOrgaoMes = false;
      }
    });
    
    if (window.Logger) {
      window.Logger.success('✅ Listener crossfilterOverview registrado para OrgaoMes');
    }
  }
  
  // Listener para sistema global de filtros (chartCommunication) via eventos
  // O createPageFilterListener já cuida disso, mas vamos garantir que os gráficos sejam atualizados
  if (window.chartCommunication) {
    // Escutar eventos de filtro para atualizar banner e visual
    const updateUI = () => {
      renderOrgaoMesFilterBanner();
      renderOrgaosList(currentOrgaosData);
    };
    
    window.chartCommunication.on('filter:applied', updateUI);
    window.chartCommunication.on('filter:removed', updateUI);
    window.chartCommunication.on('filter:cleared', updateUI);
    window.chartCommunication.on('charts:update-requested', updateUI);
  }
  
  // Inicializar busca de órgãos (busca local, não afeta filtros globais)
  const searchInput = document.getElementById('searchOrgaos');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      renderOrgaosList(currentOrgaosData);
    });
  }
}

/**
 * Alternar ordenação dos órgãos
 */
function toggleSortOrgaos() {
  sortAscending = !sortAscending;
  const sortModeEl = document.getElementById('sortMode');
  if (sortModeEl) {
    sortModeEl.textContent = sortAscending ? 'Menor → Maior' : 'Maior → Menor';
  }
  renderOrgaosList(currentOrgaosData);
}

/**
 * Filtrar por órgão (chamado ao clicar em um item da lista)
 */
function filterByOrgao(orgao) {
  if (!orgao) return;
  
  if (window.crossfilterOverview) {
    // Usar crossfilterOverview se disponível
    window.crossfilterOverview.setOrgaosFilter(orgao);
    window.crossfilterOverview.notifyListeners();
  } else if (window.chartCommunication && window.chartCommunication.filters) {
    // Usar sistema global de filtros
    window.chartCommunication.filters.apply('Orgaos', orgao, 'listaOrgaos', { operator: 'contains' });
  }
  
  // Atualizar banner imediatamente
  renderOrgaoMesFilterBanner();
  renderOrgaosList(currentOrgaosData);
  
  if (window.Logger) {
    window.Logger.debug('📊 Filtro aplicado por órgão:', { orgao });
  }
}

/**
 * Limpar todos os filtros - REFATORADO para melhor funcionamento
 */
function clearAllFiltersOrgaoMes() {
  if (window.Logger) {
    window.Logger.debug('🗑️ clearAllFiltersOrgaoMes: Limpando todos os filtros');
  }
  
  // Limpar filtros do crossfilter
  if (window.crossfilterOverview) {
    window.crossfilterOverview.clearAllFilters();
    window.crossfilterOverview.notifyListeners();
  }
  
  // Limpar filtros do sistema global (incluindo filtros de data)
  if (window.chartCommunication && window.chartCommunication.filters) {
    window.chartCommunication.filters.clear();
    if (window.chartCommunication.filters.notifyListeners) {
      window.chartCommunication.filters.notifyListeners();
    }
  }
  
  // Recarregar dados após limpar filtros
  setTimeout(() => {
    loadOrgaoMes(true);
  }, 100);
  
  if (window.Logger) {
    window.Logger.success('✅ Todos os filtros foram limpos');
  }
}

/**
 * Renderizar banner de filtros ativos (similar ao Overview)
 */
function renderOrgaoMesFilterBanner() {
  const page = document.getElementById('page-orgao-mes');
  if (!page) return;
  
  // Remover banner existente se houver
  const existingBanner = document.getElementById('orgao-mes-filter-banner');
  if (existingBanner) {
    existingBanner.remove();
  }
  
  // Obter filtros ativos
  let activeFilters = [];
  if (window.crossfilterOverview) {
    const filters = window.crossfilterOverview.filters;
    Object.entries(filters).forEach(([field, value]) => {
      if (value !== null) {
        // Mapear campos do crossfilter para nomes amigáveis
        const fieldMap = {
          'status': 'Status',
          'tema': 'Tema',
          'orgaos': 'Orgaos',
          'tipo': 'Tipo',
          'canal': 'Canal',
          'prioridade': 'Prioridade',
          'unidade': 'Unidade',
          'bairro': 'Bairro'
        };
        activeFilters.push({ 
          field: fieldMap[field] || field, 
          value: value 
        });
      }
    });
  }
  
  // Também verificar sistema global de filtros (pode ter filtros de data)
  if (window.chartCommunication && window.chartCommunication.filters) {
    const globalFilters = window.chartCommunication.filters.filters || [];
    // Agrupar filtros de data relacionados
    const dataFilters = globalFilters.filter(f => 
      f.field === 'dataCriacaoIso' || 
      (f.field && f.field.toLowerCase().includes('data'))
    );
    
    if (dataFilters.length > 0) {
      // Se há múltiplos filtros de data, criar um único filtro agrupado
      const dataMin = dataFilters.find(f => f.op === 'gte' || f.op === '>=' || String(f.value).includes('-01'));
      const dataMax = dataFilters.find(f => f.op === 'lte' || f.op === '<=' || String(f.value).includes('T23:59'));
      
      if (dataMin && dataMax) {
        // Formatar período de data
        const dataInicio = dataMin.value ? String(dataMin.value).substring(0, 10) : '';
        const dataFim = dataMax.value ? String(dataMax.value).substring(0, 10) : '';
        activeFilters.push({
          field: 'Data de Criação',
          value: `${dataInicio} a ${dataFim}`,
          isDateRange: true,
          originalFilters: [dataMin, dataMax]
        });
      } else {
        // Adicionar filtros de data individuais
        dataFilters.forEach(filter => {
      if (!activeFilters.some(f => f.field === filter.field && f.value === filter.value)) {
            // Formatar valor de data para exibição
            let displayValue = String(filter.value);
            if (displayValue.includes('T')) {
              displayValue = displayValue.substring(0, 10);
            }
            activeFilters.push({
              ...filter,
              displayValue: displayValue
            });
          }
        });
      }
    }
    
    // Adicionar outros filtros que não estão no crossfilter
    globalFilters.forEach(filter => {
      const isDataFilter = filter.field === 'dataCriacaoIso' || 
                          (filter.field && filter.field.toLowerCase().includes('data'));
      if (!isDataFilter && !activeFilters.some(f => f.field === filter.field && f.value === filter.value)) {
        activeFilters.push(filter);
      }
    });
  }
  
  // Se não há filtros, não mostrar banner
  if (activeFilters.length === 0) {
    return;
  }
  
  // Criar banner com event listeners adequados
  const banner = document.createElement('div');
  banner.id = 'orgao-mes-filter-banner';
  banner.className = 'glass rounded-xl p-4 mb-6 border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-violet-500/10';
  banner.style.position = 'relative';
  banner.style.zIndex = '10';
  banner.style.pointerEvents = 'auto';
  
  const fieldLabels = {
    'Status': 'Status',
    'Tema': 'Tema',
    'Orgaos': 'Órgão',
    'Tipo': 'Tipo',
    'Canal': 'Canal',
    'Prioridade': 'Prioridade',
    'Unidade': 'Unidade',
    'Bairro': 'Bairro',
    'dataCriacaoIso': 'Data',
    'Data de Criação': 'Data'
  };
  
  const fieldEmojis = {
    'Status': '📊',
    'Tema': '🏷️',
    'Orgaos': '🏛️',
    'Tipo': '📋',
    'Canal': '📞',
    'Prioridade': '⚡',
    'Unidade': '🏥',
    'Bairro': '📍',
    'dataCriacaoIso': '📅',
    'Data de Criação': '📅'
  };
  
  // Criar estrutura do banner
  const bannerContent = document.createElement('div');
  bannerContent.className = 'flex items-center justify-between';
  
  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'flex items-center gap-3 flex-wrap';
  
  const title = document.createElement('div');
  title.className = 'text-sm font-semibold text-cyan-300';
  title.textContent = '🔍 Filtros Ativos:';
  filtersContainer.appendChild(title);
  
  // Criar botões de filtro individuais
  activeFilters.forEach((filter, index) => {
    const filterBadge = document.createElement('div');
    filterBadge.className = 'flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-cyan-500/30 rounded-lg';
    filterBadge.style.pointerEvents = 'auto';
    filterBadge.style.cursor = 'default';
    
    const emoji = document.createElement('span');
    emoji.textContent = fieldEmojis[filter.field] || '🔍';
    
    const label = document.createElement('span');
    label.className = 'text-sm text-slate-200';
    const fieldLabel = fieldLabels[filter.field] || filter.field;
    // Usar displayValue se disponível (para filtros de data formatados)
    const filterValue = filter.displayValue || String(filter.value || '');
    // Truncar valores muito longos
    const displayValue = filterValue.length > 30 ? filterValue.substring(0, 30) + '...' : filterValue;
    label.innerHTML = `${fieldLabel}: <span class="font-bold text-cyan-300">${displayValue}</span>`;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-2 text-cyan-400 hover:text-red-400 transition-colors cursor-pointer';
    removeBtn.style.pointerEvents = 'auto';
    removeBtn.style.fontSize = '18px';
    removeBtn.style.lineHeight = '1';
    removeBtn.style.background = 'none';
    removeBtn.style.border = 'none';
    removeBtn.style.padding = '0';
    removeBtn.style.width = '20px';
    removeBtn.style.height = '20px';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remover filtro';
    removeBtn.setAttribute('data-filter-index', index);
    removeBtn.setAttribute('data-filter-field', filter.field);
    removeBtn.setAttribute('data-filter-value', filter.value);
    
    // Event listener para remover filtro
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Se é um filtro de data agrupado, remover todos os filtros originais
      if (filter.isDateRange && filter.originalFilters) {
        filter.originalFilters.forEach(origFilter => {
          removeFilterOrgaoMes(origFilter.field, origFilter.value);
        });
      } else {
        removeFilterOrgaoMes(filter.field, filter.value);
      }
    });
    
    filterBadge.appendChild(emoji);
    filterBadge.appendChild(label);
    filterBadge.appendChild(removeBtn);
    filtersContainer.appendChild(filterBadge);
  });
  
  // Botão limpar todos
  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm font-medium text-red-300 transition-colors cursor-pointer';
  clearAllBtn.style.pointerEvents = 'auto';
  clearAllBtn.textContent = 'Limpar Todos';
  clearAllBtn.title = 'Limpar todos os filtros';
  
  // Event listener para limpar todos
  clearAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearAllFiltersOrgaoMes();
  });
  
  bannerContent.appendChild(filtersContainer);
  bannerContent.appendChild(clearAllBtn);
  banner.appendChild(bannerContent);
  
  // Inserir banner no topo da página
  const header = page.querySelector('header');
  if (header && header.nextSibling) {
    page.insertBefore(banner, header.nextSibling);
  } else {
    page.insertBefore(banner, page.firstChild);
  }
}

/**
 * Remover filtro específico - REFATORADO para melhor funcionamento
 */
function removeFilterOrgaoMes(field, value) {
  if (window.Logger) {
    window.Logger.debug('🗑️ removeFilterOrgaoMes: Removendo filtro', { field, value });
  }
  
  // Tratar filtros de data primeiro (vem do sistema global de filtros)
  if (field === 'dataCriacaoIso' || field === 'Data de Criação') {
    if (window.chartCommunication && window.chartCommunication.filters) {
      // Remover todos os filtros de data relacionados
      const filters = window.chartCommunication.filters.filters || [];
      const dataFilters = filters.filter(f => 
        f.field === 'dataCriacaoIso' || 
        f.field === 'Data de Criação' ||
        (f.field && f.field.toLowerCase().includes('data'))
      );
      
      dataFilters.forEach(dataFilter => {
        window.chartCommunication.filters.remove(dataFilter.field, dataFilter.value);
      });
      
      // Forçar atualização
      if (window.chartCommunication.filters.notifyListeners) {
        window.chartCommunication.filters.notifyListeners();
      }
    }
    
    // Recarregar dados após remover filtros de data
    setTimeout(() => {
      loadOrgaoMes(true);
    }, 100);
    return;
  }
  
  // Tratar outros tipos de filtros
  // Primeiro, remover do chartCommunication (sistema global)
  if (window.chartCommunication && window.chartCommunication.filters) {
    window.chartCommunication.filters.remove(field, value);
    if (window.chartCommunication.filters.notifyAllCharts) {
      window.chartCommunication.filters.notifyAllCharts();
    }
  }
  
  if (window.crossfilterOverview) {
    const fieldMap = {
      'Status': 'status',
      'Tema': 'tema',
      'Orgaos': 'orgaos',
      'Tipo': 'tipo',
      'Canal': 'canal',
      'Prioridade': 'prioridade',
      'Unidade': 'unidade',
      'Bairro': 'bairro'
    };
    
    const mappedField = fieldMap[field] || field.toLowerCase();
    
    // Remover filtro específico do crossfilter
    if (mappedField === 'status') window.crossfilterOverview.setStatusFilter(null);
    else if (mappedField === 'tema') window.crossfilterOverview.setTemaFilter(null);
    else if (mappedField === 'orgaos') window.crossfilterOverview.setOrgaosFilter(null);
    else if (mappedField === 'tipo') window.crossfilterOverview.setTipoFilter(null);
    else if (mappedField === 'canal') window.crossfilterOverview.setCanalFilter(null);
    else if (mappedField === 'prioridade') window.crossfilterOverview.setPrioridadeFilter(null);
    else if (mappedField === 'unidade') window.crossfilterOverview.setUnidadeFilter(null);
    else if (mappedField === 'bairro') window.crossfilterOverview.setBairroFilter(null);
    
    window.crossfilterOverview.notifyListeners();
  }
  
  // Notificar chartCommunication também (já removido acima, mas garantir notificação)
  if (window.chartCommunication && window.chartCommunication.filters) {
    if (window.chartCommunication.filters.notifyAllCharts) {
      window.chartCommunication.filters.notifyAllCharts();
    }
  }
  
  // Emitir evento global
  if (window.eventBus) {
    window.eventBus.emit('filter:removed', { field, value });
  }
  
  // Recarregar dados após remover filtro
  setTimeout(() => {
    loadOrgaoMes(true);
  }, 100);
  
  if (window.Logger) {
    window.Logger.success('✅ Filtro removido com sucesso', { field, value });
  }
}

/**
 * Coletar filtros da página
 * Agora inclui filtros de mês e status usando o helper
 */
function collectPageFilters() {
  // Usar helper para coletar filtros de mês e status
  if (window.PageFiltersHelper && window.PageFiltersHelper.coletarFiltrosMesStatus) {
    return window.PageFiltersHelper.coletarFiltrosMesStatus('OrgaoMes');
  }
  return [];
}

// Exportar funções globais
window.toggleSortOrgaos = toggleSortOrgaos;
window.filterByOrgao = filterByOrgao;
window.clearAllFiltersOrgaoMes = clearAllFiltersOrgaoMes;
window.removeFilterOrgaoMes = removeFilterOrgaoMes;

/**
 * Inicializar filtros de mês e status
 */
function inicializarFiltrosOrgaoMes() {
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'OrgaoMes',
      endpoint: '/api/aggregate/by-month',
      onChange: () => loadOrgaoMes(true),
      mesSelecionado: ''
    });
  }
}

// Inicializar listeners quando o script carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initOrgaoMesFilterListeners();
    inicializarFiltrosOrgaoMes();
  });
} else {
  initOrgaoMesFilterListeners();
  inicializarFiltrosOrgaoMes();
}

// KPIs removidos da página - listeners de visibilidade não são mais necessários

window.loadOrgaoMes = loadOrgaoMes;

