/**
 * Página: Tempo Médio
 * Análise do tempo médio de atendimento em dias
 * 
 * Recriada com estrutura otimizada
 */

let mesSelecionadoTempoMedio = '';
let ordenacaoTempoMedio = 'decrescente'; // 'decrescente' ou 'crescente'
let filtroMesTempoMedio = ''; // Filtro por mês (YYYY-MM)
let filtroStatusTempoMedio = ''; // Filtro por status ('concluido', 'em-andamento', '')

/**
 * Função auxiliar para calcular número da semana ISO
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Função auxiliar para destruir um gráfico de forma segura
 */
function destroyChartSafely(chartId) {
  try {
    // Verificar se existe no window e tem método destroy
    if (window[chartId] && typeof window[chartId].destroy === 'function') {
      window[chartId].destroy();
      window[chartId] = null;
    }
    // Também tentar destruir via Chart.js se estiver disponível
    if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
      const existingChart = window.Chart.getChart(chartId);
      if (existingChart && typeof existingChart.destroy === 'function') {
        existingChart.destroy();
      }
    }
  } catch (error) {
    // Ignorar erros ao destruir gráficos
    if (window.Logger) {
      window.Logger.debug(`Erro ao destruir gráfico ${chartId}:`, error);
    }
  }
}

/**
 * Destruir todos os gráficos da página Tempo Médio
 */
function destroyAllTempoMedioCharts() {
  const chartIds = [
    'chartTempoMedio',
    'chartTempoMedioMes',
    'chartTempoMedioDia',
    'chartTempoMedioSemana',
    'chartTempoMedioUnidade',
    'chartTempoMedioUnidadeMes'
  ];
  
  chartIds.forEach(chartId => {
    destroyChartSafely(chartId);
  });
  
  if (window.Logger) {
    window.Logger.debug('⏱️ Todos os gráficos de Tempo Médio destruídos');
  }
}

/**
 * Coletar filtros da página
 */
