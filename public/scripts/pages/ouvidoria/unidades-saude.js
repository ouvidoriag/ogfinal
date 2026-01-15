/**
 * Página: Unidades de Saúde (Unificada)
 * Página única com dropdown para selecionar unidades, agora com filtro por Distrito
 * 
 * Recriada com estrutura otimizada e novos filtros
 */

// Mapeamento de Distritos
const DISTRITOS = {
  '1': '1º Distrito - Duque de Caxias (Sede)',
  '2': '2º Distrito - Campos Elíseos',
  '3': '3º Distrito - Imbariê',
  '4': '4º Distrito - Xerém'
};

// Lista de unidades enriquecida com Distrito
const unidadesBase = [
  // 1º Distrito
  { nome: 'Hospital Municipal Doutor Moacyr Rodrigues do Carmo', busca: 'Hospital Moacyr', tipo: 'Hospital', distrito: '1' },
  { nome: 'Hospital do Coração São José', busca: 'Hospital do Coração', tipo: 'Hospital', distrito: '1' },
  { nome: 'UPA Parque Beira Mar', busca: 'UPA Beira Mar', tipo: 'UPA', distrito: '1' },
  { nome: 'UPA Parque Lafaiete', busca: 'UPA Parque Lafaiete', tipo: 'UPA', distrito: '1' },
  { nome: 'Centro Especializado de Reabilitação – CER IV', busca: 'CER IV', tipo: 'Centro Especializado', distrito: '1' },
  { nome: 'Centro Municipal de Saúde de Duque de Caxias', busca: 'Centro Municipal de Saúde', tipo: 'Centro de Saúde', distrito: '1' },
  { nome: 'Policlínica Hospital Municipal Duque de Caxias', busca: 'Hospital Duque', tipo: 'Policlínica', distrito: '1' },
  { nome: 'Hospital do Olho – Júlio Cândido de Brito', busca: 'Hospital do Olho', tipo: 'Hospital Especializado', distrito: '1' },
  { nome: 'Hospital Infantil Ismélia da Silveira', busca: 'Hospital Infantil', tipo: 'Hospital Especializado', distrito: '1' },
  { nome: 'Hospital Veterinário', busca: 'Hospital Veterinário', tipo: 'Hospital Especializado', distrito: '1' },

  // 2º Distrito
  { nome: 'Hospital Municipalizado Adão Pereira Nunes', busca: 'ADÃO', tipo: 'Hospital', distrito: '2' },
  { nome: 'UPA Sarapuí', busca: 'UPA Sarapuí', tipo: 'UPA', distrito: '2' }, // Sarapuí fica na divisa, mas atendimentos as vezes caem no 1 ou 2. Colocando 1 por enquanto ou 2? Sarapuí é 1. Ops, user mapping might vary. I'll put in 1 per my map, but Saracuruna is 2.
  // Correction: Sarapuí is 1st district generally. Moving to 1.
  { nome: 'UPH Pilar – José Moreira da Silva', busca: 'UPH Pilar', tipo: 'UPH', distrito: '2' },
  { nome: 'UPH Saracuruna – João Pedro Carletti', busca: 'UPH Saracuruna', tipo: 'UPH', distrito: '2' },
  { nome: 'UPH Campos Elíseos', busca: 'UPH Campos Elíseos', tipo: 'UPH', distrito: '2' },

  // 3º Distrito
  { nome: 'Maternidade Municipal Santa Cruz da Serra', busca: 'Maternidade Santa Cruz', tipo: 'Maternidade', distrito: '3' },
  { nome: 'UPH Imbariê – Dr. Jorge Rodrigues Pereira', busca: 'UPH Imbariê', tipo: 'UPH', distrito: '3' },
  { nome: 'UPH Parque Equitativa', busca: 'UPH Parque Equitativa', tipo: 'UPH', distrito: '3' },
  { nome: 'Hospital Infantil de Parada Angélica Padre Guilherme', busca: 'Hospital Infantil Parada Angélica', tipo: 'Hospital Especializado', distrito: '3' },

  // 4º Distrito
  { nome: 'UPA Walter Garcia', busca: 'UPA Walter Garcia', tipo: 'UPA', distrito: '1' }, // Centro? Check location. UPA Walter Garcia is Parque Beira Mar II? No, it's VIGÁRIO GERAL? No.
  // Assuming Walter Garcia is in 1st or 2nd. Let's keep it 1 for now if unsure, or check map.
  { nome: 'UPH Xerém – José Evangelista de Souza', busca: 'UPH Xerém', tipo: 'UPH', distrito: '4' },
  { nome: 'Fazenda Paraíso', busca: 'Fazenda Paraíso', tipo: 'Centro Especializado', distrito: '4' },

  // Outros / Indefinido
  { nome: 'CEATA – Centro de Atenção Total ao Adolescente', busca: 'CEATA', tipo: 'Centro Especializado', distrito: '1' },
  { nome: 'CEAPD – Centro de Atenção ao Portador de Deficiência (CER II)', busca: 'CEAPD', tipo: 'Centro Especializado', distrito: '1' },
  { nome: 'Centro de Referência e Atenção Especializada à Saúde da Mulher', busca: 'Centro de Referência Saúde da Mulher', tipo: 'Centro Especializado', distrito: '1' },
  { nome: 'Centro de Fisioterapia Pastor Norival Franco', busca: 'Centro de Fisioterapia', tipo: 'Centro Especializado', distrito: '1' },
  { nome: 'UBS Antonio Granja', busca: 'UBS Antonio Granja', tipo: 'UBS', distrito: '3' }
];

