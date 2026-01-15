/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE POR CATEGORIA
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das ocorrências de zeladoria
 * agrupadas por categoria, permitindo identificar quais tipos de demandas
 * são mais frequentes e como estão distribuídas entre os departamentos.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de ocorrências por categoria (gráfico de barras horizontal)
 * - Ranking das categorias mais frequentes
 * - Evolução mensal das ocorrências por categoria
 * - Relação categoria x departamento (matriz de responsabilidades)
 * - Estatísticas agregadas (total, concentração, distribuição)
 * - Dados adicionais: departamento responsável, prazo médio
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - categoria: Tipo/categoria da demanda
 * - departamento: Departamento responsável pelo atendimento
 * - responsavel: Responsável pelo atendimento
 * - prazo: Prazo estabelecido para resolução
 * - status: Status atual da demanda
 * - dataCriacao: Data de criação da demanda
 * 
 * ============================================================================
 */

/**
 * Função principal de carregamento da página
 * Carrega e renderiza todos os dados relacionados a categorias
 */
async function loadZeladoriaCategoria() {
  if (window.Logger) {
    window.Logger.debug('📂 loadZeladoriaCategoria: Iniciando carregamento da página');
  }

  // Verificar se a página está visível
  const page = document.getElementById('page-zeladoria-categoria');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }

  try {
    // ========================================================================
    // ETAPA 1: Limpeza de gráficos existentes
    // ========================================================================
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-categoria-chart',
        'zeladoria-categoria-mes-chart',
        'zeladoria-categoria-dept-chart',
        'zeladoria-categoria-prazo-chart'
      ]);
    }

    // ========================================================================
    // ETAPA 2: Carregar dados principais por categoria
    // ========================================================================
    const data = await window.dataLoader?.load('/api/zeladoria/count-by?field=categoria', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('📂 loadZeladoriaCategoria: Dados não são um array válido', data);
      }
      return;
    }

    // Ordenar por quantidade (maior primeiro) e pegar top 20
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 20);
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);

    // ========================================================================
    // ETAPA 3: Criar gráfico principal de distribuição por categoria
    // ========================================================================
    const chartCategoria = await window.chartFactory?.createBarChart('zeladoria-categoria-chart', labels, values, {
      horizontal: true,
      colorIndex: 1,
      field: 'categoria',
      onClick: true, // Habilitar interatividade para crossfilter
      legendContainer: 'zeladoria-categoria-legend'
    });

    // CROSSFILTER: Adicionar sistema de filtros
    if (chartCategoria && sortedData && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartCategoria, sortedData, {
        field: 'categoria',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadZeladoriaCategoria) setTimeout(() => window.loadZeladoriaCategoria(), 100);
        },
        onClearFilters: () => {
          if (window.loadZeladoriaCategoria) setTimeout(() => window.loadZeladoriaCategoria(), 100);
        }
      });
    }

    // ========================================================================
    // ETAPA 4: Renderizar ranking detalhado de categorias
    // ========================================================================
    renderCategoriaRanking(sortedData);

    // ========================================================================
    // ETAPA 5: Carregar dados de categoria por departamento
    // ========================================================================
    // Matriz mostrando quais departamentos atendem quais categorias
    const categoriaDepartamento = await window.dataLoader?.load('/api/zeladoria/by-categoria-departamento', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};

    if (Object.keys(categoriaDepartamento).length > 0) {
      await renderCategoriaDepartamentoChart(categoriaDepartamento);
    }

    // Carregar prazo médio por categoria
    const prazoCategoria = await window.dataLoader?.load('/api/zeladoria/average-time-category', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (prazoCategoria.length > 0) {
      await renderCategoriaPrazoChart(prazoCategoria);
    }

    // ========================================================================
    // ETAPA 6: Carregar e renderizar dados mensais
    // ========================================================================
    const dataMes = await window.dataLoader?.load('/api/zeladoria/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];

    if (dataMes.length > 0) {
      await renderCategoriaMesChart(dataMes, sortedData.slice(0, 10));
    }

    // ========================================================================
    // ETAPA 7: Renderizar estatísticas agregadas
    // ========================================================================
    renderCategoriaStats(sortedData);

    // ========================================================================
    // ETAPA 8: Atualizar KPIs no header
    // ========================================================================
    updateZeladoriaCategoriaKPIs(sortedData, data);

    if (window.Logger) {
      window.Logger.success('📂 loadZeladoriaCategoria: Carregamento concluído com sucesso');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Categoria Zeladoria:', error);
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderCategoriaMesChart
 * ========================================================================
 * Renderiza um gráfico de barras mostrando a evolução mensal das
 * ocorrências por categoria ao longo do tempo.
 * 
 * PARÂMETROS:
 * - dataMes: Array com dados mensais agregados
 * - topCategorias: Array com as categorias mais relevantes (top 10)
 * ========================================================================
 */
async function renderCategoriaMesChart(dataMes, topCategorias) {
  // Validar parâmetros
  if (!dataMes || !Array.isArray(dataMes) || dataMes.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderCategoriaMesChart: dataMes vazio ou inválido');
    }
    return;
  }

  if (!topCategorias || !Array.isArray(topCategorias) || topCategorias.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderCategoriaMesChart: topCategorias vazio ou inválido, usando top 10 dos dados mensais');
    }
    // Extrair top 10 categorias dos dados mensais se topCategorias não foi fornecido
    const categoriasSet = new Set();
    dataMes.forEach(d => {
      if (d.categoria) categoriasSet.add(d.categoria);
    });
    topCategorias = Array.from(categoriasSet).slice(0, 10).map(c => ({ key: c, _id: c }));
  }

  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const categorias = topCategorias.map(c => c.key || c._id || 'N/A');

  const datasets = categorias.map((categoria, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => {
        const dMonth = d.month || d.ym;
        const dCategoria = d.categoria;
        return dMonth === mes && dCategoria === categoria;
      });
      return item?.count || 0;
    });
    return {
      label: categoria,
      data: data
    };
  });

  const labels = meses.map(m => {
    if (window.dateUtils?.formatMonthYearShort) {
      return window.dateUtils.formatMonthYearShort(m);
    }
    return m;
  });

  const canvasMes = document.getElementById('zeladoria-categoria-mes-chart');
  if (canvasMes) {
    const chartMes = await window.chartFactory?.createBarChart('zeladoria-categoria-mes-chart', labels, datasets, {
      colorIndex: 0,
      onClick: true, // Habilitar interatividade para crossfilter
      legendContainer: 'zeladoria-categoria-mes-legend'
    });

    // CROSSFILTER: Adicionar sistema de filtros ao gráfico mensal
    if (chartMes && dataMes && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartMes, dataMes, {
        field: 'categoria',
        valueField: 'categoria',
        onFilterChange: () => {
          if (window.loadZeladoriaCategoria) setTimeout(() => window.loadZeladoriaCategoria(), 100);
        }
      });
    }
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-categoria-mes-chart não encontrado');
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderCategoriaDepartamentoChart
 * ========================================================================
 * Renderiza um gráfico de barras agrupadas mostrando a relação entre
 * categorias e departamentos, permitindo identificar quais departamentos
 * são responsáveis por quais tipos de demandas.
 * 
 * PARÂMETROS:
 * - data: Objeto com estrutura {categoria: {departamento: count}}
 * 
 * GRÁFICO GERADO:
 * - Tipo: Barras agrupadas
 * - Eixo X: Departamentos
 * - Eixo Y: Quantidade de ocorrências
 * - Séries: Uma série por categoria (top 10)
 * ========================================================================
 */
