/**
 * Main Module - Inicialização centralizada do sistema
 * Gerencia setup inicial, navegação SPA e event listeners globais
 */

function initPage() {
  if (window.globalFilters?.filters?.length > 0) {
    window.filters?.updateFilterIndicator?.();
    window.filters?.updatePageTitle?.();
  }

  const btnCentral = document.getElementById('btnSectionCentral');
  const btnOuvidoria = document.getElementById('btnSectionOuvidoria');
  const btnZeladoria = document.getElementById('btnSectionZeladoria');
  const btnEsic = document.getElementById('btnSectionEsic');

  let isCentral = btnCentral?.classList.contains('active');
  let isOuvidoria = btnOuvidoria?.classList.contains('active');
  let isZeladoria = btnZeladoria?.classList.contains('active');
  let isEsic = btnEsic?.classList.contains('active');

  // Se nenhum estiver ativo, padrão é Ouvidoria
  if (!isCentral && !isOuvidoria && !isZeladoria && !isEsic) {
    isOuvidoria = true;
  }

  const homePageId = isCentral ? 'page-central-dashboard' :
    (isOuvidoria ? 'page-home' :
      (isZeladoria ? 'page-zeladoria-home' : 'page-esic-home'));
  const homePageData = isCentral ? 'central-dashboard' :
    (isOuvidoria ? 'home' :
      (isZeladoria ? 'zeladoria-home' : 'esic-home'));

  const allPages = document.getElementById('pages');
  if (allPages) {
    Array.from(allPages.children).forEach(page => {
      if (page.tagName === 'SECTION') {
        page.style.display = page.id === homePageId ? 'block' : 'none';
      }
    });
  }

  // FALLBACK: Garantir que a página home seja exibida mesmo se não estiver no container #pages
  const homePage = document.getElementById(homePageId);
  if (homePage) {
    homePage.style.display = 'block';
    if (window.Logger) {
      window.Logger.debug(`✅ Página ${homePageId} exibida via fallback`);
    }
  } else {
    if (window.Logger) {
      window.Logger.warn(`⚠️ Página ${homePageId} não encontrada`);
    }
  }

  const activeMenu = isCentral ? document.getElementById('sideMenuCentral') :
    (isOuvidoria ? document.getElementById('sideMenuOuvidoria') :
      (isZeladoria ? document.getElementById('sideMenuZeladoria') : document.getElementById('sideMenuEsic')));

  if (activeMenu) {
    activeMenu.querySelectorAll('div[data-page]').forEach(b => b.classList.remove('active'));
    const homeBtn = activeMenu.querySelector(`[data-page="${homePageData}"]`);
    if (homeBtn) {
      homeBtn.classList.add('active');
    }
  }
}

function loadHome() {
  if (window.Logger) {
    window.Logger.info('Página Home carregada');
  }
  return Promise.resolve();
}

/**
 * Criar wrapper que aguarda função estar disponível
 */