function coletarFiltrosTempoMedio() {
  const filtros = [];
  
  // Filtro por mês
  const mesFiltro = document.getElementById('filtroMesTempoMedio')?.value?.trim() || '';
  if (mesFiltro) {
    // Formato: YYYY-MM
    const [ano, mes] = mesFiltro.split('-');
    if (ano && mes) {
      // Filtrar por data de criação no mês selecionado
      const dataInicial = `${mesFiltro}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFinal = `${mesFiltro}-${ultimoDia}`;
      
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'gte',
        value: dataInicial
      });
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'lte',
        value: `${dataFinal}T23:59:59.999Z`
      });
    }
  }
  
  // Filtro por status
  const statusFiltro = document.getElementById('filtroStatusTempoMedio')?.value?.trim() || '';
  if (statusFiltro) {
    if (statusFiltro === 'concluido') {
      // Filtrar por status concluído - usar contains para capturar variações
      // O backend usa statusDemandaLowercase para busca case-insensitive
      filtros.push({
        field: 'statusDemanda',
        op: 'contains',
        value: 'concluíd'
      });
    } else if (statusFiltro === 'em-andamento') {
      // Filtrar por status em andamento
      // Como pode ter vários valores diferentes, usar contains com "atendimento" ou "aberto"
      // Criar filtro OR usando múltiplos contains (será tratado pelo backend se necessário)
      // Por enquanto, usar o mais comum: "em atendimento"
      filtros.push({
        field: 'statusDemanda',
        op: 'contains',
        value: 'atendimento'
      });
    }
  }
  
  return filtros;
}

async function loadTempoMedio(forceRefresh = false) {
  // PRIORIDADE 1: Verificar dependências críticas
  // CORREÇÃO: Verificar se errorHandler existe antes de usar
  if (!window.errorHandler) {
    if (window.Logger) {
      window.Logger.warn('⚠️ loadTempoMedio: errorHandler não disponível, aguardando...');
    }
    // Aguardar um pouco e tentar novamente
    return new Promise((resolve) => {
      setTimeout(() => {
        loadTempoMedio(forceRefresh).then(resolve).catch(() => resolve());
      }, 500);
    });
  }
  
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader', 'chartFactory'],
    () => {
      // Não mostrar notificação se for chamada durante inicialização
      if (window.Logger) {
        window.Logger.debug('⚠️ loadTempoMedio: Dependências não disponíveis ainda, aguardando...');
      }
      return null;
    }
  );
  
  if (!dependencies) {
    // Se as dependências não estão disponíveis, aguardar um pouco e tentar novamente
    return new Promise((resolve) => {
      setTimeout(() => {
        loadTempoMedio(forceRefresh).then(resolve).catch(() => resolve());
      }, 500);
    });
  }
  
  const { dataLoader, chartFactory } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('⏱️ loadTempoMedio: Iniciando');
  }
  
  const page = document.getElementById('page-tempo-medio');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.show('Carregando dados de tempo médio...');
  
  // PRIORIDADE 1: Usar safeAsync para tratamento de erros
  return await window.errorHandler?.safeAsync(async () => {
    // Coletar filtros da página
    const filtrosPagina = coletarFiltrosTempoMedio();
    
    // Verificar se há filtros ativos (SEMPRE verificar filtros globais)
    let activeFilters = [];
    if (window.chartCommunication && window.chartCommunication.filters) {
      // Obter filtros globais - usar .filters diretamente (é um array)
      const globalFilters = window.chartCommunication.filters.filters || [];
      // Combinar filtros globais com filtros da página
      activeFilters = [...globalFilters, ...filtrosPagina];
      if (activeFilters.length > 0) {
        if (window.Logger) {
          window.Logger.debug(`⏱️ loadTempoMedio: ${activeFilters.length} filtro(s) ativo(s)`, activeFilters);
        }
      }
    } else if (filtrosPagina.length > 0) {
      activeFilters = filtrosPagina;
    }
    
    // Carregar dados por mês (para gráfico de evolução)
    let dataMes = [];
    
    // Se houver filtros ativos, usar /api/filter para obter dados filtrados
    if (activeFilters && activeFilters.length > 0) {
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: window.location.pathname
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          
          if (Array.isArray(filteredData) && filteredData.length > 0) {
            // Agrupar por mês e calcular tempo médio
            const groupedByMonth = {};
            
            filteredData.forEach(record => {
              const tempo = record.tempoDeResolucaoEmDias || 
                           record.data?.tempoDeResolucaoEmDias ||
                           record.data?.tempo_de_resolucao_em_dias ||
                           record.tempo_de_resolucao_em_dias ||
                           null;
              
              if (tempo !== null && tempo !== undefined && !isNaN(parseFloat(tempo))) {
                // Tentar múltiplos campos de data
                const date = record.dataCriacaoIso || 
                            record.data?.dataCriacaoIso || 
                            record.dataDaCriacao ||
                            record.data?.dataDaCriacao ||
                            record.data_da_criacao ||
                            '';
                
                if (date) {
                  let dateStr = String(date);
                  // Se for ISO string, extrair apenas a parte da data
                  if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                  }
                  
                  // Tentar parsear a data
                  let dateObj;
                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Formato YYYY-MM-DD
                    dateObj = new Date(dateStr + 'T00:00:00');
                  } else {
                    dateObj = new Date(dateStr);
                  }
                  
                  if (!isNaN(dateObj.getTime())) {
                    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!groupedByMonth[monthKey]) {
                      groupedByMonth[monthKey] = { month: monthKey, tempos: [] };
                    }
                    groupedByMonth[monthKey].tempos.push(parseFloat(tempo));
                  }
                }
              }
            });
            
            // Calcular média por mês
            dataMes = Object.values(groupedByMonth)
              .map(item => ({
                month: item.month,
                dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length
              }))
              .sort((a, b) => a.month.localeCompare(b.month));
            
            if (window.Logger) {
              window.Logger.debug(`⏱️ Dados mensais filtrados: ${dataMes.length} meses`);
            }
          }
        }
      } catch (filterError) {
        if (window.Logger) {
          window.Logger.error('Erro ao aplicar filtros nos dados mensais:', filterError);
        }
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataMes.length === 0) {
      const dataMesRaw = await dataLoader.load('/api/stats/average-time/by-month', {
        fallback: [], // Fallback para erro 502
        useDataStore: !forceRefresh,
        ttl: 5 * 60 * 1000
      }) || [];
      
      // PRIORIDADE 1: Validar dados mensais
      const mesValidation = window.dataValidator?.validateApiResponse(dataMesRaw, {
        arrayItem: {
          types: { month: 'string', average: 'number' }
        }
      });
      
      dataMes = mesValidation.valid ? mesValidation.data : [];
    }
    
    // Extrair mês selecionado do filtro da página ou dos filtros ativos
    let mesSelecionado = filtroMesTempoMedio || '';
    
    // Se não houver filtro da página, tentar extrair dos filtros ativos
    if (!mesSelecionado && activeFilters && activeFilters.length > 0) {
      // Procurar filtros de data que indiquem um mês específico
      const filtrosData = activeFilters.filter(f => 
        f.field === 'dataCriacaoIso' && (f.op === 'gte' || f.op === 'lte')
      );
      
      if (filtrosData.length >= 2) {
        // Se houver filtros gte e lte, extrair o mês
        const filtroGte = filtrosData.find(f => f.op === 'gte');
        const filtroLte = filtrosData.find(f => f.op === 'lte');
        
        if (filtroGte && filtroLte) {
          // Extrair YYYY-MM do valor gte (formato: YYYY-MM-DD)
          const match = filtroGte.value.match(/^(\d{4}-\d{2})/);
          if (match) {
            mesSelecionado = match[1];
          }
        }
      }
    }
    
    mesSelecionadoTempoMedio = mesSelecionado;
    
    // Carregar estatísticas principais
    let stats = {};
    
    // MELHORIA: Integrar cache de filtros e histórico
    const endpoint = '/api/stats/tempo-medio';
    
    // Se houver filtros, usar endpoint /api/filter e calcular stats localmente
    if (activeFilters && activeFilters.length > 0) {
      // MELHORIA: Verificar cache de filtros
      const cached = window.filterCache?.get?.(activeFilters, endpoint);
      if (cached) {
        if (window.Logger) {
          window.Logger.debug('⏱️ loadTempoMedio: Stats obtidos do cache de filtros');
        }
        stats = cached;
      } else {
        try {
          const filterRequest = {
            filters: activeFilters,
            originalUrl: window.location.pathname
          };
          
          const response = await fetch('/api/filter', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(filterRequest)
          });
          
          if (response.ok) {
            const filteredData = await response.json();
            
            if (Array.isArray(filteredData) && filteredData.length > 0) {
              // Calcular estatísticas dos dados filtrados
              const tempos = filteredData
                .map(record => {
                  const tempo = record.tempoDeResolucaoEmDias || 
                               record.data?.tempoDeResolucaoEmDias ||
                               record.data?.tempo_de_resolucao_em_dias ||
                               null;
                  return tempo !== null && tempo !== undefined ? parseFloat(tempo) : null;
                })
                .filter(t => t !== null && !isNaN(t));
              
              if (tempos.length > 0) {
                const sorted = [...tempos].sort((a, b) => a - b);
                const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
                const mediana = sorted.length % 2 === 0
                  ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                  : sorted[Math.floor(sorted.length / 2)];
                const minimo = sorted[0];
                const maximo = sorted[sorted.length - 1];
                
                stats = {
                  media: media,
                  mediana: mediana,
                  minimo: minimo,
                  maximo: maximo,
                  total: filteredData.length
                };
                
                // MELHORIA: Salvar no cache de filtros
                if (window.filterCache) {
                  window.filterCache.set(activeFilters, endpoint, stats);
                }
                
                // MELHORIA: Salvar no histórico de filtros
                if (window.filterHistory) {
                  window.filterHistory.saveRecent(activeFilters);
                }
              }
            }
          }
        } catch (filterError) {
          if (window.Logger) {
            window.Logger.error('Erro ao aplicar filtros, carregando sem filtros:', filterError);
          }
        }
      }
    }
    
    // Se não calculou stats com filtros, usar endpoint normal
    if (!stats.media && !stats.total) {
      const statsUrl = '/api/stats/average-time/stats';
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Carregando stats de: ${statsUrl}`);
      }
      
      const statsRaw = await dataLoader.load(statsUrl, {
        useDataStore: !forceRefresh, // Não usar cache se for refresh forçado
        ttl: 5 * 60 * 1000,
        fallback: { media: 0, mediana: 0, minimo: 0, maximo: 0, total: 0 } // Fallback para erro 502
      }) || {};
      
      // PRIORIDADE 1: Validar stats
      const statsValidation = window.dataValidator?.validateDataStructure(statsRaw, {
        types: {
          media: 'number',
          mediana: 'number',
          minimo: 'number',
          maximo: 'number',
          total: 'number'
        }
      });
      
      stats = statsValidation.valid ? statsValidation.data : { media: 0, mediana: 0, minimo: 0, maximo: 0, total: 0 };
    }
    
    if (window.Logger) {
      window.Logger.debug(`⏱️ Stats recebidos:`, stats);
    }
    
    // Renderizar estatísticas (sempre atualizar TODOS os cards quando há refresh)
    renderTempoMedioStats(stats);
    
    if (window.Logger && forceRefresh) {
      window.Logger.debug(`✅ Cards atualizados`);
    }
    
    // Renderizar gráficos principais (passar forceRefresh e filtros para controle de cache)
    await renderTempoMedioCharts(stats, dataMes, mesSelecionado, forceRefresh, activeFilters);
    
    // Carregar dados secundários (AGUARDAR conclusão para garantir que TUDO seja atualizado)
    // Quando há refresh forçado, todos os dados devem ser recarregados
    // Passar activeFilters para que os dados secundários também sejam filtrados
    await window.errorHandler?.safeAsync(
      async () => await loadSecondaryTempoMedioData(mesSelecionado, forceRefresh, activeFilters),
      'loadTempoMedio (dados secundários)',
      { showToUser: false }
    );
    
    if (window.Logger && forceRefresh) {
      window.Logger.debug(`✅ Todos os cards, gráficos e dados atualizados com sucesso`);
    }
    
    // MELHORIA: Banner de filtros é atualizado automaticamente via autoUpdate
    // Não precisa renderizar manualmente aqui
    
    if (window.Logger) {
      window.Logger.success('⏱️ loadTempoMedio: Concluído');
    }
    
    // PRIORIDADE 2: Esconder loading
    window.loadingManager?.hide();
    
    return { success: true, stats, dataMes };
  }, 'loadTempoMedio', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hide();
      
      return { success: false, stats: { media: 0, mediana: 0, minimo: 0, maximo: 0, total: 0 }, dataMes: [] };
    }
  });
}

// Função removida - filtro por mês não está mais disponível

function renderTempoMedioStats(stats) {
  if (!stats) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderTempoMedioStats: stats é null ou undefined');
    }
    return;
  }
  
  if (window.Logger) {
    window.Logger.debug('📊 renderTempoMedioStats:', stats);
  }
  
  const statMedia = document.getElementById('statMedia');
  const statMediana = document.getElementById('statMediana');
  const statMinimo = document.getElementById('statMinimo');
  const statMaximo = document.getElementById('statMaximo');
  
  // Extrair valores com fallbacks para diferentes formatos de resposta da API
  const media = stats.media || stats.average || stats.dias || stats.mediaGeral || 0;
  const mediana = stats.mediana || stats.median || 0;
  const minimo = stats.minimo || stats.min || 0;
  const maximo = stats.maximo || stats.max || 0;
  
  if (statMedia) {
    statMedia.textContent = media.toFixed(1);
    if (window.Logger) {
      window.Logger.debug('📊 Média atualizada:', media.toFixed(1));
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Elemento statMedia não encontrado');
    }
  }
  
  if (statMediana) {
    statMediana.textContent = mediana.toFixed(1);
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Elemento statMediana não encontrado');
    }
  }
  
  if (statMinimo) {
    statMinimo.textContent = minimo.toFixed(1);
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Elemento statMinimo não encontrado');
    }
  }
  
  if (statMaximo) {
    statMaximo.textContent = maximo.toFixed(1);
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Elemento statMaximo não encontrado');
    }
  }
  
  if (window.Logger) {
    window.Logger.debug('📊 TODOS os cards atualizados:', { 
      media: media.toFixed(1), 
      mediana: mediana.toFixed(1), 
      minimo: minimo.toFixed(1), 
      maximo: maximo.toFixed(1) 
    });
  }
  
  // Confirmar visualmente que os cards foram atualizados
  if (window.Logger) {
    window.Logger.debug('✅ Cards atualizados:', {
      Média: media.toFixed(1),
      Mediana: mediana.toFixed(1),
      Mínimo: minimo.toFixed(1),
      Máximo: maximo.toFixed(1)
    });
  }
}