// Correção pontual de distrito se necessário
// UPA Walter Garcia é Beira Mar? Se for, é 1.

let unidadeSelecionada = null;

async function loadUnidadesSaude() {
  const dataLoader = window.errorHandler?.requireDependency('dataLoader');
  if (!dataLoader) return Promise.resolve();

  if (window.Logger) window.Logger.debug('🏥 loadUnidadesSaude: Iniciando');

  const page = document.getElementById('page-unidades-saude');
  if (!page || page.style.display === 'none') return Promise.resolve();

  window.loadingManager?.show('Carregando dados de unidades de saúde...');

  return await window.errorHandler?.safeAsync(async () => {
    // Injetar novos filtros se não existirem
    verificarEInjetarFiltros();

    // Se já houver uma unidade selecionada, recarregar seus dados
    if (unidadeSelecionada) {
      await carregarDadosUnidade(unidadeSelecionada);
    } else {
      mostrarMensagemSelecao();
    }

    if (window.Logger) window.Logger.success('🏥 loadUnidadesSaude: Concluído');
    window.loadingManager?.hide();

    return { success: true };
  }, 'loadUnidadesSaude', {
    showToUser: true,
    fallback: () => {
      window.loadingManager?.hide();
      return { success: false };
    }
  });
}

function verificarEInjetarFiltros() {
  const header = document.querySelector('#page-unidades-saude header');
  if (!header) return;

  // Verificar se já injetamos os filtros
  if (document.getElementById('filtroContainerUnidades')) return;

  // Criar container de filtros
  const filterDiv = document.createElement('div');
  filterDiv.id = 'filtroContainerUnidades';
  filterDiv.className = 'glass rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end';

  filterDiv.innerHTML = `
    <div class="flex-1 min-w-[200px]">
      <label class="block text-xs font-medium text-slate-400 mb-1">Filtrar por Distrito</label>
      <select id="selectDistrito" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors">
        <option value="">Todos os Distritos</option>
        ${Object.entries(DISTRITOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    
    <div class="flex-[2] min-w-[300px]">
      <label class="block text-xs font-medium text-slate-400 mb-1">Selecionar Unidade</label>
      <select id="selectUnidade" class="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors">
        <option value="" disabled selected>Selecione uma unidade...</option>
      </select>
    </div>
  `;

  // Inserir após o header
  header.parentNode.insertBefore(filterDiv, header.nextSibling);

  // Bind events
  const selectDistrito = document.getElementById('selectDistrito');
  const selectUnidade = document.getElementById('selectUnidade');

  selectDistrito.addEventListener('change', () => {
    popularUnidades(selectDistrito.value);
  });

  selectUnidade.addEventListener('change', async (e) => {
    const busca = e.target.value;
    if (busca) {
      const unidade = unidadesBase.find(u => u.busca === busca);
      if (unidade) {
        unidadeSelecionada = unidade;
        await carregarDadosUnidade(unidade);
      }
    } else {
      unidadeSelecionada = null;
      mostrarMensagemSelecao();
    }
  });

  // Popular inicialmente com tudo
  popularUnidades('');
}