function createWaitForFunctionWrapper(funcName) {
  return async function (...args) {
    // Tentar encontrar função imediatamente
    let func = window[funcName];
    if (func && typeof func === 'function') {
      return func(...args);
    }

    // Se não encontrou, aguardar até estar disponível (máximo 30 tentativas = 3 segundos)
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 30; // Aumentado para 30 tentativas (3 segundos)
      const delay = 100; // 100ms entre tentativas

      const checkAndExecute = () => {
        attempts++;
        func = window[funcName];

        if (func && typeof func === 'function') {
          // Função encontrada, executar
          if (window.Logger) {
            window.Logger.debug(`✅ Função ${funcName} encontrada após ${attempts} tentativa(s)`);
          }
          try {
            const result = func(...args);
            const promise = result && typeof result.then === 'function' ? result : Promise.resolve(result);
            promise.then(resolve).catch(resolve);
          } catch (error) {
            if (window.Logger) {
              window.Logger.error(`Erro ao executar ${funcName}:`, error);
            }
            resolve();
          }
        } else if (attempts >= maxAttempts) {
          // Timeout - função não encontrada após todas as tentativas
          // Verificar se o script pode estar com erro
          const scripts = Array.from(document.querySelectorAll('script[src]'));
          // Mapear funcName para nome do arquivo esperado
          const funcToFileMap = {
            'loadTempoMedio': 'tempo-medio.js',
            'loadVencimento': 'vencimento.js',
            'loadOverview': 'overview.js',
            'loadOrgaoMes': 'orgao-mes.js',
            'loadTema': 'tema.js',
            'loadAssunto': 'assunto.js',
            'loadStatus': 'status.js',
            'loadUnidadesSaude': 'unidades-saude.js'
          };
          const expectedFileName = funcToFileMap[funcName] || funcName.replace('load', '').toLowerCase() + '.js';
          const scriptSrc = scripts.find(s => s.src && s.src.includes(expectedFileName));

          if (window.Logger) {
            const debugInfo = {
              funcName,
              attempts,
              windowHasFunc: typeof window[funcName],
              scriptLoaded: !!scriptSrc,
              scriptSrc: scriptSrc?.src || 'não encontrado',
              expectedFile: expectedFileName
            };
            window.Logger.warn(`Função ${funcName} não encontrada após ${maxAttempts} tentativas`, debugInfo);
          }
          resolve();
        } else {
          // Tentar novamente após delay
          const timerId = window.timerManager
            ? window.timerManager.setTimeout(checkAndExecute, delay, `waitFor-${funcName}-retry`)
            : setTimeout(checkAndExecute, delay);
        }
      };

      checkAndExecute();
    });
  };
}

