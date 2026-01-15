/**
 * Página: Filtros Avançados
 * Sistema completo de filtros avançados para protocolos
 * 
 * Funcionalidades:
 * - Múltiplos filtros simultâneos
 * - Carregamento dinâmico de opções de filtro
 * - Aplicação de filtros via API /api/filter
 * - Visualização de resultados em tempo real
 * - Integração com sistema global de filtros
 */

// Estado global da página
let filtrosState = {
  filtros: [],
  totalProtocolos: 0,
  protocolosFiltrados: 0,
  optionsCache: {},
  isLoading: false,
  optionsLoaded: false, // Flag para indicar se opções já foram carregadas
  todosResultados: [], // Armazenar todos os resultados
  resultadosExibidos: 100 // Quantidade de resultados exibidos atualmente
};

/**
 * Carregar página de filtros avançados
 */
async function loadFiltrosAvancados(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('🔍 loadFiltrosAvancados: Iniciando carregamento');
  }
  
  const pageElement = document.getElementById('page-filtros-avancados');
  if (!pageElement || pageElement.style.display === 'none') {
    if (window.Logger) {
      window.Logger.debug('🔍 loadFiltrosAvancados: Página não visível');
    }
    return Promise.resolve();
  }
  
  try {
    // Inicializar componentes
    await initializeFilters();
    
    // OTIMIZAÇÃO: Só carregar opções se ainda não foram carregadas ou se forceRefresh for true
    if (!filtrosState.optionsLoaded || forceRefresh) {
      await loadFilterOptions(forceRefresh);
      filtrosState.optionsLoaded = true;
    } else {
      if (window.Logger) {
        window.Logger.debug('🔍 Opções de filtros já carregadas, pulando recarregamento');
      }
    }
    
    // Carregar total de protocolos (sempre atualizar, mas usar cache se disponível)
    await loadTotalProtocolos();
    
    // Configurar event listeners (só uma vez)
    if (!filtrosState.listenersSetup) {
      setupEventListeners();
      filtrosState.listenersSetup = true;
    }
    
    // Inicializar botão flutuante de voltar ao topo
    initBotaoVoltarTopo();
    
    // Restaurar filtros salvos se houver (só na primeira carga)
    if (!filtrosState.filtersRestored) {
      restoreSavedFilters();
      filtrosState.filtersRestored = true;
    }
    
    if (window.Logger) {
      window.Logger.success('🔍 loadFiltrosAvancados: Carregamento concluído');
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar filtros avançados:', error);
    }
    console.error('Erro ao carregar filtros avançados:', error);
  }
}

/**
 * Inicializar filtros
 */
async function initializeFilters() {
  // Limpar estado
  filtrosState.filtros = [];
  filtrosState.totalProtocolos = 0;
  filtrosState.protocolosFiltrados = 0;
  
  // Atualizar contadores
  updateCounters();
  
    // Limpar resultados
    const resultadosDiv = document.getElementById('resultadosFiltros');
    if (resultadosDiv) {
      resultadosDiv.innerHTML = `
        <div class="text-center">
          <div class="text-6xl mb-4 text-slate-600">🔍</div>
          <p class="text-slate-400">Aplique os filtros acima para visualizar os resultados</p>
        </div>
      `;
    }
    
    // Resetar estado de resultados
    filtrosState.todosResultados = [];
    filtrosState.resultadosExibidos = 100;
}

/**
 * Carregar opções para os dropdowns de filtros
 */
async function loadFilterOptions(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('🔍 Carregando opções de filtros...');
  }
  
  const camposFiltro = [
    { id: 'filtroStatusDemanda', campo: 'StatusDemanda' },
    { id: 'filtroUnidadeCadastro', campo: 'UnidadeCadastro' },
    { id: 'filtroCanal', campo: 'Canal' },
    { id: 'filtroServidor', campo: 'Servidor' },
    { id: 'filtroTipoManifestacao', campo: 'Tipo' },
    { id: 'filtroTema', campo: 'Tema' },
    { id: 'filtroPrioridade', campo: 'Prioridade' },
    { id: 'filtroUnidadeSaude', campo: 'unidadeSaude' },
    { id: 'filtroAssunto', campo: 'Assunto' },
    { id: 'filtroResponsavel', campo: 'Responsavel' },
    { id: 'filtroStatus', campo: 'Status' }
  ];
  
  // OTIMIZAÇÃO: Carregar opções em paralelo usando Promise.allSettled
  // Isso permite que algumas requisições falhem sem bloquear as outras
  const loadPromises = camposFiltro.map(async ({ id, campo }) => {
    try {
      const select = document.getElementById(id);
      if (!select) return { success: false, campo, reason: 'Select não encontrado' };
      
      // Verificar cache
      if (filtrosState.optionsCache[campo] && !forceRefresh) {
        populateSelect(select, filtrosState.optionsCache[campo]);
        return { success: true, campo, fromCache: true };
      }
      
      // Carregar do servidor
      const options = await loadDistinctValues(campo);
      if (options && options.length > 0) {
        filtrosState.optionsCache[campo] = options;
        populateSelect(select, options);
        return { success: true, campo, count: options.length };
      }
      
      return { success: false, campo, reason: 'Nenhuma opção retornada' };
    } catch (error) {
      if (window.Logger) {
        window.Logger.warn(`Erro ao carregar opções para ${campo}:`, error);
      }
      return { success: false, campo, error: error.message };
    }
  });
  
  // Usar allSettled para não bloquear se algumas falharem
  const results = await Promise.allSettled(loadPromises);
  
  // Log de resultados para debug
  if (window.Logger) {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const failed = results.length - successful;
    if (failed > 0) {
      window.Logger.debug(`🔍 Carregamento de opções: ${successful} sucesso, ${failed} falhas`);
    }
  }
  
  // Carregar meses disponíveis para criação e finalização
  await loadMesesDisponiveis(forceRefresh);
  
  if (window.Logger) {
    window.Logger.debug('🔍 Opções de filtros carregadas');
  }
}

