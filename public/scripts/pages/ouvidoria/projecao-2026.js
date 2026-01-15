/**
 * Página: Projeção 2026
 * Projeções e previsões para 2026 baseadas em análise de tendências históricas
 * 
 * Recriada com:
 * - Análise de tendência de crescimento real
 * - Cálculo de sazonalidade mensal
 * - Projeções mais precisas
 * - Múltiplos gráficos informativos
 * - KPIs detalhados
 */

async function loadProjecao2026() {
  // PRIORIDADE 1: Verificar dependências
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader', 'chartFactory'],
    () => {
      window.errorHandler?.showNotification('Sistemas não carregados. Recarregue a página.', 'warning');
      return null;
    }
  );
  
  if (!dependencies) return Promise.resolve();
  const { dataLoader, chartFactory } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('📈 loadProjecao2026: Iniciando');
  }
  
  const page = document.getElementById('page-projecao-2026');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.show('Carregando projeções para 2026...');
  
  return await window.errorHandler?.safeAsync(async () => {
    // Carregar todos os dados necessários em paralelo
    const [byMonthRaw, temasRaw, dashboardDataRaw] = await Promise.all([
      dataLoader.load('/api/aggregate/by-month', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [],
      dataLoader.load('/api/aggregate/by-theme', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || [],
      dataLoader.load('/api/dashboard-data', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }) || {}
    ]);
    
    // PRIORIDADE 1: Validar dados
    const byMonthValidation = window.dataValidator?.validateApiResponse(byMonthRaw, {
      arrayItem: { types: { ym: 'string', count: 'number' } }
    });
    const temasValidation = window.dataValidator?.validateApiResponse(temasRaw, {
      arrayItem: { types: { theme: 'string', count: 'number' } }
    });
    const dashboardValidation = window.dataValidator?.validateDataStructure(dashboardDataRaw, {
      types: { manifestationsByType: 'array', manifestationsByOrgan: 'array' }
    });
    
    const byMonth = byMonthValidation.valid ? byMonthValidation.data : [];
    const temas = temasValidation.valid ? temasValidation.data : [];
    const dashboardData = dashboardValidation.valid ? dashboardValidation.data : { manifestationsByType: [], manifestationsByOrgan: [] };
    
    // Extrair tipos e órgãos do dashboardData
    const tipos = dashboardData.manifestationsByType || [];
    const orgaos = dashboardData.manifestationsByOrgan || [];
    
    // Processar histórico mensal
    const historico = byMonth.map(x => {
      const ym = x.ym || x.month || '';
      if (!ym || typeof ym !== 'string') {
        return {
          label: ym || 'Data inválida',
          value: x.count || 0,
          ym: ym
        };
      }
      return {
        label: window.dateUtils?.formatMonthYear?.(ym) || ym,
        value: x.count || 0,
        ym: ym
      };
    }).sort((a, b) => a.ym.localeCompare(b.ym));
    
    // Calcular tendência de crescimento e sazonalidade
    const analise = calcularTendenciaESazonalidade(historico);
    
    // Gerar projeção para 2026 baseada em análise real
    const projecao2026 = gerarProjecao2026(analise, historico);
    
    // Renderizar todos os gráficos
    await Promise.all([
      renderProjecaoChart(historico, projecao2026),
      renderCrescimentoPercentual(historico, projecao2026),
      renderComparacaoAnual(historico, projecao2026),
      renderSazonalidade(analise.sazonalidade),
      renderProjecaoPorTema(temas, analise),
      renderProjecaoPorTipo(tipos, analise)
    ]);
    
    // Renderizar estatísticas e KPIs
    renderEstatisticas(historico, projecao2026, analise);
    renderProjecaoKPIs(analise, projecao2026);
    renderTopTemas(temas);
    renderTopTipos(tipos);
    renderTopOrgaos(orgaos);
    
    if (window.Logger) {
      window.Logger.success('📈 loadProjecao2026: Concluído');
    }
    
    // PRIORIDADE 2: Esconder loading
    window.loadingManager?.hide();
    
    return { success: true };
  }, 'loadProjecao2026', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hide();
      
      return { success: false };
    }
  });
}