function getPageLoader(page) {
  if (page === 'home') return loadHome;
  if (page === 'unidades-saude') return window.loadUnidadesSaude || (() => Promise.resolve());
  if (page === 'zeladoria-home') {
    return () => {
      if (window.Logger) {
        window.Logger.info('Página Home Zeladoria carregada');
      }
      return Promise.resolve();
    };
  }
  if (page === 'zeladoria-overview') {
    return window.loadZeladoriaOverview || (() => Promise.resolve());
  }
  if (page === 'esic-home') {
    return () => {
      if (window.Logger) {
        window.Logger.info('Página Home E-SIC carregada');
      }
      // Não precisa carregar dados, apenas mostrar a página
      return Promise.resolve();
    };
  }
  if (page === 'esic-overview') {
    return window.loadEsicOverview || (() => Promise.resolve());
  }

  // Páginas dinâmicas de unidades de saúde
  if (page?.startsWith('unit-')) {
    const unitName = page.replace('unit-', '').replace(/-/g, ' ');
    return () => {
      const func = window.loadUnit;
      if (!func) {
        if (window.Logger) {
          window.Logger.warn(`Função loadUnit não encontrada para unidade ${unitName}`);
        }
        return Promise.resolve();
      }
      const result = func(unitName);
      return result instanceof Promise ? result : Promise.resolve(result);
    };
  }

  // Mapeamento direto para funções específicas
  const loaderMap = {
    'main': 'loadOverview',
    'cora-chat': 'loadCoraChat',
    'orgao-mes': 'loadOrgaoMes',
    'tempo-medio': 'loadTempoMedio',
    'vencimento': 'loadVencimento',
    'notificacoes': 'loadNotificacoes',
    'filtros-avancados': 'loadFiltrosAvancados',
    'tema': 'loadTema',
    'assunto': 'loadAssunto',
    'cadastrante': 'loadCadastrante',
    'reclamacoes': 'loadReclamacoes',
    'projecao-2026': 'loadProjecao2026',
    'tipo': 'loadTipo',
    'status': 'loadStatusPage',
    'bairro': 'loadBairro',
    'responsavel': 'loadResponsavel',
    'canal': 'loadCanal',
    'prioridade': 'loadPrioridade',
    // Páginas de Zeladoria
    'zeladoria-status': 'loadZeladoriaStatus',
    'zeladoria-categoria': 'loadZeladoriaCategoria',
    'zeladoria-departamento': 'loadZeladoriaDepartamento',
    'zeladoria-bairro': 'loadZeladoriaBairro',
    'zeladoria-responsavel': 'loadZeladoriaResponsavel',
    'zeladoria-canal': 'loadZeladoriaCanal',
    'zeladoria-tempo': 'loadZeladoriaTempo',
    'zeladoria-mensal': 'loadZeladoriaMensal',
    'zeladoria-geografica': 'loadZeladoriaGeografica',
    'zeladoria-mapa': 'loadZeladoriaMapa',
    'zeladoria-colab-demandas': 'loadColabDemandas',
    'zeladoria-colab-criar': 'loadZeladoriaColabCriar',
    'zeladoria-colab-categorias': 'loadZeladoriaColabCategorias',
    'zeladoria-colab-mapa': 'loadZeladoriaColabMapa',
    'zeladoria-cora-chat': 'loadCoraChat',
    // Páginas de E-SIC
    'esic-status': 'loadEsicStatus',
    'esic-tipo-informacao': 'loadEsicTipoInformacao',
    'esic-responsavel': 'loadEsicResponsavel',
    'esic-unidade': 'loadEsicUnidade',
    'esic-canal': 'loadEsicCanal',
    'esic-mensal': 'loadEsicMensal',
    // Páginas do Painel Central
    'central-dashboard': 'loadCentralDashboard',
    'central-zeladoria': 'loadCentralZeladoria',
    'central-ouvidoria': 'loadCentralOuvidoria',
    'central-esic': 'loadCentralEsic',
    'central-cora': 'loadCentralCora',
    // Página de Configurações
    'configuracoes': 'loadConfiguracoes',
    'admin-users': 'loadAdminUsers',
    'auditoria': 'loadAuditoria'
  };

  const funcName = loaderMap[page];
  if (funcName) {
    const func = window[funcName];
    if (func && typeof func === 'function') {
      return func;
    }

    // Se a função não está disponível, criar um wrapper que aguarda ela estar disponível
    return createWaitForFunctionWrapper(funcName);
  }

  // Fallback: tentar gerar nome da função dinamicamente
  const loaderName = `load${page.charAt(0).toUpperCase() + page.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`;

  if (window[loaderName] && typeof window[loaderName] === 'function') {
    return window[loaderName];
  }

  if (window.data && window.data[loaderName] && typeof window.data[loaderName] === 'function') {
    return window.data[loaderName];
  }

  // Tentar aguardar função dinâmica também
  return createWaitForFunctionWrapper(loaderName);
}

async function loadSection(page) {
  if (!page) return;

  // FILTROS LOCAIS POR PÁGINA: Limpar filtros ao trocar de página
  if (window.chartCommunication && window.chartCommunication.filters) {
    const currentFilters = window.chartCommunication.filters.filters || [];
    if (currentFilters.length > 0) {
      if (window.Logger) {
        window.Logger.debug(`🔄 Limpando ${currentFilters.length} filtro(s) ao trocar para página: ${page}`);
      }
      window.chartCommunication.clearFilters();
    }
  }

  const loader = getPageLoader(page);

  if (!loader) {
    if (window.Logger) {
      window.Logger.warn(`Loader não encontrado para página: ${page}`);
    }
    return;
  }

  // Esconder TODAS as páginas (incluindo as que estão fora do container #pages)
  const allPages = document.getElementById('pages');
  if (allPages) {
    Array.from(allPages.children).forEach(p => {
      if (p.tagName === 'SECTION') {
        p.style.display = 'none';
      }
    });
  }

  // Também esconder páginas que possam estar fora do container #pages
  document.querySelectorAll('section[id^="page-"]').forEach(section => {
    section.style.display = 'none';
  });

  // Mostrar a página solicitada
  const pageElement = document.getElementById(`page-${page}`);
  if (pageElement) {
    pageElement.style.display = 'block';
    if (window.Logger) {
      window.Logger.debug(`✅ Página ${page} exibida`);
    }
  } else {
    if (window.Logger) {
      window.Logger.warn(`⚠️ Página page-${page} não encontrada`);
    }
  }

  const activeMenu = document.getElementById('sideMenuCentral')?.style.display !== 'none'
    ? document.getElementById('sideMenuCentral')
    : (document.getElementById('sideMenuOuvidoria')?.style.display !== 'none'
      ? document.getElementById('sideMenuOuvidoria')
      : (document.getElementById('sideMenuZeladoria')?.style.display !== 'none'
        ? document.getElementById('sideMenuZeladoria')
        : document.getElementById('sideMenuEsic')));

  if (activeMenu) {
    activeMenu.querySelectorAll('div[data-page]').forEach(b => b.classList.remove('active'));
    const pageBtn = activeMenu.querySelector(`[data-page="${page}"]`);
    if (pageBtn) {
      pageBtn.classList.add('active');
    }
  }

  try {
    await loader();
  } catch (error) {
    if (window.Logger) {
      window.Logger.error(`Erro ao carregar página ${page}:`, error);
    }
  }
}