/**
 * Carregar meses disponíveis para filtros de mês criado e mês finalizado
 */
async function loadMesesDisponiveis(forceRefresh = false) {
  try {
    // Carregar meses de criação
    if (window.dataLoader) {
      // Buscar meses de criação usando endpoint de stats
      const dataMesCriacao = await window.dataLoader.load('/api/stats/average-time/by-month', {
        useDataStore: true,
        ttl: 10 * 60 * 1000, // Cache de 10 minutos
        fallback: []
      }) || [];
      
      const mesesCriacao = dataMesCriacao
        .map(d => d.month || d.ym || d._id)
        .filter(m => m && /^\d{4}-\d{2}$/.test(m))
        .sort()
        .reverse(); // Mais recente primeiro
      
      popularSelectMeses('filtroMesCriado', mesesCriacao);
      
      // Para meses de finalização, precisamos buscar do banco
      // Usar endpoint de filter para buscar registros com dataConclusaoIso
      const mesesFinalizacao = await buscarMesesFinalizacao();
      popularSelectMeses('filtroMesFinalizado', mesesFinalizacao);
      
      if (window.Logger) {
        window.Logger.debug(`✅ Meses carregados: ${mesesCriacao.length} criação, ${mesesFinalizacao.length} finalização`);
      }
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao carregar meses disponíveis:', error);
    }
  }
}

/**
 * Buscar meses de finalização disponíveis
 */
async function buscarMesesFinalizacao() {
  try {
    // Buscar registros com dataConclusaoIso e extrair meses únicos
    const response = await fetch('/api/filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        filters: [
          {
            field: 'dataConclusaoIso',
            op: 'ne',
            value: null
          }
        ],
        limit: 10000 // Limitar para performance
      })
    });
    
    if (!response.ok) {
      return [];
    }
    
    const resultados = await response.json();
    if (!Array.isArray(resultados)) {
      return [];
    }
    
    // Extrair meses únicos de dataConclusaoIso
    const mesesSet = new Set();
    resultados.forEach(record => {
      const data = record.data || record;
      const dataConclusao = data.dataConclusaoIso || record.dataConclusaoIso || 
                           data.data_conclusao || record.data_conclusao ||
                           data.dataDaConclusao || record.dataDaConclusao;
      
      if (dataConclusao) {
        // Extrair YYYY-MM da data
        const match = String(dataConclusao).match(/^(\d{4}-\d{2})/);
        if (match) {
          mesesSet.add(match[1]);
        }
      }
    });
    
    return Array.from(mesesSet).sort().reverse(); // Mais recente primeiro
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao buscar meses de finalização:', error);
    }
    return [];
  }
}

/**
 * Popular select de meses com formatação
 */
function popularSelectMeses(selectId, meses) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  // Validar se meses é um array
  if (!Array.isArray(meses)) {
    if (window.Logger) {
      window.Logger.warn(`popularSelectMeses: meses não é um array para ${selectId}:`, meses);
    }
    return;
  }
  
  // Salvar valor atual
  const currentValue = select.value;
  
  // Limpar opções existentes (exceto "Todos os meses")
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }
  
  // Adicionar meses
  meses.forEach(mes => {
    const option = document.createElement('option');
    option.value = mes;
    
    // Formatar para nome do mês (ex: "Janeiro 2025")
    let nomeMes = mes;
    try {
      if (mes && mes.includes('-')) {
        const [ano, mesNum] = mes.split('-');
        const mesesNomes = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const mesIndex = parseInt(mesNum) - 1;
        if (mesIndex >= 0 && mesIndex < 12) {
          nomeMes = `${mesesNomes[mesIndex]} ${ano}`;
        }
      }
    } catch (e) {
      // Se der erro, usar formatação padrão
      nomeMes = mes;
    }
    
    option.textContent = nomeMes;
    select.appendChild(option);
  });
  
  // Restaurar valor se ainda existir
  if (currentValue) {
    select.value = currentValue;
  }
}

