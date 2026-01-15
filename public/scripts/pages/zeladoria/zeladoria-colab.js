/**
 * Páginas Zeladoria - Integração Colab
 * Gerencia todas as páginas relacionadas ao Colab na seção Zeladoria
 */

/**
 * Carregar lista de demandas
 */
async function loadColabDemandas() {
  if (window.Logger) {
    window.Logger.debug('📋 loadColabDemandas: Iniciando');
  }
  
  const page = document.getElementById('page-zeladoria-colab-demandas');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    const listaEl = document.getElementById('zeladoria-colab-lista-demandas');
    if (!listaEl) return;
    
    listaEl.innerHTML = '<div class="glass rounded-xl p-6 text-center text-slate-400">Carregando demandas...</div>';
    
    // Obter filtros
    const status = document.getElementById('zeladoria-colab-filter-status')?.value || '';
    const startDate = document.getElementById('zeladoria-colab-filter-start-date')?.value;
    const endDate = document.getElementById('zeladoria-colab-filter-end-date')?.value;
    
    // Se não tiver datas, usar últimos 30 dias
    let startDateStr, endDateStr;
    if (startDate && endDate) {
      startDateStr = `${startDate} 00:00:00.0000`;
      endDateStr = `${endDate} 23:59:59.9999`;
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      startDateStr = start.toISOString().replace('T', ' ').substring(0, 19) + '.0000';
      endDateStr = end.toISOString().replace('T', ' ').substring(0, 19) + '.9999';
    }
    
    let url = `/api/colab/posts?start_date=${encodeURIComponent(startDateStr)}&end_date=${encodeURIComponent(endDateStr)}`;
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }
    
    const demandas = await window.dataLoader?.load(url, {
      useDataStore: true,
      ttl: 2 * 60 * 1000
    }) || [];
    
    if (demandas.length === 0) {
      listaEl.innerHTML = '<div class="glass rounded-xl p-6 text-center text-slate-400">Nenhuma demanda encontrada</div>';
      return;
    }
    
    // Renderizar lista
    listaEl.innerHTML = demandas.map(demanda => {
      const statusColors = {
        'NOVO': 'bg-violet-500/20 text-violet-300',
        'ABERTO': 'bg-blue-500/20 text-blue-300',
        'ATENDIMENTO': 'bg-amber-500/20 text-amber-300',
        'ATENDIDO': 'bg-emerald-500/20 text-emerald-300',
        'FECHADO': 'bg-emerald-600/20 text-emerald-400',
        'RECUSADO': 'bg-rose-500/20 text-rose-300'
      };
      
      const statusColor = statusColors[demanda.status] || 'bg-slate-500/20 text-slate-300';
      const createdAt = new Date(demanda.created_at).toLocaleDateString('pt-BR');
      const updatedAt = new Date(demanda.updated_at).toLocaleDateString('pt-BR');
      
      // Obter cor do tipo de manifestação
      const tipoColor = window.config?.getColorByTipoManifestacao?.(demanda.type);
      const tipoStyle = tipoColor ? `style="background-color: ${tipoColor}20; color: ${tipoColor}"` : '';
      
      return `
        <div class="glass rounded-xl p-6 hover:bg-white/5 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span class="text-2xl font-bold text-cyan-300">#${demanda.id}</span>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusColor}">${demanda.status}</span>
                <span class="text-xs px-2 py-1 rounded" ${tipoStyle || 'class="text-slate-400"'}>${demanda.type}</span>
              </div>
              <p class="text-slate-300 mb-2">${demanda.description || 'Sem descrição'}</p>
              <div class="text-xs text-slate-400 space-y-1">
                <div>📍 ${demanda.address || 'Endereço não informado'}</div>
                ${demanda.neighborhood ? `<div>🏘️ ${demanda.neighborhood}</div>` : ''}
                <div>📅 Criado: ${createdAt} | Atualizado: ${updatedAt}</div>
              </div>
            </div>
            <div class="flex gap-2 ml-4">
              <button onclick="verDetalhesDemanda(${demanda.id}, '${demanda.type}')" class="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 rounded text-xs text-cyan-300 transition-colors">
                Ver
              </button>
              ${demanda.status === 'NOVO' || demanda.status === 'ABERTO' ? `
                <button onclick="aceitarDemanda(${demanda.id}, '${demanda.type}')" class="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 rounded text-xs text-emerald-300 transition-colors">
                  Aceitar
                </button>
              ` : ''}
              ${demanda.status === 'ATENDIMENTO' ? `
                <button onclick="finalizarDemanda(${demanda.id}, '${demanda.type}')" class="px-3 py-1 bg-violet-500/20 hover:bg-violet-500/30 rounded text-xs text-violet-300 transition-colors">
                  Finalizar
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    if (window.Logger) {
      window.Logger.success(`📋 loadColabDemandas: ${demandas.length} demandas carregadas`);
    }
  } catch (error) {
    const listaEl = document.getElementById('zeladoria-colab-lista-demandas');
    if (listaEl) {
      listaEl.innerHTML = `<div class="glass rounded-xl p-6 text-center text-rose-400">Erro ao carregar demandas: ${error.message}</div>`;
    }
    if (window.Logger) {
      window.Logger.error('Erro ao carregar demandas:', error);
    }
  }
}

