/**
 * Módulo: Gráficos Avançados (Plotly.js)
 * 
 * Gráficos avançados usando Plotly.js:
 * - Sankey Chart (fluxo Tema → Órgão → Status)
 * - TreeMap Chart (proporção por categoria)
 * - Geographic Map (distribuição geográfica por bairro)
 * - Heatmap Dinâmico (visualização cruzada)
 * 
 * Otimizações:
 * - Carregamento lazy do Plotly.js
 * - Integração com dataLoader e dataStore
 * - Fallbacks robustos
 * - Tratamento de erros completo
 */

/**
 * Garantir que Plotly.js está carregado
 * OTIMIZAÇÃO: Carrega Plotly.js sob demanda
 * @returns {Promise} Promise que resolve quando Plotly.js está pronto
 */
async function ensurePlotly() {
  if (typeof Plotly !== 'undefined') {
    return Promise.resolve();
  }
  
  // Usar sistema de lazy loading se disponível
  if (window.lazyLibraries?.loadPlotly) {
    return window.lazyLibraries.loadPlotly();
  }
  
  // Fallback: tentar carregar manualmente
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      if (window.Logger) {
        window.Logger.warn('Erro ao carregar Plotly.js');
      }
      reject(new Error('Plotly.js não carregado'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Carregar todos os gráficos avançados
 * OTIMIZAÇÃO: Reutiliza dados já carregados se disponíveis
 */
async function loadAdvancedCharts(temas = null, orgaos = null) {
  try {
    const pageMain = document.getElementById('page-main');
    if (!pageMain || pageMain.style.display === 'none') {
      if (window.Logger) {
        window.Logger.debug('Gráficos avançados: Página não visível, aguardando...');
      }
      return;
    }

    // Carregar dados em paralelo (otimizado)
    const results = await Promise.allSettled([
      temas ? Promise.resolve(temas) : (window.dataLoader?.load('/api/aggregate/by-theme', { 
        useDataStore: true,
        ttl: 5 * 60 * 1000,
        fallback: [] 
      }) || Promise.resolve([])),
      orgaos ? Promise.resolve(orgaos) : (window.dataLoader?.load('/api/aggregate/count-by?field=Orgaos', { 
        useDataStore: true,
        ttl: 5 * 60 * 1000,
        fallback: [] 
      }) || Promise.resolve([])),
      window.dataLoader?.load('/api/aggregate/count-by?field=Status', { 
        useDataStore: true,
        ttl: 5 * 60 * 1000,
        fallback: [] 
      }) || Promise.resolve([]),
      window.dataLoader?.load('/api/aggregate/count-by?field=Bairro', { 
        useDataStore: true,
        ttl: 5 * 60 * 1000,
        fallback: [] 
      }) || Promise.resolve([])
    ]);
    
    const temasData = results[0].status === 'fulfilled' ? results[0].value : (temas || []);
    const orgaosData = results[1].status === 'fulfilled' ? results[1].value : (orgaos || []);
    const status = results[2].status === 'fulfilled' ? results[2].value : [];
    const bairros = results[3].status === 'fulfilled' ? results[3].value : [];
    
    // Carregar gráficos em paralelo (otimizado)
    await Promise.allSettled([
      loadSankeyChart(temasData, orgaosData, status),
      loadTreeMapChart(temasData),
      loadGeographicMap(bairros)
    ]);
    
    if (window.Logger) {
      window.Logger.success('✅ Gráficos avançados carregados');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar gráficos avançados:', error);
    }
  }
}

/**
 * Criar Sankey Diagram: Fluxo Tema → Órgão → Status
 */
async function loadSankeyChart(temas, orgaos, status) {
  try {
    const container = document.getElementById('sankeyChart');
    if (!container) {
      if (window.Logger) {
        window.Logger.debug('Elemento sankeyChart não encontrado (opcional)');
      }
      return;
    }
    
    // Carregar Plotly.js sob demanda
    try {
      await ensurePlotly();
    } catch (error) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Plotly.js não está disponível</div>';
      return;
    }
    
    // Tentar carregar dados do endpoint otimizado
    let flowData = null;
    try {
      flowData = await window.dataLoader?.load('/api/aggregate/sankey-flow', {
        useDataStore: true,
        ttl: 10 * 60 * 1000, // 10 minutos
        fallback: null,
        timeout: 30000
      }) || null;
    } catch (e) {
      if (window.Logger) {
        window.Logger.warn('Erro ao carregar dados Sankey, usando fallback:', e);
      }
    }
    
    // Se não houver dados do endpoint, usar fallback com dados agregados
    if (!flowData || !flowData.nodes || !flowData.links) {
      if (!temas || !orgaos || !status || temas.length === 0 || orgaos.length === 0 || status.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados suficientes para Sankey</div>';
        return;
      }
      
      const topTemas = temas.slice(0, 5);
      const topOrgaos = orgaos.slice(0, 5);
      const topStatus = status.slice(0, 3);
      
      const labels = [
        ...topTemas.map(t => t.theme || t.tema || t._id || 'Não informado'),
        ...topOrgaos.map(o => o.organ || o.key || o._id || 'Não informado'),
        ...topStatus.map(s => s.status || s.key || s._id || 'Não informado')
      ];
      
      const temaIndices = topTemas.map((_, i) => i);
      const orgaoIndices = topOrgaos.map((_, i) => topTemas.length + i);
      const statusIndices = topStatus.map((_, i) => topTemas.length + topOrgaos.length + i);
      
      const source = [];
      const target = [];
      const value = [];
      
      // Criar conexões Tema → Órgão
      topTemas.forEach((tema, tIdx) => {
        topOrgaos.forEach((orgao, oIdx) => {
          const temaCount = tema.count || tema.quantidade || 0;
          const orgaoCount = orgao.count || orgao.quantidade || 0;
          if (temaCount > 0 && orgaoCount > 0) {
            source.push(temaIndices[tIdx]);
            target.push(orgaoIndices[oIdx]);
            value.push(Math.round((temaCount * orgaoCount) / 1000) || 1);
          }
        });
      });
      
      // Criar conexões Órgão → Status
      topOrgaos.forEach((orgao, oIdx) => {
        topStatus.forEach((st, sIdx) => {
          const orgaoCount = orgao.count || orgao.quantidade || 0;
          const statusCount = st.count || st.quantidade || 0;
          if (orgaoCount > 0 && statusCount > 0) {
            source.push(orgaoIndices[oIdx]);
            target.push(statusIndices[sIdx]);
            value.push(Math.round((orgaoCount * statusCount) / 1000) || 1);
          }
        });
      });
      
      if (source.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem conexões para exibir</div>';
        return;
      }
      
      const data = [{
        type: 'sankey',
        node: {
          pad: 15,
          thickness: 20,
          line: { color: '#0f172a', width: 0.5 },
          label: labels,
          color: [
            ...topTemas.map(() => '#22d3ee'), // Cyan para temas
            ...topOrgaos.map(() => '#a78bfa'), // Purple para órgãos
            ...topStatus.map(() => '#34d399')  // Green para status
          ]
        },
        link: {
          source: source,
          target: target,
          value: value,
          color: ['rgba(34,211,238,0.4)']
        }
      }];
      
      const layout = {
        title: '',
        font: { color: '#94a3b8', size: 12 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent'
      };
      
      Plotly.newPlot(container, data, layout, { 
        responsive: true, 
        displayModeBar: false 
      });
      
      if (window.Logger) {
        window.Logger.debug('Gráfico Sankey criado (fallback)');
      }
      return;
    }
    
    // Usar dados reais do backend
    const allNodes = [
      ...(flowData.nodes.temas || []),
      ...(flowData.nodes.orgaos || []),
      ...(flowData.nodes.statuses || [])
    ];
    
    if (allNodes.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados para exibir</div>';
      return;
    }
    
    const nodeMap = new Map();
    allNodes.forEach((node, idx) => {
      nodeMap.set(node, idx);
    });
    
    const source = [];
    const target = [];
    const value = [];
    
    (flowData.links || []).forEach(link => {
      const srcIdx = nodeMap.get(link.source);
      const tgtIdx = nodeMap.get(link.target);
      if (srcIdx !== undefined && tgtIdx !== undefined && link.value > 0) {
        source.push(srcIdx);
        target.push(tgtIdx);
        value.push(link.value);
      }
    });
    
    if (source.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem conexões para exibir</div>';
      return;
    }
    
    const temaCount = flowData.nodes.temas?.length || 0;
    const orgaoCount = flowData.nodes.orgaos?.length || 0;
    
    const nodeColors = [
      ...Array(temaCount).fill('#22d3ee'),
      ...Array(orgaoCount).fill('#a78bfa'),
      ...Array(flowData.nodes.statuses?.length || 0).fill('#34d399')
    ];
    
    const data = [{
      type: 'sankey',
      node: {
        pad: 15,
        thickness: 20,
        line: { color: '#0f172a', width: 0.5 },
        label: allNodes,
        color: nodeColors
      },
      link: {
        source: source,
        target: target,
        value: value,
        color: ['rgba(34,211,238,0.4)']
      }
    }];
    
    const layout = {
      title: '',
      font: { color: '#94a3b8', size: 12 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent'
    };
    
    Plotly.newPlot(container, data, layout, { 
      responsive: true, 
      displayModeBar: false 
    });
    
    if (window.Logger) {
      window.Logger.debug('Gráfico Sankey criado');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao criar gráfico Sankey:', error);
    }
    const container = document.getElementById('sankeyChart');
    if (container) {
      container.innerHTML = '<div class="p-4 text-center text-red-400">Erro ao carregar gráfico Sankey</div>';
    }
  }
}

/**
 * Criar TreeMap Chart: Proporção por Categoria/Tema
 */
async function loadTreeMapChart(temas) {
  try {
    const container = document.getElementById('treemapChart') || document.getElementById('treeMapChart');
    if (!container) {
      if (window.Logger) {
        window.Logger.debug('Elemento treemapChart não encontrado (opcional)');
      }
      return;
    }
    
    // Carregar Plotly.js sob demanda
    try {
      await ensurePlotly();
    } catch (error) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Plotly.js não está disponível</div>';
      return;
    }
    
    if (!temas || temas.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados de temas disponíveis</div>';
      return;
    }
    
    const topTemas = temas.slice(0, 15);
    const labels = topTemas.map(t => t.theme || t.tema || t._id || 'Não informado');
    const values = topTemas.map(t => t.count || t.quantidade || 0);
    const parents = topTemas.map(() => '');
    
    // Filtrar valores zero
    const validData = labels.map((label, idx) => ({
      label,
      value: values[idx],
      parent: parents[idx]
    })).filter(item => item.value > 0);
    
    if (validData.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados válidos para TreeMap</div>';
      return;
    }
    
    const data = [{
      type: 'treemap',
      labels: validData.map(d => d.label),
      values: validData.map(d => d.value),
      parents: validData.map(d => d.parent),
      marker: {
        colors: Array.from({ length: validData.length }, (_, i) => {
          const hue = (i * 137.508) % 360; // Golden angle para distribuição de cores
          return `hsl(${hue}, 70%, 50%)`;
        }),
        line: { color: '#0f172a', width: 2 }
      },
      textfont: { color: '#ffffff', size: 12 },
      textinfo: 'label+value',
      texttemplate: '%{label}<br>%{value:,.0f}'
    }];
    
    const layout = {
      title: '',
      font: { color: '#94a3b8' },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      margin: { l: 0, r: 0, t: 0, b: 0 }
    };
    
    Plotly.newPlot(container, data, layout, { 
      responsive: true, 
      displayModeBar: false 
    });
    
    if (window.Logger) {
      window.Logger.debug('Gráfico TreeMap criado');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao criar gráfico TreeMap:', error);
    }
    const container = document.getElementById('treemapChart') || document.getElementById('treeMapChart');
    if (container) {
      container.innerHTML = '<div class="p-4 text-center text-red-400">Erro ao carregar gráfico TreeMap</div>';
    }
  }
}

/**
 * Criar Mapa Geográfico: Distribuição por Bairro
 */
async function loadGeographicMap(bairros = null) {
  try {
    const container = document.getElementById('mapChart') || document.getElementById('geographicMap');
    if (!container) {
      if (window.Logger) {
        window.Logger.debug('Elemento mapChart não encontrado (opcional)');
      }
      return;
    }
    
    // Buscar dados se não foram passados
    let bairrosData = bairros;
    if (!bairrosData || bairrosData.length === 0) {
      bairrosData = await window.dataLoader?.load('/api/aggregate/count-by?field=Bairro', { 
        useDataStore: true,
        ttl: 5 * 60 * 1000,
        fallback: [] 
      }) || [];
    }
    
    if (!bairrosData || bairrosData.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados de bairros disponíveis</div>';
      return;
    }
    
    // Tentar usar Plotly.js primeiro
    try {
      await ensurePlotly();
      
      const topBairros = bairrosData.slice(0, 15);
      const labels = topBairros.map(b => b.key || b.bairro || b._id || 'Não informado');
      const values = topBairros.map(b => b.count || b.quantidade || 0);
      
      const data = [{
        type: 'bar',
        x: values,
        y: labels,
        orientation: 'h',
        marker: {
          color: 'rgba(34,211,238,0.7)',
          line: { color: 'rgba(34,211,238,1)', width: 1 }
        },
        text: values.map(v => v.toLocaleString('pt-BR')),
        textposition: 'auto'
      }];
      
      const layout = {
        title: '',
        font: { color: '#94a3b8', size: 12 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: { 
          title: 'Quantidade', 
          color: '#94a3b8',
          gridcolor: 'rgba(255,255,255,0.05)'
        },
        yaxis: { 
          title: 'Bairro', 
          color: '#94a3b8',
          gridcolor: 'rgba(255,255,255,0.05)'
        },
        margin: { l: 120, r: 20, t: 20, b: 40 }
      };
      
      Plotly.newPlot(container, data, layout, { 
        responsive: true, 
        displayModeBar: false 
      });
      
      if (window.Logger) {
        window.Logger.debug('Mapa geográfico criado com Plotly');
      }
      return;
    } catch (plotlyError) {
      // Fallback: HTML simples
      if (window.Logger) {
        window.Logger.debug('Plotly não disponível, usando fallback HTML');
      }
    }
    
    // Fallback: HTML simples
    const topBairros = bairrosData.slice(0, 15);
    let html = '<div class="space-y-2 max-h-96 overflow-y-auto">';
    topBairros.forEach((b, idx) => {
      const bairro = b.key || b.bairro || b._id || 'Não informado';
      const count = b.count || b.quantidade || 0;
      html += `
        <div class="flex items-center justify-between p-2 rounded bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
          <span class="text-slate-300 text-sm">${idx + 1}. ${bairro}</span>
          <span class="text-cyan-300 font-bold">${count.toLocaleString('pt-BR')}</span>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
    
    if (window.Logger) {
      window.Logger.debug('Mapa geográfico criado com HTML (fallback)');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao criar mapa geográfico:', error);
    }
    const container = document.getElementById('mapChart') || document.getElementById('geographicMap');
    if (container) {
      container.innerHTML = '<div class="p-4 text-center text-red-400">Erro ao carregar mapa geográfico</div>';
    }
  }
}

/**
 * Construir Heatmap Dinâmico
 * @param {string} containerId - ID do container
 * @param {Array} labels - Labels das colunas
 * @param {Array} rows - Dados das linhas (array de arrays ou array de objetos)
 */
function buildHeatmap(containerId, labels, rows) {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      if (window.Logger) {
        window.Logger.warn(`Elemento ${containerId} não encontrado`);
      }
      return;
    }
    
    // Validar dados
    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem labels para heatmap</div>';
      return;
    }
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      container.innerHTML = '<div class="p-4 text-center text-slate-400">Sem dados para heatmap</div>';
      return;
    }
    
    // Criar tabela HTML para heatmap
    let html = '<div class="overflow-auto"><table class="w-full text-xs">';
    
    // Cabeçalho
    html += '<thead><tr><th class="px-2 py-1 text-left text-slate-300 sticky left-0 bg-slate-900/95 z-10"></th>';
    labels.forEach(label => {
      html += `<th class="px-2 py-1 text-center text-slate-300">${label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Linhas
    rows.forEach((row, idx) => {
      if (!row || (typeof row !== 'object' && !Array.isArray(row))) {
        return; // Pular linha inválida
      }
      
      const rowLabel = labels[idx] || `Linha ${idx + 1}`;
      html += `<tr><td class="px-2 py-1 text-slate-300 font-semibold sticky left-0 bg-slate-900/95 z-10">${rowLabel}</td>`;
      
      // Suportar diferentes formatos
      let values = [];
      if (Array.isArray(row)) {
        values = row;
      } else if (row.values && Array.isArray(row.values)) {
        values = row.values;
      } else {
        return; // Pular linha com formato inválido
      }
      
      // Renderizar células
      values.forEach((value, colIdx) => {
        const numValue = Number(value) || 0;
        const maxValue = Math.max(...rows.flatMap(r => Array.isArray(r) ? r : (r.values || [])));
        const intensity = maxValue > 0 ? Math.min(numValue / maxValue, 1) : 0;
        const opacity = 0.3 + (intensity * 0.7);
        const color = `rgba(34,211,238,${opacity})`;
        html += `<td class="px-2 py-1 text-center text-slate-200" style="background-color: ${color}">${numValue || 0}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
    if (window.Logger) {
      window.Logger.debug('Heatmap criado');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao criar heatmap:', error);
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '<div class="p-4 text-center text-red-400">Erro ao criar heatmap</div>';
    }
  }
}

// Exportar funções globalmente
if (typeof window !== 'undefined') {
  window.advancedCharts = {
    loadAdvancedCharts,
    loadSankeyChart,
    loadTreeMapChart,
    loadGeographicMap,
    buildHeatmap,
    ensurePlotly
  };
  
  // Aliases para compatibilidade
  window.loadAdvancedCharts = loadAdvancedCharts;
  window.loadSankeyChart = loadSankeyChart;
  window.loadTreeMapChart = loadTreeMapChart;
  window.loadGeographicMap = loadGeographicMap;
  window.buildHeatmap = buildHeatmap;
}

if (window.Logger) {
  window.Logger.debug('✅ Módulo Advanced Charts carregado');
}