/**
 * Carregar valores distintos de um campo
 * OTIMIZAÇÃO: Melhor tratamento de erros e retry automático
 */
async function loadDistinctValues(field) {
  try {
    if (window.dataLoader) {
      // OTIMIZAÇÃO: Aumentar timeout e usar cache mais agressivo
      const values = await window.dataLoader.load(`/api/distinct?field=${encodeURIComponent(field)}`, {
        useDataStore: true,
        ttl: 60 * 60 * 1000, // Cache de 1 hora
        timeout: 15000 // 15 segundos de timeout (aumentado de padrão)
      });
      
      if (Array.isArray(values)) {
        return values.filter(v => v && v.trim() !== '').sort();
      }
    }
    
    return [];
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn(`Erro ao carregar valores distintos para ${field}:`, error);
    }
    
    // OTIMIZAÇÃO: Tentar retornar do cache se houver erro
    if (window.dataStore) {
      const cacheKey = `/api/distinct?field=${encodeURIComponent(field)}`;
      const cached = window.dataStore.get(cacheKey);
      if (cached && Array.isArray(cached)) {
        if (window.Logger) {
          window.Logger.debug(`Usando valores em cache para ${field}`);
        }
        return cached.filter(v => v && v.trim() !== '').sort();
      }
    }
    
    return [];
  }
}

/**
 * Popular select com opções
 */
function populateSelect(selectElement, options) {
  if (!selectElement) return;
  
  // Salvar valor atual
  const currentValue = selectElement.value;
  
  // Verificar se já existe opção "Todos"
  const temTodos = Array.from(selectElement.options).some(opt => 
    (opt.value === '' || opt.value.toLowerCase() === 'todos') && 
    (opt.textContent.toLowerCase() === 'todos' || opt.textContent.toLowerCase() === 'todos os meses')
  );
  
  // Limpar opções existentes (exceto "Todos")
  while (selectElement.children.length > (temTodos ? 1 : 0)) {
    selectElement.removeChild(selectElement.lastChild);
  }
  
  // Se não tem opção "Todos", criar uma
  if (!temTodos) {
    const optionTodos = document.createElement('option');
    optionTodos.value = '';
    optionTodos.textContent = 'Todos';
    selectElement.insertBefore(optionTodos, selectElement.firstChild);
  }
  
  // Adicionar novas opções
  options.forEach(option => {
    // Não adicionar se já existe "Todos" e o valor é vazio ou "Todos"
    if (option && option.trim() !== '' && option.toLowerCase() !== 'todos') {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option;
      selectElement.appendChild(optionElement);
    }
  });
  
  // Restaurar valor se ainda existir, caso contrário selecionar "Todos"
  if (currentValue && Array.from(selectElement.options).some(opt => opt.value === currentValue)) {
    selectElement.value = currentValue;
  } else {
    selectElement.value = '';
  }
}

/**
 * Carregar total de protocolos
 */
async function loadTotalProtocolos() {
  try {
    if (window.dataLoader) {
      const summary = await window.dataLoader.load('/api/summary', {
        useDataStore: true,
        ttl: 5 * 60 * 1000 // Cache de 5 minutos
      });
      
      if (summary && summary.total !== undefined) {
        filtrosState.totalProtocolos = summary.total || 0;
        updateTotalProtocolos();
      }
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao carregar total de protocolos:', error);
    }
  }
}

/**
 * Atualizar contador de total de protocolos
 */
function updateTotalProtocolos() {
  const element = document.getElementById('totalProtocolos');
  if (element) {
    element.textContent = filtrosState.totalProtocolos.toLocaleString('pt-BR');
  }
}

/**
 * Configurar event listeners
 */
function setupEventListeners() {
  // Botão Aplicar Filtros
  const btnAplicar = document.getElementById('btnAplicarFiltros');
  if (btnAplicar) {
    btnAplicar.addEventListener('click', applyFilters);
  }
  
  // Botão Limpar Todos
  const btnLimpar = document.getElementById('btnLimparTodos');
  if (btnLimpar) {
    btnLimpar.addEventListener('click', clearAllFilters);
  }
  
  // Botão Filtros Compostos
  const btnCompostos = document.getElementById('btnFiltrosCompostos');
  const containerCompostos = document.getElementById('compositeFiltersContainer');
  const btnFecharCompostos = document.getElementById('btnFecharCompostos');
  
  if (btnCompostos && containerCompostos) {
    btnCompostos.addEventListener('click', () => {
      containerCompostos.classList.toggle('hidden');
      if (!containerCompostos.classList.contains('hidden')) {
        initCompositeFiltersUI();
      }
    });
  }
  
  if (btnFecharCompostos && containerCompostos) {
    btnFecharCompostos.addEventListener('click', () => {
      containerCompostos.classList.add('hidden');
    });
  }
  
  // Toggle de ativar/desativar filtros
  const toggleFiltros = document.getElementById('toggleFiltros');
  if (toggleFiltros) {
    toggleFiltros.addEventListener('change', (e) => {
      if (!e.target.checked) {
        clearAllFilters();
      }
    });
  }
  
  // Enter no campo de protocolo
  const inputProtocolo = document.getElementById('filtroProtocolo');
  if (inputProtocolo) {
    inputProtocolo.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }
}