function initNavigation() {
  // Função para aguardar elementos estarem disponíveis
  function waitForMenuItems(maxAttempts = 50, interval = 100) {
    return new Promise((resolve) => {
      let attempts = 0;
      const checkItems = () => {
        const items = document.querySelectorAll('[data-page]');
        if (items.length > 0 || attempts >= maxAttempts) {
          resolve(items);
        } else {
          attempts++;
          setTimeout(checkItems, interval);
        }
      };
      checkItems();
    });
  }

  waitForMenuItems().then(menuItems => {
    if (menuItems.length === 0) {
      if (window.Logger) {
        window.Logger.warn('Nenhum item de menu encontrado, tentando novamente...');
      }
      // Re-tentar após 1 segundo
      setTimeout(initNavigation, 1000);
      return;
    }

    menuItems.forEach(item => {
      // Remover listeners anteriores para evitar duplicação
      const newItem = item.cloneNode(true);
      item.parentNode.replaceChild(newItem, item);

      const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const page = newItem.getAttribute('data-page');
        if (page) {
          loadSection(page);
        }
      };

      // Adicionar múltiplos tipos de listeners
      newItem.addEventListener('click', handler, { passive: false, capture: false });
      newItem.addEventListener('touchend', handler, { passive: false, capture: false });
      newItem.onclick = handler;
      newItem.setAttribute('data-listener-attached', 'true');
    });

    if (window.Logger) {
      window.Logger.debug(`✅ ${menuItems.length} itens de menu inicializados`);
    }
  });
}