async function renderCategoriaDepartamentoChart(data) {
  // Converter objeto em array para processamento
  const dataArray = [];
  for (const [categoria, depts] of Object.entries(data)) {
    for (const [departamento, count] of Object.entries(depts)) {
      dataArray.push({ categoria, departamento, count });
    }
  }

  // Extrair listas únicas
  const categorias = [...new Set(dataArray.map(d => d.categoria))].slice(0, 10);
  const departamentos = [...new Set(dataArray.map(d => d.departamento))];

  // Criar datasets para cada categoria
  const datasets = categorias.map((categoria, idx) => {
    const dataPoints = departamentos.map(dept => {
      const item = dataArray.find(d => d.categoria === categoria && d.departamento === dept);
      return item?.count || 0;
    });
    return {
      label: categoria,
      data: dataPoints
    };
  });

  const canvasDept = document.getElementById('zeladoria-categoria-dept-chart');
  if (canvasDept) {
    await window.chartFactory?.createBarChart('zeladoria-categoria-dept-chart', departamentos, datasets, {
      colorIndex: 2,
      onClick: false,
      legendContainer: 'zeladoria-categoria-dept-legend'
    });
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-categoria-dept-chart não encontrado');
    }
  }
}


/**
 * Renderizar gráfico de prazo médio por categoria
 */
