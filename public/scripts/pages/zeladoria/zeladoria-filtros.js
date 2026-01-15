/**
 * Página: Zeladoria - Filtros Avançados
 * Sistema de filtros para Zeladoria
 */

// Estado global da página
let zeladoriaFiltrosState = {
    filtros: [],
    totalProtocolos: 0,
    protocolosFiltrados: 0,
    optionsCache: {},
    isLoading: false,
    optionsLoaded: false,
    todosResultados: [],
    resultadosExibidos: 100
};

/**
 * Carregar página de filtros avançados da Zeladoria
 */
async function loadZeladoriaFiltros(forceRefresh = false) {
    if (window.Logger) {
        window.Logger.debug('🔍 loadZeladoriaFiltros: Iniciando carregamento');
    }

    const pageElement = document.getElementById('page-zeladoria-filtros');
    if (!pageElement || pageElement.style.display === 'none') {
        return Promise.resolve();
    }

    try {
        // Inicializar componentes
        await initializeZeladoriaFilters();

        // Carregar opções se necessário
        if (!zeladoriaFiltrosState.optionsLoaded || forceRefresh) {
            await loadZeladoriaFilterOptions(forceRefresh);
            zeladoriaFiltrosState.optionsLoaded = true;
        }

        // Carregar total de protocolos
        await loadZeladoriaTotalProtocolos();

        // Configurar event listeners
        if (!zeladoriaFiltrosState.listenersSetup) {
            setupZeladoriaEventListeners();
            zeladoriaFiltrosState.listenersSetup = true;
        }

        // Inicializar botão voltar ao topo (se função existir globalmente)
        if (typeof initBotaoVoltarTopo === 'function') {
            initBotaoVoltarTopo();
        }

        if (window.Logger) {
            window.Logger.success('🔍 loadZeladoriaFiltros: Carregamento concluído');
        }
    } catch (error) {
        console.error('Erro ao carregar filtros zeladoria:', error);
    }
}

/**
 * Inicializar filtros
 */
