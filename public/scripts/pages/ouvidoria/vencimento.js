/**
 * Página: Vencimento
 * Protocolos próximos de vencer ou já vencidos
 * 
 * Mostra protocolos com:
 * - Protocolo
 * - Setor
 * - Informações (o que é)
 * - Secretaria
 * - Data de vencimento
 * - Dias restantes
 * 
 * Filtros disponíveis:
 * - Vencidos
 * - 3 dias, 7 dias, 15 dias, 30 dias
 * - Prazo customizado
 * - Filtro por secretaria
 */

let filtroAtual = 'vencidos';
let secretariaFiltro = null;
let tempoResolucaoFiltro = null;
let protocolosCompletos = [];
let protocolosExibidos = [];
let itensPorPagina = 100;
let paginaAtual = 0;

/**
 * Carregar dados de vencimento
 */
async function loadVencimento(forceRefresh = false) {
  // PRIORIDADE 1: Verificar dependências críticas
  const dependencies = window.errorHandler?.requireDependencies(
    ['dataLoader'],
    () => {
      window.errorHandler?.showNotification(
        'Sistema não carregado. Recarregue a página.',
        'warning'
      );
      return null;
    }
  );
  
  if (!dependencies) {
    return Promise.resolve();
  }
  
  const { dataLoader } = dependencies;
  
  if (window.Logger) {
    window.Logger.debug('⏰ loadVencimento: Iniciando');
  }
  
  const page = document.getElementById('page-vencimento');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  // PRIORIDADE 2: Mostrar loading
  window.loadingManager?.showInElement('tableVencimento', 'Carregando protocolos de vencimento...');
  
  // PRIORIDADE 1: Usar safeAsync para tratamento de erros
  return await window.errorHandler?.safeAsync(async () => {
    // Garantir que o dropdown está populado ANTES de obter os valores
    const selectSecretaria = document.getElementById('selectSecretariaVencimento');
    if (selectSecretaria && selectSecretaria.options.length <= 1) {
      await popularDropdownSecretarias();
    }
    
    // Coletar filtros de mês e status usando o novo helper
    const filtrosPagina = window.PageFiltersHelper?.coletarFiltrosMesStatus?.('Vencimento') || [];
    
    // Obter filtros selecionados APÓS popular os dropdowns
    const selectFiltro = document.getElementById('selectFiltroVencimento');
    const selectSecretariaEl = document.getElementById('selectSecretariaVencimento');
    const selectTempoResolucao = document.getElementById('selectTempoResolucaoVencimento');
    
    const filtro = selectFiltro?.value || 'vencidos';
    const secretaria = selectSecretariaEl?.value || '';
    const tempoResolucao = selectTempoResolucao?.value || '';
    
    filtroAtual = filtro;
    secretariaFiltro = (secretaria && secretaria.trim() !== '' && secretaria !== 'Todas as secretarias') ? secretaria.trim() : null;
    tempoResolucaoFiltro = (tempoResolucao && tempoResolucao.trim() !== '') ? tempoResolucao.trim() : null;
    
    // Combinar com filtros globais
    let activeFilters = filtrosPagina;
    if (window.chartCommunication) {
      const globalFilters = window.chartCommunication.filters?.filters || [];
      activeFilters = [...globalFilters, ...filtrosPagina];
    }
    
    // Construir URL da API
    let url = `/api/vencimento?filtro=${encodeURIComponent(filtro)}`;
    if (secretariaFiltro) {
      url += `&secretaria=${encodeURIComponent(secretariaFiltro)}`;
    }
    if (tempoResolucaoFiltro) {
      url += `&tempoResolucao=${encodeURIComponent(tempoResolucaoFiltro)}`;
    }
    
    if (window.Logger) {
      window.Logger.debug(`⏰ Carregando vencimentos: filtro=${filtro}, secretaria=${secretariaFiltro || 'todas'}, url=${url}`);
    }
    
    // Carregar dados (sempre forçar refresh quando há filtro de secretaria)
    const forceRefreshComFiltros = forceRefresh || !!secretariaFiltro;
    
    const dataRaw = await dataLoader.load(url, {
      useDataStore: !forceRefreshComFiltros,
      ttl: 2 * 60 * 1000, // Cache de 2 minutos
      fallback: { total: 0, filtro, protocolos: [] }
    }) || { total: 0, filtro, protocolos: [] };
    
    // PRIORIDADE 1: Validar dados recebidos
    const validation = window.dataValidator?.validateDataStructure(dataRaw, {
      required: ['total', 'filtro', 'protocolos'],
      types: {
        total: 'number',
        filtro: 'string',
        protocolos: 'array'
      }
    });
    
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.error}`);
    }
    
    const data = validation.data;
    
    if (window.Logger) {
      window.Logger.debug(`⏰ Dados recebidos: ${data.total} protocolos`);
    }
    
    // Armazenar todos os protocolos
    protocolosCompletos = data.protocolos || [];
    paginaAtual = 0;
    
    // PRIORIDADE 2: Esconder loading ANTES de renderizar
    window.loadingManager?.hideInElement('tableVencimento');
    
    // Renderizar tabela (primeira página)
    renderVencimentoTable();
    
    // Atualizar contador
    updateVencimentoCounter(data);
    
    if (window.Logger) {
      window.Logger.success('⏰ loadVencimento: Concluído');
    }
    
    return { success: true, data };
  }, 'loadVencimento', {
    showToUser: true,
    fallback: () => {
      // PRIORIDADE 2: Esconder loading em caso de erro
      window.loadingManager?.hideInElement('tableVencimento');
      
      // Mostrar mensagem de erro
      const tableContainer = document.getElementById('tableVencimento');
      if (tableContainer) {
        tableContainer.innerHTML = `
          <div class="text-center py-8 text-red-400">
            <div class="text-2xl mb-2">❌</div>
            <div>Erro ao carregar dados de vencimento</div>
            <div class="text-sm text-slate-400 mt-2">Tente recarregar a página</div>
          </div>
        `;
      }
      return { success: false, data: { total: 0, filtro: 'vencidos', protocolos: [] } };
    }
  });
}

/**
 * Renderizar tabela de protocolos (com paginação)
 */
function renderVencimentoTable() {
  const tableContainer = document.getElementById('tableVencimento');
  if (!tableContainer) {
    if (window.Logger) {
      window.Logger.warn('tableVencimento não encontrado');
    }
    return;
  }
  
  // Garantir que o loading está escondido antes de renderizar
  window.loadingManager?.hideInElement('tableVencimento');
  
  if (protocolosCompletos.length === 0) {
    tableContainer.innerHTML = `
      <div class="text-center py-12 text-slate-400">
        <div class="text-4xl mb-4">✅</div>
        <div class="text-lg font-semibold mb-2">Nenhum protocolo encontrado</div>
        <div class="text-sm">Não há protocolos ${getFiltroLabel(filtroAtual)} no momento.</div>
      </div>
    `;
    return;
  }
  
  // Calcular quantos itens mostrar
  const inicio = paginaAtual * itensPorPagina;
  const fim = inicio + itensPorPagina;
  protocolosExibidos = protocolosCompletos.slice(inicio, fim);
  const temMais = fim < protocolosCompletos.length;
  
  // Criar tabela
  let html = `
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-700">
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Protocolo</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Setor</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">O que é</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Secretaria</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Data Criação</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Vencimento</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Prazo</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tempo de Resolução</th>
            <th class="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dias Restantes</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800">
  `;
  
  protocolosExibidos.forEach((p, idx) => {
    const isVencido = p.diasRestantes < 0;
    const isUrgente = p.diasRestantes >= 0 && p.diasRestantes <= 3;
    const isAtencao = p.diasRestantes > 3 && p.diasRestantes <= 7;
    
    // Cor baseada em dias restantes
    let corDias = 'text-slate-300';
    let bgDias = 'bg-slate-800/30';
    let labelDias = `${p.diasRestantes} dias`;
    
    if (isVencido) {
      corDias = 'text-red-400';
      bgDias = 'bg-red-500/20';
      labelDias = `Vencido há ${Math.abs(p.diasRestantes)} dia${Math.abs(p.diasRestantes) !== 1 ? 's' : ''}`;
    } else if (isUrgente) {
      corDias = 'text-orange-400';
      bgDias = 'bg-orange-500/20';
    } else if (isAtencao) {
      corDias = 'text-yellow-400';
      bgDias = 'bg-yellow-500/20';
    }
    
    // Formatar datas
    const dataCriacaoFormatada = formatarData(p.dataCriacao);
    const dataVencimentoFormatada = formatarData(p.dataVencimento);
    
    html += `
      <tr class="hover:bg-slate-800/50 transition-colors ${isVencido ? 'border-l-2 border-red-500' : ''}">
        <td class="py-3 px-4">
          <div class="font-mono text-sm font-semibold text-cyan-300">${escapeHtml(p.protocolo)}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-sm text-slate-300">${escapeHtml(p.setor)}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-sm text-slate-300" title="${escapeHtml(p.oQueE)}">
            ${truncateText(escapeHtml(p.oQueE), 40)}
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="text-sm text-slate-300">${escapeHtml(p.secretaria)}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-sm text-slate-400">${dataCriacaoFormatada}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-sm ${isVencido ? 'text-red-400 font-semibold' : 'text-slate-300'}">${dataVencimentoFormatada}</div>
        </td>
        <td class="py-3 px-4">
          <div class="text-xs text-slate-400">${p.prazo} dias</div>
          <div class="text-xs text-slate-500">${p.tipoManifestacao === 'SIC' || p.prazo === 20 ? 'SIC' : 'Ouvidoria'}</div>
        </td>
        <td class="py-3 px-4">
          ${p.tempoResolucao !== null && p.tempoResolucao !== undefined ? `
            <div class="text-sm font-semibold ${p.tempoResolucao > 60 ? 'text-red-400' : p.tempoResolucao > 30 ? 'text-orange-400' : p.tempoResolucao > 15 ? 'text-yellow-400' : 'text-green-400'}">
              ${p.tempoResolucao} dias
            </div>
            <div class="text-xs text-slate-500">${p.diasRestantes < 0 ? 'decorrido' : 'em resolução'}</div>
          ` : '<div class="text-xs text-slate-500">N/A</div>'}
        </td>
        <td class="py-3 px-4">
          <div class="inline-flex items-center px-2 py-1 rounded ${bgDias}">
            <span class="text-xs font-semibold ${corDias}">${labelDias}</span>
          </div>
        </td>
      </tr>
    `;
  });
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  // Adicionar botão "Carregar mais" se houver mais itens
  if (temMais) {
    html += `
      <div class="mt-6 text-center">
        <button 
          id="btnCarregarMaisVencimento" 
          class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg font-semibold text-white hover:scale-105 transition-transform duration-100"
        >
          Carregar Mais (${protocolosCompletos.length - fim} restantes)
        </button>
        <div class="text-sm text-slate-400 mt-2">
          Mostrando ${inicio + 1}-${Math.min(fim, protocolosCompletos.length)} de ${protocolosCompletos.length} protocolos
        </div>
      </div>
    `;
  } else if (protocolosCompletos.length > 0) {
    html += `
      <div class="mt-6 text-center text-sm text-slate-400">
        Mostrando todos os ${protocolosCompletos.length} protocolos
      </div>
    `;
  }
  
  tableContainer.innerHTML = html;
  
  // Adicionar listener ao botão "Carregar mais"
  const btnCarregarMais = document.getElementById('btnCarregarMaisVencimento');
  if (btnCarregarMais) {
    btnCarregarMais.addEventListener('click', () => {
      paginaAtual++;
      renderVencimentoTable();
    });
  }
}

/**
 * Atualizar contador de protocolos e KPIs
 */
function updateVencimentoCounter(data) {
  const total = data.total || 0;
  const protocolos = data.protocolos || [];
  
  // Calcular estatísticas dos KPIs
  const vencidos = protocolos.filter(p => p.diasRestantes < 0).length;
  const vencendo3 = protocolos.filter(p => p.diasRestantes >= 0 && p.diasRestantes <= 3).length;
  const vencendo7 = protocolos.filter(p => p.diasRestantes > 3 && p.diasRestantes <= 7).length;
  
  // Atualizar cards KPI
  const kpiTotal = document.getElementById('kpiTotalVencimento');
  const kpiVencidos = document.getElementById('kpiVencidos');
  const kpiVencendo3 = document.getElementById('kpiVencendo3');
  const kpiVencendo7 = document.getElementById('kpiVencendo7');
  const filtroLabel = document.getElementById('filtroLabelVencimento');
  
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');
  if (kpiVencidos) kpiVencidos.textContent = vencidos.toLocaleString('pt-BR');
  if (kpiVencendo3) kpiVencendo3.textContent = vencendo3.toLocaleString('pt-BR');
  if (kpiVencendo7) kpiVencendo7.textContent = vencendo7.toLocaleString('pt-BR');
  
  if (filtroLabel) {
    filtroLabel.textContent = getFiltroLabel(data.filtro);
  }
  
  // Manter compatibilidade com elemento antigo (se existir)
  const counter = document.getElementById('counterVencimento');
  if (counter) {
    counter.textContent = total.toLocaleString('pt-BR');
  }
}

/**
 * Obter label do filtro
 */
function getFiltroLabel(filtro) {
  const labels = {
    'vencidos': 'vencidos',
    '3': 'vencendo em até 3 dias',
    '7': 'vencendo em até 7 dias',
    '15': 'vencendo em até 15 dias',
    '30': 'vencendo em até 30 dias'
  };
  
  return labels[filtro] || filtro;
}

/**
 * Formatar data para exibição
 */
function formatarData(dataStr) {
  if (!dataStr) return 'N/A';
  
  try {
    const date = new Date(dataStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dataStr;
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dataStr;
  }
}

/**
 * Truncar texto
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Escapar HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Popular dropdown de secretarias
 */
async function popularDropdownSecretarias() {
  const selectSecretaria = document.getElementById('selectSecretariaVencimento');
  if (!selectSecretaria) {
    if (window.Logger) {
      window.Logger.warn('selectSecretariaVencimento não encontrado');
    }
    return;
  }
  
  try {
    // Limpar opções existentes (exceto "Todas as secretarias")
    while (selectSecretaria.options.length > 1) {
      selectSecretaria.remove(1);
    }
    
    // Buscar secretarias do banco usando distinct (mais confiável)
    let secretarias = [];
    
    try {
      const dataDistinct = await window.dataLoader?.load('/api/distinct?field=Secretaria', {
        useDataStore: true,
        ttl: 10 * 60 * 1000,
        fallback: []
      }) || [];
      
      // Processar dados do distinct
      secretarias = dataDistinct
        .map(item => {
          const nome = item.key || item._id || item.value || item;
          return typeof nome === 'string' ? nome : String(nome);
        })
        .filter(nome => nome && nome.trim() !== '' && nome !== 'N/A' && nome !== 'null' && nome !== 'undefined');
      
      // Se não encontrou pelo distinct, tentar endpoint de secretarias
      if (secretarias.length === 0) {
        try {
          const data = await window.dataLoader?.load('/api/secretarias', {
            useDataStore: true,
            ttl: 10 * 60 * 1000,
            fallback: { secretarias: [], total: 0 }
          }) || { secretarias: [], total: 0 };
          
          secretarias = (data.secretarias || [])
            .map(s => s.name || s.code || s)
            .filter(nome => nome && nome.trim() !== '' && nome !== 'N/A');
        } catch (error) {
          if (window.Logger) {
            window.Logger.warn('Erro ao buscar secretarias do endpoint:', error);
          }
        }
      }
    } catch (error) {
      window.errorHandler?.handleError(error, 'popularDropdownSecretarias (buscar secretarias)', {
        showToUser: false
      });
    }
    
    // Remover duplicatas
    secretarias = [...new Set(secretarias)];
    
    // Ordenar secretarias alfabeticamente
    secretarias.sort((a, b) => {
      const nomeA = String(a).toLowerCase().trim();
      const nomeB = String(b).toLowerCase().trim();
      return nomeA.localeCompare(nomeB);
    });
    
    // Adicionar opções ao dropdown
    secretarias.forEach(nome => {
      const option = document.createElement('option');
      option.value = nome;
      option.textContent = nome;
      selectSecretaria.appendChild(option);
    });
    
    if (window.Logger) {
      window.Logger.debug(`✅ Dropdown de secretarias populado com ${secretarias.length} secretarias`);
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'popularDropdownSecretarias', {
      showToUser: false
    });
  }
}

/**
 * Inicializar listeners
 */
function initVencimentoListeners() {
  const selectFiltro = document.getElementById('selectFiltroVencimento');
  const selectSecretaria = document.getElementById('selectSecretariaVencimento');
  
  // Listener para filtro de prazo
  if (selectFiltro) {
    selectFiltro.addEventListener('change', async (e) => {
      const novoFiltro = e.target.value;
      filtroAtual = novoFiltro;
      
      if (window.Logger) {
        window.Logger.debug(`⏰ Filtro alterado para: ${novoFiltro}`);
      }
      
      await recarregarVencimentos();
    });
  }
  
  // Listener para filtro de secretaria
  if (selectSecretaria) {
    selectSecretaria.addEventListener('change', async (e) => {
      const novaSecretaria = e.target.value || null;
      secretariaFiltro = novaSecretaria;
      
      if (window.Logger) {
        window.Logger.debug(`⏰ Secretaria alterada para: ${novaSecretaria || 'Todas'}`);
      }
      
      await recarregarVencimentos();
    });
  }
  
  // Listener para filtro de tempo de resolução
  const selectTempoResolucao = document.getElementById('selectTempoResolucaoVencimento');
  if (selectTempoResolucao) {
    selectTempoResolucao.addEventListener('change', async (e) => {
      const novoTempoResolucao = e.target.value || null;
      tempoResolucaoFiltro = novoTempoResolucao;
      
      if (window.Logger) {
        window.Logger.debug(`⏰ Tempo de resolução alterado para: ${novoTempoResolucao || 'Todos'}`);
      }
      
      await recarregarVencimentos();
    });
  }
  
  // Popular dropdown quando a página for carregada
  setTimeout(() => {
    popularDropdownSecretarias();
  }, 100);
  
  // Inicializar filtros de mês e status
  if (window.PageFiltersHelper && window.PageFiltersHelper.inicializarFiltrosMesStatus) {
    window.PageFiltersHelper.inicializarFiltrosMesStatus({
      prefix: 'Vencimento',
      endpoint: '/api/aggregate/by-month',
      onChange: async () => {
        await loadVencimento(true);
      },
      mesSelecionado: ''
    });
  }
}

/**
 * Recarregar vencimentos
 */
async function recarregarVencimentos() {
  // Mostrar loading usando o loadingManager
  window.loadingManager?.showInElement('tableVencimento', 'Carregando protocolos de vencimento...');
  
  // Invalidar cache
  if (window.dataStore) {
    let url = `/api/vencimento?filtro=${encodeURIComponent(filtroAtual)}`;
    if (secretariaFiltro) url += `&secretaria=${encodeURIComponent(secretariaFiltro)}`;
    if (tempoResolucaoFiltro) url += `&tempoResolucao=${encodeURIComponent(tempoResolucaoFiltro)}`;
    
    if (typeof window.dataStore.clear === 'function') {
      window.dataStore.clear(url);
    }
  }
  
  // Recarregar dados
  await window.errorHandler?.safeAsync(
    async () => await loadVencimento(true),
    'recarregarVencimentos',
    { showToUser: false }
  );
}

// Exportar função globalmente - GARANTIR que sempre seja exportada
// IMPORTANTE: Executar imediatamente, não esperar por dependências
(function() {
  'use strict';
  
  try {
    // Exportar função imediatamente
    if (typeof loadVencimento === 'function') {
      window.loadVencimento = loadVencimento;
      if (window.Logger) {
        window.Logger.debug('✅ loadVencimento exportada');
      }
    } else {
      window.errorHandler?.handleError(
        new Error('loadVencimento não é uma função'),
        'vencimento.js (export)',
        { showToUser: false, silent: true }
      );
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'vencimento.js (export)', {
      showToUser: false,
      silent: true
    });
  }
  
  // Função auxiliar para inicializar quando tudo estiver pronto
  function initWhenReady() {
    try {
      // Verificar se elementos DOM existem
      const page = document.getElementById('page-vencimento');
      if (!page) {
        // Tentar novamente depois
        setTimeout(initWhenReady, 500);
        return;
      }
      
      // Inicializar listeners
      initVencimentoListeners();
      
      if (window.Logger) {
        window.Logger.debug('✅ Página Vencimento inicializada');
      }
    } catch (error) {
      window.errorHandler?.handleError(error, 'initWhenReady (vencimento)', {
        showToUser: false,
        silent: true
      });
    }
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initWhenReady, 500);
    });
  } else {
    // DOM já está pronto
    setTimeout(initWhenReady, 500);
  }
  
  // Log de carregamento
  if (window.Logger) {
    window.Logger.debug('✅ Script vencimento.js carregado');
  }
  
  // Conectar ao sistema global de filtros
  // Conectar ao sistema global de filtros usando helper reutilizável
  if (window.createPageFilterListener) {
    window.createPageFilterListener({
      pageId: 'page-vencimento',
      listenerKey: '_vencimentoListenerRegistered',
      loadFunction: loadVencimento
    });
  } else if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
    window.chartCommunication.createPageFilterListener('page-vencimento', loadVencimento, 500);
  }
})();