/**
 * Calcular tendência de crescimento e sazonalidade
 */
function calcularTendenciaESazonalidade(historico) {
  if (!historico || historico.length === 0) {
    // Se não há dados, retornar objeto vazio com valores padrão
    return {
      taxaCrescimentoMensal: 0,
      mediaMensal: 0,
      sazonalidade: {},
      tendencia: 'estavel',
      variacaoPercentual: 0,
      mediaUltimos6Meses: 0,
      mediaPrimeiros6Meses: 0
    };
  }
  
  if (historico.length < 3) {
    // Se não há dados suficientes, usar média simples
    const media = historico.length > 0 
      ? historico.reduce((sum, h) => sum + (h.value || 0), 0) / historico.length 
      : 0;
    return {
      taxaCrescimentoMensal: 0,
      mediaMensal: media,
      sazonalidade: {},
      tendencia: 'estavel',
      variacaoPercentual: 0,
      mediaUltimos6Meses: media,
      mediaPrimeiros6Meses: media
    };
  }
  
  // Calcular taxa de crescimento mensal (regressão linear simples)
  let somaX = 0, somaY = 0, somaXY = 0, somaX2 = 0;
  historico.forEach((item, index) => {
    const x = index;
    const y = item.value;
    somaX += x;
    somaY += y;
    somaXY += x * y;
    somaX2 += x * x;
  });
  
  const n = historico.length;
  const taxaCrescimentoMensal = (n * somaXY - somaX * somaY) / (n * somaX2 - somaX * somaX);
  const mediaMensal = somaY / n;
  
  // Calcular sazonalidade (média por mês do ano)
  const sazonalidade = {};
  const mesesPorMes = {}; // { '01': [valores], '02': [valores], ... }
  
  historico.forEach(item => {
    const mes = item.ym ? item.ym.split('-')[1] : null;
    if (mes) {
      if (!mesesPorMes[mes]) mesesPorMes[mes] = [];
      mesesPorMes[mes].push(item.value);
    }
  });
  
  // Calcular média por mês
  Object.keys(mesesPorMes).forEach(mes => {
    const valores = mesesPorMes[mes];
    const media = valores.reduce((sum, v) => sum + v, 0) / valores.length;
    sazonalidade[mes] = mediaMensal > 0 ? (media / mediaMensal) : 1.0; // Fator de sazonalidade (1.0 = média, >1.0 = acima da média)
  });
  
  // Determinar tendência
  const ultimos6Meses = historico.slice(-6);
  const primeiros6Meses = historico.slice(0, 6);
  const mediaUltimos6 = ultimos6Meses.length > 0 
    ? ultimos6Meses.reduce((sum, h) => sum + (h.value || 0), 0) / ultimos6Meses.length 
    : 0;
  const mediaPrimeiros6 = primeiros6Meses.length > 0 
    ? primeiros6Meses.reduce((sum, h) => sum + (h.value || 0), 0) / primeiros6Meses.length 
    : 0;
  const variacao = mediaPrimeiros6 > 0 
    ? ((mediaUltimos6 - mediaPrimeiros6) / mediaPrimeiros6) * 100 
    : 0;
  
  let tendencia = 'estavel';
  if (variacao > 10) tendencia = 'crescimento';
  else if (variacao < -10) tendencia = 'declinio';
  
  return {
    taxaCrescimentoMensal,
    mediaMensal,
    sazonalidade,
    tendencia,
    variacaoPercentual: variacao,
    mediaUltimos6Meses: mediaUltimos6,
    mediaPrimeiros6Meses: mediaPrimeiros6
  };
}

/**
 * Gerar projeção para 2026 baseada em análise real
 */