async function initializeZeladoriaFilters() {
    zeladoriaFiltrosState.filtros = [];
    zeladoriaFiltrosState.totalProtocolos = 0;
    zeladoriaFiltrosState.protocolosFiltrados = 0;

    updateZeladoriaCounters();

    const resultadosDiv = document.getElementById('zeladoriaResultadosFiltros');
    if (resultadosDiv) {
        resultadosDiv.innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-4 text-slate-600">🔍</div>
        <p class="text-slate-400">Aplique os filtros acima para visualizar os resultados</p>
      </div>
    `;
    }

    zeladoriaFiltrosState.todosResultados = [];
    zeladoriaFiltrosState.resultadosExibidos = 100;
}

/**
 * Carregar opções para os dropdowns
 */
async function loadZeladoriaFilterOptions(forceRefresh = false) {
    const camposFiltro = [
        { id: 'zeladoriaFiltroStatus', campo: 'status' },
        { id: 'zeladoriaFiltroCategoria', campo: 'categoria' },
        { id: 'zeladoriaFiltroDepartamento', campo: 'departamento' },
        { id: 'zeladoriaFiltroBairro', campo: 'bairro' },
        { id: 'zeladoriaFiltroResponsavel', campo: 'responsavel' },
        { id: 'zeladoriaFiltroOrigem', campo: 'origem' },
        { id: 'zeladoriaFiltroCanal', campo: 'canal' }
    ];

    const loadPromises = camposFiltro.map(async ({ id, campo }) => {
        try {
            const select = document.getElementById(id);
            if (!select) return;

            // Cache check
            if (zeladoriaFiltrosState.optionsCache[campo] && !forceRefresh) {
                populateZeladoriaSelect(select, zeladoriaFiltrosState.optionsCache[campo]);
                return;
            }

            // Fetch options using count-by which returns [{key, count}, ...]
            const options = await loadZeladoriaDistinctValues(campo);
            if (options && options.length > 0) {
                zeladoriaFiltrosState.optionsCache[campo] = options;
                populateZeladoriaSelect(select, options);
            }
        } catch (error) {
            console.error(`Erro ao carregar opções para ${campo}:`, error);
        }
    });

    await Promise.allSettled(loadPromises);
}

/**
 * Carregar valores distintos via API count-by
 */
async function loadZeladoriaDistinctValues(field) {
    try {
        if (window.dataLoader) {
            const response = await window.dataLoader.load(`/api/zeladoria/count-by?field=${encodeURIComponent(field)}`, {
                useDataStore: true,
                ttl: 60 * 60 * 1000 // 1 hora
            });

            if (Array.isArray(response)) {
                // Map {key, count} to just key, filter empties, sort
                return response
                    .map(item => item.key)
                    .filter(v => v && v !== 'Não informado' && v.trim() !== '')
                    .sort();
            }
        }
        return [];
    } catch (error) {
        console.error(`Erro ao carregar distinct ${field}:`, error);
        return [];
    }
}

/**
 * Popular select
 */
function populateZeladoriaSelect(selectElement, options) {
    if (!selectElement) return;
    const currentValue = selectElement.value;

    // Clear except "Todos"
    while (selectElement.children.length > 1) {
        selectElement.removeChild(selectElement.lastChild);
    }

    if (selectElement.children.length === 0) {
        const optAll = document.createElement('option');
        optAll.value = "";
        optAll.textContent = "Todos";
        selectElement.appendChild(optAll);
    }

    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        selectElement.appendChild(opt);
    });

    if (currentValue) selectElement.value = currentValue;
}

/**
 * Carregar total de protocolos
 */
async function loadZeladoriaTotalProtocolos() {
    try {
        if (window.dataLoader) {
            const summary = await window.dataLoader.load('/api/zeladoria/summary', {
                useDataStore: true,
                ttl: 5 * 60 * 1000
            });
            if (summary && summary.total !== undefined) {
                zeladoriaFiltrosState.totalProtocolos = summary.total;
                updateZeladoriaCounters();
            }
        }
    } catch (error) {
        console.error('Erro loading total zeladoria:', error);
    }
}

/**
 * Atualizar contadores na tela
 */
function updateZeladoriaCounters() {
    const elTotal = document.getElementById('zeladoriaTotalProtocolos');
    const elFiltrados = document.getElementById('zeladoriaTotalFiltrados');
    const elPercent = document.getElementById('zeladoriaPercentualFiltrado');
    const elAtivos = document.getElementById('zeladoriaContadorFiltrosAtivos');

    if (elTotal) elTotal.textContent = zeladoriaFiltrosState.totalProtocolos.toLocaleString('pt-BR');
    if (elFiltrados) {
        if (zeladoriaFiltrosState.filtros.length > 0) {
            elFiltrados.textContent = zeladoriaFiltrosState.protocolosFiltrados.toLocaleString('pt-BR');
        } else {
            elFiltrados.textContent = '—';
        }
    }

    if (elPercent) {
        if (zeladoriaFiltrosState.filtros.length > 0 && zeladoriaFiltrosState.totalProtocolos > 0) {
            const pct = (zeladoriaFiltrosState.protocolosFiltrados / zeladoriaFiltrosState.totalProtocolos) * 100;
            elPercent.textContent = `${pct.toFixed(1)}%`;
        } else {
            elPercent.textContent = '—';
        }
    }

    if (elAtivos) elAtivos.textContent = zeladoriaFiltrosState.filtros.length;
}

/**
 * Setup Event Listeners
 */
function setupZeladoriaEventListeners() {
    const btnAplicar = document.getElementById('btnZeladoriaAplicarFiltros');
    if (btnAplicar) btnAplicar.addEventListener('click', applyZeladoriaFilters);

    const btnLimpar = document.getElementById('btnZeladoriaLimparTodos');
    if (btnLimpar) btnLimpar.addEventListener('click', clearAllZeladoriaFilters);

    // Toggle
    const toggle = document.getElementById('toggleZeladoriaFiltros');
    if (toggle) {
        toggle.addEventListener('change', (e) => {
            if (!e.target.checked) clearAllZeladoriaFilters();
        });
    }
}

/**
 * Coletar filtros
 */
function collectZeladoriaFilters() {
    const filtros = [];

    // Mapeamento ID -> Campo API
    const inputs = [
        { id: 'zeladoriaFiltroStatus', field: 'status', op: 'eq' },
        { id: 'zeladoriaFiltroCategoria', field: 'categoria', op: 'eq' },
        { id: 'zeladoriaFiltroDepartamento', field: 'departamento', op: 'eq' },
        { id: 'zeladoriaFiltroBairro', field: 'bairro', op: 'eq' },
        { id: 'zeladoriaFiltroResponsavel', field: 'responsavel', op: 'eq' },
        { id: 'zeladoriaFiltroOrigem', field: 'origem', op: 'eq' },
        { id: 'zeladoriaFiltroCanal', field: 'canal', op: 'eq' }
    ];

    inputs.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && el.value && el.value !== '' && el.value !== 'Todos') {
            filtros.push({
                field: item.field,
                op: item.op,
                value: el.value
            });
        }
    });

    // Filtro de Texto (Protocolo Global ou Empresa)
    // Zeladoria has `protocoloEmpresa`. Could also search inside JSON data if needed.
    // We'll search `protocoloEmpresa` or `description`? 
    // Zeladoria model doesn't explicitly show 'description' but it has `data` mixed.
    // For now let's assume filtering by `protocoloEmpresa` if user types in a text box.
    // But wait, the UI I'm planning (based on Ouvidoria) might have a text input.
    // Ouvidoria has `filtroProtocolo`. I'll add `zeladoriaFiltroProtocolo`.
    const elProto = document.getElementById('zeladoriaFiltroProtocolo');
    if (elProto && elProto.value) {
        filtros.push({
            field: 'protocoloEmpresa',
            op: 'contains',
            value: elProto.value
        });
    }

    // Datas
    const dtIni = document.getElementById('zeladoriaFiltroDataInicial')?.value;
    const dtFim = document.getElementById('zeladoriaFiltroDataFinal')?.value;

    if (dtIni) {
        filtros.push({ field: 'dataCriacaoIso', op: 'gte', value: dtIni });
    }
    if (dtFim) {
        filtros.push({ field: 'dataCriacaoIso', op: 'lte', value: dtFim + 'T23:59:59.999Z' });
    }

    return filtros;
}

/**
 * Aplicar Filtros
 */
async function applyZeladoriaFilters() {
    if (zeladoriaFiltrosState.isLoading) return;

    const toggle = document.getElementById('toggleZeladoriaFiltros');
    if (toggle && !toggle.checked) return;

    zeladoriaFiltrosState.isLoading = true;
    document.getElementById('zeladoriaResultadosFiltros').innerHTML = `
    <div class="flex flex-col items-center justify-center py-12">
      <div class="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
      <p class="text-cyan-300 animate-pulse">Buscando registros...</p>
    </div>
  `;

    try {
        const filtros = collectZeladoriaFilters();
        zeladoriaFiltrosState.filtros = filtros;

        // Call new endpoint for Zeladoria
        const response = await fetch('/api/zeladoria/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters })
        });

        if (!response.ok) throw new Error('Falha ao buscar dados');

        const data = await response.json();
        zeladoriaFiltrosState.todosResultados = data;
        zeladoriaFiltrosState.protocolosFiltrados = data.length;
        zeladoriaFiltrosState.resultadosExibidos = 100;

        updateZeladoriaCounters();
        renderZeladoriaResults();

    } catch (error) {
        console.error('Erro ao aplicar filtros:', error);
        document.getElementById('zeladoriaResultadosFiltros').innerHTML = `
      <div class="text-center text-red-400 py-8">
        <p>Erro ao buscar dados. Tente novamente.</p>
        <small class="block mt-2 text-red-500/50">${error.message}</small>
      </div>
    `;
    } finally {
        zeladoriaFiltrosState.isLoading = false;
    }
}

/**
 * Renderizar Resultados
 */
function renderZeladoriaResults() {
    const container = document.getElementById('zeladoriaResultadosFiltros');
    const resultados = zeladoriaFiltrosState.todosResultados.slice(0, zeladoriaFiltrosState.resultadosExibidos);

    if (resultados.length === 0) {
        container.innerHTML = `
      <div class="text-center py-12">
        <div class="text-4xl mb-4 text-slate-600">📭</div>
        <p class="text-slate-400">Nenhum registro encontrado com os filtros selecionados.</p>
      </div>
    `;
        return;
    }

    let html = `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-white/10 text-xs text-slate-400 uppercase tracking-wider">
            <th class="p-4 font-medium">Protocolo</th>
            <th class="p-4 font-medium">Data</th>
            <th class="p-4 font-medium">Departamento</th>
            <th class="p-4 font-medium">Categoria</th>
            <th class="p-4 font-medium">Bairro</th>
            <th class="p-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-sm">
  `;

    resultados.forEach(r => {
        // Determine status color
        let statusClass = 'bg-slate-500/20 text-slate-300';
        const st = (r.status || '').toLowerCase();

        if (st.includes('novo') || st.includes('aberto')) statusClass = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
        else if (st.includes('execu') || st.includes('andamento')) statusClass = 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
        else if (st.includes('concl') || st.includes('final')) statusClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';

        // Date formatting
        let dataFmt = r.dataCriacao || '—';
        if (r.dataCriacaoIso) {
            try {
                const d = new Date(r.dataCriacaoIso);
                dataFmt = d.toLocaleDateString('pt-BR');
            } catch (e) { }
        }

        html += `
      <tr class="hover:bg-white/5 transition-colors group">
        <td class="p-4 font-mono text-xs text-cyan-300/80">${r.protocoloEmpresa || r.id || '—'}</td>
        <td class="p-4 text-slate-300">${dataFmt}</td>
        <td class="p-4 text-slate-300">${r.departamento || '—'}</td>
        <td class="p-4 text-slate-300">${r.categoria || '—'}</td>
        <td class="p-4 text-slate-300">${r.bairro || '—'}</td>
        <td class="p-4">
          <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">
            ${r.status || 'Desconhecido'}
          </span>
        </td>
      </tr>
    `;
    });

    html += `</tbody></table></div>`;

    if (zeladoriaFiltrosState.todosResultados.length > zeladoriaFiltrosState.resultadosExibidos) {
        html += `
      <div class="text-center mt-4 pt-4 border-t border-white/5">
        <button onclick="loadMoreZeladoriaResults()" class="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
          Carregar Mais (${zeladoriaFiltrosState.todosResultados.length - zeladoriaFiltrosState.resultadosExibidos} restantes)
        </button>
      </div>
    `;
    }

    container.innerHTML = html;
}

window.loadMoreZeladoriaResults = function () {
    zeladoriaFiltrosState.resultadosExibidos += 100;
    renderZeladoriaResults();
};

/**
 * Limpar Filtros
 */
function clearAllZeladoriaFilters() {
    const ids = [
        'zeladoriaFiltroStatus', 'zeladoriaFiltroCategoria', 'zeladoriaFiltroDepartamento',
        'zeladoriaFiltroBairro', 'zeladoriaFiltroResponsavel', 'zeladoriaFiltroOrigem',
        'zeladoriaFiltroCanal', 'zeladoriaFiltroProtocolo', 'zeladoriaFiltroDataInicial',
        'zeladoriaFiltroDataFinal'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    zeladoriaFiltrosState.filtros = [];
    zeladoriaFiltrosState.todosResultados = [];
    zeladoriaFiltrosState.protocolosFiltrados = 0;
    updateZeladoriaCounters();

    const resDiv = document.getElementById('zeladoriaResultadosFiltros');
    if (resDiv) {
        resDiv.innerHTML = `
      <div class="text-center">
        <div class="text-6xl mb-4 text-slate-600">🔍</div>
        <p class="text-slate-400">Filtros limpos. Aplique novos filtros.</p>
      </div>
    `;
    }
}

// Expor globalmente
window.loadZeladoriaFiltros = loadZeladoriaFiltros;