function initSectionSelector() {
  // Função auxiliar para aguardar elemento estar disponível
  function waitForElement(selector, maxAttempts = 50, interval = 100) {
    return new Promise((resolve) => {
      let attempts = 0;
      const checkElement = () => {
        const element = typeof selector === 'string'
          ? document.querySelector(selector)
          : (typeof selector === 'function' ? selector() : selector);

        if (element) {
          resolve(element);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkElement, interval);
        } else {
          resolve(null);
        }
      };
      checkElement();
    });
  }

  // Aguardar elementos críticos estarem disponíveis
  Promise.all([
    waitForElement(() => document.getElementById('btnSectionCentral')),
    waitForElement(() => document.getElementById('btnSectionOuvidoria')),
    waitForElement(() => document.getElementById('btnSectionZeladoria')),
    waitForElement(() => document.getElementById('btnSectionEsic')),
    waitForElement(() => document.getElementById('sideMenuCentral')),
    waitForElement(() => document.getElementById('sideMenuOuvidoria')),
    waitForElement(() => document.getElementById('sideMenuZeladoria')),
    waitForElement(() => document.getElementById('sideMenuEsic')),
    waitForElement(() => document.getElementById('sectionTitle'))
  ]).then(([btnCentralEl, btnOuvidoriaEl, btnZeladoriaEl, btnEsicEl, menuCentralEl, menuOuvidoriaEl, menuZeladoriaEl, menuEsicEl, sectionTitleEl]) => {
    // Debug: verificar elementos encontrados
    if (window.Logger) {
      window.Logger.debug('Inicializando seletor de seções:', {
        btnCentral: !!btnCentralEl,
        btnOuvidoria: !!btnOuvidoriaEl,
        btnZeladoria: !!btnZeladoriaEl,
        btnEsic: !!btnEsicEl,
        menuCentral: !!menuCentralEl,
        menuOuvidoria: !!menuOuvidoriaEl,
        menuZeladoria: !!menuZeladoriaEl,
        menuEsic: !!menuEsicEl
      });
    }

    // Verificar elementos mínimos necessários
    if (!btnOuvidoriaEl || !btnZeladoriaEl || !menuOuvidoriaEl || !menuZeladoriaEl) {
      if (window.Logger) {
        window.Logger.warn('Elementos básicos não encontrados para initSectionSelector, tentando novamente...');
      }
      // Re-tentar após 1 segundo
      setTimeout(initSectionSelector, 1000);
      return;
    }

    // Variáveis locais para uso no switchSection
    let btnCentral = btnCentralEl;
    let btnOuvidoria = btnOuvidoriaEl;
    let btnZeladoria = btnZeladoriaEl;
    let btnEsic = btnEsicEl;
    let menuCentral = menuCentralEl;
    let menuOuvidoria = menuOuvidoriaEl;
    let menuZeladoria = menuZeladoriaEl;
    let menuEsic = menuEsicEl;
    let sectionTitle = sectionTitleEl;

    function switchSection(section) {
      console.log('🔄 switchSection chamado com:', section);

      // Remover active de todos os botões (se existirem)
      if (btnCentral) btnCentral.classList.remove('active');
      if (btnOuvidoria) btnOuvidoria.classList.remove('active');
      if (btnZeladoria) btnZeladoria.classList.remove('active');
      if (btnEsic) btnEsic.classList.remove('active');

      // Esconder todos os menus (se existirem)
      if (menuCentral) menuCentral.style.display = 'none';
      if (menuOuvidoria) menuOuvidoria.style.display = 'none';
      if (menuZeladoria) menuZeladoria.style.display = 'none';
      if (menuEsic) menuEsic.style.display = 'none';

      if (section === 'central') {
        console.log('✅ Ativando seção Painel Central');
        if (btnCentral) {
          btnCentral.classList.add('active');
          console.log('✅ Botão Central marcado como active');
        } else {
          console.error('❌ btnCentral não encontrado');
        }
        if (menuCentral) {
          menuCentral.style.display = 'block';
          console.log('✅ Menu Central exibido');
        } else {
          console.error('❌ menuCentral não encontrado');
        }
        if (sectionTitle) {
          sectionTitle.textContent = 'Painel Central';
          console.log('✅ Título atualizado para Painel Central');
        }
        loadSection('central-dashboard');

        if (window.Logger) {
          window.Logger.info('Seção Painel Central ativada');
        }
      } else if (section === 'ouvidoria') {
        if (btnOuvidoria) btnOuvidoria.classList.add('active');
        if (menuOuvidoria) menuOuvidoria.style.display = 'block';
        if (sectionTitle) sectionTitle.textContent = 'Ouvidoria';
        loadSection('home');
      } else if (section === 'zeladoria') {
        if (btnZeladoria) btnZeladoria.classList.add('active');
        if (menuZeladoria) menuZeladoria.style.display = 'block';
        if (sectionTitle) sectionTitle.textContent = 'Zeladoria';
        loadSection('zeladoria-home');
      } else if (section === 'esic') {
        console.log('✅ Ativando seção E-SIC');
        if (btnEsic) {
          btnEsic.classList.add('active');
          console.log('✅ Botão E-SIC marcado como active');
        } else {
          console.error('❌ btnEsic não encontrado');
        }
        if (menuEsic) {
          menuEsic.style.display = 'block';
          console.log('✅ Menu E-SIC exibido');
        } else {
          console.error('❌ menuEsic não encontrado');
        }
        if (sectionTitle) {
          sectionTitle.textContent = 'E-SIC';
          console.log('✅ Título atualizado para E-SIC');
        }
        loadSection('esic-home');

        if (window.Logger) {
          window.Logger.info('Seção E-SIC ativada');
        }
      }
    }

    // Função para adicionar event listener de forma robusta
    function addClickListener(element, handler, name) {
      if (!element) return;

      // Remover listeners anteriores para evitar duplicação
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);

      // Adicionar múltiplos tipos de listeners para garantir funcionamento
      newElement.addEventListener('click', handler, { passive: false, capture: false });
      newElement.addEventListener('touchend', handler, { passive: false, capture: false });

      // Fallback: onclick direto
      newElement.onclick = handler;

      // Adicionar atributo para debug
      newElement.setAttribute('data-listener-attached', 'true');

      if (window.Logger) {
        window.Logger.debug(`✅ Event listener adicionado ao ${name}`);
      }

      return newElement;
    }

    // Adicionar event listeners de forma robusta
    const handlerCentral = (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchSection('central');
    };

    const handlerOuvidoria = (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchSection('ouvidoria');
    };

    const handlerZeladoria = (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchSection('zeladoria');
    };

    const handlerEsic = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.Logger) {
        window.Logger.debug('🔵 Botão E-SIC clicado - chamando switchSection');
      }
      switchSection('esic');
    };

    if (btnCentral) {
      btnCentral = addClickListener(btnCentral, handlerCentral, 'btnSectionCentral');
    }

    if (btnOuvidoria) {
      btnOuvidoria = addClickListener(btnOuvidoria, handlerOuvidoria, 'btnSectionOuvidoria');
    }

    if (btnZeladoria) {
      btnZeladoria = addClickListener(btnZeladoria, handlerZeladoria, 'btnSectionZeladoria');
    }

    if (btnEsic) {
      btnEsic = addClickListener(btnEsic, handlerEsic, 'btnSectionEsic');
    }

    // Expor função globalmente para debug e fallback
    window.switchSection = switchSection;
    globalSwitchSection = switchSection; // Guardar em variável global também

    if (window.Logger) {
      window.Logger.debug('✅ switchSection exposto globalmente');
    }
  });
}

function initEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (window.filters?.clearFilters) {
        window.filters.clearFilters();
      }
    }
  });
}

async function preloadData() {
  try {
    if (window.dataLoader && window.dataLoader.load) {
      await window.dataLoader.load('/api/summary', { useDataStore: true });
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao pré-carregar dados:', error);
    }
  }
}

function initUrlRouting() {
  // Verificar se há rota na URL
  const path = window.location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section');
  const hash = window.location.hash.replace('#', '');

  // Tratar parâmetro ?section=zeladoria, ?section=ouvidoria, ?section=esic
  // OU hash #zeladoria, #ouvidoria, #esic (compatibilidade)
  const sectionToLoad = section || (hash && ['zeladoria', 'ouvidoria', 'esic'].includes(hash) ? hash : null);

  if (sectionToLoad && ['zeladoria', 'ouvidoria', 'esic'].includes(sectionToLoad)) {
    // Aguardar um pouco para garantir que switchSection está disponível
    setTimeout(() => {
      if (window.switchSection) {
        window.switchSection(sectionToLoad);
        // Limpar parâmetro da URL sem recarregar
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }, 100);
  }

  if (path === '/chat' || path === '/chat/') {
    // Carregar página de chat
    loadSection('cora-chat');
    // Atualizar URL sem recarregar a página
    window.history.replaceState({}, '', '/');
  }
}

// Expor switchSection globalmente ANTES de init
let globalSwitchSection = null;

// Função switchSection global (será sobrescrita pela versão completa)
window.switchSection = function (section) {
  console.warn('⚠️ switchSection chamado antes da inicialização completa, tentando novamente...');
  // Tentar encontrar elementos e executar
  const btnOuvidoria = document.getElementById('btnSectionOuvidoria');
  const btnZeladoria = document.getElementById('btnSectionZeladoria');
  const btnEsic = document.getElementById('btnSectionEsic');
  const menuOuvidoria = document.getElementById('sideMenuOuvidoria');
  const menuZeladoria = document.getElementById('sideMenuZeladoria');
  const menuEsic = document.getElementById('sideMenuEsic');
  const sectionTitle = document.getElementById('sectionTitle');

  if (section === 'esic') {
    if (btnEsic) btnEsic.classList.add('active');
    if (btnOuvidoria) btnOuvidoria.classList.remove('active');
    if (btnZeladoria) btnZeladoria.classList.remove('active');
    if (menuEsic) menuEsic.style.display = 'block';
    if (menuOuvidoria) menuOuvidoria.style.display = 'none';
    if (menuZeladoria) menuZeladoria.style.display = 'none';
    if (sectionTitle) sectionTitle.textContent = 'E-SIC';
    if (window.loadSection) {
      window.loadSection('esic-home');
    }
  }
};

function init() {
  initSectionSelector();
  checkUserPermissions(); // Verificar permissões RBAC
  initPage();
  initNavigation();
  initEventListeners();
  initUrlRouting(); // Adicionar roteamento de URL

  // Garantir que switchSection está disponível
  if (globalSwitchSection) {
    window.switchSection = globalSwitchSection;
  }

  // Usar Timer Manager se disponível, senão fallback para setTimeout
  if (window.timerManager) {
    window.timerManager.setTimeout(preloadData, 2000, 'preloadData');
  } else {
    setTimeout(preloadData, 2000);
  }

  if (window.Logger) {
    window.Logger.success('Sistema inicializado');
  } else {
    console.log('✅ Sistema inicializado');
  }

  // Esconder loading após inicialização completa
  hideLoadingScreen();

  // Verificação adicional: se após 5 segundos ainda estiver mostrando loading, esconder forçadamente
  setTimeout(() => {
    const loadingContainer = document.getElementById('city-loading-container');
    if (loadingContainer && loadingContainer.style.display !== 'none') {
      if (window.Logger) {
        window.Logger.warn('⚠️ Loading ainda visível após 5s, escondendo forçadamente');
      }
      if (window.cityLoading) {
        window.cityLoading.hide();
      } else {
        loadingContainer.style.opacity = '0';
        loadingContainer.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          loadingContainer.style.display = 'none';
        }, 500);
      }
    }
  }, 5000);
}

