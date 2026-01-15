/**
 * Chart Factory - Biblioteca de Geração de Gráficos Abstrata
 * Padroniza criação de gráficos usando configurações centralizadas
 */

// Função para escurecer cores hexadecimais (útil para modo claro)
function darkenHexColor(hex, amount = 0.3) {
  if (!hex || !hex.startsWith('#')) return hex;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

function getColorPalette() {
  const config = window.config?.CHART_CONFIG || {};
  const basePalette = config.COLOR_PALETTE || [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#fb7185', '#e879f9',
    '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
  ];

  // Se estiver no modo claro, escurecer as cores para melhor contraste
  if (isLightMode()) {
    return basePalette.map(color => darkenHexColor(color, 0.25));
  }

  return basePalette;
}

function getColorFromPalette(index, customPalette = null) {
  const palette = customPalette || getColorPalette();
  const color = palette[index % palette.length];

  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 1)`;
  }
  return color;
}

function getColorWithAlpha(color, alpha = null) {
  // Se alpha não foi especificado, usar padrão baseado no modo
  if (alpha === null) {
    alpha = isLightMode() ? 0.7 : 0.75; // Mais suave para modo escuro
  }

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
 * Detectar categoria baseada em field, canvasId ou labels
 * @param {string} field - Campo sendo visualizado
 * @param {string} canvasId - ID do canvas
 * @param {Array} labels - Labels do gráfico
 * @returns {string|null} - Categoria detectada ou null
 */
function detectCategory(field, canvasId, labels) {
  const fieldLower = (field || '').toLowerCase();
  const canvasLower = (canvasId || '').toLowerCase();

  // Verificar campo explicitamente
  if (fieldLower.includes('tipo') || fieldLower.includes('manifestacao')) {
    return 'tipo';
  }
  if (fieldLower.includes('status') || fieldLower.includes('situacao')) {
    return 'status';
  }
  if (fieldLower.includes('canal') || fieldLower.includes('origem')) {
    return 'canal';
  }
  if (fieldLower.includes('prioridade')) {
    return 'prioridade';
  }

  // Verificar canvasId
  if (canvasLower.includes('tipo') || canvasLower.includes('manifestacao')) {
    return 'tipo';
  }
  if (canvasLower.includes('status') || canvasLower.includes('situacao')) {
    return 'status';
  }
  if (canvasLower.includes('canal') || canvasLower.includes('origem')) {
    return 'canal';
  }
  if (canvasLower.includes('prioridade')) {
    return 'prioridade';
  }

  // Verificar labels se disponíveis
  if (labels && Array.isArray(labels) && labels.length > 0) {
    const firstLabels = labels.slice(0, 5).map(l => (l || '').toLowerCase());
    const labelsStr = firstLabels.join(' ');

    // Detectar tipo de manifestação
    if (labelsStr.includes('elogio') || labelsStr.includes('reclama') ||
      labelsStr.includes('denúncia') || labelsStr.includes('denuncia') ||
      labelsStr.includes('sugest')) {
      return 'tipo';
    }

    // Detectar status
    if (labelsStr.includes('aberto') || labelsStr.includes('fechado') ||
      labelsStr.includes('pendente') || labelsStr.includes('vencido') ||
      labelsStr.includes('concluído') || labelsStr.includes('concluido')) {
      return 'status';
    }

    // Detectar canal
    if (labelsStr.includes('site') || labelsStr.includes('email') ||
      labelsStr.includes('presencial') || labelsStr.includes('telefone') ||
      labelsStr.includes('whatsapp')) {
      return 'canal';
    }

    // Detectar prioridade
    if (labelsStr.includes('alta') || labelsStr.includes('média') ||
      labelsStr.includes('media') || labelsStr.includes('baixa') ||
      labelsStr.includes('urgente')) {
      return 'prioridade';
    }
  }

  return null;
}

/**
 * Renderizar legenda customizada para gráficos de pizza/doughnut
 * @param {Chart} chart - Instância do Chart.js
 * @param {string} containerId - ID do container HTML para a legenda
 * @param {Object} options - Opções de estilo (opcional)
 */
function renderCustomLegend(chart, containerId, options = {}) {
  const container = typeof containerId === 'string'
    ? document.getElementById(containerId)
    : containerId;

  if (!container) {
    if (window.Logger) {
      window.Logger.warn(`Container de legenda não encontrado: ${containerId}`);
    }
    return;
  }

  const data = chart.data;
  const labels = data.labels || [];
  const dataset = data.datasets[0] || {};
  const colors = dataset.backgroundColor || [];
  const values = dataset.data || [];

  // Calcular total para porcentagens
  const total = values.reduce((sum, val) => sum + (val || 0), 0);

  // Limpar container
  container.innerHTML = '';

  // Criar lista de legenda
  const ul = document.createElement('ul');
  ul.className = options.listClass || 'chart-legend-list';
  ul.style.cssText = `
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  `;

  labels.forEach((label, index) => {
    const li = document.createElement('li');
    li.className = options.itemClass || 'chart-legend-item';
    li.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 4px;
      transition: opacity 0.2s;
      font-size: 12px;
    `;

    // Cor do item
    const colorBox = document.createElement('span');
    colorBox.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 2px;
      background-color: ${colors[index] || '#ccc'};
      flex-shrink: 0;
    `;

    // Label
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    labelSpan.style.color = 'var(--text-primary, #fff)';

    // Valor/porcentagem
    const valueSpan = document.createElement('span');
    const percentage = total > 0 ? ((values[index] / total) * 100).toFixed(1) : 0;
    valueSpan.textContent = `(${percentage}%)`;
    valueSpan.style.cssText = 'color: var(--text-secondary, #999); font-size: 11px;';

    li.appendChild(colorBox);
    li.appendChild(labelSpan);
    if (options.showPercentage !== false) {
      li.appendChild(valueSpan);
    }

    // Interatividade: clicar para toggle visibilidade
    li.addEventListener('click', () => {
      const meta = chart.getDatasetMeta(0);
      if (meta && meta.data[index]) {
        meta.data[index].hidden = !meta.data[index].hidden;
        li.style.opacity = meta.data[index].hidden ? '0.5' : '1';
        chart.update();
      }
    });

    ul.appendChild(li);
  });

  container.appendChild(ul);
}

/**
 * Obter cor destacada (mais brilhante) para realce visual
 * @param {string} color - Cor original (hex, rgb, rgba)
 * @returns {string} Cor destacada
 */
function getHighlightedColor(color) {
  if (!color) return '#22d3ee';

  // Se for rgba, aumentar opacidade e brilho
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = Math.min(255, parseInt(match[1]) + 50);
      const g = Math.min(255, parseInt(match[2]) + 50);
      const b = Math.min(255, parseInt(match[3]) + 50);
      const a = match[4] ? Math.min(1, parseFloat(match[4]) + 0.2) : 1;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  // Se for hex, clarear
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const newR = Math.min(255, r + 50);
    const newG = Math.min(255, g + 50);
    const newB = Math.min(255, b + 50);
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  // Fallback: cor ciano brilhante
  return '#22d3ee';
}

/**
 * Adicionar realce visual ao elemento clicado no gráfico
 * @param {Chart} chart - Instância do Chart.js
 * @param {number} datasetIndex - Índice do dataset
 * @param {number} index - Índice do elemento
 */
function highlightChartElement(chart, datasetIndex, index) {
  if (!chart) return;

  // Salvar cores originais se ainda não foram salvas
  if (!chart._originalColors) {
    chart._originalColors = {};
    chart.data.datasets.forEach((dataset, dsIdx) => {
      if (!chart._originalColors[dsIdx]) {
        chart._originalColors[dsIdx] = [];
      }
      if (Array.isArray(dataset.backgroundColor)) {
        chart._originalColors[dsIdx] = [...dataset.backgroundColor];
      } else {
        chart._originalColors[dsIdx] = dataset.backgroundColor;
      }
    });
  }

  // Restaurar todas as cores primeiro
  chart.data.datasets.forEach((dataset, dsIdx) => {
    if (chart._originalColors[dsIdx]) {
      if (Array.isArray(chart._originalColors[dsIdx])) {
        dataset.backgroundColor = [...chart._originalColors[dsIdx]];
      } else {
        dataset.backgroundColor = chart._originalColors[dsIdx];
      }
    }
  });

  // Destacar elemento clicado
  const clickedDataset = chart.data.datasets[datasetIndex];
  if (Array.isArray(clickedDataset.backgroundColor)) {
    const originalColor = chart._originalColors[datasetIndex]?.[index] || clickedDataset.backgroundColor[index];
    clickedDataset.backgroundColor[index] = getHighlightedColor(originalColor);
  } else {
    clickedDataset.backgroundColor = getHighlightedColor(clickedDataset.backgroundColor);
  }

  // Atualizar com validações
  try {
    if (chart && chart.canvas && chart.canvas.parentNode && document.body.contains(chart.canvas) && !chart.destroyed && !chart._isDestroying) {
      chart.update('none'); // Atualizar sem animação
    }
  } catch (error) {
    // Ignorar erros de update
  }

  // Restaurar cor após 1 segundo
  if (chart._highlightTimeout) {
    clearTimeout(chart._highlightTimeout);
  }
  chart._highlightTimeout = setTimeout(() => {
    if (chart && chart._originalColors) {
      chart.data.datasets.forEach((dataset, dsIdx) => {
        if (chart._originalColors[dsIdx]) {
          if (Array.isArray(chart._originalColors[dsIdx])) {
            dataset.backgroundColor = [...chart._originalColors[dsIdx]];
          } else {
            dataset.backgroundColor = chart._originalColors[dsIdx];
          }
        }
      });
      // Atualizar com validações
      try {
        if (chart && chart.canvas && chart.canvas.parentNode && document.body.contains(chart.canvas) && !chart.destroyed && !chart._isDestroying) {
          chart.update('none');
        }
      } catch (error) {
        // Ignorar erros de update
      }
    }
  }, 1000);
}

/**
 * Configuração padrão de datalabels para gráficos de barra
 * Retorna labels brancos com sombreado cinza para melhor legibilidade
 * Ajusta automaticamente a posição para barras horizontais ou verticais
 */
function getStandardBarDataLabels(horizontal = false) {
  return {
    display: true,
    color: '#ffffff', // SEMPRE branco, nunca cinza
    font: {
      weight: 'bold',
      size: 12,
      family: 'Arial, sans-serif'
    },
    formatter: (value) => {
      // Mostrar apenas o número formatado
      return value.toLocaleString('pt-BR');
    },
    anchor: horizontal ? 'end' : 'end', // Para barras horizontais, mostrar na ponta; para verticais, no topo
    align: horizontal ? 'right' : 'top',  // Alinhamento: direita para horizontal, topo para vertical
    textStrokeColor: '#666666', // Sombreado cinza (não a cor do texto, apenas o contorno)
    textStrokeWidth: 2,
    padding: 4,
    clip: false
  };
}

/**
 * Configuração padrão de datalabels para gráficos doughnut/pie
 * Retorna labels brancos com sombreado cinza para melhor legibilidade
 */
function getStandardDoughnutDataLabels(minPercent = 3) {
  return {
    display: function (context) {
      // Exibir apenas se a fatia for maior que minPercent
      const value = context.parsed || context.dataset.data[context.dataIndex];
      const total = context.dataset.data.reduce((a, b) => a + b, 0);
      const percent = total > 0 ? (value / total) * 100 : 0;
      return percent >= minPercent;
    },
    color: '#ffffff', // SEMPRE branco, nunca cinza
    font: {
      weight: 'bold',
      size: 14,
      family: 'Arial, sans-serif'
    },
    formatter: (value) => {
      // Mostrar apenas o número formatado
      return value.toLocaleString('pt-BR');
    },
    anchor: 'center',
    align: 'center',
    textStrokeColor: '#666666', // Sombreado cinza (não a cor do texto, apenas o contorno)
    textStrokeWidth: 3,
    padding: 6,
    clip: false
  };
}

/**
 * Configuração padrão de datalabels para gráficos de linha
 * Retorna labels brancos com sombreado cinza para melhor legibilidade
 * Exibe apenas em pontos importantes (máximos, mínimos, início, fim)
 */
function getStandardLineDataLabels(showAll = false) {
  return {
    display: function (context) {
      if (showAll) return true; // Mostrar todos se solicitado

      const dataset = context.dataset;
      const dataIndex = context.dataIndex;
      const data = dataset.data;

      // Mostrar apenas em pontos importantes
      if (dataIndex === 0 || dataIndex === data.length - 1) {
        return true; // Sempre mostrar primeiro e último
      }

      // Mostrar em máximos e mínimos locais
      const currentValue = data[dataIndex];
      const prevValue = data[dataIndex - 1];
      const nextValue = data[dataIndex + 1];

      // Máximo local
      if (currentValue > prevValue && currentValue > nextValue) {
        return true;
      }

      // Mínimo local
      if (currentValue < prevValue && currentValue < nextValue) {
        return true;
      }

      return false;
    },
    color: '#ffffff', // SEMPRE branco, nunca cinza
    font: {
      weight: 'bold',
      size: 11,
      family: 'Arial, sans-serif'
    },
    formatter: (value) => {
      // Mostrar apenas o número formatado
      return value.toLocaleString('pt-BR');
    },
    anchor: 'end',
    align: 'top',
    offset: 5,
    textStrokeColor: '#666666', // Sombreado cinza (não a cor do texto, apenas o contorno)
    textStrokeWidth: 2,
    padding: 3,
    clip: false
  };
}

function getChartDefaults(chartType) {
  const config = window.config?.CHART_CONFIG || {};
  const lightMode = isLightMode();

  // Cores adaptáveis ao tema
  const textColor = lightMode ? '#1e293b' : '#94a3b8';
  const gridColor = lightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
  const tooltipBg = lightMode ? 'rgba(255, 255, 255, 0.98)' : 'rgba(15, 23, 42, 0.95)';
  const tooltipTitleColor = lightMode ? '#0f172a' : '#e2e8f0';
  const tooltipBodyColor = lightMode ? '#1e293b' : '#cbd5e1';

  const defaults = {
    responsive: true,
    maintainAspectRatio: true,
    animation: config.PERFORMANCE?.ANIMATION_DURATION === 0 ? false : true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: config.TOOLTIP?.BACKGROUND || tooltipBg,
        titleColor: config.TOOLTIP?.TITLE_COLOR || tooltipTitleColor,
        bodyColor: config.TOOLTIP?.BODY_COLOR || tooltipBodyColor,
        borderColor: config.TOOLTIP?.BORDER_COLOR || 'rgba(34, 211, 238, 0.3)',
        borderWidth: config.TOOLTIP?.BORDER_WIDTH || 1,
        padding: config.TOOLTIP?.PADDING || 12
      }
    }
  };

  switch (chartType) {
    case 'bar':
      return {
        ...defaults,
        scales: {
          x: {
            ticks: { color: textColor },
            beginAtZero: true,
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      };

    case 'bar-horizontal':
      return {
        ...defaults,
        indexAxis: 'y',
        scales: {
          x: {
            ticks: { color: textColor },
            beginAtZero: true,
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          }
        }
      };

    case 'line':
      return {
        ...defaults,
        scales: {
          x: {
            ticks: { color: textColor },
            grid: { color: gridColor }
          },
          y: {
            ticks: { color: textColor },
            beginAtZero: true,
            grid: { color: gridColor }
          }
        }
      };

    case 'doughnut':
    case 'pie':
      return {
        ...defaults,
        plugins: {
          ...defaults.plugins,
          legend: { display: false }
        }
      };

    default:
      return defaults;
  }
}

async function ensureChartJS() {
  if (window.Chart) {
    // Verificar se o plugin datalabels está carregado e registrá-lo
    registerDataLabelsPlugin();
    return Promise.resolve();
  }

  if (window.lazyLibraries?.loadChartJS) {
    const result = await window.lazyLibraries.loadChartJS();
    registerDataLabelsPlugin();
    return result;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    script.onload = () => {
      const pluginScript = document.createElement('script');
      pluginScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2/dist/chartjs-plugin-datalabels.min.js';
      pluginScript.onload = () => {
        registerDataLabelsPlugin();
        resolve();
      };
      pluginScript.onerror = () => {
        if (window.Logger) {
          window.Logger.warn('Erro ao carregar chartjs-plugin-datalabels');
        }
        resolve();
      };
      document.head.appendChild(pluginScript);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Registrar o plugin datalabels no Chart.js
 */
function registerDataLabelsPlugin() {
  if (!window.Chart || !window.Chart.register) {
    return;
  }

  // O plugin chartjs-plugin-datalabels v2 se auto-registra quando carregado
  // Mas podemos tentar registrar explicitamente se necessário
  try {
    // Verificar se o plugin já está registrado
    const registry = window.Chart.registry;
    if (registry) {
      const plugins = registry.getAll ? registry.getAll() : [];
      const hasDataLabels = plugins.some(p =>
        (p.id && p.id.includes('datalabel')) ||
        (p.id === 'datalabels')
      );

      if (hasDataLabels) {
        // Plugin já está registrado
        return;
      }
    }

    // Tentar registrar o plugin se disponível globalmente
    // O plugin v2 expõe ChartDataLabels globalmente quando carregado
    if (typeof ChartDataLabels !== 'undefined') {
      window.Chart.register(ChartDataLabels);
    } else if (window.ChartDataLabels) {
      window.Chart.register(window.ChartDataLabels);
    }
  } catch (e) {
    // Plugin já registrado ou não disponível (ignorar)
    if (window.Logger) {
      window.Logger.debug('Plugin datalabels:', e.message || 'já registrado ou não disponível');
    }
  }
}

async function createBarChart(canvasId, labels, values, options = {}) {
  try {
    await ensureChartJS();

    // VALIDAÇÃO ROBUSTA: Verificar se o canvas existe antes de qualquer operação
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não encontrado`);
      }
      return null;
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não está no DOM`);
      }
      return null;
    }

    // VALIDAÇÃO: Verificar se o canvas tem contexto válido
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
      if (!ctx) {
        if (window.Logger) {
          window.Logger.warn(`Não foi possível obter contexto 2D do canvas ${canvasId}`);
        }
        return null;
      }
    } catch (error) {
      if (window.Logger) {
        window.Logger.warn(`Erro ao obter contexto do canvas ${canvasId}:`, error);
      }
      return null;
    }

    // Destruir gráfico existente se houver
    if (window.Chart && window[canvasId] instanceof window.Chart) {
      try {
        window[canvasId]._isDestroying = true;
        window[canvasId].destroy();
      } catch (error) {
        // Ignorar erros ao destruir gráfico antigo
      }
      window[canvasId] = null;
    }

    // PRIORIDADE 3: Otimização de performance - Limitar pontos
    const maxPoints = options.maxPoints || window.config?.CHART_CONFIG?.PERFORMANCE?.MAX_POINTS || 100;
    if (labels && labels.length > maxPoints) {
      if (window.Logger) {
        window.Logger.debug(`⚠️ Gráfico ${canvasId}: Limitando ${labels.length} pontos para ${maxPoints} para melhor performance`);
      }
      labels = labels.slice(0, maxPoints);
      if (Array.isArray(values) && values.length > 0) {
        if (Array.isArray(values[0])) {
          values = values.map(v => v.slice(0, maxPoints));
        } else {
          values = values.slice(0, maxPoints);
        }
      }
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM antes de continuar
    // (ctx já foi obtido anteriormente nas linhas 569-583)
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas não está no DOM, pulando criação de gráfico`);
      }
      return null;
    }

    // Verificar se ctx ainda é válido (já foi obtido anteriormente)
    if (!ctx) {
      if (window.Logger) {
        window.Logger.warn(`Contexto do canvas não está disponível`);
      }
      return null;
    }

    const defaults = getChartDefaults(options.horizontal ? 'bar-horizontal' : 'bar');
    const palette = getColorPalette();

    let datasets = [];

    if (Array.isArray(values) && values.length > 0) {
      if (typeof values[0] === 'object' && !Array.isArray(values[0]) && ('data' in values[0] || 'label' in values[0])) {
        // Detectar categoria para datasets múltiplos (ex: gráfico de status mensal)
        const category = detectCategory(options.field, canvasId, values.map(d => d.label));

        datasets = values.map((dataset, idx) => {
          const label = dataset.label || `Dataset ${idx + 1}`;

          // Se detectou categoria, usar cor consistente baseada no label
          let backgroundColor, borderColor;
          if (category && window.config?.getColorByCategory) {
            const color = window.config.getColorByCategory(category, label);
            backgroundColor = color ? getColorWithAlpha(color, 0.75) : getColorWithAlpha(getColorFromPalette(idx, palette), 0.7);
            borderColor = color || getColorFromPalette(idx, palette);
          } else {
            backgroundColor = dataset.backgroundColor || getColorWithAlpha(getColorFromPalette(idx, palette), 0.7);
            borderColor = dataset.borderColor || getColorFromPalette(idx, palette);
          }

          return {
            label: label,
            data: dataset.data || [],
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            borderWidth: dataset.borderWidth || options.borderWidth || 1
          };
        });
      } else if (Array.isArray(values[0]) && typeof values[0][0] === 'number') {
        datasets = values.map((data, idx) => ({
          label: options.labels?.[idx] || `Dataset ${idx + 1}`,
          data: data,
          backgroundColor: getColorWithAlpha(getColorFromPalette(idx, palette), 0.7),
          borderColor: getColorFromPalette(idx, palette),
          borderWidth: options.borderWidth || 1
        }));
      } else {
        // Detectar categoria automaticamente
        const category = detectCategory(options.field, canvasId, labels);

        let backgroundColor, borderColor;

        // Se detectou uma categoria, usar cores consistentes para ela
        if (category && window.config?.getColorByCategory) {
          backgroundColor = labels.map((label) => {
            const color = window.config.getColorByCategory(category, label);
            // Usar cores mais suaves para fundo escuro (alpha 0.75)
            return color ? getColorWithAlpha(color, 0.75) : getColorWithAlpha(getColorFromPalette(0, palette), 0.7);
          });
          borderColor = labels.map((label) => {
            const color = window.config.getColorByCategory(category, label);
            return color || getColorFromPalette(0, palette);
          });
        }
        // Fallback para tipo de manifestação (compatibilidade)
        else if (category === 'tipo' && window.config?.getColorByTipoManifestacao) {
          backgroundColor = labels.map((label) => {
            const color = window.config.getColorByTipoManifestacao(label);
            return color ? getColorWithAlpha(color, 0.75) : getColorWithAlpha(getColorFromPalette(0, palette), 0.7);
          });
          borderColor = labels.map((label) => {
            const color = window.config.getColorByTipoManifestacao(label);
            return color || getColorFromPalette(0, palette);
          });
        }
        // Se cores customizadas foram fornecidas, usar elas
        else if (options.backgroundColor && Array.isArray(options.backgroundColor)) {
          backgroundColor = options.backgroundColor;
          borderColor = options.borderColor || options.backgroundColor;
        }
        // Caso padrão: usar cor única da paleta
        else {
          const colorIndex = options.colorIndex !== undefined ? options.colorIndex : 0;
          const baseColor = options.backgroundColor
            ? (options.backgroundColor.startsWith('#') ? options.backgroundColor : getColorFromPalette(colorIndex, palette))
            : getColorFromPalette(colorIndex, palette);

          // Cores mais suaves para fundo escuro
          backgroundColor = options.backgroundColor || getColorWithAlpha(baseColor, 0.75);
          borderColor = options.borderColor || baseColor;
        }

        datasets = [{
          label: options.label || 'Dados',
          data: values,
          backgroundColor: Array.isArray(backgroundColor) ? backgroundColor : backgroundColor,
          borderColor: Array.isArray(borderColor) ? borderColor : borderColor,
          borderWidth: options.borderWidth || 1
        }];
      }
    }

    // Adicionar datalabels padrão se não foram especificados
    // Permite sobrescrever com options.chartOptions.plugins.datalabels ou desabilitar com options.disableDataLabels
    const pluginsConfig = {
      ...defaults.plugins,
      ...(options.chartOptions?.plugins || {})
    };

    if (!pluginsConfig.datalabels && !options.disableDataLabels) {
      pluginsConfig.datalabels = getStandardBarDataLabels(options.horizontal);
    }

    const config = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        ...defaults,
        ...options.chartOptions,
        plugins: pluginsConfig
      }
    };

    if (options.horizontal) {
      config.options.indexAxis = options.chartOptions?.indexAxis || 'y';
    }

    // Garantir que o plugin datalabels está registrado
    registerDataLabelsPlugin();

    const chart = new Chart(ctx, config);
    window[canvasId] = chart;

    // GARANTIR que os datalabels estão sempre brancos com sombreado cinza (gráficos de barra)
    if (chart && chart.options && chart.options.plugins && chart.options.plugins.datalabels) {
      chart.options.plugins.datalabels.color = '#ffffff'; // Forçar branco sempre
      if (!chart.options.plugins.datalabels.textStrokeColor || chart.options.plugins.datalabels.textStrokeColor === '#000000') {
        chart.options.plugins.datalabels.textStrokeColor = '#666666'; // Sombreado cinza
      }
      // Forçar atualização para aplicar as cores - com verificações robustas
      setTimeout(() => {
        try {
          // Verificar se o chart ainda existe e não foi destruído
          if (!chart || chart.destroyed || chart._isDestroying) {
            return;
          }

          // Verificar se o canvas ainda existe no DOM
          const canvas = chart.canvas;
          if (!canvas) {
            return;
          }

          // Verificar se o canvas ainda está no DOM
          if (!canvas.parentNode || !document.body.contains(canvas)) {
            if (window.Logger) {
              window.Logger.debug('⚠️ Chart canvas não encontrado no DOM, pulando update');
            }
            return;
          }

          // Verificar se o chart ainda tem contexto válido
          if (!chart.ctx) {
            if (window.Logger) {
              window.Logger.debug('⚠️ Chart context não encontrado, pulando update');
            }
            return;
          }

          // Verificar se o chart ainda está registrado no Chart.js
          try {
            if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
              const registeredChart = window.Chart.getChart(canvas);
              if (!registeredChart || registeredChart !== chart) {
                // Chart não está mais registrado ou foi substituído
                return;
              }
            }
          } catch (e) {
            // Ignorar erros de verificação
          }

          // Atualizar apenas se tudo estiver válido
          chart.update('none');
        } catch (error) {
          // Ignorar erros de update se o chart foi destruído ou canvas removido
          const errorMsg = error?.message || '';
          if (errorMsg.includes('destroyed') ||
            errorMsg.includes('ownerDocument') ||
            errorMsg.includes('null')) {
            // Erro esperado quando chart foi destruído - ignorar silenciosamente
            return;
          }
          if (window.Logger) {
            window.Logger.warn('⚠️ Erro ao atualizar chart:', error.message);
          }
        }
      }, 100);
    }

    // REFATORAÇÃO FASE 5: Integração chartLegend × chartFactory
    // Criar legenda interativa se solicitado
    if (options.createLegend && options.legendContainer) {
      if (datasets.length > 1 && window.chartLegend && window.chartLegend.createInteractiveLegend) {
        window.chartLegend.createInteractiveLegend(canvasId, options.legendContainer, datasets, options);
      }
    } else if (datasets.length > 1 && options.legendContainer) {
      // Compatibilidade: manter comportamento antigo se legendContainer estiver presente
      if (window.chartLegend && window.chartLegend.createInteractiveLegend) {
        window.chartLegend.createInteractiveLegend(canvasId, options.legendContainer, datasets, options);
      }
    }

    // Registrar gráfico no sistema de comunicação
    if (window.chartCommunication) {
      const fieldMapping = window.chartCommunication.getFieldMapping(canvasId);
      window.chartCommunication.registerChart(canvasId, {
        type: 'bar',
        field: fieldMapping?.field || null,
        operator: fieldMapping?.op || null,
        horizontal: options.horizontal || false
      });
    }


    return chart;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error(`Erro ao criar gráfico de barras ${canvasId}:`, error);
    }
    return null;
  }
}

