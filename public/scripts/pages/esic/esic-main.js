/**
 * ============================================================================
 * ROUTER PRINCIPAL - e-SIC
 * ============================================================================
 * 
 * Gerencia a navegação entre as páginas do módulo e-SIC
 * Similar ao zeladoria-main.js
 */

// Mapeamento de páginas - usando funções globais diretamente (não módulos ES6)
const pageMap = {
  'home': null,
  'overview': () => {
    const fn = window.loadEsicOverview;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'status': () => {
    const fn = window.loadEsicStatus;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'tipo-informacao': () => {
    const fn = window.loadEsicTipoInformacao;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'responsavel': () => {
    const fn = window.loadEsicResponsavel;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'unidade': () => {
    const fn = window.loadEsicUnidade;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'canal': () => {
    const fn = window.loadEsicCanal;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  },
  'mensal': () => {
    const fn = window.loadEsicMensal;
    return fn ? Promise.resolve(fn) : Promise.resolve(() => Promise.resolve());
  }
};

let currentPage = 'home';
let currentLoader = null;

/**
 * Carregar seção específica
 */
window.loadSection = function(pageId) {
  if (currentPage === pageId) return;
  
  // Esconder todas as páginas
  document.querySelectorAll('section[id^="page-"]').forEach(section => {
    section.style.display = 'none';
  });
  
  // Remover active de todos os nav items
  document.querySelectorAll('nav div[data-page]').forEach(item => {
    item.classList.remove('active');
  });
  
  // Ativar nav item
  const navItem = document.querySelector(`nav div[data-page="${pageId}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }
  
  // Mostrar página (adicionar prefixo 'esic-' exceto para 'home')
  const pageElementId = pageId === 'home' ? `page-${pageId}` : `page-esic-${pageId}`;
  const page = document.getElementById(pageElementId);
  if (page) {
    page.style.display = 'block';
  }
  
  // Atualizar título
  const titles = {
    'home': '🏠 Home - e-SIC',
    'overview': '📊 Visão Geral - e-SIC',
    'status': '📈 Por Status - e-SIC',
    'tipo-informacao': '📑 Tipo de Informação - e-SIC',
    'responsavel': '👤 Por Responsável - e-SIC',
    'unidade': '🏢 Por Unidade - e-SIC',
    'canal': '📞 Por Canal - e-SIC',
    'mensal': '📅 Análise Mensal - e-SIC'
  };
  
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.innerHTML = `<h1 class="neon text-3xl font-bold">${titles[pageId] || 'e-SIC'}</h1>`;
  }
  
  // Carregar loader da página
  currentPage = pageId;
  const loader = pageMap[pageId];
  
  if (loader && typeof loader === 'function') {
    loader().then(loadFn => {
      if (loadFn && typeof loadFn === 'function') {
        loadFn();
      }
    }).catch(err => {
      window.Logger?.error('Erro ao carregar página e-SIC:', err);
    });
  }
};

// Inicializar navegação
document.addEventListener('DOMContentLoaded', () => {
  // Adicionar event listeners aos nav items
  document.querySelectorAll('nav div[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      if (pageId) {
        loadSection(pageId);
      }
    });
  });
  
  // Carregar página inicial
  loadSection('home');
});

