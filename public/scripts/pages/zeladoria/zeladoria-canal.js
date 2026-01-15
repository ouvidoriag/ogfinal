/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE POR CANAL
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das ocorrências de zeladoria
 * agrupadas por canal de entrada, permitindo identificar quais canais são
 * mais utilizados pelos cidadãos para reportar demandas.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de ocorrências por canal (gráfico de rosca)
 * - Ranking dos canais mais utilizados
 * - Evolução mensal das ocorrências por canal
 * - Estatísticas agregadas (total, canais únicos, canal principal)
 * - Dados adicionais: origem, protocolo empresa
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - canal: Canal de entrada da demanda (Colab, Web, Telefone, etc.)
 * - origem: Origem da demanda
 * - protocoloEmpresa: Protocolo da empresa relacionada
 * - status: Status atual da demanda
 * - categoria: Categoria da demanda
 * 
 * ============================================================================
 */

/**
 * Função principal de carregamento da página
 * Carrega e renderiza todos os dados relacionados a canais
 */
async function loadZeladoriaCanal() {
  if (window.Logger) {
    window.Logger.debug('📡 loadZeladoriaCanal: Iniciando carregamento da página');
  }
  
  // Verificar se a página está visível
  const page = document.getElementById('page-zeladoria-canal');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // ========================================================================
    // ETAPA 1: Limpeza de gráficos existentes
    // ========================================================================
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-canal-chart',
        'zeladoria-canal-mes-chart'
      ]);
    }
    
    // ========================================================================
    // ETAPA 2: Carregar dados principais por canal
    // ========================================================================
    const data = await window.dataLoader?.load('/api/zeladoria/count-by?field=canal', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📡 loadZeladoriaCanal: Dados não são um array válido', data);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    // ========================================================================
    // ETAPA 3: Criar gráfico principal de distribuição por canal
    // ========================================================================
    // Gráfico de rosca (doughnut) mostrando a proporção de cada canal
    const legendContainer = document.getElementById('zeladoria-canal-legend');
    // PADRONIZAÇÃO: Usar campo 'canal' para cores padronizadas
    const chartCanal = await window.chartFactory?.createDoughnutChart('zeladoria-canal-chart', labels, values, {
      onClick: true, // Habilitar interatividade para crossfilter
      field: 'canal', // Especificar campo para usar cores padronizadas do config.js
      ...(legendContainer && { legendContainer: 'zeladoria-canal-legend' })
    });
    
    // CROSSFILTER: Adicionar sistema de filtros
    if (chartCanal && sortedData && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartCanal, sortedData, {
        field: 'canal',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadZeladoriaCanal) setTimeout(() => window.loadZeladoriaCanal(), 100);
        },
        onClearFilters: () => {
          if (window.loadZeladoriaCanal) setTimeout(() => window.loadZeladoriaCanal(), 100);
        }
      });
    }
    
    // ========================================================================
    // ETAPA 4: Renderizar ranking detalhado de canais
    // ========================================================================
    renderCanalRanking(sortedData);
    
    // ========================================================================
    // ETAPA 5: Carregar e renderizar dados mensais
    // ========================================================================
    const dataMes = await window.dataLoader?.load('/api/zeladoria/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderCanalMesChart(dataMes, sortedData);
    }
    
    // ========================================================================
    // ETAPA 6: Renderizar estatísticas agregadas
    // ========================================================================
    renderCanalStats(sortedData);
    
    // ========================================================================
    // ETAPA 7: Atualizar KPIs no header
    // ========================================================================
    updateZeladoriaCanalKPIs(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateZeladoriaCanalKPIs(sortedData),
        pageLoadFunction: window.loadZeladoriaCanal
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#zeladoria-canal-ranking > div');
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
            const textEl = card.querySelector('span[title]') || card.querySelector('.font-semibold');
            return textEl ? (textEl.getAttribute('title') || textEl.textContent.trim()) : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('📡 loadZeladoriaCanal: Carregamento concluído com sucesso');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Canal Zeladoria:', error);
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderCanalMesChart
 * ========================================================================
 * Renderiza um gráfico de barras mostrando a evolução mensal das
 * ocorrências por canal ao longo do tempo.
 * 
 * PARÂMETROS:
 * - dataMes: Array com dados mensais agregados
 * - canais: Array com todos os canais ordenados por ocorrências
 * 
 * GRÁFICO GERADO:
 * - Tipo: Barras agrupadas
 * - Eixo X: Meses (formato MM/YYYY)
 * - Eixo Y: Quantidade de ocorrências
 * - Séries: Uma linha por canal
 * ========================================================================
 */
async function renderCanalMesChart(dataMes, canais) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const canalList = canais.map(c => c.key || c._id || 'N/A');
  
  const datasets = canalList.map((canal, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => {
        const dMonth = d.month || d.ym;
        const dCanal = d.canal;
        return dMonth === mes && dCanal === canal;
      });
      return item?.count || 0;
    });
    return {
      label: canal,
      data: data
    };
  });
  
  const labels = meses.map(m => {
    if (window.dateUtils?.formatMonthYearShort) {
      return window.dateUtils.formatMonthYearShort(m);
    }
    return m;
  });
  
  const canvas = document.getElementById('zeladoria-canal-mes-chart');
  if (canvas) {
    // PADRONIZAÇÃO: Usar campo 'canal' para cores padronizadas
    await window.chartFactory?.createBarChart('zeladoria-canal-mes-chart', labels, datasets, {
      field: 'canal', // Especificar campo para usar cores padronizadas do config.js
      onClick: false,
      legendContainer: 'zeladoria-canal-mes-legend'
    });
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-canal-mes-chart não encontrado');
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderCanalRanking
 * ========================================================================
 * Renderiza uma lista ranking dos canais ordenados por quantidade
 * de ocorrências, exibindo ícone, nome, quantidade e percentual.
 * 
 * PARÂMETROS:
 * - data: Array de objetos com {key, count} ordenado por count
 * 
 * ELEMENTOS EXIBIDOS:
 * - Posição no ranking
 * - Ícone representativo do canal
 * - Nome do canal
 * - Quantidade de ocorrências
 * - Percentual em relação ao total
 * ========================================================================
 */
function renderCanalRanking(data) {
  const rankEl = document.getElementById('zeladoria-canal-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  // Mapeamento de ícones por tipo de canal para melhor visualização
  const canalIcons = {
    'Colab': '📱',
    'Aplicativo': '📱',
    'Web': '🌐',
    'Telefone': '📞',
    'Presencial': '🏢',
    'Email': '📧',
    'WhatsApp': '💬',
    'SMS': '💬',
    'Rede Social': '📲'
  };
  
  rankEl.innerHTML = data.map((item, idx) => {
    const canal = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    const icon = canalIcons[canal] || '📡';
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6" title="Posição no ranking">${idx + 1}.</span>
          <span class="text-lg" title="Tipo de canal">${icon}</span>
          <span class="text-sm text-slate-300 truncate" title="${canal}">${canal}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-indigo-300" title="Total de ocorrências">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500" title="Percentual do total">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * ========================================================================
 * FUNÇÃO: renderCanalStats
 * ========================================================================
 * Renderiza cards com estatísticas agregadas sobre a distribuição
 * de ocorrências por canal.
 * 
 * PARÂMETROS:
 * - data: Array completo com todos os canais
 * 
 * MÉTRICAS EXIBIDAS:
 * - Total de ocorrências: Soma de todas as ocorrências
 * - Canais únicos: Quantidade de canais distintos
 * - Canal principal: Percentual do canal mais utilizado
 * ========================================================================
 */
function renderCanalStats(data) {
  const statsEl = document.getElementById('zeladoria-canal-stats');
  if (!statsEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const topCanal = data[0];
  const topCanalPercent = topCanal && total > 0 ? ((topCanal.count / total) * 100).toFixed(1) : 0;
  const uniqueCanais = data.length;
  
  statsEl.innerHTML = `
    <div class="grid grid-cols-3 gap-4">
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Total de ocorrências registradas">
        <div class="text-xs text-slate-400 mb-1">Total de Ocorrências</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">Todas as demandas</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Quantidade de canais distintos utilizados">
        <div class="text-xs text-slate-400 mb-1">Canais Únicos</div>
        <div class="text-2xl font-bold text-violet-300">${uniqueCanais}</div>
        <div class="text-xs text-slate-500 mt-1">Canais disponíveis</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Canal mais utilizado e seu percentual">
        <div class="text-xs text-slate-400 mb-1">Canal Principal</div>
        <div class="text-lg font-bold text-indigo-300">${topCanal ? (topCanalPercent + '%') : '—'}</div>
        <div class="text-xs text-slate-400 mt-1 truncate" title="${topCanal ? (topCanal.key || topCanal._id || 'N/A') : ''}">
          ${topCanal ? (topCanal.key || topCanal._id || 'N/A') : 'N/A'}
        </div>
      </div>
    </div>
  `;
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaCanalKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const unicos = data.length;
  const maisUsado = data[0];
  const maisUsadoNome = maisUsado ? (maisUsado.key || maisUsado._id || 'N/A') : '—';
  const media = unicos > 0 ? Math.round(total / unicos) : 0;
  
  const totalEl = document.getElementById('zeladoria-canal-kpi-total');
  const unicosEl = document.getElementById('zeladoria-canal-kpi-unicos');
  const maisUsadoEl = document.getElementById('zeladoria-canal-kpi-mais-usado');
  const mediaEl = document.getElementById('zeladoria-canal-kpi-media');
  
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (unicosEl) unicosEl.textContent = unicos.toLocaleString('pt-BR');
  if (maisUsadoEl) {
    maisUsadoEl.textContent = maisUsadoNome;
    maisUsadoEl.title = maisUsadoNome;
  }
  if (mediaEl) mediaEl.textContent = media.toLocaleString('pt-BR');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-canal', loadZeladoriaCanal, 500);
}

window.loadZeladoriaCanal = loadZeladoriaCanal;