function gerarProjecao2026(analise, historico) {
  const projecao2026 = [];
  
  // Validar parâmetros
  if (!analise || typeof analise !== 'object') {
    if (window.Logger) {
      window.Logger.warn('⚠️ gerarProjecao2026: analise inválida, usando valores padrão');
    }
    analise = {
      mediaMensal: 0,
      taxaCrescimentoMensal: 0,
      sazonalidade: {}
    };
  }
  
  if (!historico || !Array.isArray(historico)) {
    historico = [];
  }
  
  // Calcular valor base para projeção usando média mensal e tendência
  const mediaMensal = typeof analise.mediaMensal === 'number' ? analise.mediaMensal : 0;
  const taxaCrescimentoMensal = typeof analise.taxaCrescimentoMensal === 'number' ? analise.taxaCrescimentoMensal : 0;
  const sazonalidade = analise.sazonalidade || {};
  
  // Obter último mês histórico
  const ultimoMesHistorico = historico.length > 0 ? historico[historico.length - 1] : null;
  let ultimoAno = 2025;
  let ultimoMes = 12;
  
  if (ultimoMesHistorico && ultimoMesHistorico.ym) {
    const partes = ultimoMesHistorico.ym.split('-').map(Number);
    if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
      ultimoAno = partes[0];
      ultimoMes = partes[1];
    }
  }
  
  for (let mes = 1; mes <= 12; mes++) {
    const mesStr = String(mes).padStart(2, '0');
    const ym = `2026-${mesStr}`;
    
    // Calcular número de meses desde o último mês histórico
    const mesesDesdeUltimo = (2026 - ultimoAno) * 12 + (mes - ultimoMes);
    
    // Aplicar crescimento mensal acumulado
    const crescimentoAcumulado = taxaCrescimentoMensal * mesesDesdeUltimo;
    let valorBase = mediaMensal + crescimentoAcumulado;
    
    // Aplicar sazonalidade
    const fatorSazonalidade = sazonalidade[mesStr] || 1.0;
    const valorProjetado = Math.round(valorBase * fatorSazonalidade);
    
    // Garantir valor mínimo razoável (não menos que 50% da média, ou 1 se média for 0)
    const valorMinimo = mediaMensal > 0 ? Math.round(mediaMensal * 0.5) : 1;
    const valorFinal = Math.max(valorProjetado, valorMinimo);
    
    projecao2026.push({
      label: window.dateUtils?.formatMonthYear?.(ym) || `${mes}/2026`,
      value: valorFinal,
      ym: ym,
      mes: mes
    });
  }
  
  return projecao2026;
}

/**
 * Renderizar gráfico principal de projeção
 */
async function renderProjecaoChart(historico, projecao2026) {
  const todosLabels = [...historico.map(h => h.label), ...projecao2026.map(p => p.label)];
  const historicoValues = historico.map(h => h.value);
  const projecaoValues = projecao2026.map(p => p.value);
  
  // PADRONIZAÇÃO: Usar cores da paleta padronizada do sistema
  const config = window.config?.CHART_CONFIG || {};
  const primaryColor = config.COLORS?.PRIMARY || '#06b6d4';
  const secondaryColor = config.COLORS?.SECONDARY || '#8b5cf6';
  
  // Converter hex para rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const datasets = [
    {
      label: 'Histórico',
      data: [...historicoValues, ...Array(12).fill(null)],
      borderColor: primaryColor,
      backgroundColor: hexToRgba(primaryColor, 0.1),
      fill: true,
      tension: 0.4
    },
    {
      label: 'Projeção 2026',
      data: [...Array(historico.length).fill(null), ...projecaoValues],
      borderColor: secondaryColor,
      backgroundColor: hexToRgba(secondaryColor, 0.1),
      borderDash: [5, 5],
      fill: true,
      tension: 0.4
    }
  ];
  
  const chartProjecao = await window.chartFactory?.createLineChart('chartProjecaoMensal', todosLabels, datasets, {
    fill: true,
    tension: 0.4,
    onClick: true, // Habilitar interatividade para crossfilter
    legendContainer: 'legendProjecaoMensal',
    chartOptions: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR')} manifestações`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 45 } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        }
      }
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros (filtro por mês/período)
  if (chartProjecao && historico && window.addCrossfilterToChart) {
    window.addCrossfilterToChart(chartProjecao, historico, {
      field: 'month',
      valueField: 'ym',
      onFilterChange: () => {
        if (window.loadProjecao2026) setTimeout(() => window.loadProjecao2026(), 100);
      }
    });
  }
}

