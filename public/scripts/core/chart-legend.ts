/**
 * Sistema de Legenda Interativa para Gráficos
 * Permite marcar/desmarcar datasets em gráficos de linha múltipla
 * 
 * Sistema modular e robusto para controle de visibilidade de datasets
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

/// <reference path="./chart-communication/global.d.ts" />

interface LegendOptions {
  [key: string]: any;
}

interface LegendController {
  update: () => void;
  render: () => void;
  getVisibility: () => Record<string, boolean>;
  setVisibility: (label: string, visible: boolean) => void;
}

/**
 * Criar legenda interativa para gráfico
 * @param chartId - ID do gráfico
 * @param containerId - ID do container da legenda
 * @param datasets - Array de datasets do gráfico
 * @param options - Opções de configuração
 * @returns Controller da legenda
 */
function createInteractiveLegend(
  chartId: string, 
  containerId: string, 
  datasets: ChartDataset[], 
  options: LegendOptions = {}
): LegendController | undefined {
  const container = document.getElementById(containerId);
  if (!container) {
    if (window.Logger) {
      window.Logger.warn(`Container ${containerId} não encontrado para legenda`);
    }
    return;
  }

  const chart = (window as any)[chartId] as ChartInstance | undefined;
  if (!chart || !(window.Chart && (window.Chart as any).getChart)) {
    if (window.Logger) {
      window.Logger.warn(`Gráfico ${chartId} não encontrado`);
    }
    return;
  }

  // Inicializar visibilidade (todos visíveis por padrão)
  const visibilityKey = `${chartId}_visibility`;
  if (!(window as any)[visibilityKey]) {
    (window as any)[visibilityKey] = {} as Record<string, boolean>;
    datasets.forEach((ds, idx) => {
      (window as any)[visibilityKey][ds.label || `Dataset ${idx}`] = true;
    });
  }

  const visibility = (window as any)[visibilityKey] as Record<string, boolean>;

  // Função para atualizar gráfico baseado na visibilidade
  const updateChart = () => {
    if (!chart || !(window.Chart && (window.Chart as any).getChart)) return;

    const visibleDatasets = datasets.filter((ds, idx) => {
      const label = ds.label || `Dataset ${idx}`;
      return visibility[label] !== false;
    });

    if (visibleDatasets.length === 0) {
      // Se nenhum dataset estiver visível, mostrar todos
      datasets.forEach((ds, idx) => {
        const label = ds.label || `Dataset ${idx}`;
        visibility[label] = true;
      });
      updateChart();
      return;
    }

    // Atualizar dados do gráfico
    chart.data.datasets = datasets.map((ds, idx) => {
      const label = ds.label || `Dataset ${idx}`;
      const isVisible = visibility[label] !== false;
      
      return {
        ...ds,
        hidden: !isVisible
      };
    });

    // Forçar animação mesmo se estiver desabilitada na criação inicial
    const originalAnimation = (chart as any).options.animation;
    (chart as any).options.animation = {
      duration: 750,
      easing: 'easeOutCubic'
    };
    chart.update('active');
    // Restaurar configuração original após animação
    setTimeout(() => {
      (chart as any).options.animation = originalAnimation;
    }, 800);
  };

  // Função para renderizar legenda
  const renderLegend = () => {
    const total = datasets.reduce((sum: number, ds) => {
      const data = ds.data || [];
      const dataSum: number = Array.isArray(data) 
        ? (data.reduce((s: number, v) => s + (typeof v === 'number' ? v : 0), 0) as number)
        : 0;
      return sum + dataSum;
    }, 0);

    container.innerHTML = datasets.map((ds, idx) => {
      const label = ds.label || `Dataset ${idx}`;
      const isVisible = visibility[label] !== false;
      let color: string = (Array.isArray(ds.borderColor) ? ds.borderColor[0] : ds.borderColor) || 
                         (Array.isArray(ds.backgroundColor) ? ds.backgroundColor[0] : ds.backgroundColor) || 
                         getColorFromPalette(idx);
      
      // Verificar se é tipo de manifestação e usar cor específica
      if ((window as any).config?.getColorByTipoManifestacao) {
        const tipoColor = (window as any).config.getColorByTipoManifestacao(label);
        if (tipoColor) {
          color = tipoColor;
        }
      }
      
      // Calcular total deste dataset
      const data = ds.data || [];
      const datasetTotal: number = Array.isArray(data) 
        ? (data.reduce((sum: number, v) => sum + (typeof v === 'number' ? v : 0), 0) as number)
        : 0;
      const percent = total > 0 ? ((datasetTotal / total) * 100).toFixed(1) : '0';

      return `
        <div 
          class="legend-item flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-all cursor-pointer border ${isVisible ? 'border-transparent opacity-100' : 'border-white/20 opacity-40'}"
          data-label="${label.replace(/"/g, '&quot;')}"
        >
          <div 
            class="w-4 h-4 rounded flex-shrink-0 border-2 transition-all relative ${isVisible ? 'border-white/30' : 'border-white/50'}" 
            style="background-color: ${isVisible ? color : 'transparent'}; ${!isVisible ? `border-color: ${color}; border-style: dashed;` : ''}"
          >
            ${isVisible ? '' : '<div class="w-full h-0.5 bg-white/50 absolute top-1/2 left-0 transform rotate-45"></div>'}
          </div>
          <div class="flex-1 min-w-0 ${!isVisible ? 'line-through' : ''}">
            <div class="text-slate-300 truncate text-sm" title="${label}">${label}</div>
            <div class="text-slate-500 text-[10px]">${datasetTotal.toLocaleString('pt-BR')} (${percent}%)</div>
          </div>
        </div>
      `;
    }).join('');

    // Adicionar event listeners
    container.querySelectorAll('.legend-item').forEach((item) => {
      item.addEventListener('click', () => {
        const label = item.getAttribute('data-label');
        if (label) {
          visibility[label] = !visibility[label];
          updateChart();
          renderLegend();
        }
      });
    });

    // Remover controles existentes antes de criar novos (evitar duplicação)
    const existingControls = container.querySelector('.legend-controls');
    if (existingControls) {
      existingControls.remove();
    }
    
    // Criar ou recriar controles sempre (para garantir que os listeners estejam ativos)
    const controls = document.createElement('div');
    controls.className = 'legend-controls flex gap-2 mt-2 pt-2 border-t border-white/10';
    controls.innerHTML = `
      <button class="btn-marcar-todos text-xs px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors" type="button">
        Marcar Todos
      </button>
      <button class="btn-desmarcar-todos text-xs px-3 py-1 rounded bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 transition-colors" type="button">
        Desmarcar Todos
      </button>
    `;
    
    // Adicionar event listeners aos botões
    const btnMarcar = controls.querySelector('.btn-marcar-todos');
    const btnDesmarcar = controls.querySelector('.btn-desmarcar-todos');
    
    if (btnMarcar) {
      btnMarcar.addEventListener('click', (e) => {
        e.stopPropagation();
        datasets.forEach((ds, idx) => {
          const label = ds.label || `Dataset ${idx}`;
          visibility[label] = true;
        });
        updateChart();
        renderLegend();
      });
    }
    
    if (btnDesmarcar) {
      btnDesmarcar.addEventListener('click', (e) => {
        e.stopPropagation();
        datasets.forEach((ds, idx) => {
          const label = ds.label || `Dataset ${idx}`;
          visibility[label] = false;
        });
        updateChart();
        renderLegend();
      });
    }
    
    container.appendChild(controls);
  };

  // Renderizar legenda inicial
  renderLegend();

  // Retornar função de atualização para uso externo
  return {
    update: updateChart,
    render: renderLegend,
    getVisibility: () => ({ ...visibility }),
    setVisibility: (label: string, visible: boolean) => {
      visibility[label] = visible;
      updateChart();
      renderLegend();
    }
  };
}