/**
 * Esconde a tela de loading quando o sistema estiver pronto
 */
function hideLoadingScreen() {
  let attempts = 0;
  const maxAttempts = 30; // Máximo de 15 segundos (30 * 500ms)
  const minWaitTime = 2000; // Mínimo de 2 segundos antes de esconder
  const startTime = Date.now();

  const hideLoading = () => {
    if (window.cityLoading) {
      window.cityLoading.hide();
    } else {
      // Fallback caso cityLoading não esteja disponível
      const loadingContainer = document.getElementById('city-loading-container');
      if (loadingContainer) {
        loadingContainer.style.opacity = '0';
        loadingContainer.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          loadingContainer.style.display = 'none';
        }, 500);
      }
    }
  };

  // Verificar se os principais componentes estão carregados
  const checkComponents = () => {
    attempts++;
    const elapsed = Date.now() - startTime;

    const hasDataStore = typeof window.dataStore !== 'undefined';
    const hasChartFactory = typeof window.ChartFactory !== 'undefined';
    const hasGlobalFilters = typeof window.globalFilters !== 'undefined';
    const hasLogger = typeof window.Logger !== 'undefined';

    // Verificar se a página principal está visível (indicando que o sistema carregou)
    const pagesContainer = document.getElementById('pages');
    const hasPages = pagesContainer && pagesContainer.children.length > 0;

    // Condições para esconder:
    // 1. Componentes principais carregados OU
    // 2. Passou o tempo mínimo E tem páginas OU
    // 3. Máximo de tentativas atingido
    const componentsReady = hasDataStore && hasChartFactory && hasGlobalFilters && hasLogger;
    const minTimePassed = elapsed >= minWaitTime;
    const maxAttemptsReached = attempts >= maxAttempts;

    if (componentsReady && minTimePassed) {
      // Componentes prontos e tempo mínimo passado
      setTimeout(hideLoading, 500);
      if (window.Logger) {
        window.Logger.debug('🔍 Componentes carregados, escondendo loading...');
      }
    } else if (minTimePassed && hasPages && (hasDataStore || hasChartFactory)) {
      // Tempo mínimo passado, tem páginas e pelo menos alguns componentes
      setTimeout(hideLoading, 500);
      if (window.Logger) {
        window.Logger.debug('🔍 Sistema parcialmente carregado, escondendo loading...');
      }
    } else if (maxAttemptsReached) {
      // Timeout - esconder mesmo assim
      hideLoading();
      if (window.Logger) {
        window.Logger.warn('⚠️ Timeout ao verificar componentes, escondendo loading forçadamente');
      }
    } else {
      // Continuar verificando
      setTimeout(checkComponents, 500);
    }
  };

  // Iniciar verificação após um pequeno delay
  setTimeout(checkComponents, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.main = {
  init,
  initPage,
  loadHome,
  loadSection,
  initNavigation,
  initSectionSelector,
  initEventListeners
};

// Garantir que switchSection está disponível globalmente
if (globalSwitchSection) {
  window.switchSection = globalSwitchSection;
}

window.initPage = initPage;
window.loadHome = loadHome;
window.loadSection = loadSection;


/**
 * Verifica as permissões do usuário logado e aplica regras de interface (RBAC)
 */
async function checkUserPermissions() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (data.success && data.user) {
      applyRBAC(data.user);
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao verificar permissões:', error);
    }
  }
}