async function renderTempoMedioCharts(stats, dataMes, mesSelecionado = '', forceRefresh = false, activeFilters = null) {
  try {
    let dataOrgao = [];
    
    // Se houver filtros ativos, usar /api/filter para obter dados filtrados
    if (activeFilters && activeFilters.length > 0) {
      if (window.Logger) {
        window.Logger.debug(`⏱️ renderTempoMedioCharts: Aplicando ${activeFilters.length} filtro(s) ativo(s)`);
      }
      
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: window.location.pathname
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          
          if (Array.isArray(filteredData) && filteredData.length > 0) {
            // Agrupar por órgão/unidade e calcular tempo médio
            const grouped = {};
            
            filteredData.forEach(record => {
              // Tentar múltiplos campos para encontrar o órgão/secretaria
              const org = record.secretaria || 
                         record.org || 
                         record.orgaos ||
                         record.unit || 
                         record.data?.secretaria ||
                         record.data?.org ||
                         record.data?.orgaos ||
                         'N/A';
              
              // Tentar múltiplos campos para encontrar o tempo
              const tempo = record.tempoDeResolucaoEmDias || 
                           record.data?.tempoDeResolucaoEmDias ||
                           record.data?.tempo_de_resolucao_em_dias ||
                           record.tempo_de_resolucao_em_dias ||
                           null;
              
              if (tempo !== null && tempo !== undefined && !isNaN(parseFloat(tempo)) && org && org !== 'N/A') {
                if (!grouped[org]) {
                  grouped[org] = { org, tempos: [] };
                }
                grouped[org].tempos.push(parseFloat(tempo));
              }
            });
            
            // Calcular média por órgão
            dataOrgao = Object.values(grouped).map(item => ({
              org: item.org,
              dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length,
              count: item.tempos.length
            }));
            
            if (window.Logger) {
              window.Logger.debug(`⏱️ Dados filtrados: ${dataOrgao.length} órgãos/unidades`);
            }
          }
        }
      } catch (filterError) {
        if (window.Logger) {
          window.Logger.error('Erro ao aplicar filtros nos gráficos, carregando sem filtros:', filterError);
        }
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataOrgao.length === 0) {
      // Construir URL com filtro de mês se houver
      let dataOrgaoUrl = '/api/stats/average-time';
      if (mesSelecionado) {
        dataOrgaoUrl += `?meses=${encodeURIComponent(mesSelecionado)}`;
      }
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ renderTempoMedioCharts: Carregando dados de ${dataOrgaoUrl} (forceRefresh: ${forceRefresh})`);
      }
      
      dataOrgao = await window.dataLoader?.load(dataOrgaoUrl, {
          useDataStore: !forceRefresh, // Não usar cache se há refresh forçado
          ttl: 5 * 60 * 1000,
          fallback: [] // Fallback para erro 502
        }) || [];
    }
    
    // Gráfico principal: Tempo médio por órgão/unidade
    if (dataOrgao && Array.isArray(dataOrgao) && dataOrgao.length > 0) {
      // Ordenar por tempo médio conforme ordenação selecionada
      const sortedData = [...dataOrgao].sort((a, b) => {
        const valueA = a.dias || a.average || a.media || 0;
        const valueB = b.dias || b.average || b.media || 0;
        // Usar ordenação selecionada
        return ordenacaoTempoMedio === 'crescente' 
          ? valueA - valueB  // Ordem crescente (menor primeiro)
          : valueB - valueA;  // Ordem decrescente (maior primeiro)
      });
      
      const top10 = sortedData.slice(0, 10); // GARANTIR APENAS 10 ITENS
      const labels = top10.map(o => o.org || o.unit || o._id || 'N/A');
      const values = top10.map(o => o.dias || o.average || o.media || 0);
      
      // GARANTIR APENAS 10 ITENS - SEM EXCEÇÕES
      const MAX_ITEMS = 10;
      const finalLabels = labels.slice(0, MAX_ITEMS);
      const finalValues = values.slice(0, MAX_ITEMS);
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Top ${finalLabels.length} unidades selecionadas (de ${dataOrgao.length} totais)`);
      }
      
      // Log para debug
      if (window.Logger) {
        window.Logger.debug(`📊 Gráfico Tempo Médio: Exibindo exatamente ${finalLabels.length} unidades`);
      }
      
      if (finalLabels.length > 0 && finalValues.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedio');
        
        // Truncar labels longos para melhor visualização
        const truncatedLabels = finalLabels.map(label => {
          const maxLength = 35;
          return label && label.length > maxLength 
            ? label.substring(0, maxLength) + '...' 
            : label || 'N/A';
        });
        
        // PADRONIZAÇÃO: Remover gradiente customizado e usar cores padronizadas do sistema
        // O ChartFactory usará cores consistentes da paleta padrão
        // Preparar handler onClick antes de criar o gráfico
        const onClickHandler = (event, elements) => {
          if (window.Logger) {
            window.Logger.debug('⏱️ onClick chamado no gráfico principal', { 
              elements: elements?.length || 0,
              hasElements: !!elements && elements.length > 0
            });
          }
          
          if (elements && elements.length > 0) {
            const element = elements[0];
            const index = element.index;
            
            if (window.Logger) {
              window.Logger.debug('⏱️ Elemento clicado:', { index, element });
            }
            
            // Usar dados originais (top10) para obter o valor correto
            const orgaoItem = top10[index];
            const orgao = orgaoItem?.org || orgaoItem?.unit || orgaoItem?._id || finalLabels[index] || 'N/A';
            
            if (window.Logger) {
              window.Logger.debug('⏱️ Clique no gráfico de Tempo Médio (órgão/unidade):', { 
                orgao, 
                index, 
                orgaoItem,
                tempoMedio: orgaoItem?.dias || orgaoItem?.average || orgaoItem?.media || 0,
                chartId: 'chartTempoMedio',
                hasChartCommunication: !!window.chartCommunication,
                hasFilters: !!(window.chartCommunication && window.chartCommunication.filters)
              });
            }
            
            if (orgao && orgao !== 'N/A' && window.chartCommunication && window.chartCommunication.filters) {
              try {
                // Aplicar filtro por órgão/unidade (usar Orgaos que é mapeado para orgaos no banco)
                window.chartCommunication.filters.apply('Orgaos', orgao, 'chartTempoMedio', {
                  toggle: true,
                  clearPrevious: false
                });
                
                if (window.Logger) {
                  window.Logger.debug('✅ Filtro aplicado, recarregando dados...');
                }
                
                // Recarregar dados após aplicar filtro
                loadTempoMedio(true).catch((err) => {
                  if (window.Logger) {
                    window.Logger.error('Erro ao recarregar após aplicar filtro:', err);
                  }
                });
              } catch (error) {
                if (window.Logger) {
                  window.Logger.error('Erro ao aplicar filtro:', error);
                }
              }
            } else {
              if (window.Logger) {
                window.Logger.warn('⏱️ Não foi possível aplicar filtro:', { 
                  orgao, 
                  chartCommunication: !!window.chartCommunication,
                  filters: !!(window.chartCommunication && window.chartCommunication.filters)
                });
              }
            }
          } else {
            if (window.Logger) {
              window.Logger.debug('⏱️ Clique no gráfico mas nenhum elemento foi clicado');
            }
          }
        };
        
        const tempoMedioChart = await window.chartFactory?.createBarChart('chartTempoMedio', truncatedLabels, finalValues, {
          horizontal: true,
          colorIndex: 0, // Usar primeira cor da paleta padronizada
          label: 'Tempo Médio (dias)',
          borderWidth: 2,
          chartOptions: {
            indexAxis: 'y',
            maintainAspectRatio: true,
            responsive: true,
            interaction: {
              mode: 'nearest'
            },
            onClick: onClickHandler,
            layout: {
              padding: {
                left: 10,
                right: 10,
                top: 10,
                bottom: 10
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleColor: '#e2e8f0',
                bodyColor: '#cbd5e1',
                borderColor: '#06b6d4',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                  title: function(context) {
                    // Mostrar label completo no tooltip
                    const index = context[0].dataIndex;
                    return finalLabels[index] || 'N/A';
                  },
                  label: function(context) {
                    const value = context.parsed.x || context.parsed.y;
                    return `Tempo médio: ${value.toFixed(1)} dias`;
                  },
                  afterLabel: function(context) {
                    const index = context.dataIndex;
                    const total = finalValues.reduce((a, b) => a + b, 0);
                    const percent = total > 0 ? ((finalValues[index] / total) * 100).toFixed(1) : '0.0';
                    return `${percent}% do total acumulado`;
                  }
                }
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                ticks: {
                  color: '#94a3b8',
                  font: {
                    size: 11,
                    weight: '500'
                  },
                  callback: function(value) {
                    return value + ' dias';
                  }
                },
                grid: {
                  color: 'rgba(148, 163, 184, 0.1)',
                  lineWidth: 1
                },
                title: {
                  display: true,
                  text: 'Tempo Médio (dias)',
                  color: '#06b6d4',
                  font: {
                    size: 12,
                    weight: '600'
                  }
                }
              },
              y: {
                ticks: {
                  color: '#cbd5e1',
                  font: {
                    size: 11,
                    weight: '500'
                  },
                  maxRotation: 0,
                  autoSkip: false
                },
                grid: {
                  display: false
                }
              }
            },
            animation: {
              duration: 1500,
              easing: 'easeInOutQuart'
            }
          }
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico (estilo Power BI)
        if (tempoMedioChart) {
          if (window.Logger) {
            window.Logger.debug('✅ Gráfico chartTempoMedio criado, configurando handlers...');
          }
          
          // Verificar se o canvas existe
          const tempoMedioCanvas = document.getElementById('chartTempoMedio');
          if (tempoMedioCanvas) {
            tempoMedioCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico principal');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por órgão/unidade
            // IMPORTANTE: Definir no options do chart
            if (tempoMedioChart.options) {
              // Garantir que interaction está habilitado
              if (!tempoMedioChart.options.interaction) {
                tempoMedioChart.options.interaction = {};
              }
              tempoMedioChart.options.interaction.mode = 'nearest';
              
              tempoMedioChart.options.onClick = (event, elements) => {
                if (window.Logger) {
                  window.Logger.debug('⏱️ onClick chamado no gráfico principal', { 
                    elements: elements?.length || 0,
                    hasElements: !!elements && elements.length > 0
                  });
                }
                
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const index = element.index;
                  
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Elemento clicado:', { index, element });
                  }
                  
                  // Usar dados originais (top10) para obter o valor correto
                  const orgaoItem = top10[index];
                  const orgao = orgaoItem?.org || orgaoItem?.unit || orgaoItem?._id || finalLabels[index] || 'N/A';
                  
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Clique no gráfico de Tempo Médio (órgão/unidade):', { 
                      orgao, 
                      index, 
                      orgaoItem,
                      tempoMedio: orgaoItem?.dias || orgaoItem?.average || orgaoItem?.media || 0,
                      chartId: 'chartTempoMedio',
                      hasChartCommunication: !!window.chartCommunication,
                      hasFilters: !!(window.chartCommunication && window.chartCommunication.filters)
                    });
                  }
                  
                  if (orgao && orgao !== 'N/A' && window.chartCommunication && window.chartCommunication.filters) {
                    try {
                      // Aplicar filtro por órgão/unidade (usar Orgaos que é mapeado para orgaos no banco)
                      window.chartCommunication.filters.apply('Orgaos', orgao, 'chartTempoMedio', {
                        toggle: true,
                        clearPrevious: false
                      });
                      
                      if (window.Logger) {
                        window.Logger.debug('✅ Filtro aplicado, recarregando dados...');
                      }
                      
                      // Recarregar dados após aplicar filtro
                      loadTempoMedio(true).catch((err) => {
                        if (window.Logger) {
                          window.Logger.error('Erro ao recarregar após aplicar filtro:', err);
                        }
                      });
                    } catch (error) {
                      if (window.Logger) {
                        window.Logger.error('Erro ao aplicar filtro:', error);
                      }
                    }
                  } else {
                    if (window.Logger) {
                      window.Logger.warn('⏱️ Não foi possível aplicar filtro:', { 
                        orgao, 
                        chartCommunication: !!window.chartCommunication,
                        filters: !!(window.chartCommunication && window.chartCommunication.filters)
                      });
                    }
                  }
                } else {
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Clique no gráfico mas nenhum elemento foi clicado');
                  }
                }
              };
              
              // Atualizar o gráfico para aplicar o handler
              // Usar setTimeout para garantir que o gráfico está totalmente inicializado
              setTimeout(() => {
                try {
                  if (tempoMedioChart && !tempoMedioChart._isDestroying) {
                    tempoMedioChart.update('none');
                    if (window.Logger) {
                      window.Logger.debug('✅ Handler onClick configurado e gráfico atualizado para chartTempoMedio');
                    }
                  }
                } catch (error) {
                  if (window.Logger) {
                    window.Logger.error('Erro ao atualizar gráfico:', error);
                  }
                }
              }, 100);
            } else {
              if (window.Logger) {
                window.Logger.warn('⚠️ tempoMedioChart.options não existe');
              }
            }
          } else {
            if (window.Logger) {
              window.Logger.warn('⚠️ Canvas chartTempoMedio não encontrado');
            }
          }
        } else {
          if (window.Logger) {
            window.Logger.warn('⚠️ tempoMedioChart não foi criado');
          }
        }
        
        // Renderizar ranking (apenas top 10)
        renderTempoMedioRanking(top10);
      }
    }
    
    // Gráfico por mês
    if (dataMes && Array.isArray(dataMes) && dataMes.length > 0) {
      // Mostrar últimos 12 meses
      const dadosParaGrafico = dataMes.slice(-12);
      
      const labels = dadosParaGrafico.map(m => {
        const ym = m.month || m.ym || '';
        return window.dateUtils?.formatMonthYearShort(ym) || ym;
      });
      const values = dadosParaGrafico.map(m => m.dias || m.average || m.media || 0);
      
      if (labels.length > 0 && values.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedioMes');
        
        // Armazenar dados para uso no onClick handler
        window._tempoMedioMesData = dadosParaGrafico;
        
        const tempoMedioMesChart = await window.chartFactory?.createLineChart('chartTempoMedioMes', labels, values, {
          label: 'Tempo Médio (dias)',
          colorIndex: 0,
          fill: true,
          tension: 0.4,
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico
        if (tempoMedioMesChart) {
          const tempoMedioMesCanvas = document.getElementById('chartTempoMedioMes');
          if (tempoMedioMesCanvas) {
            tempoMedioMesCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioMesCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico mensal');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por mês
            if (tempoMedioMesChart.options) {
              tempoMedioMesChart.options.onClick = (event, elements) => {
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const index = element.index;
                  const monthData = window._tempoMedioMesData?.[index] || dadosParaGrafico[index];
                  
                  if (monthData) {
                    const month = monthData.month || monthData.ym || monthData._id;
                    if (month && window.chartCommunication && window.chartCommunication.filters) {
                      if (window.Logger) {
                        window.Logger.debug('⏱️ Clique no gráfico mensal (mês):', { month, index });
                      }
                      window.chartCommunication.filters.apply('dataCriacaoIso', month, 'chartTempoMedioMes', { 
                        operator: 'contains',
                        toggle: true,
                        clearPrevious: false
                      });
                      loadTempoMedio(true).catch(() => {});
                    }
                  }
                }
              };
              tempoMedioMesChart.update('none');
            }
          }
        }
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'renderTempoMedioCharts', {
      showToUser: false
    });
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar gráficos de Tempo Médio:', error);
    }
  }
}

