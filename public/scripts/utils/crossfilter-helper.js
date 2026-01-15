/**
 * Helper Universal para Crossfilter em Gráficos
 * 
 * Aplica sistema de filtros crossfilter (estilo Power BI) em gráficos Chart.js
 * Funciona tanto com crossfilterOverview quanto com chartCommunication
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function () {
  'use strict';

  /**
   * Adicionar filtros crossfilter a um gráfico Chart.js
   * 
   * @param {Chart} chart - Instância do gráfico Chart.js
   * @param {Array} dataArray - Array de dados originais (para extrair valores)
   * @param {Object} config - Configuração do filtro
   * @param {string} config.field - Campo do filtro ('status', 'tema', 'orgaos', 'tipo', 'canal', 'prioridade', 'bairro')
   * @param {string} config.valueField - Campo no objeto de dados que contém o valor (ex: 'theme', 'status', 'organ')
   * @param {Function} config.onFilterChange - Callback quando filtro muda (opcional)
   * @param {Function} config.onClearFilters - Callback quando filtros são limpos (opcional)
   */
  window.addCrossfilterToChart = function (chart, dataArray, config) {
    // Validação: gráfico deve existir e ter canvas
    if (!chart) {
      if (window.Logger) {
        window.Logger.debug('addCrossfilterToChart: gráfico não fornecido (pode ser esperado)');
      }
      return;
    }

    if (!chart.canvas) {
      if (window.Logger) {
        window.Logger.debug('addCrossfilterToChart: gráfico sem canvas (pode ser esperado)');
      }
      return;
    }

    // Verificar se o canvas ainda está no DOM
    try {
      if (!chart.canvas.ownerDocument || !chart.canvas.parentElement) {
        if (window.Logger) {
          window.Logger.debug('addCrossfilterToChart: canvas não está no DOM (pode ser esperado)');
        }
        return;
      }
    } catch (error) {
      // Canvas foi removido do DOM - caso esperado quando gráfico é destruído
      if (window.Logger) {
        window.Logger.debug('addCrossfilterToChart: erro ao verificar canvas (pode ser esperado)', error.message);
      }
      return;
    }

    const { field, valueField, onFilterChange, onClearFilters } = config || {};

    if (!field) {
      if (window.Logger) {
        window.Logger.warn('addCrossfilterToChart: campo não especificado');
      }
      return;
    }

    const fieldLower = field.toLowerCase();

    // Mapear campo para método do crossfilterOverview
    const fieldMethodMap = {
      'status': 'setStatusFilter',
      'statusdemanda': 'setStatusFilter',
      'tema': 'setTemaFilter',
      'orgaos': 'setOrgaosFilter',
      'secretaria': 'setOrgaosFilter',
      'tipo': 'setTipoFilter',
      'tipodemanifestacao': 'setTipoFilter',
      'canal': 'setCanalFilter',
      'prioridade': 'setPrioridadeFilter',
      'bairro': 'setBairroFilter',
      'unidade': 'setUnidadeFilter',
      'unidadecadastro': 'setUnidadeFilter'
    };

    const methodName = fieldMethodMap[fieldLower];

    // Tornar gráfico clicável
    chart.canvas.style.cursor = 'pointer';
    chart.canvas.title = `Clique para alternar filtro por ${field} | Clique direito para limpar tudo`;

    /**
     * Obter valor do elemento do gráfico
     */
    function getValueFromIndex(index) {
      if (dataArray && dataArray[index]) {
        const dataItem = dataArray[index];
        return dataItem[valueField] ||
          dataItem[field] ||
          dataItem[fieldLower] ||
          dataItem.label ||
          dataItem.key ||
          dataItem._id ||
          chart.data.labels[index];
      }
      return chart.data.labels[index];
    }

    /**
     * Destacar pontos do gráfico baseados nos filtros ativos
     */
    function updateChartHighlighting() {
      if (!chart || !chart.data || !chart.data.datasets) return;

      const globalFilters = window.chartCommunication?.filters?.filters ||
        (window.crossfilterOverview?.filters ? Object.entries(window.crossfilterOverview.filters)
          .filter(([_, v]) => v !== null)
          .map(([f, v]) => ({ field: f, value: v })) : []);

      // Filtrar apenas filtros relevantes para este campo e normalizar em um array plano
      const activeValues = globalFilters
        .filter(f => f.field.toLowerCase() === fieldLower)
        .flatMap(f => Array.isArray(f.value) ? f.value : [f.value]);

      const hasActiveFilters = activeValues.length > 0;

      chart.data.datasets.forEach((dataset) => {
        // Salvar cores originais se não existirem
        if (!dataset._originalBackgroundColor) {
          dataset._originalBackgroundColor = dataset.backgroundColor;
        }

        const originalColors = dataset._originalBackgroundColor;

        if (Array.isArray(originalColors)) {
          dataset.backgroundColor = originalColors.map((color, idx) => {
            if (!hasActiveFilters) return color; // Sem filtros: cor normal

            const val = getValueFromIndex(idx);
            // Verificar se o valor do ponto atual está entre os valores ativos (string comparison insensível)
            const isActive = activeValues.some(activeVal =>
              String(activeVal).toLowerCase() === String(val).toLowerCase()
            );

            // Se ativo: cor normal. Se inativo: dimming (baixa opacidade)
            return isActive ? color : window.chartFactory?.getColorWithAlpha(color, 0.15) || color;
          });
        }
      });

      try {
        chart.update('none');
      } catch (e) {
        // Ignorar erros de update
      }
    }

    // Registrar o gráfico para atualizações visuais automáticas
    if (window.eventBus) {
      const highlightHandler = () => {
        if (chart && !chart.destroyed) {
          updateChartHighlighting();
        }
      };

      window.eventBus.on('filter:applied', highlightHandler);
      window.eventBus.on('filter:removed', highlightHandler);
      window.eventBus.on('filter:cleared', highlightHandler);

      // Limpar listeners quando gráfico for destruído (se possível injetar no destroy)
      const originalDestroy = chart.destroy;
      chart.destroy = function () {
        window.eventBus.off('filter:applied', highlightHandler);
        window.eventBus.off('filter:removed', highlightHandler);
        window.eventBus.off('filter:cleared', highlightHandler);
        return originalDestroy.apply(this, arguments);
      };
    }

    // Executar destaque inicial
    setTimeout(updateChartHighlighting, 100);

    // Capturar estado de Ctrl/Cmd para seleção múltipla (mantido por compatibilidade)
    let lastClickCtrlState = false;

    // Interceptar clique no canvas ANTES do Chart.js
    chart.canvas.addEventListener('mousedown', (e) => {
      lastClickCtrlState = e.ctrlKey || e.metaKey;
    }, true);

    // Handler de clique do Chart.js
    if (!chart.options.onClick || chart.options.onClick._isCrossfilter) {
      const clickHandler = (event, elements) => {
        if (elements && elements.length > 0) {
          const element = elements[0];
          const index = element.index;
          const value = getValueFromIndex(index);

          if (!value) return;

          // BI STYLE: Ctrl+Clique acumula, Clique normal substitui
          const multiSelect = lastClickCtrlState;

          if (window.Logger) {
            window.Logger.debug(`📊 Clique no gráfico (${field}): ${value} | MultiSelect: ${multiSelect}`);
          }

          // Usar crossfilterOverview se disponível (página Overview)
          if (window.crossfilterOverview && methodName) {
            const method = window.crossfilterOverview[methodName];
            if (method && typeof method === 'function') {
              // Se NÃO for multiSelect, e já tiver outros filtros, opcionalmente limparia. 
              // Mas o toggleFilter já lida com o estado. No caso de SINGLE SELECT (multiSelect=false), 
              // queremos limpar os outros valores do MESMO campo se existirem.

              if (!multiSelect) {
                // Se é clique normal, limpamos o campo antes de aplicar o novo valor (toggle original)
                // O crossfilter-overview.js lida com isso em toggleFilter(field, value, false)
              }

              method.call(window.crossfilterOverview, value, multiSelect);
              setTimeout(() => window.crossfilterOverview.notifyListeners(), 50);
              if (onFilterChange) setTimeout(() => onFilterChange(value, multiSelect), 100);
            }
          }
          // Fallback: usar chartCommunication (outras páginas)
          else if (window.chartCommunication && window.chartCommunication.filters) {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);

            window.chartCommunication.filters.apply(fieldName, value, chart.id, {
              toggle: true,
              clearPrevious: !multiSelect // Se não for multiSelect, limpa os anteriores
            });

            if (onFilterChange) setTimeout(() => onFilterChange(value, multiSelect), 100);
          }
        }
      };
      clickHandler._isCrossfilter = true;
      chart.options.onClick = clickHandler;
    }

    // Adicionar handler para clique direito (limpar filtros)
    const chartContainer = chart.canvas.parentElement;
    if (chartContainer && !chartContainer.dataset.crossfilterEnabled) {
      chartContainer.dataset.crossfilterEnabled = 'true';
      chartContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        if (window.Logger) {
          window.Logger.debug(`📊 Limpando filtros via clique direito (${field})`);
        }

        if (window.crossfilterOverview) {
          window.crossfilterOverview.clearAllFilters();
          setTimeout(() => window.crossfilterOverview.notifyListeners(), 50);
        } else if (window.chartCommunication && window.chartCommunication.filters) {
          window.chartCommunication.filters.clear();
        }

        if (onClearFilters) setTimeout(() => onClearFilters(), 100);
      });
    }

    // Hover effect
    chart.canvas.addEventListener('mousemove', (e) => {
      try {
        if (!chart || !chart.canvas || !chart.canvas.parentElement) return;
        const elements = chart.getElementsAtEventForMode(e, 'index', { intersect: false }, true);
        chart.canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      } catch (error) { }
    });

    if (window.Logger) {
      window.Logger.debug(`✅ Crossfilter (v2-Dimming) adicionado ao gráfico (${field})`);
    }
  };

  /**
   * Helper para adicionar crossfilter a múltiplos gráficos
   */
  window.addCrossfilterToCharts = function (chartsConfig) {
    chartsConfig.forEach(config => {
      const { chartId, dataArray, field, valueField, onFilterChange, onClearFilters } = config;

      // Aguardar gráfico estar disponível
      const checkChart = setInterval(() => {
        const chart = window.ChartFactory?.getChart?.(chartId) ||
          window.chartFactory?.getChart?.(chartId) ||
          (window.Chart && Chart.getChart(chartId));

        if (chart) {
          clearInterval(checkChart);
          window.addCrossfilterToChart(chart, dataArray, {
            field,
            valueField,
            onFilterChange,
            onClearFilters
          });
        }
      }, 100);

      // Timeout após 5 segundos
      setTimeout(() => {
        clearInterval(checkChart);
      }, 5000);
    });
  };

  if (window.Logger) {
    window.Logger.debug('✅ CrossfilterHelper: Helper universal de crossfilter inicializado');
  }
})();