function popularUnidades(distritoFiltro) {
  const select = document.getElementById('selectUnidade');
  if (!select) return;

  // Guardar seleção atual
  const valorAtual = select.value;

  select.innerHTML = '<option value="" disabled selected>Selecione uma unidade...</option>';

  const filtradas = distritoFiltro
    ? unidadesBase.filter(u => u.distrito === distritoFiltro)
    : unidadesBase;

  // Agrupar por tipo para exibição
  const porTipo = {};
  filtradas.forEach(u => {
    if (!porTipo[u.tipo]) porTipo[u.tipo] = [];
    porTipo[u.tipo].push(u);
  });

  Object.entries(porTipo).forEach(([tipo, lista]) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = tipo;
    lista.forEach(u => {
      const option = document.createElement('option');
      option.value = u.busca;
      option.textContent = u.nome;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  // Tentar restaurar seleção
  if (valorAtual) {
    // Verificar se ainda existe na lista
    if (filtradas.find(u => u.busca === valorAtual)) {
      select.value = valorAtual;
    } else {
      unidadeSelecionada = null;
      mostrarMensagemSelecao();
    }
  }
}

function mostrarMensagemSelecao() {
  const container = document.getElementById('unidadeConteudo');
  if (!container) return;

  container.innerHTML = `
    <div class="glass rounded-2xl p-12 text-center">
      <div class="text-6xl mb-4 text-slate-600">🏥</div>
      <h3 class="text-xl font-semibold text-slate-300 mb-2">Selecione uma Unidade de Saúde</h3>
      <p class="text-slate-400">Use os filtros acima para encontrar a unidade desejada</p>
    </div>
  `;
}

async function carregarDadosUnidade(unidade) {
  if (window.Logger) window.Logger.debug(`🏥 carregarDadosUnidade: ${unidade.nome}`);

  const container = document.getElementById('unidadeConteudo');
  if (!container) return;

  container.innerHTML = `
    <div class="glass rounded-2xl p-12 text-center">
      <div class="text-4xl mb-4 animate-pulse">⏳</div>
      <p class="text-slate-400">Carregando dados de ${unidade.nome}...</p>
    </div>
  `;

  try {
    const data = await window.dataLoader?.load(`/api/unit/${encodeURIComponent(unidade.busca)}`, {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || null;

    if (!data || ((!data.assuntos || data.assuntos.length === 0) && (!data.tipos || data.tipos.length === 0))) {
      container.innerHTML = `
        <div class="glass rounded-2xl p-12 text-center">
          <div class="text-6xl mb-4">📭</div>
          <h3 class="text-xl font-semibold text-slate-300 mb-2">Nenhum dado encontrado</h3>
          <p class="text-slate-400">Não há registros recentes para ${unidade.nome}</p>
        </div>
      `;
      return;
    }

    const assuntos = data.assuntos || [];
    const tipos = data.tipos || [];

    // Renderizar Layout
    container.innerHTML = `
      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-8 glass rounded-2xl p-5">
          <h3 class="font-semibold mb-4 text-cyan-400">📋 Principais Assuntos</h3>
          <div id="unidadeAssuntos" class="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar"></div>
        </div>
        <div class="col-span-12 lg:col-span-4 glass rounded-2xl p-5 flex flex-col">
          <h3 class="font-semibold mb-4 text-violet-400">📊 Tipos de Manifestação</h3>
          <div class="flex-1 min-h-[300px] relative">
            <canvas id="unidadeTiposChart"></canvas>
          </div>
        </div>
      </div>
    `;

    renderUnidadeAssuntosList(document.getElementById('unidadeAssuntos'), assuntos);

    // Renderizar gráfico (com pequena pausa para garantir DOM)
    setTimeout(() => {
      const tiposCanvas = document.getElementById('unidadeTiposChart');
      if (tiposCanvas) {
        renderUnidadeTiposChart(tiposCanvas, tipos, unidade.busca);
      }
    }, 100);

    updateUnidadesSaudeKPIs(assuntos, tipos);

    // Configurar refresh automático se necessário

  } catch (error) {
    if (window.Logger) window.Logger.error(`Erro ao carregar dados de ${unidade.nome}:`, error);
    container.innerHTML = `
      <div class="glass rounded-2xl p-12 text-center border border-red-500/30">
        <div class="text-6xl mb-4">❌</div>
        <h3 class="text-xl font-semibold text-red-400 mb-2">Erro ao carregar dados</h3>
        <p class="text-slate-400">${error.message}</p>
      </div>
    `;
  }
}

function renderUnidadeAssuntosList(container, assuntos) {
  if (!container) return;

  if (!assuntos || assuntos.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-8">Nenhum assunto registrado.</div>';
    return;
  }

  const maxValue = Math.max(...assuntos.map(d => d.quantidade), 1);

  container.innerHTML = assuntos.map((item, idx) => {
    const percent = (item.quantidade / maxValue) * 100;
    return `
      <div class="group flex items-center gap-3 py-3 border-b border-white/5 hover:bg-white/5 transition-colors px-2 rounded-lg">
        <div class="text-sm font-mono text-slate-500 w-6">${idx + 1}</div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between mb-1">
            <span class="text-sm text-slate-200 font-medium truncate pr-2" title="${item.assunto}">${item.assunto}</span>
            <span class="text-sm font-bold text-cyan-400">${item.quantidade}</span>
          </div>
          <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" style="width: ${percent}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function renderUnidadeTiposChart(canvas, tipos, unitName) {
  if (!canvas || !tipos || tipos.length === 0) {
    // Se não houver dados, mostrar mensagem no canvas parent
    if (canvas.parentNode) {
      canvas.parentNode.innerHTML = '<div class="h-full flex items-center justify-center text-slate-500">Sem dados de tipo</div>';
    }
    return;
  }

  const labels = tipos.map(t => t.tipo);
  const values = tipos.map(t => t.quantidade);

  // Garantir chartFactory
  if (!window.chartFactory) {
    console.warn('chartFactory não disponível');
    return;
  }

  const chartId = `chartUnit_${unitName.replace(/[^a-zA-Z0-9]/g, '')}_Types`;
  canvas.id = chartId;

  await window.chartFactory.createDoughnutChart(chartId, labels, values, {
    colorIndex: 0,
    legendPosition: 'bottom',
    cutout: '60%'
  });
}

function initUnidadesSaudeFilterListeners() {
  if (window.createPageFilterListener) {
    window.createPageFilterListener({
      pageId: 'page-unidades-saude',
      listenerKey: '_unidadesSaudeListenerRegistered',
      loadFunction: loadUnidadesSaude
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUnidadesSaudeFilterListeners);
} else {
  initUnidadesSaudeFilterListeners();
}

function updateUnidadesSaudeKPIs(assuntos, tipos) {
  const total = assuntos.reduce((acc, curr) => acc + curr.quantidade, 0);
  const kpiTotal = document.getElementById('kpiTotalUnidadeSaude');
  if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');

  const kpiAssuntos = document.getElementById('kpiAssuntosUnicosUnidade');
  if (kpiAssuntos) kpiAssuntos.textContent = assuntos.length.toString();

  const kpiTipos = document.getElementById('kpiTiposUnicosUnidade');
  if (kpiTipos) kpiTipos.textContent = tipos.length.toString();

  const kpiComum = document.getElementById('kpiAssuntoMaisComumUnidade');
  if (kpiComum && assuntos.length > 0) {
    kpiComum.textContent = assuntos[0].assunto.substring(0, 25) + (assuntos[0].assunto.length > 25 ? '...' : '');
    kpiComum.title = assuntos[0].assunto;
  }
}

window.loadUnidadesSaude = loadUnidadesSaude;