function renderTempoMedioRanking(dataOrgao) {
  const listaTempoMedio = document.getElementById('listaTempoMedio');
  if (!listaTempoMedio) return;
  
  if (!dataOrgao || !Array.isArray(dataOrgao) || dataOrgao.length === 0) {
    listaTempoMedio.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum dado encontrado</div>';
    return;
  }
  
  // Ordenar por tempo médio conforme ordenação selecionada
  const sortedData = [...dataOrgao].sort((a, b) => {
    const valueA = a.dias || a.average || a.media || 0;
    const valueB = b.dias || b.average || b.media || 0;
    // Usar ordenação selecionada
    return ordenacaoTempoMedio === 'crescente' 
      ? valueA - valueB  // Ordem crescente (menor primeiro)
      : valueB - valueA; // Ordem decrescente (maior primeiro)
  });
  
  const top10 = sortedData.slice(0, 10); // Garantir apenas 10 itens
  
  if (top10.length === 0) {
    listaTempoMedio.innerHTML = '<div class="text-center text-slate-400 py-4">Nenhum dado encontrado</div>';
    return;
  }
  
  const maxValue = Math.max(...top10.map(item => item.dias || item.average || item.media || 0));
  
  listaTempoMedio.innerHTML = top10.map((item, idx) => {
    const unit = item.org || item.unit || item._id || 'N/A';
    const average = item.dias || item.average || item.media || 0;
    const averageFormatted = average.toFixed(1);
    const percentage = maxValue > 0 ? ((average / maxValue) * 100).toFixed(0) : 0;
    
    // Cores para os top 3
    let badgeClass = 'bg-slate-700/50 text-slate-300';
    let badgeIcon = '';
    if (idx === 0) {
      badgeClass = 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border border-yellow-500/30';
      badgeIcon = '🥇';
    } else if (idx === 1) {
      badgeClass = 'bg-gradient-to-r from-slate-400/20 to-slate-500/20 text-slate-300 border border-slate-500/30';
      badgeIcon = '🥈';
    } else if (idx === 2) {
      badgeClass = 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 border border-orange-500/30';
      badgeIcon = '🥉';
    }
    
    // Truncar nome longo
    const unitDisplay = unit.length > 30 ? unit.substring(0, 30) + '...' : unit;
    
    return `
      <div class="group relative flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gradient-to-r hover:from-violet-500/10 hover:to-cyan-500/10 transition-all duration-300 border border-transparent hover:border-violet-500/20">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="flex-shrink-0 w-10 h-10 rounded-lg ${badgeClass} flex items-center justify-center text-xs font-bold">
            ${badgeIcon || (idx + 1)}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-slate-200 truncate" title="${unit}">${unitDisplay}</div>
            <div class="mt-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500" 
                style="width: ${percentage}%"
              ></div>
            </div>
          </div>
        </div>
        <div class="flex-shrink-0 ml-3 text-right">
          <span class="text-sm font-bold text-cyan-300">${averageFormatted}</span>
          <span class="text-xs text-slate-500 ml-1">dias</span>
        </div>
      </div>
    `;
  }).join('');
}