/**
 * Inicializar UI de Filtros Compostos
 */
function initCompositeFiltersUI() {
  const container = document.getElementById('compositeFiltersUI');
  if (!container) {
    if (window.Logger) {
      window.Logger.warn('Container compositeFiltersUI não encontrado');
    }
    return;
  }

  // Usar a API window.compositeFiltersUI se disponível
  if (window.compositeFiltersUI && window.compositeFiltersUI.showBuilder) {
    // Criar botão para abrir o builder
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-slate-400 mb-4">Crie filtros compostos com operadores AND/OR</p>
        <button id="btnAbrirBuilderCompostos" class="px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors">
          Abrir Construtor de Filtros Compostos
        </button>
      </div>
    `;

    const btnAbrir = document.getElementById('btnAbrirBuilderCompostos');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', () => {
        window.compositeFiltersUI.showBuilder((compositeFilter) => {
          // Salvar filtro composto no estado
          window.compositeFilterInstance = compositeFilter;
          if (window.Logger) {
            window.Logger.debug('Filtro composto criado:', compositeFilter);
          }
          // Atualizar contador
          updateCounters();
        });
      });
    }
  } else {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400">
        <p>Sistema de filtros compostos em desenvolvimento</p>
      </div>
    `;
  }
}

/**
 * Coletar filtros do formulário
 */
function collectFilters() {
  // PRIORIDADE: Coletar filtros compostos primeiro (se existirem)
  if (window.compositeFilterInstance) {
    try {
      // Retornar filtro composto como objeto especial
      // O backend espera um objeto com isComposite: true e compositeFilter
      return { 
        isComposite: true, 
        compositeFilter: window.compositeFilterInstance 
      };
    } catch (error) {
      if (window.Logger) {
        window.Logger.warn('Erro ao coletar filtros compostos:', error);
      }
    }
  }
  
  const filtros = [];
  
  // Protocolo (busca por texto)
  const protocolo = document.getElementById('filtroProtocolo')?.value?.trim();
  if (protocolo) {
    filtros.push({
      field: 'protocolo',
      op: 'contains',
      value: protocolo
    });
  }
  
  // Status Demanda
  const statusDemanda = document.getElementById('filtroStatusDemanda')?.value?.trim();
  if (statusDemanda && statusDemanda !== '' && statusDemanda.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'StatusDemanda',
      op: 'eq',
      value: statusDemanda
    });
  }
  
  // Unidade/Cadastro
  const unidadeCadastro = document.getElementById('filtroUnidadeCadastro')?.value?.trim();
  if (unidadeCadastro && unidadeCadastro !== '' && unidadeCadastro.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'UnidadeCadastro',
      op: 'eq',
      value: unidadeCadastro
    });
  }
  
  // Canal
  const canal = document.getElementById('filtroCanal')?.value?.trim();
  if (canal && canal !== '' && canal.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Canal',
      op: 'eq',
      value: canal
    });
  }
  
  // Servidor
  const servidor = document.getElementById('filtroServidor')?.value?.trim();
  if (servidor && servidor !== '' && servidor.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Servidor',
      op: 'eq',
      value: servidor
    });
  }
  
  // Tipo de Manifestação
  const tipoManifestacao = document.getElementById('filtroTipoManifestacao')?.value?.trim();
  if (tipoManifestacao && tipoManifestacao !== '' && tipoManifestacao.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Tipo',
      op: 'eq',
      value: tipoManifestacao
    });
  }
  
  // Tema
  const tema = document.getElementById('filtroTema')?.value?.trim();
  if (tema && tema !== '' && tema.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Tema',
      op: 'eq',
      value: tema
    });
  }
  
  // Prioridade
  const prioridade = document.getElementById('filtroPrioridade')?.value?.trim();
  if (prioridade && prioridade !== '' && prioridade.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Prioridade',
      op: 'eq',
      value: prioridade
    });
  }
  
  // Unidade/Saúde
  const unidadeSaude = document.getElementById('filtroUnidadeSaude')?.value?.trim();
  if (unidadeSaude && unidadeSaude !== '' && unidadeSaude.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'unidadeSaude',
      op: 'eq',
      value: unidadeSaude
    });
  }
  
  // Período da Criação (Data Inicial e Final)
  const dataCriacaoInicial = document.getElementById('filtroDataCriacaoInicial')?.value?.trim();
  const dataCriacaoFinal = document.getElementById('filtroDataCriacaoFinal')?.value?.trim();
  
  if (dataCriacaoInicial) {
    // Filtro de data inicial (maior ou igual)
    // Formato: YYYY-MM-DD (será comparado como início do dia)
    filtros.push({
      field: 'dataCriacaoIso',
      op: 'gte',
      value: dataCriacaoInicial
    });
  }
  
  if (dataCriacaoFinal) {
    // Filtro de data final (menor ou igual)
    // Adicionar 23:59:59 para incluir o dia inteiro
    const dataFinalCompleta = dataCriacaoFinal + 'T23:59:59.999Z';
    filtros.push({
      field: 'dataCriacaoIso',
      op: 'lte',
      value: dataFinalCompleta
    });
  }
  
  // Filtro por Mês Criado
  const mesCriado = document.getElementById('filtroMesCriado')?.value?.trim();
  if (mesCriado) {
    // Formato: YYYY-MM
    const [ano, mes] = mesCriado.split('-');
    if (ano && mes) {
      const dataInicial = `${mesCriado}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFinal = `${mesCriado}-${ultimoDia}`;
      
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'gte',
        value: dataInicial
      });
      filtros.push({
        field: 'dataCriacaoIso',
        op: 'lte',
        value: `${dataFinal}T23:59:59.999Z`
      });
    }
  }
  
  // Filtro por Mês Finalizado
  const mesFinalizado = document.getElementById('filtroMesFinalizado')?.value?.trim();
  if (mesFinalizado) {
    // Formato: YYYY-MM
    const [ano, mes] = mesFinalizado.split('-');
    if (ano && mes) {
      const dataInicial = `${mesFinalizado}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const dataFinal = `${mesFinalizado}-${ultimoDia}`;
      
      filtros.push({
        field: 'dataConclusaoIso',
        op: 'gte',
        value: dataInicial
      });
      filtros.push({
        field: 'dataConclusaoIso',
        op: 'lte',
        value: `${dataFinal}T23:59:59.999Z`
      });
    }
  }
  
  // Assunto
  const assunto = document.getElementById('filtroAssunto')?.value?.trim();
  if (assunto && assunto !== '' && assunto.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Assunto',
      op: 'eq',
      value: assunto
    });
  }
  
  // Responsável
  const responsavel = document.getElementById('filtroResponsavel')?.value?.trim();
  if (responsavel && responsavel !== '' && responsavel.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Responsavel',
      op: 'eq',
      value: responsavel
    });
  }
  
  // Status
  const status = document.getElementById('filtroStatus')?.value?.trim();
  if (status && status !== '' && status.toLowerCase() !== 'todos') {
    filtros.push({
      field: 'Status',
      op: 'eq',
      value: status
    });
  }
  
  return filtros;
}