/**
 * Aplica regras de visibilidade baseadas na Role do usuário
 * Refatorado para RBAC Hierárquico (CÉREBRO X-3)
 * @param {Object} user - Objeto do usuário
 */
function applyRBAC(user) {
  const role = user.role || 'visualizador';

  if (window.Logger) {
    window.Logger.info(`🔒 Aplicando regras de acesso para: ${user.username} (${role})`);
  }

  // Prevenção de segurança: Salvar role globalmente
  window.currentUserRole = role;

  // Definição de Hierarquia (Backend align)
  const ROLE_LEVELS = {
    'master': 100,
    'administrador': 50,
    'analista': 20,
    'visualizador': 10
  };

  const currentLevel = ROLE_LEVELS[role] || 0;

  // Lógica de visibilidade baseada em data-role
  document.querySelectorAll('[data-role]').forEach(el => {
    const requiredRole = el.getAttribute('data-role');
    const requiredLevel = ROLE_LEVELS[requiredRole] || 0;

    if (currentLevel < requiredLevel) {
      el.style.display = 'none';
      el.classList.add('hidden-by-rbac');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.style.display = 'block';
      el.classList.remove('hidden-by-rbac');
      el.removeAttribute('aria-hidden');
    }
  });

  // Regras legadas e seletores específicos
  if (role !== 'administrador' && role !== 'master') {
    document.querySelectorAll('.admin-only, [data-page="configuracoes"]').forEach(el => {
      el.style.display = 'none';
      el.classList.add('hidden-by-rbac');
    });
  }

  // Atualizar interface com info do usuário
  const userDisplay = document.getElementById('user-role-display');
  if (userDisplay) {
    const roleNames = {
      'master': 'Master',
      'administrador': 'Administrador',
      'analista': 'Analista',
      'visualizador': 'Visualizador'
    };
    userDisplay.textContent = roleNames[role] || role;
  }
}