async function loadSecondaryTempoMedioData(mesSelecionado = '', forceRefresh = false, activeFilters = null) {
  try {
    // MELHORIA: Sempre verificar filtros globais, mesmo se activeFilters não foi passado
    if (!activeFilters && window.chartCommunication && window.chartCommunication.filters) {
      activeFilters = window.chartCommunication.filters.filters || [];
      if (window.Logger) {
        window.Logger.debug(`⏱️ loadSecondaryTempoMedioData: Filtros globais detectados: ${activeFilters?.length || 0}`);
      }
    }
    
    if (window.Logger) {
      window.Logger.debug(`⏱️ loadSecondaryTempoMedioData: mesSelecionado=${mesSelecionado}, forceRefresh=${forceRefresh}, filtros=${activeFilters?.length || 0}`);
    }
    
    // Se houver filtros ativos, usar /api/filter para obter dados filtrados
    let dataDia = [];
    let dataSemana = [];
    let dataUnidade = [];
    let dataUnidadeMes = [];
    
    if (activeFilters && activeFilters.length > 0) {
      try {
        const filterRequest = {
          filters: activeFilters,
          originalUrl: window.location.pathname
        };
        
        const response = await fetch('/api/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(filterRequest)
        });
        
        if (response.ok) {
          const filteredData = await response.json();
          
          if (Array.isArray(filteredData) && filteredData.length > 0) {
            // Agrupar por dia e calcular tempo médio
            const groupedByDay = {};
            const groupedByWeek = {};
            const groupedByUnit = {};
            const groupedByMonthUnit = {};
            
            filteredData.forEach(record => {
              const tempo = record.tempoDeResolucaoEmDias || 
                           record.data?.tempoDeResolucaoEmDias ||
                           record.data?.tempo_de_resolucao_em_dias ||
                           record.tempo_de_resolucao_em_dias ||
                           null;
              
              if (tempo !== null && tempo !== undefined && !isNaN(parseFloat(tempo))) {
                const tempoValue = parseFloat(tempo);
                
                // Por dia - tentar múltiplos campos de data
                const date = record.dataCriacaoIso || 
                            record.data?.dataCriacaoIso || 
                            record.dataDaCriacao ||
                            record.data?.dataDaCriacao ||
                            record.data_da_criacao ||
                            '';
                
                if (date) {
                  let dateStr = String(date);
                  // Se for ISO string, extrair apenas a parte da data
                  if (dateStr.includes('T')) {
                    dateStr = dateStr.split('T')[0];
                  }
                  
                  // Tentar parsear a data
                  let dateObj;
                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // Formato YYYY-MM-DD
                    dateObj = new Date(dateStr + 'T00:00:00');
                  } else {
                    dateObj = new Date(dateStr);
                  }
                  
                  if (!isNaN(dateObj.getTime())) {
                    const dayKey = dateStr.substring(0, 10); // YYYY-MM-DD
                    if (dayKey && dayKey.length === 10) {
                      if (!groupedByDay[dayKey]) {
                        groupedByDay[dayKey] = { date: dayKey, tempos: [] };
                      }
                      groupedByDay[dayKey].tempos.push(tempoValue);
                    }
                    
                    // Por semana
                    const weekKey = `${dateObj.getFullYear()}-W${String(getWeekNumber(dateObj)).padStart(2, '0')}`;
                    if (!groupedByWeek[weekKey]) {
                      groupedByWeek[weekKey] = { week: weekKey, tempos: [] };
                    }
                    groupedByWeek[weekKey].tempos.push(tempoValue);
                  }
                }
                
                // Por unidade - tentar múltiplos campos
                const unit = record.secretaria || 
                            record.org || 
                            record.orgaos ||
                            record.unit || 
                            record.data?.secretaria ||
                            record.data?.org ||
                            record.data?.orgaos ||
                            'N/A';
                
                if (unit && unit !== 'N/A') {
                  if (!groupedByUnit[unit]) {
                    groupedByUnit[unit] = { unit, tempos: [] };
                  }
                  groupedByUnit[unit].tempos.push(tempoValue);
                  
                  // Por mês/unidade
                  if (date) {
                    let dateStr = String(date);
                    if (dateStr.includes('T')) {
                      dateStr = dateStr.split('T')[0];
                    }
                    
                    let dateObj;
                    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      dateObj = new Date(dateStr + 'T00:00:00');
                    } else {
                      dateObj = new Date(dateStr);
                    }
                    
                    if (!isNaN(dateObj.getTime())) {
                      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                      const monthUnitKey = `${monthKey}_${unit}`;
                      if (!groupedByMonthUnit[monthUnitKey]) {
                        groupedByMonthUnit[monthUnitKey] = { month: monthKey, unit, tempos: [] };
                      }
                      groupedByMonthUnit[monthUnitKey].tempos.push(tempoValue);
                    }
                  }
                }
              }
            });
            
            // Calcular médias
            dataDia = Object.values(groupedByDay)
              .map(item => ({
                date: item.date,
                dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length
              }))
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-30);
            
            dataSemana = Object.values(groupedByWeek)
              .map(item => ({
                week: item.week,
                dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length
              }))
              .sort((a, b) => a.week.localeCompare(b.week))
              .slice(-12);
            
            dataUnidade = Object.values(groupedByUnit)
              .map(item => ({
                unit: item.unit,
                dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length
              }))
              .sort((a, b) => b.dias - a.dias)
              .slice(0, 20);
            
            dataUnidadeMes = Object.values(groupedByMonthUnit)
              .map(item => ({
                month: item.month,
                unit: item.unit,
                dias: item.tempos.reduce((a, b) => a + b, 0) / item.tempos.length
              }));
            
            if (window.Logger) {
              window.Logger.debug(`⏱️ Dados secundários filtrados: ${dataDia.length} dias, ${dataSemana.length} semanas, ${dataUnidade.length} unidades`);
            }
          }
        }
      } catch (filterError) {
        if (window.Logger) {
          window.Logger.error('Erro ao aplicar filtros nos dados secundários:', filterError);
        }
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataDia.length === 0) {
      // Construir URL com filtro de mês se houver
      let dataDiaUrl = '/api/stats/average-time/by-day';
      if (mesSelecionado) {
        dataDiaUrl += `?meses=${encodeURIComponent(mesSelecionado)}`;
      }
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Carregando dados diários de: ${dataDiaUrl}`);
      }
      
      dataDia = await window.dataLoader?.load(dataDiaUrl, {
        useDataStore: !forceRefresh, // Não usar cache se há refresh forçado
        ttl: 5 * 60 * 1000,
        fallback: [] // Fallback para erro 502
      }) || [];
    }
    
    if (dataDia && Array.isArray(dataDia) && dataDia.length > 0) {
      const last30 = dataDia.slice(-30);
      // Armazenar dados para uso no onClick handler
      window._tempoMedioDiaData = last30;
      
      const labels = last30.map(d => {
        const date = d.date || d._id || '';
        return window.dateUtils?.formatDate(date) || date;
      });
      const values = last30.map(d => d.dias || d.average || d.media || 0);
      
      if (labels.length > 0 && values.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedioDia');
        
        const tempoMedioDiaChart = await window.chartFactory?.createLineChart('chartTempoMedioDia', labels, values, {
          label: 'Tempo Médio (dias)',
          colorIndex: 0,
          fill: true,
          tension: 0.4,
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico
        if (tempoMedioDiaChart) {
          const tempoMedioDiaCanvas = document.getElementById('chartTempoMedioDia');
          if (tempoMedioDiaCanvas) {
            tempoMedioDiaCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioDiaCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico diário');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por data
            if (tempoMedioDiaChart.options) {
              tempoMedioDiaChart.options.onClick = (event, elements) => {
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const index = element.index;
                  const dayData = window._tempoMedioDiaData?.[index] || last30[index];
                  
                  if (dayData) {
                    const date = dayData.date || dayData._id;
                    if (date && window.chartCommunication && window.chartCommunication.filters) {
                      if (window.Logger) {
                        window.Logger.debug('⏱️ Clique no gráfico diário (data):', { date, index });
                      }
                      window.chartCommunication.filters.apply('dataCriacaoIso', date, 'chartTempoMedioDia', {
                        operator: 'contains',
                        toggle: true,
                        clearPrevious: false
                      });
                      loadTempoMedio(true).catch(() => {});
                    }
                  }
                }
              };
              tempoMedioDiaChart.update('none');
            }
          }
        }
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataSemana.length === 0) {
      // Construir URL com filtro de mês se houver
      let dataSemanaUrl = '/api/stats/average-time/by-week';
      if (mesSelecionado) {
        dataSemanaUrl += `?meses=${encodeURIComponent(mesSelecionado)}`;
      }
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Carregando dados semanais de: ${dataSemanaUrl}`);
      }
      
      dataSemana = await window.dataLoader?.load(dataSemanaUrl, {
        useDataStore: !forceRefresh, // Não usar cache se há refresh forçado
        ttl: 5 * 60 * 1000,
        fallback: [] // Fallback para erro 502
      }) || [];
    }
    
    if (dataSemana && Array.isArray(dataSemana) && dataSemana.length > 0) {
      const last12 = dataSemana.slice(-12);
      // Armazenar dados para uso no onClick handler
      window._tempoMedioSemanaData = last12;
      
      const labels = last12.map(s => {
        const week = s.week || s._id || 'N/A';
        // Formatar semana: "2025-W45" -> "Semana 45/2025"
        if (week.includes('W')) {
          const [year, weekNum] = week.split('-W');
          return `Sem ${weekNum}/${year.slice(-2)}`;
        }
        return week;
      });
      const values = last12.map(s => s.dias || s.average || s.media || 0);
      
      if (labels.length > 0 && values.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedioSemana');
        
        const tempoMedioSemanaChart = await window.chartFactory?.createLineChart('chartTempoMedioSemana', labels, values, {
          label: 'Tempo Médio (dias)',
          colorIndex: 1,
          fill: true,
          tension: 0.4
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico
        if (tempoMedioSemanaChart) {
          const tempoMedioSemanaCanvas = document.getElementById('chartTempoMedioSemana');
          if (tempoMedioSemanaCanvas) {
            tempoMedioSemanaCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioSemanaCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico semanal');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por semana
            if (tempoMedioSemanaChart.options) {
              tempoMedioSemanaChart.options.onClick = (event, elements) => {
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const index = element.index;
                  const weekData = window._tempoMedioSemanaData?.[index] || last12[index];
                  
                  if (weekData) {
                    const week = weekData.week || weekData._id;
                    if (week && window.chartCommunication && window.chartCommunication.filters) {
                      if (window.Logger) {
                        window.Logger.debug('⏱️ Clique no gráfico semanal (semana):', { week, index });
                      }
                      window.chartCommunication.filters.apply('dataCriacaoIso', week, 'chartTempoMedioSemana', {
                        operator: 'contains',
                        toggle: true,
                        clearPrevious: false
                      });
                      loadTempoMedio(true).catch(() => {});
                    }
                  }
                }
              };
              tempoMedioSemanaChart.update('none');
            }
          }
        }
      } else {
        // Log para debug
        if (window.Logger) {
          window.Logger.warn('Tendência Semanal: dados vazios ou inválidos', { dataSemana, last12, labels, values });
        }
      }
    } else {
      // Log para debug
      if (window.Logger) {
        window.Logger.warn('Tendência Semanal: nenhum dado retornado do endpoint');
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataUnidade.length === 0) {
      // Construir URL com filtro de mês se houver
      let dataUnidadeUrl = '/api/stats/average-time/by-unit';
      if (mesSelecionado) {
        dataUnidadeUrl += `?meses=${encodeURIComponent(mesSelecionado)}`;
      }
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Carregando dados por unidade de: ${dataUnidadeUrl}`);
      }
      
      dataUnidade = await window.dataLoader?.load(dataUnidadeUrl, {
        useDataStore: !forceRefresh, // Não usar cache se há refresh forçado
        ttl: 5 * 60 * 1000,
        fallback: [] // Fallback para erro 502
      }) || [];
    }
    
    if (dataUnidade && Array.isArray(dataUnidade) && dataUnidade.length > 0) {
      const top20 = dataUnidade.slice(0, 20);
      // Armazenar dados para uso no onClick handler
      window._tempoMedioUnidadeData = top20;
      
      const labels = top20.map(u => u.unit || u.org || u._id || 'N/A');
      const values = top20.map(u => u.dias || u.average || u.media || 0);
      
      if (labels.length > 0 && values.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedioUnidade');
        
        const tempoMedioUnidadeChart = await window.chartFactory?.createBarChart('chartTempoMedioUnidade', labels, values, {
          horizontal: true,
          colorIndex: 2,
          label: 'Tempo Médio (dias)',
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico
        if (tempoMedioUnidadeChart) {
          const tempoMedioUnidadeCanvas = document.getElementById('chartTempoMedioUnidade');
          if (tempoMedioUnidadeCanvas) {
            tempoMedioUnidadeCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioUnidadeCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico de unidade');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por unidade
            if (tempoMedioUnidadeChart.options) {
              tempoMedioUnidadeChart.options.onClick = (event, elements) => {
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const index = element.index;
                  const unidadeItem = window._tempoMedioUnidadeData?.[index] || top20[index];
                  const unidade = unidadeItem?.unit || unidadeItem?.org || unidadeItem?._id || labels[index] || 'N/A';
                  
                  if (unidade && unidade !== 'N/A' && window.chartCommunication && window.chartCommunication.filters) {
                    if (window.Logger) {
                      window.Logger.debug('⏱️ Clique no gráfico de unidade:', { unidade, index, unidadeItem });
                    }
                    window.chartCommunication.filters.apply('Orgaos', unidade, 'chartTempoMedioUnidade', {
                      toggle: true,
                      clearPrevious: false
                    });
                    loadTempoMedio(true).catch(() => {});
                  }
                }
              };
              tempoMedioUnidadeChart.update('none');
            }
          }
        }
      }
    }
    
    // Se não obteve dados filtrados, carregar normalmente
    if (dataUnidadeMes.length === 0) {
      // Construir URL com filtro de mês se houver
      let dataUnidadeMesUrl = '/api/stats/average-time/by-month-unit';
      if (mesSelecionado) {
        dataUnidadeMesUrl += `?meses=${encodeURIComponent(mesSelecionado)}`;
      }
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Carregando dados por mês/unidade de: ${dataUnidadeMesUrl}`);
      }
      
      dataUnidadeMes = await window.dataLoader?.load(dataUnidadeMesUrl, {
        useDataStore: !forceRefresh, // Não usar cache se há refresh forçado
        ttl: 5 * 60 * 1000,
        fallback: [] // Fallback para erro 502
      }) || [];
    }
    
    if (dataUnidadeMes && Array.isArray(dataUnidadeMes) && dataUnidadeMes.length > 0) {
      // Processar para gráfico de linha múltipla
      const unidades = [...new Set(dataUnidadeMes.map(d => d.unit || d._id))].slice(0, 5);
      const meses = [...new Set(dataUnidadeMes.map(d => d.month || d.ym))].sort();
      
      const datasets = unidades.map((unidade, idx) => {
        const data = meses.map(mes => {
          const item = dataUnidadeMes.find(d => 
            (d.unit === unidade || d._id === unidade) && (d.month === mes || d.ym === mes)
          );
          return item?.dias || item?.average || item?.media || 0;
        });
        return {
          label: unidade,
          data: data
        };
      });
      
      const labels = meses.map(m => window.dateUtils?.formatMonthYearShort(m) || m);
      
      if (labels.length > 0 && datasets.length > 0 && datasets[0].data.length > 0) {
        // Destruir gráfico existente antes de criar novo
        destroyChartSafely('chartTempoMedioUnidadeMes');
        
        // Armazenar dados para uso no onClick handler
        window._tempoMedioUnidadeMesData = { unidades, meses, dataUnidadeMes };
        
        const tempoMedioUnidadeMesChart = await window.chartFactory?.createLineChart('chartTempoMedioUnidadeMes', labels, datasets, {
          fill: false,
          tension: 0.4,
          legendContainer: 'legendTempoMedioUnidadeMes'
        });
        
        // CROSSFILTER: Adicionar handler de clique após criar o gráfico
        if (tempoMedioUnidadeMesChart) {
          const tempoMedioUnidadeMesCanvas = document.getElementById('chartTempoMedioUnidadeMes');
          if (tempoMedioUnidadeMesCanvas) {
            tempoMedioUnidadeMesCanvas.style.cursor = 'pointer';
            
            // Adicionar handler de clique direito para limpar filtros
            const container = tempoMedioUnidadeMesCanvas.parentElement;
            if (container && !container.dataset.crossfilterEnabled) {
              container.dataset.crossfilterEnabled = 'true';
              container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.chartCommunication && window.chartCommunication.filters) {
                  window.chartCommunication.filters.clear();
                  if (window.Logger) {
                    window.Logger.debug('⏱️ Filtros limpos via clique direito no gráfico unidade/mês');
                  }
                  loadTempoMedio(true).catch(() => {});
                }
              });
            }
            
            // Handler de clique esquerdo para aplicar filtro por unidade ou mês
            if (tempoMedioUnidadeMesChart.options) {
              tempoMedioUnidadeMesChart.options.onClick = (event, elements) => {
                if (elements && elements.length > 0) {
                  const element = elements[0];
                  const datasetIndex = element.datasetIndex;
                  const index = element.index;
                  
                  // Se clicou em um ponto, filtrar por unidade (dataset) ou mês (index)
                  if (window._tempoMedioUnidadeMesData) {
                    const { unidades: storedUnidades, meses: storedMeses } = window._tempoMedioUnidadeMesData;
                    
                    // Filtrar por unidade (datasetIndex) se disponível
                    if (storedUnidades && storedUnidades[datasetIndex]) {
                      const unidade = storedUnidades[datasetIndex];
                      if (window.chartCommunication && window.chartCommunication.filters) {
                        if (window.Logger) {
                          window.Logger.debug('⏱️ Clique no gráfico unidade/mês (unidade):', { unidade, datasetIndex });
                        }
                        window.chartCommunication.filters.apply('Orgaos', unidade, 'chartTempoMedioUnidadeMes', {
                          toggle: true,
                          clearPrevious: false
                        });
                        loadTempoMedio(true).catch(() => {});
                      }
                    } else if (storedMeses && storedMeses[index]) {
                      // Filtrar por mês (index) se não houver unidade
                      const mes = storedMeses[index];
                      if (window.chartCommunication && window.chartCommunication.filters) {
                        if (window.Logger) {
                          window.Logger.debug('⏱️ Clique no gráfico unidade/mês (mês):', { mes, index });
                        }
                        window.chartCommunication.filters.apply('dataCriacaoIso', mes, 'chartTempoMedioUnidadeMes', {
                          operator: 'contains',
                          toggle: true,
                          clearPrevious: false
                        });
                        loadTempoMedio(true).catch(() => {});
                      }
                    }
                  }
                }
              };
              tempoMedioUnidadeMesChart.update('none');
            }
          }
        }
      }
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'loadSecondaryTempoMedioData', {
      showToUser: false
    });
    if (window.Logger) {
      window.Logger.error('Erro ao carregar dados secundários de tempo médio:', error);
    }
  }
}