/**
 * Aplicar filtros
 */
async function applyFilters() {
  if (filtrosState.isLoading) {
    if (window.Logger) {
      window.Logger.warn('🔍 Filtros já estão sendo aplicados, aguardando...');
    }
    return;
  }
  
  // Verificar se toggle está ativo
  const toggle = document.getElementById('toggleFiltros');
  if (toggle && !toggle.checked) {
    if (window.Logger) {
      window.Logger.debug('🔍 Toggle de filtros desativado');
    }
    return;
  }
  
  filtrosState.isLoading = true;
  
  try {
    // Coletar filtros do formulário
    const filtrosData = collectFilters();
    
    // Verificar se é filtro composto
    let filtros = [];
    let isComposite = false;
    
    if (filtrosData && filtrosData.isComposite && filtrosData.compositeFilter) {
      isComposite = true;
      filtros = filtrosData;
      if (window.Logger) {
        window.Logger.debug('🔍 Aplicando filtro composto', filtrosData.compositeFilter);
      }
    } else {
      filtros = Array.isArray(filtrosData) ? filtrosData : [];
      if (window.Logger) {
        window.Logger.debug(`🔍 Aplicando ${filtros.length} filtro(s)`, filtros);
      }
    }
    
    // Atualizar estado
    filtrosState.filtros = filtros;
    
    // Atualizar contador de filtros ativos
    updateCounters();
    
    // Se não há filtros, limpar resultados
    if (filtros.length === 0) {
      clearResults();
      filtrosState.isLoading = false;
      return;
    }
    
    // Mostrar loading
    showLoading();
    
    // Aplicar filtros via API
    const resultados = await applyFiltersAPI(filtros);
    
    // Armazenar todos os resultados
    filtrosState.todosResultados = resultados;
    filtrosState.resultadosExibidos = 100; // Resetar para 100
    
    // Exibir resultados
    displayResults();
    
    // Atualizar estatísticas
    filtrosState.protocolosFiltrados = resultados.length;
    updateStatistics();
    
    
    // Salvar filtros
    saveFilters();
    
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao aplicar filtros:', error);
    }
    showError('Erro ao aplicar filtros. Tente novamente.');
  } finally {
    filtrosState.isLoading = false;
  }
}