async function renderCategoriaPrazoChart(data) {
  // Ordenar por prazo (maior primeiro) e pegar top 15
  const sortedData = [...data].sort((a, b) => (b.average || 0) - (a.average || 0)).slice(0, 15);

  const labels = sortedData.map(d => d.key || d._id || 'N/A');
  const values = sortedData.map(d => d.average || 0);

  const canvasPrazo = document.getElementById('zeladoria-categoria-prazo-chart');
  if (canvasPrazo) {
    await window.chartFactory?.createBarChart('zeladoria-categoria-prazo-chart', labels, values, {
      horizontal: true,
      colorIndex: 4, // Cor diferente
      label: 'Dias (Média)',
      onClick: true
    });
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderCategoriaRanking
 * ========================================================================
 * Renderiza uma lista ranking das categorias ordenadas por quantidade
 * de ocorrências, exibindo posição, nome, quantidade e percentual.
 * 
 * PARÂMETROS:
 * - data: Array de objetos com {key, count} ordenado por count
 * ========================================================================
 */
function renderCategoriaRanking(data) {
  const rankEl = document.getElementById('zeladoria-categoria-ranking');
  if (!rankEl) return;

  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);

  rankEl.innerHTML = data.map((item, idx) => {
    const categoria = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6" title="Posição no ranking">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${categoria}">${categoria}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <div class="text-sm font-bold text-violet-300" title="Total de ocorrências">${count.toLocaleString('pt-BR')}</div>
            <div class="text-xs text-slate-500" title="Percentual do total">${percent}%</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * ========================================================================
 * FUNÇÃO: renderCategoriaStats
 * ========================================================================
 * Renderiza cards com estatísticas agregadas sobre a distribuição
 * de ocorrências por categoria.
 * 
 * PARÂMETROS:
 * - data: Array completo com todas as categorias
 * 
 * MÉTRICAS EXIBIDAS:
 * - Total de ocorrências: Soma de todas as ocorrências
 * - Categorias únicas: Quantidade de categorias distintas
 * - Top 5 concentração: Percentual de ocorrências nas 5 principais categorias
 * ========================================================================
 */
function renderCategoriaStats(data) {
  const statsEl = document.getElementById('zeladoria-categoria-stats');
  if (!statsEl) return;

  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const top5 = data.slice(0, 5).reduce((sum, item) => sum + (item.count || 0), 0);
  const top5Percent = total > 0 ? ((top5 / total) * 100).toFixed(1) : 0;
  const uniqueCategories = data.length;

  statsEl.innerHTML = `
    <div class="grid grid-cols-3 gap-4">
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Total de ocorrências registradas">
        <div class="text-xs text-slate-400 mb-1">Total de Ocorrências</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">Todas as demandas</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Quantidade de categorias distintas">
        <div class="text-xs text-slate-400 mb-1">Categorias Únicas</div>
        <div class="text-2xl font-bold text-violet-300">${uniqueCategories}</div>
        <div class="text-xs text-slate-500 mt-1">Tipos de demanda</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Percentual de ocorrências concentradas nas 5 principais categorias">
        <div class="text-xs text-slate-400 mb-1">Top 5 Concentração</div>
        <div class="text-2xl font-bold text-emerald-300">${top5Percent}%</div>
        <div class="text-xs text-slate-500 mt-1">Foco prioritário</div>
      </div>
    </div>
  `;
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaCategoriaKPIs(sortedData, allData) {
  if (!allData || !Array.isArray(allData) || allData.length === 0) {
    return;
  }

  const total = allData.reduce((sum, item) => sum + (item.count || 0), 0);
  const unicos = allData.length;
  const maisComum = sortedData[0];
  const maisComumNome = maisComum ? (maisComum.key || maisComum._id || 'N/A') : '—';
  const media = unicos > 0 ? Math.round(total / unicos) : 0;

  const totalEl = document.getElementById('zeladoria-categoria-kpi-total');
  const unicosEl = document.getElementById('zeladoria-categoria-kpi-unicas');
  const maisComumEl = document.getElementById('zeladoria-categoria-kpi-mais-comum');
  const mediaEl = document.getElementById('zeladoria-categoria-kpi-media');

  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (unicosEl) unicosEl.textContent = unicos.toLocaleString('pt-BR');
  if (maisComumEl) {
    maisComumEl.textContent = maisComumNome;
    maisComumEl.title = maisComumNome;
  }
  if (mediaEl) mediaEl.textContent = media.toLocaleString('pt-BR');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-categoria', loadZeladoriaCategoria, 500);
}

window.loadZeladoriaCategoria = loadZeladoriaCategoria;
