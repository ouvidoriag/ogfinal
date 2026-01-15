/**
 * ============================================================================
 * PÁGINA: ZELADORIA - ANÁLISE GEOGRÁFICA
 * ============================================================================
 * 
 * Esta página apresenta uma análise geográfica das ocorrências de zeladoria,
 * exibindo dados de localização (bairros, coordenadas GPS) e permitindo
 * identificar áreas com maior concentração de demandas.
 * 
 * DADOS EXIBIDOS:
 * - Tabela de bairros com coordenadas GPS
 * - Quantidade de ocorrências por bairro
 * - Distribuição de categorias por bairro
 * - Distribuição de status por bairro
 * - Dados adicionais: apoios, cidade, estado
 * 
 * CAMPOS DO BANCO UTILIZADOS:
 * - bairro: Nome do bairro
 * - latitude: Coordenada de latitude
 * - longitude: Coordenada de longitude
 * - categoria: Categoria da demanda
 * - status: Status atual da demanda
 * - apoios: Quantidade de apoios recebidos
 * - cidade: Cidade do bairro
 * - estado: Estado do bairro
 * 
 * ============================================================================
 */

async function loadZeladoriaGeografica() {
  const page = document.getElementById('page-zeladoria-geografica');
  if (!page || page.style.display === 'none') return;
  
  try {
    const data = await window.dataLoader?.load('/api/zeladoria/geographic', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    const content = document.getElementById('zeladoria-geografica-content');
    if (!content) return;
    
    if (data.length === 0) {
      content.innerHTML = '<p class="text-slate-400">Nenhum dado geográfico disponível</p>';
      return;
    }
    
    // Ordenar por quantidade de ocorrências (maior primeiro)
    const sortedData = [...data].sort((a, b) => (b.count || 0) - (a.count || 0));
    
    // Atualizar KPIs no header
    updateZeladoriaGeograficaKPIs(sortedData, data);
    
    // Criar tabela com dados geográficos detalhados
    let html = `
      <div class="mb-4 glass rounded-lg p-4">
        <div class="text-sm text-slate-300 mb-2">📊 Resumo Geográfico</div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <div class="text-slate-400">Total de Bairros</div>
            <div class="text-cyan-300 font-bold text-lg">${data.length}</div>
          </div>
          <div>
            <div class="text-slate-400">Total de Ocorrências</div>
            <div class="text-violet-300 font-bold text-lg">${data.reduce((sum, item) => sum + (item.count || 0), 0).toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div class="text-slate-400">Média por Bairro</div>
            <div class="text-emerald-300 font-bold text-lg">${data.length > 0 ? Math.round(data.reduce((sum, item) => sum + (item.count || 0), 0) / data.length) : 0}</div>
          </div>
          <div>
            <div class="text-slate-400">Top Bairro</div>
            <div class="text-amber-300 font-bold text-sm truncate" title="${sortedData[0]?.bairro || 'N/A'}">${sortedData[0]?.bairro || 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
    
    html += '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-700">';
    html += '<th class="text-left p-3 text-cyan-300">#</th>';
    html += '<th class="text-left p-3 text-cyan-300">Bairro</th>';
    html += '<th class="text-left p-3 text-cyan-300">Ocorrências</th>';
    html += '<th class="text-left p-3 text-cyan-300">Coordenadas GPS</th>';
    html += '<th class="text-left p-3 text-cyan-300">Categoria Principal</th>';
    html += '<th class="text-left p-3 text-cyan-300">Status</th>';
    html += '</tr></thead><tbody>';
    
    sortedData.slice(0, 50).forEach((item, idx) => {
      // Encontrar categoria e status mais comuns
      const topCategoria = Object.entries(item.categorias || {})
        .sort((a, b) => b[1] - a[1])[0];
      const topStatus = Object.entries(item.status || {})
        .sort((a, b) => b[1] - a[1])[0];
      
      html += '<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">';
      html += `<td class="p-3 text-slate-400">${idx + 1}</td>`;
      html += `<td class="p-3 font-medium">${item.bairro || 'Não informado'}</td>`;
      html += `<td class="p-3 text-emerald-300 font-bold">${item.count || 0}</td>`;
      html += `<td class="p-3 text-xs text-slate-400" title="Latitude, Longitude">${item.latitude?.toFixed(4) || 'N/A'}, ${item.longitude?.toFixed(4) || 'N/A'}</td>`;
      html += `<td class="p-3 text-xs text-violet-300">${topCategoria ? `${topCategoria[0]} (${topCategoria[1]})` : 'N/A'}</td>`;
      html += `<td class="p-3 text-xs text-cyan-300">${topStatus ? `${topStatus[0]} (${topStatus[1]})` : 'N/A'}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table></div>';
    html += `<p class="mt-4 text-slate-400 text-sm">Mostrando ${Math.min(sortedData.length, 50)} de ${sortedData.length} bairros com coordenadas GPS</p>`;
    
    content.innerHTML = html;
  } catch (error) {
    window.Logger?.error('Erro ao carregar Geográfica Zeladoria:', error);
  }
}

/**
 * Atualizar KPIs no header da página
 */
function updateZeladoriaGeograficaKPIs(sortedData, allData) {
  if (!allData || !Array.isArray(allData) || allData.length === 0) {
    return;
  }
  
  const total = allData.reduce((sum, item) => sum + (item.count || 0), 0);
  const bairros = allData.length;
  const maisAtivo = sortedData[0];
  const maisAtivoNome = maisAtivo ? (maisAtivo.bairro || 'N/A') : '—';
  const media = bairros > 0 ? Math.round(total / bairros) : 0;
  
  const bairrosEl = document.getElementById('zeladoria-geografica-kpi-bairros');
  const totalEl = document.getElementById('zeladoria-geografica-kpi-total');
  const maisAtivoEl = document.getElementById('zeladoria-geografica-kpi-mais-ativo');
  const mediaEl = document.getElementById('zeladoria-geografica-kpi-media');
  
  if (bairrosEl) bairrosEl.textContent = bairros.toLocaleString('pt-BR');
  if (totalEl) totalEl.textContent = total.toLocaleString('pt-BR');
  if (maisAtivoEl) {
    maisAtivoEl.textContent = maisAtivoNome;
    maisAtivoEl.title = maisAtivoNome;
  }
  if (mediaEl) mediaEl.textContent = media.toLocaleString('pt-BR');
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-geografica', loadZeladoriaGeografica, 500);
}

window.loadZeladoriaGeografica = loadZeladoriaGeografica;

