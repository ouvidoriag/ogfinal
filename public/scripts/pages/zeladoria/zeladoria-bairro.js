/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE POR BAIRRO
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das ocorrências de zeladoria
 * agrupadas por bairro, fornecendo insights sobre a distribuição geográfica
 * das demandas e permitindo identificar áreas que necessitam de maior atenção.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de ocorrências por bairro (gráfico de barras horizontal)
 * - Ranking dos bairros com mais ocorrências
 * - Evolução mensal das ocorrências por bairro
 * - Informações geográficas (coordenadas, cidade, estado)
 * - Estatísticas agregadas (total, concentração, média)
 * - Dados adicionais: origem, apoios, status por bairro
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - bairro: Nome do bairro onde ocorreu a demanda
 * - cidade: Cidade do bairro
 * - estado: Estado do bairro
 * - origem: Origem da demanda (Colab, Web, etc.)
 * - apoios: Quantidade de apoios recebidos
 * - status: Status atual da demanda
 * - categoria: Categoria da demanda
 * - latitude/longitude: Coordenadas geográficas
 * 
 * ============================================================================
 */

/**
 * Função principal de carregamento da página
 * Carrega e renderiza todos os dados relacionados a bairros
 */
async function loadZeladoriaBairro() {
  if (window.Logger) {
    window.Logger.debug('📍 loadZeladoriaBairro: Iniciando carregamento da página');
  }
  
  // Verificar se a página está visível
  const page = document.getElementById('page-zeladoria-bairro');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // ========================================================================
    // ETAPA 1: Limpeza de gráficos existentes
    // ========================================================================
    // Destruir gráficos existentes antes de criar novos para evitar
    // sobreposição e vazamento de memória
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-bairro-chart',
        'zeladoria-bairro-mes-chart',
        'zeladoria-bairro-origem-chart'
      ]);
    }
    
    // ========================================================================
    // ETAPA 2: Carregar dados principais por bairro
    // ========================================================================
    // Buscar contagem de ocorrências agrupadas por bairro
    // Cache de 10 minutos para otimizar performance
    const data = await window.dataLoader?.load('/api/zeladoria/count-by?field=bairro', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📍 loadZeladoriaBairro: Dados não são um array válido', data);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro) e pegar top 20
    // Limitar a 20 para melhor visualização e performance
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 20);
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    // ========================================================================
    // ETAPA 3: Criar gráfico principal de distribuição por bairro
    // ========================================================================
    // Gráfico de barras horizontal mostrando os bairros com mais ocorrências
    // Habilitado para interação (filtros globais ao clicar)
    const chartBairro = await window.chartFactory?.createBarChart('zeladoria-bairro-chart', labels, values, {
      horizontal: true,
      colorIndex: 3,
      field: 'bairro',
      onClick: true, // Habilitar interatividade para crossfilter
      legendContainer: 'zeladoria-bairro-legend'
    });
    
    // CROSSFILTER: Adicionar sistema de filtros
    if (chartBairro && sortedData && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartBairro, sortedData, {
        field: 'bairro',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadZeladoriaBairro) setTimeout(() => window.loadZeladoriaBairro(), 100);
        },
        onClearFilters: () => {
          if (window.loadZeladoriaBairro) setTimeout(() => window.loadZeladoriaBairro(), 100);
        }
      });
    }
    
    // ========================================================================
    // ETAPA 4: Renderizar ranking detalhado de bairros
    // ========================================================================
    renderBairroRanking(sortedData);
    
    // ========================================================================
    // ETAPA 5: Carregar e renderizar dados mensais
    // ========================================================================
    // Evolução temporal das ocorrências por bairro
    const dataMes = await window.dataLoader?.load('/api/zeladoria/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderBairroMesChart(dataMes, sortedData.slice(0, 10));
    }
    
    // ========================================================================
    // ETAPA 6: Carregar dados geográficos e adicionais
    // ========================================================================
    // Dados com coordenadas, cidade, estado e informações complementares
    const geoData = await window.dataLoader?.load('/api/zeladoria/geographic', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (geoData.length > 0) {
      renderBairroGeoInfo(geoData, sortedData);
    }
    
    // ========================================================================
    // ETAPA 7: Carregar dados adicionais (origem, apoios)
    // ========================================================================
    // Buscar dados de origem por bairro para análise complementar
    await loadBairroDadosAdicionais(sortedData);
    
    // ========================================================================
    // ETAPA 8: Renderizar estatísticas agregadas
    // ========================================================================
    renderBairroStats(sortedData, data);
    
    // ========================================================================
    // ETAPA 9: Atualizar KPIs no header
    // ========================================================================
    updateZeladoriaBairroKPIs(sortedData, data);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateZeladoriaBairroKPIs(sortedData, data),
        pageLoadFunction: window.loadZeladoriaBairro
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#zeladoria-bairro-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const bairro = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: bairro,
              field: 'bairro'
            };
          }),
          field: 'bairro',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]') || card.querySelector('.font-semibold');
            return textEl ? (textEl.getAttribute('title') || textEl.textContent.trim()) : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('📍 loadZeladoriaBairro: Carregamento concluído com sucesso');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Bairro Zeladoria:', error);
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderBairroMesChart
 * ========================================================================
 * Renderiza um gráfico de barras mostrando a evolução mensal das
 * ocorrências nos principais bairros ao longo do tempo.
 * 
 * PARÂMETROS:
 * - dataMes: Array com dados mensais agregados
 * - topBairros: Array com os bairros mais relevantes (top 10)
 * 
 * GRÁFICO GERADO:
 * - Tipo: Barras agrupadas
 * - Eixo X: Meses (formato MM/YYYY)
 * - Eixo Y: Quantidade de ocorrências
 * - Séries: Uma linha por bairro
 * ========================================================================
 */