/**
 * Aplicar filtros via API
 */
async function applyFiltersAPI(filtros) {
  try {
    // Verificar se é filtro composto
    const isComposite = filtros && filtros.isComposite && filtros.compositeFilter;
    const endpoint = isComposite ? '/api/filter' : '/api/filter';
    
    let requestBody;
    if (isComposite) {
      // Enviar filtro composto
      requestBody = {
        isComposite: true,
        compositeFilter: filtros.compositeFilter,
        originalUrl: window.location.pathname
      };
    } else {
      // Enviar filtros simples
      requestBody = {
        filters: Array.isArray(filtros) ? filtros : [],
        originalUrl: window.location.pathname
      };
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Enviar cookies de sessão
      body: JSON.stringify({
        filters: filtros,
        originalUrl: window.location.pathname
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.statusText}`);
    }
    
    const resultados = await response.json();
    return Array.isArray(resultados) ? resultados : [];
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro na requisição de filtros:', error);
    }
    throw error;
  }
}

/**
 * Exibir resultados
 */
function displayResults() {
  const resultadosDiv = document.getElementById('resultadosFiltros');
  if (!resultadosDiv) return;
  
  const resultados = filtrosState.todosResultados;
  const resultadosExibidos = filtrosState.resultadosExibidos;
  
  if (!resultados || resultados.length === 0) {
    resultadosDiv.innerHTML = `
      <div class="text-center py-8">
        <div class="text-6xl mb-4 text-slate-600">🔍</div>
        <p class="text-slate-400 text-lg mb-2">Nenhum protocolo encontrado</p>
        <p class="text-slate-500 text-sm">Tente ajustar os filtros aplicados</p>
      </div>
    `;
    return;
  }
  
  // Verificar se há filtros de data aplicados (incluindo filtros de mês)
  const temFiltroData = filtrosState.filtros.some(f => 
    f.field === 'dataCriacaoIso' || 
    f.field === 'dataConclusaoIso' ||
    f.field === 'data_da_criacao' ||
    f.field === 'dataDaCriacao' ||
    f.field === 'data_conclusao' ||
    f.field === 'dataDaConclusao'
  ) || 
  document.getElementById('filtroMesCriado')?.value?.trim() ||
  document.getElementById('filtroMesFinalizado')?.value?.trim();
  
  // Ordenar por data decrescente se não houver filtro de data
  let resultadosOrdenados = [...resultados];
  if (!temFiltroData) {
    resultadosOrdenados.sort((a, b) => {
      const dataA = a.data?.dataCriacaoIso || a.dataCriacaoIso || a.data?.data_da_criacao || a.dataDaCriacao || '';
      const dataB = b.data?.dataCriacaoIso || b.dataCriacaoIso || b.data?.data_da_criacao || b.dataDaCriacao || '';
      
      // Comparar datas (mais recente primeiro)
      if (dataA && dataB) {
        return new Date(dataB) - new Date(dataA);
      }
      if (dataA) return -1;
      if (dataB) return 1;
      return 0;
    });
  }
  
  // Pegar apenas os resultados a serem exibidos
  const resultadosParaExibir = resultadosOrdenados.slice(0, resultadosExibidos);
  const temMais = resultadosOrdenados.length > resultadosExibidos;
  
  // Criar tabela de resultados
  const tableHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
           <tr class="border-b border-slate-700">
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Protocolo</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Data Criação</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Status</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Tema</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Assunto</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Órgão</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Canal</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Prioridade</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Unidade</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Tipo</th>
             <th class="px-3 py-3 text-left text-slate-300 font-semibold whitespace-nowrap">Data Conclusão</th>
           </tr>
        </thead>
        <tbody>
          ${resultadosParaExibir.map(row => {
            const data = row.data || row;
            const protocolo = data.protocolo || row.protocolo || 'N/A';
            const dataCriacao = data.data_da_criacao || data.dataDaCriacao || row.dataDaCriacao || 'N/A';
            const status = data.status || data.statusDemanda || row.status || row.statusDemanda || 'N/A';
            const tema = data.tema || row.tema || 'N/A';
            const assunto = data.assunto || row.assunto || 'N/A';
            const orgao = data.orgaos || data.orgao || row.orgaos || row.orgao || 'N/A';
             const canal = data.canal || row.canal || 'N/A';
             const prioridade = data.prioridade || row.prioridade || 'N/A';
             const unidade = data.unidadeCadastro || data.unidade_cadastro || row.unidadeCadastro || row.unidade_cadastro || 'N/A';
            const tipo = data.tipoDeManifestacao || data.tipo_de_manifestacao || row.tipoDeManifestacao || row.tipo_de_manifestacao || 'N/A';
            const dataConclusao = data.dataConclusaoIso || data.data_conclusao || data.dataDaConclusao || row.dataConclusaoIso || row.data_conclusao || row.dataDaConclusao || 'N/A';
            
            // Criar URL do Colab com o protocolo
            const colabUrl = `https://duquedecaxias.colab.re/item/workflow/${protocolo}`;
            
            return `
              <tr class="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td class="px-3 py-3">
                  <a href="${colabUrl}" target="_blank" rel="noopener noreferrer" 
                     class="text-cyan-300 font-mono hover:text-cyan-200 hover:underline transition-colors cursor-pointer text-xs">
                    ${protocolo}
                  </a>
                </td>
                <td class="px-3 py-3 text-slate-300 text-xs">${formatDate(dataCriacao)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(status, 20)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(tema, 25)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(assunto, 25)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(orgao, 25)}</td>
                 <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(canal, 15)}</td>
                 <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(prioridade, 15)}</td>
                 <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(unidade, 25)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${truncateText(tipo, 20)}</td>
                <td class="px-3 py-3 text-slate-300 text-xs">${dataConclusao !== 'N/A' ? formatDate(dataConclusao) : 'N/A'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="mt-4 flex items-center justify-between">
        <div class="text-sm text-slate-400">
          Mostrando ${resultadosExibidos} de ${resultados.length} resultados. ${temMais ? 'Ajuste os filtros para refinar a busca.' : ''}
        </div>
        ${temMais ? `
          <button 
            id="btnVerMais" 
            class="px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/50 rounded-lg text-cyan-300 hover:from-cyan-500/30 hover:to-violet-500/30 transition-all flex items-center gap-2 font-semibold"
            onclick="carregarMaisResultados()"
          >
            <span>Ver Mais</span>
            <span class="text-lg">↓</span>
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  resultadosDiv.innerHTML = tableHTML;
}

/**
 * Carregar mais resultados
 */
function carregarMaisResultados() {
  const incremento = 100;
  const total = filtrosState.todosResultados.length;
  const atual = filtrosState.resultadosExibidos;
  
  // Aumentar quantidade exibida
  filtrosState.resultadosExibidos = Math.min(atual + incremento, total);
  
  // Re-exibir resultados
  displayResults();
  
  // Scroll suave para o botão "Ver Mais" se ainda houver mais resultados
  if (filtrosState.resultadosExibidos < total) {
    setTimeout(() => {
      const btnVerMais = document.getElementById('btnVerMais');
      if (btnVerMais) {
        btnVerMais.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
}

// Tornar função acessível globalmente
window.carregarMaisResultados = carregarMaisResultados;

/**
 * Voltar ao topo da página
 */
function voltarAoTopo() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// Tornar função acessível globalmente
window.voltarAoTopo = voltarAoTopo;

/**
 * Inicializar botão flutuante de voltar ao topo
 */
function initBotaoVoltarTopo() {
  const btnVoltarTopo = document.getElementById('btnVoltarTopo');
  if (!btnVoltarTopo) return;
  
  // Listener de scroll para mostrar/ocultar botão
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollY = window.scrollY || window.pageYOffset;
      const page = document.getElementById('page-filtros-avancados');
      
      // Mostrar botão apenas se estiver na página de filtros avançados e scroll > 300px
      if (page && page.style.display !== 'none' && scrollY > 300) {
        btnVoltarTopo.classList.remove('opacity-0', 'pointer-events-none');
        btnVoltarTopo.classList.add('opacity-100', 'pointer-events-auto');
      } else {
        btnVoltarTopo.classList.add('opacity-0', 'pointer-events-none');
        btnVoltarTopo.classList.remove('opacity-100', 'pointer-events-auto');
      }
    }, 10);
  }, { passive: true });
}

// A inicialização do botão é feita dentro de loadFiltrosAvancados()

/**
 * Mostrar loading
 */
function showLoading() {
  const resultadosDiv = document.getElementById('resultadosFiltros');
  if (resultadosDiv) {
    resultadosDiv.innerHTML = `
      <div class="text-center py-8">
        <div class="inline-block animate-spin text-4xl mb-4 text-cyan-400">⏳</div>
        <p class="text-slate-400">Aplicando filtros...</p>
      </div>
    `;
  }
}

/**
 * Limpar resultados
 */
function clearResults() {
  // Resetar estado de resultados
  filtrosState.todosResultados = [];
  filtrosState.resultadosExibidos = 100;
  
  const resultadosDiv = document.getElementById('resultadosFiltros');
  if (resultadosDiv) {
    resultadosDiv.innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-4 text-slate-600">🔍</div>
        <p class="text-slate-400">Aplique os filtros acima para visualizar os resultados</p>
      </div>
    `;
  }
}

/**
 * Mostrar erro
 */
function showError(message) {
  const resultadosDiv = document.getElementById('resultadosFiltros');
  if (resultadosDiv) {
    resultadosDiv.innerHTML = `
      <div class="text-center py-8">
        <div class="text-4xl mb-4 text-red-400">❌</div>
        <p class="text-red-300 mb-2">${message}</p>
      </div>
    `;
  }
}

/**
 * Limpar todos os filtros
 */
function clearAllFilters() {
  // Limpar todos os campos
  document.getElementById('filtroProtocolo').value = '';
  document.getElementById('filtroStatusDemanda').value = '';
  document.getElementById('filtroUnidadeCadastro').value = '';
  document.getElementById('filtroCanal').value = '';
  document.getElementById('filtroServidor').value = '';
  document.getElementById('filtroTipoManifestacao').value = '';
  document.getElementById('filtroTema').value = '';
  document.getElementById('filtroPrioridade').value = '';
  document.getElementById('filtroUnidadeSaude').value = '';
  document.getElementById('filtroDataCriacaoInicial').value = '';
  document.getElementById('filtroDataCriacaoFinal').value = '';
  document.getElementById('filtroMesCriado').value = '';
  document.getElementById('filtroMesFinalizado').value = '';
  document.getElementById('filtroAssunto').value = '';
  document.getElementById('filtroResponsavel').value = '';
  document.getElementById('filtroStatus').value = '';
  
  // Limpar estado
  filtrosState.filtros = [];
  filtrosState.protocolosFiltrados = 0;
  
  // Atualizar contadores
  updateCounters();
  
  // Limpar resultados
  clearResults();
  
  // Filtros funcionam apenas nesta página (manual)
  
  // Limpar filtros salvos
  clearSavedFilters();
  
  if (window.Logger) {
    window.Logger.debug('🔍 Todos os filtros foram limpos');
  }
}

/**
 * Atualizar contadores
 */
function updateCounters() {
  // Contador de filtros ativos
  const contadorEl = document.getElementById('contadorFiltrosAtivos');
  if (contadorEl) {
    contadorEl.textContent = filtrosState.filtros.length;
  }
  
  // Total de protocolos filtrados
  const totalFiltradosEl = document.getElementById('totalProtocolosFiltrados');
  if (totalFiltradosEl) {
    if (filtrosState.protocolosFiltrados > 0) {
      totalFiltradosEl.textContent = filtrosState.protocolosFiltrados.toLocaleString('pt-BR');
    } else {
      totalFiltradosEl.textContent = '—';
    }
  }
  
  // Percentual filtrado
  const percentualEl = document.getElementById('percentualFiltrado');
  if (percentualEl && filtrosState.totalProtocolos > 0) {
    const percentual = filtrosState.protocolosFiltrados > 0
      ? ((filtrosState.protocolosFiltrados / filtrosState.totalProtocolos) * 100).toFixed(1)
      : '0.0';
    percentualEl.textContent = `${percentual}%`;
  } else if (percentualEl) {
    percentualEl.textContent = '—';
  }
}

/**
 * Atualizar estatísticas
 */
function updateStatistics() {
  updateCounters();
}

/**
 * Formatar data
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  try {
    // Tentar diferentes formatos
    if (dateStr.includes('/')) {
      return dateStr;
    }
    
    if (dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    }
    
    return dateStr;
  } catch (error) {
    return dateStr;
  }
}

/**
 * Truncar texto
 */
function truncateText(text, maxLength) {
  if (!text) return 'N/A';
  const str = String(text);
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

/**
 * Salvar filtros no localStorage
 */
function saveFilters() {
  try {
    const filtrosData = {
      filtros: filtrosState.filtros,
      timestamp: Date.now()
    };
    localStorage.setItem('filtros-avancados-state', JSON.stringify(filtrosData));
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao salvar filtros:', error);
    }
  }
}

/**
 * Restaurar filtros salvos
 */
function restoreSavedFilters() {
  try {
    const saved = localStorage.getItem('filtros-avancados-state');
    if (!saved) return;
    
    const filtrosData = JSON.parse(saved);
    
    // Verificar se não é muito antigo (7 dias)
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - filtrosData.timestamp > maxAge) {
      clearSavedFilters();
      return;
    }
    
    // Restaurar valores dos campos (simplificado - apenas alguns campos principais)
    // Nota: Restaurar todos os campos seria complexo, então vamos apenas restaurar se houver filtros salvos
    if (filtrosData.filtros && filtrosData.filtros.length > 0) {
      // Aplicar filtros salvos (opcional - pode ser desabilitado)
      // applyFiltersAPI(filtrosData.filtros).then(displayResults);
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao restaurar filtros:', error);
    }
  }
}

/**
 * Limpar filtros salvos
 */
function clearSavedFilters() {
  try {
    localStorage.removeItem('filtros-avancados-state');
  } catch (error) {
    if (window.Logger) {
      window.Logger.warn('Erro ao limpar filtros salvos:', error);
    }
  }
}

// Exportar função globalmente
window.loadFiltrosAvancados = loadFiltrosAvancados;


if (window.Logger) {
  window.Logger.debug('✅ Página Filtros Avançados carregada');
}