async function createLineChart(canvasId, labels, values, options = {}) {
  try {
    await ensureChartJS();

    // VALIDAÇÃO ROBUSTA: Verificar se o canvas existe antes de qualquer operação
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não encontrado`);
      }
      return null;
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não está no DOM`);
      }
      return null;
    }

    // Destruir gráfico existente se houver
    if (window.Chart && window[canvasId] instanceof window.Chart) {
      try {
        window[canvasId]._isDestroying = true;
        window[canvasId].destroy();
      } catch (error) {
        // Ignorar erros ao destruir gráfico antigo
      }
      window[canvasId] = null;
    }

    // PRIORIDADE 3: Otimização de performance - Limitar pontos
    const maxPoints = options.maxPoints || window.config?.CHART_CONFIG?.PERFORMANCE?.MAX_POINTS || 100;
    if (labels && labels.length > maxPoints) {
      if (window.Logger) {
        window.Logger.debug(`⚠️ Gráfico ${canvasId}: Limitando ${labels.length} pontos para ${maxPoints} para melhor performance`);
      }
      labels = labels.slice(0, maxPoints);
      if (Array.isArray(values) && values.length > 0) {
        if (Array.isArray(values[0])) {
          values = values.map(v => v.slice(0, maxPoints));
        } else {
          values = values.slice(0, maxPoints);
        }
      }
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM antes de obter contexto
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas não está no DOM, pulando criação de gráfico`);
      }
      return null;
    }

    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
      if (!ctx) {
        if (window.Logger) {
          window.Logger.warn(`Não foi possível obter contexto 2D do canvas`);
        }
        return null;
      }
    } catch (error) {
      if (window.Logger) {
        window.Logger.warn(`Erro ao obter contexto do canvas:`, error);
      }
      return null;
    }
    const defaults = getChartDefaults('line');
    const palette = getColorPalette();

    let datasets = [];

    if (Array.isArray(values) && values.length > 0) {
      if (typeof values[0] === 'object' && !Array.isArray(values[0]) && ('data' in values[0] || 'label' in values[0])) {
        datasets = values.map((dataset, idx) => ({
          label: dataset.label || `Dataset ${idx + 1}`,
          data: dataset.data || [],
          borderColor: dataset.borderColor || getColorFromPalette(idx, palette),
          backgroundColor: dataset.backgroundColor || getColorWithAlpha(getColorFromPalette(idx, palette), 0.1),
          borderWidth: dataset.borderWidth || options.borderWidth || 2,
          fill: dataset.fill !== undefined ? dataset.fill : options.fill || false,
          tension: dataset.tension !== undefined ? dataset.tension : options.tension || 0.4
        }));
      } else if (Array.isArray(values[0]) && typeof values[0][0] === 'number') {
        datasets = values.map((data, idx) => ({
          label: options.labels?.[idx] || `Dataset ${idx + 1}`,
          data: data,
          borderColor: getColorFromPalette(idx, palette),
          backgroundColor: getColorWithAlpha(getColorFromPalette(idx, palette), 0.1),
          borderWidth: options.borderWidth || 2,
          fill: options.fill || false,
          tension: options.tension || 0.4
        }));
      } else {
        const colorIndex = options.colorIndex !== undefined ? options.colorIndex : 0;
        const baseColor = options.borderColor || getColorFromPalette(colorIndex, palette);

        datasets = [{
          label: options.label || 'Dados',
          data: values,
          borderColor: baseColor,
          backgroundColor: options.backgroundColor || getColorWithAlpha(baseColor, 0.1),
          borderWidth: options.borderWidth || 2,
          fill: options.fill || false,
          tension: options.tension || 0.4
        }];
      }
    }

    // Adicionar datalabels padrão se não foram especificados
    const pluginsConfig = {
      ...defaults.plugins,
      ...(options.chartOptions?.plugins || {})
    };

    if (!pluginsConfig.datalabels && !options.disableDataLabels) {
      pluginsConfig.datalabels = getStandardLineDataLabels(options.showAllLabels || false);
    }

    const config = {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        ...defaults,
        ...options.chartOptions,
        plugins: pluginsConfig
      }
    };

    // Garantir que o plugin datalabels está registrado
    registerDataLabelsPlugin();

    const chart = new Chart(ctx, config);
    window[canvasId] = chart;

    // GARANTIR que os datalabels estão sempre brancos com sombreado cinza (gráficos de linha)
    if (chart && chart.options && chart.options.plugins && chart.options.plugins.datalabels) {
      chart.options.plugins.datalabels.color = '#ffffff'; // Forçar branco sempre
      if (!chart.options.plugins.datalabels.textStrokeColor || chart.options.plugins.datalabels.textStrokeColor === '#000000') {
        chart.options.plugins.datalabels.textStrokeColor = '#666666'; // Sombreado cinza
      }
      // Forçar atualização para aplicar as cores - com verificações robustas
      setTimeout(() => {
        try {
          // Verificar se o chart ainda existe e não foi destruído
          if (!chart || chart.destroyed || chart._isDestroying) {
            return;
          }

          // Verificar se o canvas ainda existe no DOM
          const canvas = chart.canvas;
          if (!canvas) {
            return;
          }

          // Verificar se o canvas ainda está no DOM
          if (!canvas.parentNode || !document.body.contains(canvas)) {
            return;
          }

          // Verificar se o chart ainda tem contexto válido
          if (!chart.ctx) {
            return;
          }

          // Verificar se o chart ainda está registrado no Chart.js
          try {
            if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
              const registeredChart = window.Chart.getChart(canvas);
              if (!registeredChart || registeredChart !== chart) {
                return;
              }
            }
          } catch (e) {
            // Ignorar erros de verificação
          }

          // Atualizar apenas se tudo estiver válido
          chart.update('none');
        } catch (error) {
          // Ignorar erros de update se o chart foi destruído ou canvas removido
          const errorMsg = error?.message || '';
          if (errorMsg.includes('destroyed') ||
            errorMsg.includes('ownerDocument') ||
            errorMsg.includes('null')) {
            return;
          }
        }
      }, 100);
    }

    // REFATORAÇÃO FASE 5: Integração chartLegend × chartFactory
    // Criar legenda interativa se solicitado
    if (options.createLegend && options.legendContainer) {
      if (datasets.length > 1 && window.chartLegend && window.chartLegend.createInteractiveLegend) {
        window.chartLegend.createInteractiveLegend(canvasId, options.legendContainer, datasets, options);
      }
    } else if (datasets.length > 1 && options.legendContainer) {
      // Compatibilidade: manter comportamento antigo se legendContainer estiver presente
      if (window.chartLegend && window.chartLegend.createInteractiveLegend) {
        window.chartLegend.createInteractiveLegend(canvasId, options.legendContainer, datasets, options);
      }
    }

    // Registrar gráfico no sistema de comunicação
    if (window.chartCommunication) {
      const fieldMapping = window.chartCommunication.getFieldMapping(canvasId);
      window.chartCommunication.registerChart(canvasId, {
        type: 'line',
        field: fieldMapping?.field || null,
        operator: fieldMapping?.op || null
      });
    }


    return chart;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error(`Erro ao criar gráfico de linha ${canvasId}:`, error);
    }
    return null;
  }
}

async function createDoughnutChart(canvasId, labels, values, options = {}) {
  try {
    await ensureChartJS();

    // VALIDAÇÃO ROBUSTA: Verificar se o canvas existe antes de qualquer operação
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não encontrado`);
      }
      return null;
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas ${canvasId} não está no DOM`);
      }
      return null;
    }

    // Destruir gráfico existente se houver
    if (window[canvasId] instanceof Chart) {
      try {
        window[canvasId]._isDestroying = true;
        window[canvasId].destroy();
      } catch (error) {
        // Ignorar erros ao destruir gráfico antigo
      }
      window[canvasId] = null;
    }

    // VALIDAÇÃO: Verificar se o canvas ainda está no DOM antes de obter contexto
    if (!canvas.parentNode || !document.body.contains(canvas)) {
      if (window.Logger) {
        window.Logger.warn(`Canvas não está no DOM, pulando criação de gráfico`);
      }
      return null;
    }

    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
      if (!ctx) {
        if (window.Logger) {
          window.Logger.warn(`Não foi possível obter contexto 2D do canvas`);
        }
        return null;
      }
    } catch (error) {
      if (window.Logger) {
        window.Logger.warn(`Erro ao obter contexto do canvas:`, error);
      }
      return null;
    }
    const defaults = getChartDefaults('doughnut');
    const palette = getColorPalette();

    // Detectar categoria automaticamente para cores consistentes
    const category = detectCategory(options.field, canvasId, labels);

    let backgroundColor, borderColor;

    // Se detectou uma categoria, usar cores consistentes para ela
    if (category && window.config?.getColorByCategory) {
      backgroundColor = labels.map((label) => {
        const color = window.config.getColorByCategory(category, label);
        // Cores mais suaves para doughnut (alpha 0.85 para melhor visibilidade)
        return color ? getColorWithAlpha(color, 0.85) : getColorWithAlpha(getColorFromPalette(labels.indexOf(label), palette), 0.85);
      });
      borderColor = labels.map((label) => {
        const color = window.config.getColorByCategory(category, label);
        return color || getColorFromPalette(labels.indexOf(label), palette);
      });
    }
    // Fallback para tipo de manifestação (compatibilidade)
    else if (category === 'tipo' && window.config?.getColorByTipoManifestacao) {
      backgroundColor = labels.map((label) => {
        const color = window.config.getColorByTipoManifestacao(label);
        return color ? getColorWithAlpha(color, 0.85) : getColorWithAlpha(getColorFromPalette(labels.indexOf(label), palette), 0.85);
      });
      borderColor = labels.map((label) => {
        const color = window.config.getColorByTipoManifestacao(label);
        return color || getColorFromPalette(labels.indexOf(label), palette);
      });
    }
    // Se cores customizadas foram fornecidas, usar elas
    else if (options.backgroundColor && Array.isArray(options.backgroundColor)) {
      backgroundColor = options.backgroundColor;
      borderColor = options.borderColor || options.backgroundColor;
    }
    // Caso padrão: usar paleta padrão com cores suaves
    else {
      backgroundColor = Array.isArray(values) && values.length > 0
        ? values.map((_, idx) => getColorWithAlpha(getColorFromPalette(idx, palette), 0.85))
        : [getColorWithAlpha(getColorFromPalette(0, palette), 0.85)];

      borderColor = Array.isArray(values) && values.length > 0
        ? values.map((_, idx) => getColorFromPalette(idx, palette))
        : [getColorFromPalette(0, palette)];
    }

    // Garantir que a legenda padrão do Chart.js sempre esteja desabilitada
    // (usamos legenda customizada abaixo do gráfico quando legendContainer é fornecido)
    // Adicionar datalabels padrão se não foram fornecidos nas opções
    const pluginsConfig = {
      ...defaults.plugins,
      ...(options.chartOptions?.plugins || {}),
      // SEMPRE desabilitar legenda padrão do Chart.js
      // A legenda customizada será renderizada abaixo se legendContainer for fornecido
      legend: {
        display: false
      }
    };

    // Adicionar datalabels padrão se não foram especificados
    // Permite sobrescrever com options.chartOptions.plugins.datalabels
    if (!pluginsConfig.datalabels && !options.disableDataLabels) {
      pluginsConfig.datalabels = getStandardDoughnutDataLabels(3);
    }

    const finalOptions = {
      ...defaults,
      ...options.chartOptions,
      plugins: pluginsConfig
    };

    // Garantir que o plugin datalabels está registrado
    registerDataLabelsPlugin();

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels || [],
        datasets: [{
          data: values || [],
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: options.borderWidth || 1,
          hoverOffset: 12,
          hoverBorderWidth: 2,
          hoverBorderColor: isLightMode() ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.4)',
          borderRadius: options.borderRadius || 4,
          spacing: options.spacing || 3,
          offset: options.offset || 0
        }]
      },
      options: finalOptions
    });

    window[canvasId] = chart;

    // Renderizar legenda customizada se container for fornecido
    if (options.legendContainer) {
      renderCustomLegend(chart, options.legendContainer, options.legendOptions);
    }

    // GARANTIR que a legenda padrão do Chart.js esteja desabilitada
    // (mesmo que tenha sido habilitada por algum motivo)
    if (chart.options && chart.options.plugins) {
      chart.options.plugins.legend = { display: false };

      // GARANTIR que os datalabels estão sempre brancos com sombreado cinza (gráficos doughnut/pie)
      if (chart.options.plugins.datalabels) {
        chart.options.plugins.datalabels.color = '#ffffff'; // Forçar branco sempre
        if (!chart.options.plugins.datalabels.textStrokeColor || chart.options.plugins.datalabels.textStrokeColor === '#000000') {
          chart.options.plugins.datalabels.textStrokeColor = '#666666'; // Sombreado cinza
        }
      }

      // Atualizar com validações robustas
      try {
        if (chart && chart.canvas && chart.canvas.parentNode && document.body.contains(chart.canvas) && !chart.destroyed && !chart._isDestroying) {
          chart.update('none'); // Atualizar sem animação para aplicar imediatamente
        }
      } catch (error) {
        // Ignorar erros de update
      }
    }

    // Forçar atualização adicional para garantir que os datalabels sejam renderizados corretamente
    if (chart && chart.options && chart.options.plugins && chart.options.plugins.datalabels) {
      setTimeout(() => {
        try {
          // Verificar se o chart ainda existe e não foi destruído
          if (!chart || chart.destroyed || chart._isDestroying) {
            return;
          }

          // Verificar se o canvas ainda existe no DOM
          const canvas = chart.canvas;
          if (!canvas) {
            return;
          }

          // Verificar se o canvas ainda está no DOM
          if (!canvas.parentNode || !document.body.contains(canvas)) {
            return;
          }

          // Verificar se o chart ainda tem contexto válido
          if (!chart.ctx) {
            return;
          }

          // Verificar se o chart ainda está registrado no Chart.js
          try {
            if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
              const registeredChart = window.Chart.getChart(canvas);
              if (!registeredChart || registeredChart !== chart) {
                return;
              }
            }
          } catch (e) {
            // Ignorar erros de verificação
          }

          // Atualizar apenas se tudo estiver válido
          if (chart.options && chart.options.plugins && chart.options.plugins.datalabels) {
            chart.options.plugins.datalabels.color = '#ffffff'; // Reforçar branco
            chart.update('none');
          }
        } catch (error) {
          // Ignorar erros de update se o chart foi destruído ou canvas removido
          const errorMsg = error?.message || '';
          if (errorMsg.includes('destroyed') ||
            errorMsg.includes('ownerDocument') ||
            errorMsg.includes('null')) {
            return;
          }
        }
      }, 200);
    }

    // REFATORAÇÃO FASE 5: Integração chartLegend × chartFactory
    // Criar legenda interativa para gráficos de pizza/doughnut
    if (options.createLegend && options.legendContainer && labels && labels.length > 0) {
      if (window.chartLegend && window.chartLegend.createDoughnutLegend) {
        // Aguardar um pouco para garantir que o gráfico está renderizado
        setTimeout(() => {
          window.chartLegend.createDoughnutLegend(
            canvasId,
            options.legendContainer,
            labels,
            values,
            backgroundColor,
            options
          );
        }, 100);
      }
    } else if (options.legendContainer && labels && labels.length > 0) {
      // Compatibilidade: manter comportamento antigo se legendContainer estiver presente
      if (window.chartLegend && window.chartLegend.createDoughnutLegend) {
        setTimeout(() => {
          window.chartLegend.createDoughnutLegend(
            canvasId,
            options.legendContainer,
            labels,
            values,
            backgroundColor,
            options
          );
        }, 100);
      }
    }

    // Registrar gráfico no sistema de comunicação
    if (window.chartCommunication) {
      const fieldMapping = window.chartCommunication.getFieldMapping(canvasId);
      window.chartCommunication.registerChart(canvasId, {
        type: options.type || 'doughnut',
        field: fieldMapping?.field || null,
        operator: fieldMapping?.op || null
      });
    }


    return chart;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error(`Erro ao criar gráfico de rosca ${canvasId}:`, error);
    }
    return null;
  }
}

/**
 * Criar Gráfico de Pizza (Pie)
 */
async function createPieChart(canvasId, labels, values, options = {}) {
  options.chartOptions = {
    ...options.chartOptions,
    cutout: 0
  };
  return createDoughnutChart(canvasId, labels, values, options);
}

/**
 * Criar Gráfico de Barras Empilhadas (Stacked Bar)
 */
async function createStackedBarChart(canvasId, labels, datasets, options = {}) {
  const stackedOptions = {
    ...options,
    chartOptions: {
      ...options.chartOptions,
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  };
  return createBarChart(canvasId, labels, datasets, stackedOptions);
}

async function updateChart(canvasId, labels, values, options = {}) {
  try {
    await ensureChartJS();
    const chart = window[canvasId];
    if (!chart || !window.Chart || !(chart instanceof window.Chart)) {
      if (labels && values) {
        const chartType = options.type || 'bar';
        if (chartType === 'line') {
          return await createLineChart(canvasId, labels, values, options);
        } else if (chartType === 'doughnut' || chartType === 'pie') {
          return await createDoughnutChart(canvasId, labels, values, options);
        } else {
          return await createBarChart(canvasId, labels, values, options);
        }
      }
      return null;
    }

    if (labels) {
      chart.data.labels = labels;
    }

    if (values) {
      if (Array.isArray(values) && values.length > 0) {
        if (typeof values[0] === 'object' && !Array.isArray(values[0]) && ('data' in values[0] || 'label' in values[0])) {
          chart.data.datasets = values.map((dataset, idx) => ({
            ...chart.data.datasets[idx],
            ...dataset,
            data: dataset.data || []
          }));
        } else if (Array.isArray(values[0]) && typeof values[0][0] === 'number') {
          chart.data.datasets = values.map((data, idx) => ({
            ...(chart.data.datasets[idx] || {}),
            data: data
          }));
        } else {
          if (chart.data.datasets.length > 0) {
            chart.data.datasets[0].data = values;
          } else {
            chart.data.datasets = [{
              label: options.label || 'Dados',
              data: values
            }];
          }
        }
      }
    }

    if (options.chartOptions) {
      Object.assign(chart.options, options.chartOptions);
    }

    // Atualizar com validações
    try {
      if (chart && chart.canvas && chart.canvas.parentNode && document.body.contains(chart.canvas) && !chart.destroyed && !chart._isDestroying) {
        chart.update(options.animationMode || 'default');
      }
    } catch (error) {
      // Ignorar erros de update
    }

    if (window.Logger) {
      window.Logger.debug(`Gráfico ${canvasId} atualizado`);
    }

    return chart;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error(`Erro ao atualizar gráfico ${canvasId}:`, error);
    }
    return null;
  }
}

function createReactiveChart(canvasId, dataStoreKey, dataTransformer, chartOptions = {}) {
  if (!window.dataStore) {
    if (window.Logger) {
      window.Logger.warn('dataStore não disponível para gráfico reativo');
    }
    return () => { };
  }

  const updateChartFromStore = (data) => {
    if (!data) return;

    try {
      const transformed = dataTransformer(data);
      if (transformed && transformed.labels && transformed.values) {
        updateChart(canvasId, transformed.labels, transformed.values, {
          ...chartOptions,
          type: chartOptions.type || 'bar'
        }).catch(err => {
          if (window.Logger) {
            window.Logger.error(`Erro ao atualizar gráfico ${canvasId}:`, err);
          }
        });
      }
    } catch (error) {
      if (window.Logger) {
        window.Logger.error(`Erro ao atualizar gráfico reativo ${canvasId}:`, error);
      }
    }
  };

  const initialData = window.dataStore.get(dataStoreKey);
  if (initialData) {
    updateChartFromStore(initialData);
  }

  const unsubscribe = window.dataStore.subscribe(dataStoreKey, updateChartFromStore);

  if (!window._chartFactoryUnsubscribes) {
    window._chartFactoryUnsubscribes = new Map();
  }
  window._chartFactoryUnsubscribes.set(canvasId, unsubscribe);

  return unsubscribe;
}

/**
 * Função utilitária global para destruir gráficos Chart.js de forma segura
 * Pode ser usada em qualquer página antes de criar novos gráficos
 * 
 * @param {string|string[]} chartId - ID do canvas ou array de IDs
 * @returns {boolean} - true se algum gráfico foi destruído
 */
function destroyChartSafely(chartId) {
  let destroyed = false;
  const ids = Array.isArray(chartId) ? chartId : [chartId];

  ids.forEach(id => {
    try {
      // Verificar se existe no window e tem método destroy
      if (window[id] && typeof window[id].destroy === 'function') {
        // Marcar como destruído antes de destruir
        window[id]._isDestroying = true;
        window[id].destroy();
        window[id] = null;
        destroyed = true;
        if (window.Logger) {
          window.Logger.debug(`Gráfico ${id} destruído (window[${id}])`);
        }
      }

      // Também tentar destruir via Chart.js se estiver disponível
      if (typeof window.Chart !== 'undefined' && typeof window.Chart.getChart === 'function') {
        const existingChart = window.Chart.getChart(id);
        if (existingChart && typeof existingChart.destroy === 'function') {
          existingChart._isDestroying = true;
          existingChart.destroy();
          destroyed = true;
          if (window.Logger) {
            window.Logger.debug(`Gráfico ${id} destruído (Chart.getChart)`);
          }
        }
      }

      // Verificar se o canvas existe e limpar
      const canvas = document.getElementById(id);
      if (canvas) {
        // Limpar referência ao chart instance
        if (canvas._chartInstance) {
          canvas._chartInstance = null;
        }
        // VALIDAÇÃO: Verificar se o canvas ainda está no DOM antes de obter contexto
        if (!canvas.parentNode || !document.body.contains(canvas)) {
          if (window.Logger) {
            window.Logger.warn(`Canvas não está no DOM, pulando criação de gráfico`);
          }
          return null;
        }

        let ctx = null;
        try {
          ctx = canvas.getContext('2d');
          if (!ctx) {
            if (window.Logger) {
              window.Logger.warn(`Não foi possível obter contexto 2D do canvas`);
            }
            return null;
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn(`Erro ao obter contexto do canvas:`, error);
          }
          return null;
        }
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (error) {
      // Ignorar erros ao destruir gráficos (pode não existir)
      if (window.Logger) {
        window.Logger.debug(`Erro ao destruir gráfico ${id}:`, error);
      }
    }
  });

  return destroyed;
}

/**
 * Destruir múltiplos gráficos de uma vez
 * 
 * @param {string[]} chartIds - Array de IDs de gráficos
 */
function destroyCharts(chartIds) {
  if (!Array.isArray(chartIds) || chartIds.length === 0) {
    return;
  }

  chartIds.forEach(id => destroyChartSafely(id));

  if (window.Logger) {
    window.Logger.debug(`Destruídos ${chartIds.length} gráfico(s)`);
  }
}

if (typeof window !== 'undefined') {
  // CORREÇÃO: Expor chartFactory ANTES de qualquer outra coisa para garantir disponibilidade
  window.chartFactory = {
    getChartDefaults,
    getColorPalette,
    getColorFromPalette,
    getColorWithAlpha,
    getStandardBarDataLabels,
    getStandardDoughnutDataLabels,
    getStandardLineDataLabels,
    createBarChart,
    createLineChart,
    createDoughnutChart,
    createPieChart,
    createStackedBarChart,
    updateChart,
    createReactiveChart,
    destroyChart: destroyChartSafely,
    destroyCharts: destroyCharts
  };

  // Exportar funções globalmente para uso em outras páginas
  window.getStandardBarDataLabels = getStandardBarDataLabels;
  window.getStandardDoughnutDataLabels = getStandardDoughnutDataLabels;
  window.getStandardLineDataLabels = getStandardLineDataLabels;

  // CORREÇÃO: Expor também como ChartFactory (com C maiúsculo) para compatibilidade
  window.ChartFactory = window.chartFactory;

  if (window.Logger) {
    window.Logger.debug('✅ Chart Factory inicializado');
  } else {
    // Log mesmo sem Logger para garantir que foi carregado
    console.log('✅ Chart Factory inicializado');
  }
}