/**
 * Atualizar ordenação do ranking
 */
function atualizarOrdenacaoTempoMedio(novaOrdenacao) {
  ordenacaoTempoMedio = novaOrdenacao;
  
  // Atualizar botões visuais
  const btnDecrescente = document.getElementById('btnOrdenacaoDecrescente');
  const btnCrescente = document.getElementById('btnOrdenacaoCrescente');
  
  if (btnDecrescente && btnCrescente) {
    if (novaOrdenacao === 'decrescente') {
      btnDecrescente.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 active:scale-95';
      btnCrescente.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-600/40 hover:text-slate-300 active:scale-95';
    } else {
      btnCrescente.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 active:scale-95';
      btnDecrescente.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 bg-slate-700/30 text-slate-400 border border-slate-600/30 hover:bg-slate-600/40 hover:text-slate-300 active:scale-95';
    }
  }
  
  // Recarregar dados para aplicar nova ordenação
  // CORREÇÃO: Verificar se chartFactory está disponível antes de chamar loadTempoMedio
  if (window.chartFactory || (window.errorHandler && window.errorHandler.requireDependency('chartFactory'))) {
    loadTempoMedio(false).catch(err => {
      if (window.errorHandler) {
        window.errorHandler.handleError(err, 'recarregarTempoMedioComOrdenacao', {
          showToUser: false
        });
      }
    });
  } else {
    // Se chartFactory não está disponível, aguardar um pouco e tentar novamente
    setTimeout(() => {
      if (window.chartFactory) {
        loadTempoMedio(false).catch(() => {});
      }
    }, 500);
  }
}