/**
 * Renderizar gráfico de crescimento percentual
 */
async function renderCrescimentoPercentual(historico, projecao2026) {
  // Calcular crescimento mês a mês
  const crescimento = [];
  
  // Histórico
  for (let i = 1; i < historico.length; i++) {
    const anterior = historico[i - 1].value;
    const atual = historico[i].value;
    const percentual = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
    crescimento.push({
      label: historico[i].label,
      value: percentual,
      tipo: 'historico'
    });
  }
  
  // Projeção
  const ultimoHistorico = historico[historico.length - 1];
  projecao2026.forEach((proj, index) => {
    const anterior = index === 0 ? ultimoHistorico.value : projecao2026[index - 1].value;
    const atual = proj.value;
    const percentual = anterior > 0 ? ((atual - anterior) / anterior) * 100 : 0;
    crescimento.push({
      label: proj.label,
      value: percentual,
      tipo: 'projecao'
    });
  });
  
  const labels = crescimento.map(c => c.label);
  const valores = crescimento.map(c => c.value);
  
  const chartCrescimento = await window.chartFactory?.createBarChart('chartCrescimentoPercentual', labels, valores, {
        colorIndex: 0,
        onClick: true, // Habilitar interatividade para crossfilter
        chartOptions: {
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const valor = context.parsed.y;
                  const sinal = valor >= 0 ? '+' : '';
                  return `${sinal}${valor.toFixed(1)}%`;
                }
              }
            }
          },
          scales: {
            y: {
              ticks: {
                callback: function(value) {
                  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
                }
              }
        }
      }
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros
  if (chartCrescimento && crescimento && window.addCrossfilterToChart) {
    window.addCrossfilterToChart(chartCrescimento, crescimento, {
      field: 'month',
      valueField: 'label',
      onFilterChange: () => {
        if (window.loadProjecao2026) setTimeout(() => window.loadProjecao2026(), 100);
      }
    });
  }
}

/**
 * Renderizar gráfico de comparação anual
 */
