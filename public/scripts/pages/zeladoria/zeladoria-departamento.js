/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE POR DEPARTAMENTO
 * ============================================================================
 * 
 * Esta página apresenta uma análise detalhada das ocorrências de zeladoria
 * agrupadas por departamento responsável, permitindo identificar a carga de
 * trabalho de cada departamento e sua distribuição ao longo do tempo.
 * 
 * DADOS EXIBIDOS:
 * - Distribuição de ocorrências por departamento (gráfico de barras horizontal)
 * - Ranking dos departamentos com mais ocorrências
 * - Evolução mensal das ocorrências por departamento
 * - Estatísticas agregadas (total, concentração, média)
 * - Dados adicionais: categoria, responsável, status por departamento
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - departamento: Departamento responsável pelo atendimento
 * - categoria: Categoria das demandas atendidas
 * - responsavel: Responsável pelo atendimento
 * - status: Status atual das demandas
 * - dataCriacao: Data de criação das demandas
 * 
 * ============================================================================
 */

/**
 * Função principal de carregamento da página
 * Carrega e renderiza todos os dados relacionados a departamentos
 */
async function loadZeladoriaDepartamento() {
  if (window.Logger) {
    window.Logger.debug('🏢 loadZeladoriaDepartamento: Iniciando');
  }
  
  const page = document.getElementById('page-zeladoria-departamento');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Destruir gráficos existentes antes de criar novos
    if (window.chartFactory?.destroyCharts) {
      window.chartFactory.destroyCharts([
        'zeladoria-departamento-chart',
        'zeladoria-departamento-mes-chart'
      ]);
    }
    
    // Carregar dados por departamento
    const data = await window.dataLoader?.load('/api/zeladoria/count-by?field=departamento', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    // Validar dados recebidos
    if (!Array.isArray(data) || data.length === 0) {
      if (window.Logger) {
        window.Logger.warn('🏢 loadZeladoriaDepartamento: Dados não são um array válido', data);
      }
      return;
    }
    
    // Ordenar por quantidade (maior primeiro)
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0));
    const labels = sortedData.map(d => d.key || d._id || 'N/A');
    const values = sortedData.map(d => d.count || 0);
    
    // Criar gráfico principal (barra horizontal)
    const chartDept = await window.chartFactory?.createBarChart('zeladoria-departamento-chart', labels, values, {
      horizontal: true,
      colorIndex: 2,
      field: 'departamento',
      onClick: true, // Habilitar interatividade para crossfilter
      legendContainer: 'zeladoria-departamento-legend'
    });
    
    // CROSSFILTER: Adicionar sistema de filtros
    if (chartDept && sortedData && window.addCrossfilterToChart) {
      window.addCrossfilterToChart(chartDept, sortedData, {
        field: 'departamento',
        valueField: 'key',
        onFilterChange: () => {
          if (window.loadZeladoriaDepartamento) setTimeout(() => window.loadZeladoriaDepartamento(), 100);
        },
        onClearFilters: () => {
          if (window.loadZeladoriaDepartamento) setTimeout(() => window.loadZeladoriaDepartamento(), 100);
        }
      });
    }
    
    // Renderizar ranking de departamentos
    renderDepartamentoRanking(sortedData);
    
    // Carregar dados mensais
    const dataMes = await window.dataLoader?.load('/api/zeladoria/by-month', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    if (dataMes.length > 0) {
      await renderDepartamentoMesChart(dataMes, sortedData.slice(0, 10));
    }
    
    // Renderizar estatísticas
    renderDepartamentoStats(sortedData);
    
    // Atualizar KPIs no header
    updateZeladoriaDepartamentoKPIs(sortedData);
    
    // CROSSFILTER: Fazer KPIs reagirem aos filtros
    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: () => updateZeladoriaDepartamentoKPIs(sortedData),
        pageLoadFunction: window.loadZeladoriaDepartamento
      });
    }
    
    // CROSSFILTER: Tornar ranking clicável
    setTimeout(() => {
      const rankItems = document.querySelectorAll('#zeladoria-departamento-ranking > div');
      if (rankItems.length > 0 && window.makeCardsClickable) {
        window.makeCardsClickable({
          cards: Array.from(rankItems).map((item, idx) => {
            const dept = sortedData[idx]?.key || sortedData[idx]?._id || '';
            return {
              element: item,
              value: dept,
              field: 'departamento'
            };
          }),
          field: 'departamento',
          getValueFromCard: (card) => {
            const textEl = card.querySelector('span[title]') || card.querySelector('.font-semibold');
            return textEl ? (textEl.getAttribute('title') || textEl.textContent.trim()) : '';
          }
        });
      }
    }, 500);
    
    if (window.Logger) {
      window.Logger.success('🏢 loadZeladoriaDepartamento: Concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar Departamento Zeladoria:', error);
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderDepartamentoMesChart
 * ========================================================================
 * Renderiza um gráfico de barras mostrando a evolução mensal das
 * ocorrências por departamento ao longo do tempo.
 * 
 * PARÂMETROS:
 * - dataMes: Array com dados mensais agregados
 * - topDepartamentos: Array com os departamentos mais relevantes (top 10)
 * ========================================================================
 */
async function renderDepartamentoMesChart(dataMes, topDepartamentos) {
  const meses = [...new Set(dataMes.map(d => d.month || d.ym))].sort();
  const departamentos = topDepartamentos.map(d => d.key || d._id || 'N/A');
  
  const datasets = departamentos.map((departamento, idx) => {
    const data = meses.map(mes => {
      const item = dataMes.find(d => {
        const dMonth = d.month || d.ym;
        const dDept = d.departamento;
        return dMonth === mes && dDept === departamento;
      });
      return item?.count || 0;
    });
    return {
      label: departamento,
      data: data
    };
  });
  
  const labels = meses.map(m => {
    if (window.dateUtils?.formatMonthYearShort) {
      return window.dateUtils.formatMonthYearShort(m);
    }
    return m;
  });
  
  const canvas = document.getElementById('zeladoria-departamento-mes-chart');
  if (canvas) {
    await window.chartFactory?.createBarChart('zeladoria-departamento-mes-chart', labels, datasets, {
      colorIndex: 0,
      onClick: false,
      legendContainer: 'zeladoria-departamento-mes-legend'
    });
  } else {
    if (window.Logger) {
      window.Logger.warn('⚠️ Canvas zeladoria-departamento-mes-chart não encontrado');
    }
  }
}

/**
 * ========================================================================
 * FUNÇÃO: renderDepartamentoRanking
 * ========================================================================
 * Renderiza uma lista ranking dos departamentos ordenados por quantidade
 * de ocorrências, exibindo posição, nome, quantidade e percentual.
 * 
 * PARÂMETROS:
 * - data: Array de objetos com {key, count} ordenado por count
 * ========================================================================
 */
function renderDepartamentoRanking(data) {
  const rankEl = document.getElementById('zeladoria-departamento-ranking');
  if (!rankEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  
  rankEl.innerHTML = data.map((item, idx) => {
    const departamento = item.key || item._id || 'N/A';
    const count = item.count || 0;
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
    
    return `
      <div class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <span class="text-xs text-slate-400 w-6">${idx + 1}.</span>
          <span class="text-sm text-slate-300 truncate" title="${departamento}">${departamento}</span>
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

/**
 * ========================================================================
 * FUNÇÃO: renderDepartamentoStats
 * ========================================================================
 * Renderiza cards com estatísticas agregadas sobre a distribuição
 * de ocorrências por departamento.
 * 
 * PARÂMETROS:
 * - data: Array completo com todos os departamentos
 * 
 * MÉTRICAS EXIBIDAS:
 * - Total de ocorrências: Soma de todas as ocorrências
 * - Departamentos únicos: Quantidade de departamentos distintos
 * - Top 3 concentração: Percentual de ocorrências nos 3 principais departamentos
 * - Média por departamento: Média aritmética de ocorrências por departamento
 * ========================================================================
 */
function renderDepartamentoStats(data) {
  const statsEl = document.getElementById('zeladoria-departamento-stats');
  if (!statsEl) return;
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const top3 = data.slice(0, 3).reduce((sum, item) => sum + (item.count || 0), 0);
  const top3Percent = total > 0 ? ((top3 / total) * 100).toFixed(1) : 0;
  const uniqueDepts = data.length;
  const avgPerDept = uniqueDepts > 0 ? (total / uniqueDepts).toFixed(0) : 0;
  
  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Total de ocorrências registradas">
        <div class="text-xs text-slate-400 mb-1">Total de Ocorrências</div>
        <div class="text-2xl font-bold text-cyan-300">${total.toLocaleString('pt-BR')}</div>
        <div class="text-xs text-slate-500 mt-1">Todas as demandas</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Quantidade de departamentos distintos">
        <div class="text-xs text-slate-400 mb-1">Departamentos</div>
        <div class="text-2xl font-bold text-violet-300">${uniqueDepts}</div>
        <div class="text-xs text-slate-500 mt-1">Unidades responsáveis</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Percentual de ocorrências concentradas nos 3 principais departamentos">
        <div class="text-xs text-slate-400 mb-1">Top 3 Concentração</div>
        <div class="text-2xl font-bold text-emerald-300">${top3Percent}%</div>
        <div class="text-xs text-slate-500 mt-1">Foco prioritário</div>
      </div>
      <div class="glass rounded-lg p-4 hover:bg-white/5 transition-colors" title="Média aritmética de ocorrências por departamento">
        <div class="text-xs text-slate-400 mb-1">Média por Dept.</div>
        <div class="text-2xl font-bold text-amber-300">${avgPerDept}</div>
        <div class="text-xs text-slate-500 mt-1">Distribuição média</div>
      </div>
    </div>
  `;
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaDepartamentoKPIs(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return;
  }
  
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
  const unicos = data.length;
  const maisAtivo = data[0];
  const maisAtivoNome = maisAtivo ? (maisAtivo.key || maisAtivo._id || 'N/A') : '—';
  const media = unicos > 0 ? Math.round(total / unicos) : 0;
  
  const totalEl = document.getElementById('zeladoria-departamento-kpi-total');
  const unicosEl = document.getElementById('zeladoria-departamento-kpi-unicos');
  const maisAtivoEl = document.getElementById('zeladoria-departamento-kpi-mais-ativo');
  const mediaEl = document.getElementById('zeladoria-departamento-kpi-media');
  
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
  window.chartCommunication.createPageFilterListener('page-zeladoria-departamento', loadZeladoriaDepartamento, 500);
}

window.loadZeladoriaDepartamento = loadZeladoriaDepartamento;