/**
 * Inicializar event listeners para botões de ordenação
 */
function inicializarBotoesOrdenacaoTempoMedio() {
  const btnDecrescente = document.getElementById('btnOrdenacaoDecrescente');
  const btnCrescente = document.getElementById('btnOrdenacaoCrescente');
  
  if (btnDecrescente) {
    btnDecrescente.addEventListener('click', () => {
      atualizarOrdenacaoTempoMedio('decrescente');
    });
  }
  
  if (btnCrescente) {
    btnCrescente.addEventListener('click', () => {
      atualizarOrdenacaoTempoMedio('crescente');
    });
  }
  
  // Inicializar estado visual apenas se chartFactory estiver disponível
  // CORREÇÃO: Não chamar loadTempoMedio durante inicialização se dependências não estiverem prontas
  if (window.chartFactory || (window.errorHandler && window.errorHandler.requireDependency('chartFactory'))) {
    atualizarOrdenacaoTempoMedio(ordenacaoTempoMedio);
  } else {
    // Aguardar um pouco e tentar novamente quando as dependências estiverem prontas
    setTimeout(() => {
      if (window.chartFactory) {
        atualizarOrdenacaoTempoMedio(ordenacaoTempoMedio);
      }
    }, 1000);
  }
}

/**
 * Popular select de meses
 */