async function renderComparacaoAnual(historico, projecao2026) {
  // Agrupar por mês do ano (janeiro, fevereiro, etc.)
  const mesesAno = {};
  
  historico.forEach(item => {
    const mes = item.ym ? parseInt(item.ym.split('-')[1]) : null;
    if (mes) {
      if (!mesesAno[mes]) mesesAno[mes] = { historico: [], projecao: [] };
      mesesAno[mes].historico.push(item.value);
    }
  });
  
  projecao2026.forEach(item => {
    const mes = item.mes;
    if (mes) {
      if (!mesesAno[mes]) mesesAno[mes] = { historico: [], projecao: [] };
      mesesAno[mes].projecao.push(item.value);
    }
  });
  
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const labels = [];
  const valoresHistorico = [];
  const valoresProjecao = [];
  
  for (let mes = 1; mes <= 12; mes++) {
    labels.push(meses[mes - 1]);
    const dados = mesesAno[mes];
    if (dados && dados.historico.length > 0) {
      valoresHistorico.push(dados.historico.reduce((sum, v) => sum + v, 0) / dados.historico.length);
    } else {
      valoresHistorico.push(null);
    }
    if (dados && dados.projecao.length > 0) {
      valoresProjecao.push(dados.projecao[0]);
    } else {
      valoresProjecao.push(null);
    }
  }
  
  const datasets = [
    {
      label: 'Média Histórica',
      data: valoresHistorico,
      borderColor: '#22d3ee',
      backgroundColor: 'rgba(34,211,238,0.1)',
      fill: false
    },
    {
      label: 'Projeção 2026',
      data: valoresProjecao,
      borderColor: '#a78bfa',
      backgroundColor: 'rgba(167,139,250,0.1)',
      borderDash: [5, 5],
      fill: false
    }
  ];
  
  const chartComparacao = await window.chartFactory?.createLineChart('chartComparacaoAnual', labels, datasets, {
    fill: false,
    onClick: true, // Habilitar interatividade para crossfilter
    legendContainer: 'legendComparacaoAnual',
    chartOptions: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const valor = context.parsed.y;
              return valor !== null ? `${context.dataset.label}: ${Math.round(valor).toLocaleString('pt-BR')}` : 'Sem dados';
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
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros
  if (chartComparacao && historico && window.addCrossfilterToChart) {
    window.addCrossfilterToChart(chartComparacao, historico, {
      field: 'month',
      valueField: 'ym',
      onFilterChange: () => {
        if (window.loadProjecao2026) setTimeout(() => window.loadProjecao2026(), 100);
      }
    });
  }
}

/**
 * Renderizar gráfico de sazonalidade
 */
async function renderSazonalidade(sazonalidade) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const labels = [];
  const valores = [];
  
  for (let mes = 1; mes <= 12; mes++) {
    const mesStr = String(mes).padStart(2, '0');
    labels.push(meses[mes - 1]);
    valores.push((sazonalidade[mesStr] || 1.0) * 100); // Converter para percentual
  }
  
  const chartSazonalidade = await window.chartFactory?.createBarChart('chartSazonalidade', labels, valores, {
    colorIndex: 2,
    onClick: true, // Habilitar interatividade para crossfilter
    chartOptions: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const valor = context.parsed.y;
              const referencia = valor > 100 ? 'acima' : valor < 100 ? 'abaixo' : 'igual';
              return `${valor.toFixed(1)}% da média (${referencia})`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return `${value.toFixed(0)}%`;
            }
          }
        }
      }
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros
  if (chartSazonalidade && labels && window.addCrossfilterToChart) {
    const sazonalidadeData = labels.map((label, idx) => ({
      mes: label,
      valor: valores[idx]
    }));
    
    window.addCrossfilterToChart(chartSazonalidade, sazonalidadeData, {
      field: 'month',
      valueField: 'mes',
      onFilterChange: () => {
        if (window.loadProjecao2026) setTimeout(() => window.loadProjecao2026(), 100);
      }
    });
  }
}

/**
 * Renderizar projeção por tema
 */
async function renderProjecaoPorTema(temas, analise) {
  const topTemas = temas.slice(0, 20);
  const fatorCrescimento = 1 + (analise.taxaCrescimentoMensal / analise.mediaMensal);
  
  const labels = topTemas.map(t => t.theme || t.tema || t._id || 'N/A');
  const valoresAtuais = topTemas.map(t => t.count || 0);
  const valoresProjetados = valoresAtuais.map(v => Math.round(v * fatorCrescimento * 12)); // Projeção anual
  
  const datasets = [
    {
      label: 'Atual (último período)',
      data: valoresAtuais,
      backgroundColor: 'rgba(34,211,238,0.6)'
    },
    {
      label: 'Projeção 2026',
      data: valoresProjetados,
      backgroundColor: 'rgba(167,139,250,0.6)'
    }
  ];
  
  const chartTema = await window.chartFactory?.createBarChart('chartProjecaoTema', labels, valoresAtuais, {
    colorIndex: 0,
    onClick: true, // Habilitar interatividade para crossfilter
    field: 'tema',
    chartOptions: {
      indexAxis: 'y',
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const atual = context.parsed.x;
              const projetado = Math.round(atual * fatorCrescimento * 12);
              return `Atual: ${atual.toLocaleString('pt-BR')} | Projetado 2026: ${projetado.toLocaleString('pt-BR')}`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString('pt-BR');
            }
          }
        }
      }
    }
  });
  
  // CROSSFILTER: Adicionar sistema de filtros
  if (chartTema && temas && window.addCrossfilterToChart) {
    window.addCrossfilterToChart(chartTema, temas, {
      field: 'tema',
      valueField: 'theme',
      onFilterChange: () => {
        if (window.loadProjecao2026) setTimeout(() => window.loadProjecao2026(), 100);
      }
    });
  }
}

/**
 * Renderizar projeção por tipo
 */
