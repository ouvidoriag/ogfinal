/**
 * Helper Universal para Conectar TODOS os Elementos Visuais ao Sistema de Filtros
 * 
 * Conecta automaticamente:
 * - Gráficos (pizza, barra, linha, etc.)
 * - Cards clicáveis
 * - KPIs e números
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

(function() {
  'use strict';

  /**
   * Conectar TODOS os elementos visuais de uma página ao sistema de filtros
   * 
   * @param {Object} config - Configuração
   * @param {string} config.pageId - ID da página
   * @param {Array} config.charts - Array de configurações de gráficos
   * @param {Array} config.cards - Array de configurações de cards
   * @param {Array} config.kpis - Array de configurações de KPIs
   */
  window.connectAllElements = function(config) {
    const {
      pageId,
      charts = [],
      cards = [],
      kpis = []
    } = config;

    if (!pageId) {
      if (window.Logger) {
        window.Logger.warn('connectAllElements: pageId não especificado');
      }
      return;
    }

    if (window.Logger) {
      window.Logger.debug(`🔗 Conectando todos os elementos da página ${pageId}`, {
        charts: charts.length,
        cards: cards.length,
        kpis: kpis.length
      });
    }

    // Conectar gráficos
    charts.forEach(chartConfig => {
      connectChart(chartConfig);
    });

    // Conectar cards
    cards.forEach(cardConfig => {
      connectCard(cardConfig);
    });

    // Conectar KPIs
    kpis.forEach(kpiConfig => {
      connectKPI(kpiConfig);
    });

    if (window.Logger) {
      window.Logger.success(`✅ Todos os elementos da página ${pageId} conectados`);
    }
  };

  /**
   * Conectar um gráfico ao sistema de filtros
   */
  function connectChart(config) {
    const {
      chartId,
      dataArray,
      field,
      valueField,
      delay = 100
    } = config;

    if (!chartId || !field) {
      if (window.Logger) {
        window.Logger.warn('connectChart: chartId ou field não especificado', config);
      }
      return;
    }

    // Aguardar gráfico ser criado
    setTimeout(() => {
      const chart = window.ChartFactory?.getChart?.(chartId) || 
                   window.chartFactory?.getChart?.(chartId) ||
                   (window.Chart && Chart.getChart(chartId));

      if (chart && chart.canvas && chart.canvas.ownerDocument) {
        try {
          window.addCrossfilterToChart(chart, dataArray, {
            field,
            valueField: valueField || field,
            onFilterChange: () => {
              // Recarregar página quando filtro mudar
              const pageId = config.pageId;
              if (pageId) {
                const page = document.getElementById(pageId);
                if (page && page.style.display !== 'none') {
                  // Encontrar função de load da página
                  const loadFunction = window[`load${pageId.replace('page-', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`] ||
                                     window[`load${pageId.replace('page-', '').charAt(0).toUpperCase() + pageId.replace('page-', '').slice(1)}`];
                  
                  if (loadFunction && typeof loadFunction === 'function') {
                    loadFunction();
                  }
                }
              }
            }
          });

          if (window.Logger) {
            window.Logger.debug(`✅ Gráfico ${chartId} conectado ao sistema de filtros`);
          }
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn(`Erro ao conectar gráfico ${chartId}:`, error);
          }
        }
      } else {
        // Tentar novamente após mais tempo
        if (delay < 2000) {
          connectChart({ ...config, delay: delay * 2 });
        } else {
          if (window.Logger) {
            window.Logger.warn(`Gráfico ${chartId} não encontrado após múltiplas tentativas`);
          }
        }
      }
    }, delay);
  }

  /**
   * Conectar um card ao sistema de filtros
   */
  function connectCard(config) {
    const {
      selector,
      field,
      getValue,
      delay = 200
    } = config;

    if (!selector || !field) {
      if (window.Logger) {
        window.Logger.warn('connectCard: selector ou field não especificado', config);
      }
      return;
    }

    setTimeout(() => {
      const cards = document.querySelectorAll(selector);
      
      if (cards.length > 0) {
        if (window.makeCardsClickable) {
          // Criar seletores únicos para cada card baseado em data-* ou índice
          const cardsConfig = Array.from(cards).map((card, index) => {
            // Tentar criar um seletor único baseado em atributos data-*
            let uniqueSelector = selector;
            if (card.dataset.value) {
              uniqueSelector = `${selector}[data-value="${card.dataset.value}"]`;
            } else if (card.dataset[field]) {
              uniqueSelector = `${selector}[data-${field}="${card.dataset[field]}"]`;
            } else if (card.id) {
              uniqueSelector = `#${card.id}`;
            } else {
              // Fallback: usar nth-child
              const parent = card.parentElement;
              if (parent) {
                const siblings = Array.from(parent.children);
                const childIndex = siblings.indexOf(card) + 1;
                uniqueSelector = `${selector}:nth-child(${childIndex})`;
              }
            }
            
            return {
              selector: uniqueSelector,
              value: getValue ? getValue(card) : (card.dataset.value || card.dataset[field] || card.textContent.trim()),
              field: field
            };
          });
          
          window.makeCardsClickable({
            cards: cardsConfig,
            field: field,
            getValueFromCard: getValue || ((card) => card.dataset.value || card.dataset[field] || card.textContent.trim())
          });

          if (window.Logger) {
            window.Logger.debug(`✅ ${cards.length} card(s) conectado(s) ao sistema de filtros`);
          }
        } else {
          // Fallback: adicionar listeners manualmente
          cards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
              e.preventDefault();
              const value = getValue ? getValue(card) : (card.dataset.value || card.textContent.trim());
              
              if (value && window.crossfilterOverview) {
                const methodName = `set${field.charAt(0).toUpperCase() + field.slice(1)}Filter`;
                const method = window.crossfilterOverview[methodName];
                if (method && typeof method === 'function') {
                  method.call(window.crossfilterOverview, value);
                  window.crossfilterOverview.notifyListeners();
                }
              }
            });
          });
        }
      } else if (delay < 2000) {
        // Tentar novamente
        connectCard({ ...config, delay: delay * 2 });
      }
    }, delay);
  }

  /**
   * Conectar KPIs ao sistema de filtros (reagir quando filtros mudam)
   */
  function connectKPI(config) {
    const {
      updateFunction,
      pageLoadFunction
    } = config;

    if (!updateFunction) {
      if (window.Logger) {
        window.Logger.warn('connectKPI: updateFunction não especificado', config);
      }
      return;
    }

    if (window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: updateFunction,
        pageLoadFunction: pageLoadFunction
      });

      if (window.Logger) {
        window.Logger.debug('✅ KPIs conectados ao sistema de filtros');
      }
    } else {
      // Fallback: listener manual
      if (window.crossfilterOverview) {
        window.crossfilterOverview.onFilterChange(() => {
          if (typeof updateFunction === 'function') {
            updateFunction();
          }
        });
      }
    }
  }

  /**
   * Conectar automaticamente TODOS os gráficos Chart.js de uma página
   */
  window.connectAllChartsInPage = function(pageId, fieldMap = {}) {
    const page = document.getElementById(pageId);
    if (!page) {
      if (window.Logger) {
        window.Logger.warn(`connectAllChartsInPage: Página ${pageId} não encontrada`);
      }
      return;
    }

    if (window.Logger) {
      window.Logger.debug(`🔗 Conectando todos os gráficos da página ${pageId}`);
    }

    // Encontrar todos os canvas na página
    const canvases = page.querySelectorAll('canvas');
    let connectedCount = 0;
    
    canvases.forEach((canvas, index) => {
      const chartId = canvas.id || `chart-${index}`;
      
      // Aguardar gráfico ser criado
      setTimeout(() => {
        const chart = window.ChartFactory?.getChart?.(chartId) || 
                     window.chartFactory?.getChart?.(chartId) ||
                     (window.Chart && Chart.getChart(chartId));

        if (chart && chart.canvas && chart.canvas.ownerDocument) {
          // Tentar detectar o campo baseado no ID ou contexto
          let field = fieldMap[chartId];
          
          if (!field) {
            // Detectar campo do ID do gráfico
            const idLower = chartId.toLowerCase();
            if (idLower.includes('tema') || idLower.includes('theme')) field = 'tema';
            else if (idLower.includes('assunto') || idLower.includes('subject')) field = 'assunto';
            else if (idLower.includes('status')) field = 'status';
            else if (idLower.includes('orgao') || idLower.includes('organ')) field = 'orgaos';
            else if (idLower.includes('canal')) field = 'canal';
            else if (idLower.includes('tipo')) field = 'tipo';
            else if (idLower.includes('prioridade')) field = 'prioridade';
            else if (idLower.includes('bairro')) field = 'bairro';
            else if (idLower.includes('responsavel')) field = 'responsavel';
            else if (idLower.includes('cadastrante')) field = 'cadastrante';
          }

          if (field) {
            try {
              // Obter dados do gráfico
              const labels = chart.data.labels || [];
              const datasets = chart.data.datasets || [];
              const dataArray = labels.map((label, idx) => {
                const value = datasets[0]?.data?.[idx] || 0;
                return {
                  value: value,
                  label: label,
                  index: idx,
                  [field]: label
                };
              });

              window.addCrossfilterToChart(chart, dataArray, {
                field: field,
                valueField: 'label',
                onFilterChange: () => {
                  // Encontrar função de load da página
                  const pageName = pageId.replace('page-', '').split('-').map(w => 
                    w.charAt(0).toUpperCase() + w.slice(1)
                  ).join('');
                  const loadFunction = window[`load${pageName}`] || window[`load${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`];
                  
                  if (loadFunction && typeof loadFunction === 'function') {
                    loadFunction();
                  }
                },
                onClearFilters: () => {
                  const pageName = pageId.replace('page-', '').split('-').map(w => 
                    w.charAt(0).toUpperCase() + w.slice(1)
                  ).join('');
                  const loadFunction = window[`load${pageName}`] || window[`load${pageName.charAt(0).toUpperCase() + pageName.slice(1)}`];
                  
                  if (loadFunction && typeof loadFunction === 'function') {
                    loadFunction();
                  }
                }
              });

              connectedCount++;
              if (window.Logger) {
                window.Logger.debug(`✅ Gráfico ${chartId} conectado automaticamente (campo: ${field})`);
              }
            } catch (error) {
              if (window.Logger) {
                window.Logger.warn(`Erro ao conectar gráfico ${chartId}:`, error);
              }
            }
          } else {
            if (window.Logger) {
              window.Logger.debug(`⏭️ Gráfico ${chartId} ignorado (campo não detectado)`);
            }
          }
        }
      }, 150 * (index + 1));
    });

    if (window.Logger && connectedCount > 0) {
      setTimeout(() => {
        window.Logger.success(`✅ ${connectedCount} gráfico(s) conectado(s) na página ${pageId}`);
      }, 1000);
    }
  };

  /**
   * Conectar automaticamente TODOS os cards clicáveis de uma página
   */
  window.connectAllCardsInPage = function(pageId, field) {
    const page = document.getElementById(pageId);
    if (!page || !field) {
      if (window.Logger) {
        window.Logger.warn(`connectAllCardsInPage: Página ${pageId} ou campo ${field} não especificado`);
      }
      return;
    }

    if (window.Logger) {
      window.Logger.debug(`🔗 Conectando todos os cards da página ${pageId} (campo: ${field})`);
    }

    // Encontrar cards comuns (divs com data-* ou classes específicas)
    const cardSelectors = [
      `.${field}-item`,
      `[data-${field}]`,
      `.card[data-value]`,
      `.item[data-value]`,
      `[data-value]`
    ];

    let totalCards = 0;

    cardSelectors.forEach(selector => {
      const cards = page.querySelectorAll(selector);
      if (cards.length > 0) {
        totalCards += cards.length;
        connectCard({
          selector: selector,
          field: field,
          getValue: (card) => card.dataset[field] || card.dataset.value || card.textContent.trim()
        });
      }
    });

    if (window.Logger && totalCards > 0) {
      setTimeout(() => {
        window.Logger.success(`✅ ${totalCards} card(s) conectado(s) na página ${pageId}`);
      }, 500);
    }
  };

  /**
   * Conectar TODOS os elementos de uma página automaticamente
   * Função principal que conecta gráficos, cards e KPIs
   */
  window.connectAllElementsInPage = function(pageId, config = {}) {
    const {
      fieldMap = {},
      defaultField = null,
      kpiUpdateFunction = null,
      pageLoadFunction = null
    } = config;

    if (window.Logger) {
      window.Logger.debug(`🔗 Conectando TODOS os elementos da página ${pageId}`);
    }

    // Conectar todos os gráficos
    if (window.connectAllChartsInPage) {
      window.connectAllChartsInPage(pageId, fieldMap);
    }

    // Conectar todos os cards
    if (defaultField && window.connectAllCardsInPage) {
      window.connectAllCardsInPage(pageId, defaultField);
    }

    // Conectar KPIs
    if (kpiUpdateFunction && window.makeKPIsReactive) {
      window.makeKPIsReactive({
        updateFunction: kpiUpdateFunction,
        pageLoadFunction: pageLoadFunction
      });
    }

    if (window.Logger) {
      window.Logger.success(`✅ Todos os elementos da página ${pageId} conectados`);
    }
  };

  if (window.Logger) {
    window.Logger.debug('✅ ConnectAllElements: Helper universal de conexão inicializado');
  }
})();