async function renderBairroMesChart(dataMes, topBairros) {
  // Validar parâmetros
  if (!dataMes || !Array.isArray(dataMes) || dataMes.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderBairroMesChart: dataMes vazio ou inválido');
    }
    return;
  }
  
  if (!topBairros || !Array.isArray(topBairros) || topBairros.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderBairroMesChart: topBairros vazio ou inválido, usando top 10 dos dados mensais');
    }
    // Extrair top 10 bairros dos dados mensais se topBairros não foi fornecido
    const bairrosSet = new Set();
    dataMes.forEach(d => {
      if (d.bairro) bairrosSet.add(d.bairro);
    });
    topBairros = Array.from(bairrosSet).slice(0, 10).map(b => ({ key: b, _id: b }));
  }
  
  // Extrair lista única de meses e ordenar cronologicamente
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const bairros = topBairros.map(b => b.key || b._id || 'N/A');
  
  // Criar datasets para cada bairro
  // Cada dataset representa a evolução mensal de um bairro
  const datasets = bairros.map((bairro, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => {
        const dMonth = d.month || d.ym;
        const dBairro = d.bairro;
        return dMonth === mes && dBairro === bairro;
      });
      return item?.count || 0;
    });
    return {
      label: bairro,
      data: data
    };
  });
  
  // Formatar labels dos meses para exibição amigável
  const labels = meses.map(m => {
    if (window.dateUtils?.formatMonthYearShort) {
      return window.dateUtils.formatMonthYearShort(m);
    }
    return m;
  });
  
  // Criar gráfico de barras agrupadas
  const canvas = document.getElementById('zeladoria-bairro-mes-chart');
  if (canvas) {
    const chartMes = await window.chartFactory?.createBarChart('zeladoria-bairro-mes-chart', labels, datasets, {
      colorIndex: 0,
      onClick: true, // Habilitar interatividade para crossfilter
      field: 'bairro',
      legendContainer: 'zeladoria-bairro-mes-legend'
    });
    
    // CROSSFILTER: Adicionar sistema de filtros ao gráfico mensal
    if (chartMes && dataMes && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartMes, dataMes, {
        field: 'bairro',
        valueField: 'bairro',
        onFilterChange: () => {
          if (window.loadZeladoriaBairro) setTimeout(() => window.loadZeladoriaBairro(), 100);
        }
      });
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-bairro-mes-chart não encontrado');
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderBairroRanking
 * ========================================================================
 * Renderiza uma lista ranking dos bairros ordenados por quantidade
 * de ocorrências, exibindo posição, nome, quantidade e percentual.
 * 
 * PARÂMETROS:
 * - data: Array de objetos com {key, count} ordenado por count
 * 
 * ELEMENTOS EXIBIDOS:
 * - Posição no ranking (1, 2, 3...)
 * - Ícone de localização
 * - Nome do bairro
 * - Quantidade de ocorrências
 * - Percentual em relação ao total
 * ========================================================================
 */
function renderBairroRanking(data) {
  const rankEl = document.getElementById('zeladoria-bairro-ranking');
  if (!rankEl) return;
  
  // Calcular total para cálculo de percentuais
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  // Gerar HTML do ranking com informações detalhadas
  rankEl.innerHTML = data.map((item, idx) => {
    const bairro = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6" title="Posição no ranking">${idx + 1}.</span>
          <span class="text-lg" title="Localização geográfica">📍</span>
          <span class="text-sm text-slate-300 truncate" title="${bairro}">${bairro}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-emerald-300" title="Total de ocorrências">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500" title="Percentual do total">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * ========================================================================
 * FUNÇÃO: renderBairroGeoInfo
 * ========================================================================
 * Renderiza informações geográficas dos bairros, incluindo coordenadas
 * GPS (latitude/longitude) para possível integração com mapas.
 * 
 * PARÂMETROS:
 * - geoData: Array com dados geográficos do endpoint /api/zeladoria/geographic
 * - rankingData: Array com ranking de bairros ordenado por ocorrências
 * 
 * DADOS EXIBIDOS:
 * - Nome do bairro
 * - Coordenadas GPS (latitude, longitude)
 * - Quantidade de ocorrências
 * - Categorias e status (se disponíveis)
 * ========================================================================
 */
function renderBairroGeoInfo(geoData, rankingData) {
  const geoEl = document.getElementById('zeladoria-bairro-geo');
  if (!geoEl) return;
  
  // Combinar dados geográficos com ranking (top 10)
  // Filtrar apenas bairros que possuem coordenadas válidas
  const bairrosComGeo = rankingData.slice(0, 10).map(item => {
    const bairro = item.key || item._id || 'N/A';
    const geo = geoData.find(g => (g.bairro || g._id?.bairro) === bairro);
    return {
      bairro,
      count: item.count || 0,
      lat: geo?.latitude || geo?._id?.latitude,
      lng: geo?.longitude || geo?._id?.longitude,
      categorias: geo?.categorias || {},
      status: geo?.status || {}
    };
  }).filter(b => b.lat && b.lng);
  
  // Exibir mensagem se não houver dados geográficos
  if (bairrosComGeo.length === 0) {
    geoEl.innerHTML = `
      <div class="text-center text-slate-400 py-4">
        <div class="text-lg mb-2">📍</div>
        <div>Nenhum dado geográfico disponível</div>
        <div class="text-xs mt-2 text-slate-500">Coordenadas GPS não foram informadas</div>
      </div>
    `;
    return;
  }
  
  // Renderizar lista de bairros com coordenadas
  geoEl.innerHTML = `
    <div class="text-xs text-slate-400 mb-2">
      Top ${bairrosComGeo.length} bairros com coordenadas GPS
    </div>
    <div class="space-y-2">
      ${bairrosComGeo.map((item, idx) => {
        // Contar categorias e status mais comuns
        const topCategoria = Object.entries(item.categorias || {})
          .sort((a, b) => b[1] - a[1])[0];
        const topStatus = Object.entries(item.status || {})
          .sort((a, b) => b[1] - a[1])[0];
        
        return `
          <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-slate-300 truncate" title="${item.bairro}">${item.bairro}</div>
                ${topCategoria ? `<div class="text-xs text-slate-500 mt-1">Categoria: ${topCategoria[0]} (${topCategoria[1]})</div>` : ''}
              </div>
            </div>
            <div class="text-right ml-2">
              <div class="text-xs text-slate-400" title="Coordenadas GPS">
                ${item.lat?.toFixed(4)}, ${item.lng?.toFixed(4)}
              </div>
              <div class="text-xs text-slate-500 mt-1">${item.count} ocorrências</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * ========================================================================
 * FUNÇÃO: renderBairroStats
 * ========================================================================
 * Renderiza cards com estatísticas agregadas sobre a distribuição
 * de ocorrências por bairro, fornecendo métricas de concentração
 * e distribuição geográfica.
 * 
 * PARÂMETROS:
 * - topData: Array com top bairros (limitado)
 * - allData: Array completo com todos os bairros
 * 
 * MÉTRICAS EXIBIDAS:
 * - Total de ocorrências: Soma de todas as ocorrências
 * - Bairros únicos: Quantidade de bairros distintos
 * - Top 10 concentração: Percentual de ocorrências nos 10 principais bairros
 * - Média por bairro: Média aritmética de ocorrências por bairro
 * ========================================================================
 */
function renderBairroStats(topData, allData) {
  const statsEl = document.getElementById('zeladoria-bairro-stats');
  if (!statsEl) return;
  
  // Calcular métricas agregadas
  const total = allData.reduce((sum, item) => sum + (item.count || 0), 0);
  const top10 = topData.slice(0, 10).reduce((sum, item) => sum + (item.count || 0), 0);
  const top10Percent = total > 0 ? ((top10 / total) * 100).toFixed(1) : 0;
  const uniqueBairros = allData.length;
  const avgPerBairro = uniqueBairros > 0 ? (total / uniqueBairros).toFixed(0) : 0;
  
  // Renderizar cards de estatísticas
  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Total de ocorrências registradas">
        <div class="text-xs text-slate-400 mb-1">Total de Ocorrências</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">Todas as demandas</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Quantidade de bairros distintos com ocorrências">
        <div class="text-xs text-slate-400 mb-1">Bairros Únicos</div>
        <div class="text-2xl font-bold text-violet-300">${uniqueBairros}</div>
        <div class="text-xs text-slate-500 mt-1">Áreas atendidas</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Percentual de ocorrências concentradas nos 10 principais bairros">
        <div class="text-xs text-slate-400 mb-1">Top 10 Concentração</div>
        <div class="text-2xl font-bold text-emerald-300">${top10Percent}%</div>
        <div class="text-xs text-slate-500 mt-1">Foco prioritário</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Média aritmética de ocorrências por bairro">
        <div class="text-xs text-slate-400 mb-1">Média por Bairro</div>
        <div class="text-2xl font-bold text-amber-300">${avgPerBairro}</div>
        <div class="text-xs text-slate-500 mt-1">Distribuição média</div>
      </div>
    </div>
  `;
}

/**
 * ========================================================================
 * FUNÇÃO: loadBairroDadosAdicionais
 * ========================================================================
 * Carrega e renderiza dados adicionais sobre os bairros, incluindo:
 * - Distribuição por origem (Colab, Web, etc.)
 * - Informações sobre apoios recebidos
 * - Dados de cidade e estado
 * 
 * PARÂMETROS:
 * - topBairros: Array com os principais bairros
 * ========================================================================
 */
async function loadBairroDadosAdicionais(topBairros) {
  try {
    // Buscar dados de origem por bairro
    const origemData = await window.dataLoader?.load('/api/zeladoria/count-by?field=origem', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Renderizar informações de origem se disponível
    const origemEl = document.getElementById('zeladoria-bairro-origem');
    if (origemEl && origemData.length > 0) {
      const totalOrigem = origemData.reduce((sum, item) => sum + (item.count || 0), 0);
      origemEl.innerHTML = `
        <div class="text-xs text-slate-400 mb-2">Origem das Ocorrências</div>
        <div class="space-y-2">
          ${origemData.slice(0, 5).map(item => {
            const percent = totalOrigem > 0 ? ((item.count / totalOrigem) * 100).toFixed(1) : 0;
            return `
              <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/30">
                <span class="text-sm text-slate-300">${item.key || 'N/A'}</span>
                <div class="text-right">
                  <div class="text-sm font-bold text-indigo-300">${item.count.toLocaleString('pt-BR')}</div>
                  <div class="text-xs text-slate-500">${percent}%</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao carregar dados adicionais de bairro:', error);
    }
  }
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaBairroKPIs(sortedData, allData) {
  if (!allData || !Array.isArray(allData) || allData.length === 0) {
    return;
  }
  
  const total = allData.reduce((sum, item) => sum + (item.count || 0), 0);
  const unicos = allData.length;
  const maisAtivo = sortedData[0];
  const maisAtivoNome = maisAtivo ? (maisAtivo.key || maisAtivo._id || 'N/A') : '—';
  const media = unicos > 0 ? Math.round(total / unicos) : 0;
  
  const totalEl = document.getElementById('zeladoria-bairro-kpi-total');
  const unicosEl = document.getElementById('zeladoria-bairro-kpi-unicos');
  const maisAtivoEl = document.getElementById('zeladoria-bairro-kpi-mais-ativo');
  const mediaEl = document.getElementById('zeladoria-bairro-kpi-media');
  
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (unicosEl) unicosEl.textContent = unicos.toLocaleString('pt-BR');
  if (maisAtivoEl) {
    maisAtivoEl.textContent = maisAtivoNome;
    maisAtivoEl.title = maisAtivoNome;
  }
  if (mediaEl) mediaEl.textContent = media.toLocaleString('pt-BR');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-bairro', loadZeladoriaBairro, 500);
}

window.loadZeladoriaBairro = loadZeladoriaBairro;