/**
 * Criar legenda interativa para gráfico de pizza/doughnut
 * @param chartId - ID do gráfico
 * @param containerId - ID do container da legenda
 * @param labels - Array de labels
 * @param values - Array de valores
 * @param colors - Array de cores (opcional)
 * @param options - Opções de configuração
 * @returns Controller da legenda
 */
function createDoughnutLegend(
  chartId: string, 
  containerId: string, 
  labels: string[], 
  values: number[], 
  colors: string[] | null = null, 
  options: LegendOptions = {}
): LegendController | undefined {
  const container = document.getElementById(containerId);
  if (!container) {
    if (window.Logger) {
      window.Logger.warn(`Container ${containerId} não encontrado para legenda`);
    }
    return;
  }

  const chart = (window as any)[chartId] as ChartInstance | undefined;
  if (!chart || !(window.Chart && (window.Chart as any).getChart)) {
    if (window.Logger) {
      window.Logger.warn(`Gráfico ${chartId} não encontrado`);
    }
    return;
  }

  // Obter cores do gráfico se não fornecidas
  if (!colors && chart.data.datasets && chart.data.datasets[0]) {
    const bgColors = chart.data.datasets[0].backgroundColor;
    const borderColors = chart.data.datasets[0].borderColor;
    colors = (Array.isArray(bgColors) ? bgColors : bgColors ? [bgColors] : []) ||
             (Array.isArray(borderColors) ? borderColors : borderColors ? [borderColors] : []) ||
             [];
  }

  // Inicializar visibilidade (todos visíveis por padrão)
  const visibilityKey = `${chartId}_visibility`;
  if (!(window as any)[visibilityKey]) {
    (window as any)[visibilityKey] = {} as Record<string, boolean>;
    labels.forEach((label) => {
      (window as any)[visibilityKey][label] = true;
    });
  }

  const visibility = (window as any)[visibilityKey] as Record<string, boolean>;

  // Função para atualizar gráfico baseado na visibilidade
  const updateChart = () => {
    if (!chart || !(window.Chart && (window.Chart as any).getChart)) return;

    const visibleLabels = labels.filter(label => visibility[label] !== false);
    
    if (visibleLabels.length === 0) {
      // Se nenhum label estiver visível, mostrar todos
      labels.forEach(label => {
        visibility[label] = true;
      });
      updateChart();
      return;
    }

    // Filtrar dados visíveis
    const visibleData = labels.map((label, idx) => {
      const isVisible = visibility[label] !== false;
      return isVisible ? values[idx] : null;
    });

    // Atualizar dados do gráfico
    chart.data.labels = labels;
    if (chart.data.datasets[0]) {
      chart.data.datasets[0].data = visibleData;
    }
    
    // Forçar animação mesmo se estiver desabilitada na criação inicial
    const originalAnimation = (chart as any).options.animation;
    (chart as any).options.animation = {
      duration: 750,
      easing: 'easeOutCubic'
    };
    chart.update('active');
    // Restaurar configuração original após animação
    setTimeout(() => {
      (chart as any).options.animation = originalAnimation;
    }, 800);
  };

  // Função para renderizar legenda
  const renderLegend = () => {
    const total = values.reduce((sum, v) => sum + (v || 0), 0);
    
    container.innerHTML = labels.map((label, idx) => {
      const isVisible = visibility[label] !== false;
      // Verificar se é tipo de manifestação e usar cor específica
      let color = (colors && colors[idx]) ? colors[idx] : getColorFromPalette(idx);
      if ((window as any).config?.getColorByTipoManifestacao) {
        const tipoColor = (window as any).config.getColorByTipoManifestacao(label);
        if (tipoColor) {
          color = tipoColor;
        }
      }
      const value = values[idx] || 0;
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';

      return `
        <div 
          class="legend-item flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-all cursor-pointer border ${isVisible ? 'border-transparent opacity-100' : 'border-white/20 opacity-40'}"
          data-label="${label.replace(/"/g, '&quot;')}"
        >
          <div 
            class="w-4 h-4 rounded flex-shrink-0 border-2 transition-all relative ${isVisible ? 'border-white/30' : 'border-white/50'}" 
            style="background-color: ${isVisible ? color : 'transparent'}; ${!isVisible ? `border-color: ${color}; border-style: dashed;` : ''}"
          >
            ${isVisible ? '' : '<div class="w-full h-0.5 bg-white/50 absolute top-1/2 left-0 transform rotate-45"></div>'}
          </div>
          <div class="flex-1 min-w-0 ${!isVisible ? 'line-through' : ''}">
            <div class="text-slate-300 truncate text-sm" title="${label}">${label}</div>
            <div class="text-slate-500 text-[10px]">${value.toLocaleString('pt-BR')} (${percent}%)</div>
          </div>
        </div>
      `;
    }).join('');

    // Adicionar event listeners aos itens
    container.querySelectorAll('.legend-item').forEach((item) => {
      item.addEventListener('click', () => {
        const label = item.getAttribute('data-label');
        if (label) {
          visibility[label] = !visibility[label];
          updateChart();
          renderLegend();
        }
      });
    });

    // Remover controles existentes antes de criar novos (evitar duplicação)
    const existingControls = container.querySelector('.legend-controls');
    if (existingControls) {
      existingControls.remove();
    }
    
    // Criar ou recriar controles sempre (para garantir que os listeners estejam ativos)
    const controls = document.createElement('div');
    controls.className = 'legend-controls flex gap-2 mt-2 pt-2 border-t border-white/10';
    controls.innerHTML = `
      <button class="btn-marcar-todos text-xs px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors" type="button">
        Marcar Todos
      </button>
      <button class="btn-desmarcar-todos text-xs px-3 py-1 rounded bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 transition-colors" type="button">
        Desmarcar Todos
      </button>
    `;
    
    // Adicionar event listeners aos botões
    const btnMarcar = controls.querySelector('.btn-marcar-todos');
    const btnDesmarcar = controls.querySelector('.btn-desmarcar-todos');
    
    if (btnMarcar) {
      btnMarcar.addEventListener('click', (e) => {
        e.stopPropagation();
        labels.forEach(label => {
          visibility[label] = true;
        });
        updateChart();
        renderLegend();
      });
    }
    
    if (btnDesmarcar) {
      btnDesmarcar.addEventListener('click', (e) => {
        e.stopPropagation();
        labels.forEach(label => {
          visibility[label] = false;
        });
        updateChart();
        renderLegend();
      });
    }
    
    container.appendChild(controls);
  };

  // Renderizar legenda inicial
  renderLegend();

  // Retornar função de atualização para uso externo
  return {
    update: updateChart,
    render: renderLegend,
    getVisibility: () => ({ ...visibility }),
    setVisibility: (label: string, visible: boolean) => {
      visibility[label] = visible;
      updateChart();
      renderLegend();
    }
  };
}

/**
 * Obter cor da paleta por índice
 */
function getColorFromPalette(index: number): string {
  const palette = (window as any).config?.CHART_CONFIG?.COLOR_PALETTE || [
    '#22d3ee', '#a78bfa', '#34d399', '#f59e0b', '#fb7185', '#e879f9',
    '#8b5cf6', '#06b6d4', '#10b981', '#f97316', '#ec4899', '#6366f1'
  ];
  return palette[index % palette.length];
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  if (!(window as any).chartLegend) (window as any).chartLegend = {};
  (window as any).chartLegend.createInteractiveLegend = createInteractiveLegend;
  (window as any).chartLegend.createDoughnutLegend = createDoughnutLegend;
  (window as any).chartLegend.getColorFromPalette = getColorFromPalette;
}