async function popularSelectMesesTempoMedio() {
  const selectMes = document.getElementById('filtroMesTempoMedio');
  if (!selectMes) return;
  
  try {
    // Carregar dados mensais para obter meses disponíveis
    const dataMes = await window.dataLoader?.load('/api/stats/average-time/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000,
      fallback: []
    }) || [];
    
    // Limpar opções existentes (exceto "Todos os meses")
    while (selectMes.children.length > 1) {
      selectMes.removeChild(selectMes.lastChild);
    }
    
    // Adicionar meses disponíveis (ordenados do mais recente para o mais antigo)
    const meses = dataMes
      .map(d => d.month || d.ym || d._id)
      .filter(m => m)
      .sort()
      .reverse();
    
    meses.forEach(mes => {
      const option = document.createElement('option');
      option.value = mes;
      
      // Formatar para nome do mês (ex: "Janeiro 2025")
      let nomeMes = mes;
      try {
        if (mes && mes.includes('-')) {
          const [ano, mesNum] = mes.split('-');
          const mesesNomes = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
          ];
          const mesIndex = parseInt(mesNum) - 1;
          if (mesIndex >= 0 && mesIndex < 12) {
            nomeMes = `${mesesNomes[mesIndex]} ${ano}`;
          }
        }
      } catch (e) {
        // Se der erro, usar formatação padrão
        nomeMes = window.dateUtils?.formatMonthYearShort(mes) || mes;
      }
      
      option.textContent = nomeMes;
      selectMes.appendChild(option);
    });
    
    // Restaurar seleção anterior se existir
    if (filtroMesTempoMedio) {
      selectMes.value = filtroMesTempoMedio;
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'popularSelectMesesTempoMedio', {
      showToUser: false
    });
  }
}


/**
 * Inicializar listeners de filtros
 */
function inicializarFiltrosTempoMedio() {
  const selectMes = document.getElementById('filtroMesTempoMedio');
  const selectStatus = document.getElementById('filtroStatusTempoMedio');
  
  // Listener para filtro de mês
  if (selectMes) {
    selectMes.addEventListener('change', async (e) => {
      filtroMesTempoMedio = e.target.value || '';
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Filtro de mês alterado para: ${filtroMesTempoMedio || 'Todos'}`);
      }
      
      // Invalidar cache de TODOS os endpoints relacionados
      if (window.dataStore && typeof window.dataStore.clear === 'function') {
        // Limpar cache de todos os endpoints que podem ter sido cacheados
        const endpointsToClear = [
          '/api/stats/average-time',
          '/api/stats/average-time/stats',
          '/api/stats/average-time/by-day',
          '/api/stats/average-time/by-week',
          '/api/stats/average-time/by-unit',
          '/api/stats/average-time/by-month-unit',
          '/api/stats/average-time/by-month'
        ];
        
        // Limpar endpoints base
        endpointsToClear.forEach(endpoint => {
          window.dataStore.clear(endpoint);
        });
        
        // Limpar também versões com query string (se existirem no cache)
        if (filtroMesTempoMedio) {
          endpointsToClear.forEach(endpoint => {
            window.dataStore.clear(`${endpoint}?meses=${encodeURIComponent(filtroMesTempoMedio)}`);
          });
        }
        
        if (window.Logger) {
          window.Logger.debug(`⏱️ Cache invalidado para ${endpointsToClear.length} endpoints`);
        }
      }
      
      // Recarregar dados com forceRefresh=true para garantir que não use cache
      await loadTempoMedio(true);
    });
  }
  
  // Listener para filtro de status
  if (selectStatus) {
    selectStatus.addEventListener('change', async (e) => {
      filtroStatusTempoMedio = e.target.value || '';
      
      if (window.Logger) {
        window.Logger.debug(`⏱️ Filtro de status alterado para: ${filtroStatusTempoMedio || 'Todos'}`);
      }
      
      // Invalidar cache de TODOS os endpoints relacionados
      if (window.dataStore && typeof window.dataStore.clear === 'function') {
        // Limpar cache de todos os endpoints que podem ter sido cacheados
        const endpointsToClear = [
          '/api/stats/average-time',
          '/api/stats/average-time/stats',
          '/api/stats/average-time/by-day',
          '/api/stats/average-time/by-week',
          '/api/stats/average-time/by-unit',
          '/api/stats/average-time/by-month-unit',
          '/api/stats/average-time/by-month'
        ];
        
        // Limpar endpoints base
        endpointsToClear.forEach(endpoint => {
          window.dataStore.clear(endpoint);
        });
        
        // Limpar também versões com query string (se existirem no cache)
        if (filtroMesTempoMedio) {
          endpointsToClear.forEach(endpoint => {
            window.dataStore.clear(`${endpoint}?meses=${encodeURIComponent(filtroMesTempoMedio)}`);
          });
        }
        
        if (window.Logger) {
          window.Logger.debug(`⏱️ Cache invalidado para ${endpointsToClear.length} endpoints`);
        }
      }
      
      // Recarregar dados com forceRefresh=true para garantir que não use cache
      await loadTempoMedio(true);
    });
  }
  
  // Popular select de meses
  popularSelectMesesTempoMedio();
}

// Inicializar botões quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    inicializarBotoesOrdenacaoTempoMedio();
    inicializarFiltrosTempoMedio();
  });
} else {
  inicializarBotoesOrdenacaoTempoMedio();
  inicializarFiltrosTempoMedio();
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-tempo-medio', loadTempoMedio, 500);
}

// LISTENER ROBUSTO: Escutar mudanças de filtros via eventBus
if (window.eventBus) {
  // Prevenir múltiplos listeners
  if (!window._tempoMedioFilterListenerRegistered) {
    window._tempoMedioFilterListenerRegistered = true;
    
    // Listener para quando filtros são aplicados
    window.eventBus.on('filter:applied', async () => {
      const page = document.getElementById('page-tempo-medio');
      if (!page || page.style.display === 'none') {
        return;
      }
      
      if (window.Logger) {
        window.Logger.debug('⏱️ Filtro aplicado, recarregando tempo médio...');
      }
      
      // Recarregar dados com filtros ativos
      await loadTempoMedio(true).catch(err => {
        if (window.errorHandler) {
          window.errorHandler.handleError(err, 'loadTempoMedio (filter:applied)', {
            showToUser: false
          });
        }
      });
    });
    
    // Listener para quando filtros são removidos
    window.eventBus.on('filter:removed', async () => {
      const page = document.getElementById('page-tempo-medio');
      if (!page || page.style.display === 'none') {
        return;
      }
      
      if (window.Logger) {
        window.Logger.debug('⏱️ Filtro removido, recarregando tempo médio...');
      }
      
      // Recarregar dados
      await loadTempoMedio(true).catch(err => {
        if (window.errorHandler) {
          window.errorHandler.handleError(err, 'loadTempoMedio (filter:removed)', {
            showToUser: false
          });
        }
      });
    });
    
    // Listener para quando todos os filtros são limpos
    window.eventBus.on('filter:cleared', async () => {
      const page = document.getElementById('page-tempo-medio');
      if (!page || page.style.display === 'none') {
        return;
      }
      
      if (window.Logger) {
        window.Logger.debug('⏱️ Filtros limpos, recarregando tempo médio...');
      }
      
      // Recarregar dados sem filtros
      await loadTempoMedio(true).catch(err => {
        if (window.errorHandler) {
          window.errorHandler.handleError(err, 'loadTempoMedio (filter:cleared)', {
            showToUser: false
          });
        }
      });
    });
    
    if (window.Logger) {
      window.Logger.success('✅ Listeners de filtros registrados para Tempo Médio');
    }
  }
}

// BANNER: Usar autoUpdate para atualizar automaticamente quando filtros mudarem
if (window.filterBanner) {
  // Aguardar um pouco para garantir que a página está carregada
  setTimeout(() => {
    const pageContainer = document.getElementById('page-tempo-medio');
    if (pageContainer) {
      window.filterBanner.autoUpdate('page-tempo-medio', {
        showClearAll: true,
        showCount: true,
        position: 'top',
        onClear: () => {
          // Callback quando limpar todos
          if (window.chartCommunication && window.chartCommunication.filters) {
            window.chartCommunication.filters.clear();
          }
          loadTempoMedio(true).catch(() => {});
        }
      });
      
      if (window.Logger) {
        window.Logger.debug('✅ FilterBanner autoUpdate configurado para Tempo Médio');
      }
    }
  }, 1000);
}

window.loadTempoMedio = loadTempoMedio;