async function renderProjecaoPorTipo(tipos, analise) {
  const topTipos = tipos.slice(0, 8);
  const fatorCrescimento = 1 + (analise.taxaCrescimentoMensal / analise.mediaMensal);
  
  const labels = topTipos.map(t => t.type || t.tipo || t._id || 'N/A');
  const valores = topTipos.map(t => {
    const atual = t.count || 0;
    return Math.round(atual * fatorCrescimento * 12); // Projeção anual
  });
  
  // PADRONIZAÇÃO: Usar campo 'tipoDeManifestacao' para cores padronizadas
  const chartTipo = await window.chartFactory?.createDoughnutChart('chartProjecaoTipo', labels, valores, {
    field: 'tipoDeManifestacao', // Especificar campo para usar cores padronizadas (Denúncia=vermelho, Reclamação=laranja, etc.)
    onClick: true, // Habilitar interatividade para crossfilter
    legendContainer: 'legendProjecaoTipo',
    chartOptions: {
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const valor = context.parsed;
              const percentual = ((valor / valores.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
              return `${context.label}: ${valor.toLocaleString('pt-BR')} (${percentual}%)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Renderizar estatísticas principais
 */
function renderEstatisticas(historico, projecao2026, analise) {
  const totalHistorico = historico.reduce((sum, item) => sum + item.value, 0);
  const totalProjetado = projecao2026.reduce((sum, item) => sum + item.value, 0);
  const mediaMensal = analise.mediaMensal;
  const crescimentoAnual = ((totalProjetado - totalHistorico) / totalHistorico) * 100;
  
  const totalHistoricoEl = document.getElementById('totalHistorico');
  const totalProjetadoEl = document.getElementById('totalProjetado');
  const mediaMensalEl = document.getElementById('mediaMensal');
  const crescimentoAnualEl = document.getElementById('crescimentoAnual');
  const tendenciaEl = document.getElementById('tendencia');
  
  if (totalHistoricoEl) totalHistoricoEl.textContent = totalHistorico.toLocaleString('pt-BR');
  if (totalProjetadoEl) totalProjetadoEl.textContent = totalProjetado.toLocaleString('pt-BR');
  if (mediaMensalEl) mediaMensalEl.textContent = Math.round(mediaMensal).toLocaleString('pt-BR');
  if (crescimentoAnualEl) {
    const sinal = crescimentoAnual >= 0 ? '+' : '';
    crescimentoAnualEl.textContent = `${sinal}${crescimentoAnual.toFixed(1)}%`;
    crescimentoAnualEl.className = crescimentoAnual >= 0 ? 'text-2xl font-bold text-emerald-300' : 'text-2xl font-bold text-rose-300';
  }
  if (tendenciaEl) {
    const icone = analise.tendencia === 'crescimento' ? '📈' : analise.tendencia === 'declinio' ? '📉' : '➡️';
    const texto = analise.tendencia === 'crescimento' ? 'Crescimento' : analise.tendencia === 'declinio' ? 'Declínio' : 'Estável';
    tendenciaEl.innerHTML = `${icone} ${texto}`;
  }
}

/**
 * Renderizar KPIs detalhados
 */
function renderProjecaoKPIs(analise, projecao2026) {
  const kpisContainer = document.getElementById('kpisProjecao');
  if (!kpisContainer) return;
  
  // Validar parâmetros
  if (!analise || typeof analise !== 'object') {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderProjecaoKPIs: analise inválida ou não fornecida');
    }
    kpisContainer.innerHTML = '<div class="text-slate-400 text-sm">Dados de análise não disponíveis</div>';
    return;
  }
  
  if (!projecao2026 || !Array.isArray(projecao2026) || projecao2026.length === 0) {
    if (window.Logger) {
      window.Logger.warn('⚠️ renderProjecaoKPIs: projecao2026 inválida ou vazia');
    }
    kpisContainer.innerHTML = '<div class="text-slate-400 text-sm">Dados de projeção não disponíveis</div>';
    return;
  }
  
  // Valores padrão para propriedades que podem estar ausentes
  const taxaCrescimentoMensal = typeof analise.taxaCrescimentoMensal === 'number' 
    ? analise.taxaCrescimentoMensal 
    : 0;
  const variacaoPercentual = typeof analise.variacaoPercentual === 'number' 
    ? analise.variacaoPercentual 
    : 0;
  
  const mesPico = projecao2026.reduce((max, item) => item.value > max.value ? item : max, projecao2026[0]);
  const mesBaixo = projecao2026.reduce((min, item) => item.value < min.value ? item : min, projecao2026[0]);
  
  kpisContainer.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-slate-800/50 rounded-lg p-4">
        <div class="text-slate-400 text-xs mb-1">Taxa de Crescimento Mensal</div>
        <div class="text-lg font-bold text-cyan-300">${taxaCrescimentoMensal.toFixed(1)}</div>
      </div>
      <div class="bg-slate-800/50 rounded-lg p-4">
        <div class="text-slate-400 text-xs mb-1">Variação (6 meses)</div>
        <div class="text-lg font-bold ${variacaoPercentual >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
          ${variacaoPercentual >= 0 ? '+' : ''}${variacaoPercentual.toFixed(1)}%
        </div>
      </div>
      <div class="bg-slate-800/50 rounded-lg p-4">
        <div class="text-slate-400 text-xs mb-1">Mês de Pico (2026)</div>
        <div class="text-lg font-bold text-violet-300">${mesPico?.label || 'N/A'}</div>
        <div class="text-xs text-slate-500">${(mesPico?.value || 0).toLocaleString('pt-BR')} manifestações</div>
      </div>
      <div class="bg-slate-800/50 rounded-lg p-4">
        <div class="text-slate-400 text-xs mb-1">Mês Mais Baixo (2026)</div>
        <div class="text-lg font-bold text-rose-300">${mesBaixo?.label || 'N/A'}</div>
        <div class="text-xs text-slate-500">${(mesBaixo?.value || 0).toLocaleString('pt-BR')} manifestações</div>
      </div>
    </div>
  `;
}

/**
 * Renderizar top temas
 */
function renderTopTemas(temas) {
  const topTemas = temas.slice(0, 20);
  const listaTemasEl = document.getElementById('listaTemasProjecao');
  if (!listaTemasEl) return;
  
  listaTemasEl.innerHTML = topTemas.map((item, idx) => {
    const tema = item.theme || item.tema || item._id || 'N/A';
    const quantidade = item.count || item.quantidade || 0;
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 text-sm text-slate-300 truncate">${tema}</div>
        <div class="text-lg font-bold text-violet-300 min-w-[80px] text-right">${quantidade.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar top tipos
 */
function renderTopTipos(tipos) {
  const topTipos = tipos.slice(0, 8);
  const listaTiposEl = document.getElementById('listaTiposProjecao');
  if (!listaTiposEl) return;
  
  listaTiposEl.innerHTML = topTipos.map((item, idx) => {
    const tipo = item.type || item.tipo || item._id || 'N/A';
    const quantidade = item.count || item.quantidade || 0;
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 text-sm text-slate-300 truncate">${tipo}</div>
        <div class="text-lg font-bold text-cyan-300 min-w-[80px] text-right">${quantidade.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

/**
 * Renderizar top órgãos
 */
function renderTopOrgaos(orgaos) {
  const topOrgaos = orgaos.slice(0, 8);
  const listaOrgaosEl = document.getElementById('listaOrgaosProjecao');
  if (!listaOrgaosEl) return;
  
  listaOrgaosEl.innerHTML = topOrgaos.map((item, idx) => {
    const orgao = item.organ || item.orgao || item._id || 'N/A';
    const quantidade = item.count || item.quantidade || 0;
    return `
      <div class="flex items-center gap-3 py-2 border-b border-white/5">
        <div class="text-sm text-slate-400 w-8">${idx + 1}º</div>
        <div class="flex-1 text-sm text-slate-300 truncate">${orgao}</div>
        <div class="text-lg font-bold text-emerald-300 min-w-[80px] text-right">${quantidade.toLocaleString('pt-BR')}</div>
      </div>
    `;
  }).join('');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-projecao-2026', loadProjecao2026, 500);
}

window.loadProjecao2026 = loadProjecao2026;
