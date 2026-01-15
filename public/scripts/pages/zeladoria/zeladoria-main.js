/**
 * Main Module - Zeladoria
 * Sistema de navegação SPA para Zeladoria (separado da Ouvidoria)
 */

function loadSection(page) {
  if (!page) return;
  
  // Esconder todas as páginas
  const allPages = document.getElementById('pages');
  if (allPages) {
    Array.from(allPages.children).forEach(p => {
      if (p.tagName === 'SECTION') {
        p.style.display = 'none';
      }
    });
  }
  
  // Mostrar página selecionada
  const pageElement = document.getElementById(`page-${page}`);
  if (pageElement) {
    pageElement.style.display = 'block';
  }
  
  // Atualizar menu ativo
  const nav = document.querySelector('nav');
  if (nav) {
    nav.querySelectorAll('div[data-page]').forEach(b => b.classList.remove('active'));
    const pageBtn = nav.querySelector(`[data-page="${page}"]`);
    if (pageBtn) {
      pageBtn.classList.add('active');
    }
  }
  
  // Carregar dados da página
  const loader = getPageLoader(page);
  if (loader) {
    loader().catch(error => {
      if (window.Logger) {
        window.Logger.error(`Erro ao carregar página ${page}:`, error);
      } else {
        console.error(`Erro ao carregar página ${page}:`, error);
      }
    });
  }
}

function getPageLoader(page) {
  const loaderMap = {
    'home': () => {
      if (window.Logger) {
        window.Logger.info('Página Home Zeladoria carregada');
      }
      return Promise.resolve();
    },
    'overview': window.loadZeladoriaOverview || (() => Promise.resolve()),
    // IDs antigos (compatibilidade com zeladoria.html deprecado)
    'demandas': window.loadColabDemandas || (() => Promise.resolve()),
    'criar': window.loadZeladoriaColabCriar || (() => Promise.resolve()),
    'categorias': window.loadZeladoriaColabCategorias || (() => Promise.resolve()),
    'mapa': window.loadZeladoriaMapa || (() => Promise.resolve()),
    'cora': window.loadCoraChat || (() => Promise.resolve()),
    // IDs novos (dashboard unificado)
    'zeladoria-colab-demandas': window.loadColabDemandas || (() => Promise.resolve()),
    'zeladoria-colab-criar': window.loadZeladoriaColabCriar || (() => Promise.resolve()),
    'zeladoria-colab-categorias': window.loadZeladoriaColabCategorias || (() => Promise.resolve()),
    'zeladoria-colab-mapa': window.loadZeladoriaColabMapa || (() => Promise.resolve()),
    'zeladoria-cora-chat': window.loadCoraChat || (() => Promise.resolve())
  };
  
  return loaderMap[page] || null;
}

function initNavigation() {
  const menuItems = document.querySelectorAll('[data-page]');
  menuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      if (page) {
        loadSection(page);
      }
    });
  });
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadSection('home');
  });
} else {
  initNavigation();
  loadSection('home');
}

// Exportar para uso global
window.loadSection = loadSection;