/**
 * Carregar página de criar demanda
 */
async function loadZeladoriaColabCriar() {
  const page = document.getElementById('page-zeladoria-colab-criar');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    // Carregar categorias
    const categorias = await window.dataLoader?.load('/api/colab/categories?type=post', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || { categories: [] };
    
    const selectEl = document.getElementById('zeladoria-colab-categoria-id');
    if (selectEl && categorias.categories) {
      selectEl.innerHTML = '<option value="">Selecione uma categoria</option>' +
        categorias.categories.map(cat => 
          `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
    }
    
    // Configurar formulário
    const form = document.getElementById('zeladoria-colab-form-criar');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await criarDemanda();
      };
    }
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar página criar:', error);
    }
  }
}

/**
 * Criar nova demanda
 */
async function criarDemanda() {
  try {
    const descricao = document.getElementById('zeladoria-colab-descricao')?.value;
    const endereco = document.getElementById('zeladoria-colab-endereco')?.value;
    const bairro = document.getElementById('zeladoria-colab-bairro')?.value;
    const latitude = parseFloat(document.getElementById('zeladoria-colab-latitude')?.value);
    const longitude = parseFloat(document.getElementById('zeladoria-colab-longitude')?.value);
    const categoriaId = parseInt(document.getElementById('zeladoria-colab-categoria-id')?.value);
    const imagens = document.getElementById('zeladoria-colab-imagens')?.value;
    
    if (!descricao || !endereco || isNaN(latitude) || isNaN(longitude) || !categoriaId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    
    const payload = {
      description: descricao,
      address: endereco,
      lat: latitude,
      lng: longitude,
      postCategoryId: categoriaId
    };
    
    if (bairro) payload.neighborhood = bairro;
    if (imagens) {
      payload.pictureUrl = imagens.split(',').map(url => url.trim()).filter(url => url);
    }
    
    const response = await fetch('/api/colab/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Enviar cookies de sessão
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao criar demanda');
    }
    
    alert('✅ Demanda criada com sucesso!');
    if (typeof window.loadSection === 'function') {
      window.loadSection('zeladoria-colab-demandas');
    } else if (typeof loadSection === 'function') {
      loadSection('zeladoria-colab-demandas');
    }
  } catch (error) {
    alert(`❌ Erro: ${error.message}`);
    if (window.Logger) {
      window.Logger.error('Erro ao criar demanda:', error);
    }
  }
}

/**
 * Carregar categorias
 */
async function loadZeladoriaColabCategorias() {
  const page = document.getElementById('page-zeladoria-colab-categorias');
  if (!page || page.style.display === 'none') {
    return Promise.resolve();
  }
  
  try {
    const categorias = await window.dataLoader?.load('/api/colab/categories?type=post', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || { categories: [] };
    
    const listaEl = document.getElementById('zeladoria-colab-lista-categorias');
    if (!listaEl) return;
    
    if (categorias.categories.length === 0) {
      listaEl.innerHTML = '<div class="glass rounded-xl p-6 text-center text-slate-400">Nenhuma categoria encontrada</div>';
      return;
    }
    
    listaEl.innerHTML = categorias.categories.map(cat => {
      const tipoColor = window.config?.getColorByTipoManifestacao?.(cat.type);
      const tipoStyle = tipoColor ? `style="background-color: ${tipoColor}20; color: ${tipoColor}"` : '';
      
      return `
        <div class="glass rounded-xl p-6 hover:bg-white/5 transition-colors">
          <div class="text-2xl font-bold text-cyan-300 mb-2">#${cat.id}</div>
          <div class="text-slate-300 font-semibold">${cat.name}</div>
          <div class="text-xs mt-2 px-2 py-1 rounded inline-block" ${tipoStyle || 'class="text-slate-400"'}>Tipo: ${cat.type}</div>
        </div>
      `;
    }).join('');
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao carregar categorias:', error);
    }
  }
}

// Funções auxiliares globais
window.aceitarDemanda = async (id, type) => {
  try {
    const endpoint = type === 'post' ? `/api/colab/posts/${id}/accept` : `/api/colab/events/${id}/accept`;
    const response = await fetch(endpoint, { method: 'POST' });
    
    if (!response.ok) throw new Error('Erro ao aceitar demanda');
    
    alert('✅ Demanda aceita com sucesso!');
    if (window.loadColabDemandas) {
      window.loadColabDemandas();
    }
  } catch (error) {
    alert(`❌ Erro: ${error.message}`);
  }
};

window.finalizarDemanda = async (id, type) => {
  const message = prompt('Mensagem de finalização:');
  if (!message) return;
  
  try {
    const endpoint = type === 'post' ? `/api/colab/posts/${id}/solve` : `/api/colab/events/${id}/solve`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) throw new Error('Erro ao finalizar demanda');
    
    alert('✅ Demanda finalizada com sucesso!');
    if (window.loadColabDemandas) {
      window.loadColabDemandas();
    }
  } catch (error) {
    alert(`❌ Erro: ${error.message}`);
  }
};

window.verDetalhesDemanda = async (id, type) => {
  try {
    const endpoint = type === 'post' ? `/api/colab/posts/${id}` : `/api/colab/events/${id}`;
    const response = await fetch(endpoint);
    
    if (!response.ok) throw new Error('Erro ao buscar detalhes');
    
    const demanda = await response.json();
    
    // Criar modal com detalhes
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="glass rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="neon text-xl font-bold">Demanda #${demanda.id}</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-white">✕</button>
        </div>
        <div class="space-y-4">
          <div>
            <div class="text-sm text-slate-400 mb-1">Status</div>
            <div class="text-lg font-semibold">${demanda.status}</div>
          </div>
          <div>
            <div class="text-sm text-slate-400 mb-1">Descrição</div>
            <div class="text-slate-300">${demanda.description || 'Sem descrição'}</div>
          </div>
          <div>
            <div class="text-sm text-slate-400 mb-1">Endereço</div>
            <div class="text-slate-300">${demanda.address || 'Não informado'}</div>
            ${demanda.neighborhood ? `<div class="text-slate-400 text-sm mt-1">${demanda.neighborhood}</div>` : ''}
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-slate-400 mb-1">Criado em</div>
              <div class="text-slate-300">${new Date(demanda.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <div class="text-sm text-slate-400 mb-1">Atualizado em</div>
              <div class="text-slate-300">${new Date(demanda.updated_at).toLocaleString('pt-BR')}</div>
            </div>
          </div>
          ${demanda.citizen ? `
            <div>
              <div class="text-sm text-slate-400 mb-1">Cidadão</div>
              <div class="text-slate-300">${demanda.citizen}</div>
            </div>
          ` : ''}
          <div class="flex gap-2 pt-4 border-t border-slate-700">
            <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('button').onclick = () => modal.remove();
  } catch (error) {
    alert(`❌ Erro: ${error.message}`);
  }
};

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-colab-demandas', loadColabDemandas, 500);
  window.chartCommunication.createPageFilterListener('page-zeladoria-colab-criar', loadZeladoriaColabCriar, 500);
  window.chartCommunication.createPageFilterListener('page-zeladoria-colab-categorias', loadZeladoriaColabCategorias, 500);
}

// Exportar funções
window.loadColabDemandas = loadColabDemandas;
window.loadZeladoriaColabCriar = loadZeladoriaColabCriar;
window.loadZeladoriaColabCategorias = loadZeladoriaColabCategorias;

