/**
 * ============================================================================
 * PÁGINA: ZELADORIA - MAPA INTERATIVO
 * ============================================================================
 * 
 * Mapa interativo com coordenadas GPS das demandas de zeladoria.
 * Utiliza Leaflet com múltiplos temas, clusters, marcadores coloridos
 * e filtros por status/categoria.
 * 
 * RECURSOS:
 * - Múltiplos temas de mapa (OpenStreetMap, Dark, Satellite, etc.)
 * - Marcadores coloridos por status/categoria
 * - Clusters para performance
 * - Popups informativos
 * - Filtros interativos
 * - Legenda e estatísticas
 * 
 * ============================================================================
 */

let map = null;
let markersLayer = null;
let heatmapLayer = null;
let markersData = [];
let currentTheme = 'osm';
let currentFilters = { status: '', categoria: '', departamento: '', distrito: '' };
let mapSettings = {
  showClusters: true,
  markerSize: 'normal',
  showLegend: true,
  showCoordinates: true,
  showHeatmap: false
};

// Limites geográficos de Duque de Caxias (aproximados)
const CAXIAS_BOUNDS = {
  north: -22.65,  // Latitude máxima
  south: -22.90,  // Latitude mínima
  east: -43.15,   // Longitude máxima
  west: -43.45    // Longitude mínima
};

// Distritos de Duque de Caxias
const DISTRITOS = {
  '1º Distrito - Duque de Caxias (Sede)': {
    code: '1',
    bairros: [
      'Bar dos Cavaleiros', 'Carolina', 'Centro', 'Corte Oito', 'Corte 8',
      'Doutor Laureano', 'Engenho do Porto', 'Favela do Lixão', 'Gramacho',
      'Jardim 25 de Agosto', 'Jardim Gramacho', 'Jardim Leal',
      'Jardim Olavo Bilac', 'Olavo Bilac', 'Lagunas e Dourados',
      'Parque Laguna e Dourados', 'Parque Beira-Mar', 'Parque Centenário',
      'Parque Duque', 'Parque Felicidade', 'Parque Lafaiete', 'Parque Paulicéia',
      'Periquitos', 'Prainha', 'Sarapuí', 'Vila Sarapuí', 'Vila Guanabara',
      'Vila Itamarati', 'Vila Meriti', 'Vila São Luiz', 'Vila São Sebastião'
    ]
  },
  '2º Distrito - Campos Elíseos': {
    code: '2',
    bairros: [
      'Cângulo', 'Chácaras Arcampo', 'Chácaras Rio-Petrópolis', 'Campos Elíseos',
      'Cidade dos Meninos', 'Figueira', 'Graças', 'Jardim das Oliveiras',
      'Jardim Glória', 'Jardim Primavera', 'Jardim Porangaba', 'Jardim Vila Nova',
      'Jardim Vista Alegre', 'Jurema', 'Lote XV', 'Nossa Senhora do Carmo',
      'Novo São Bento', 'Pantanal', 'Pilar', 'Parque Alvorada', 'Parque Eldorado',
      'Parque Fluminense', 'Parque Muisa', 'Parque Nova Esperança', 'Parque Samirópolis',
      'Reta do Bicão', 'São Bento', 'Santo Antônio', 'Saracuruna', 'Silva Cardoso',
      'Vila Maria Helena', 'Vila São José', 'Vila Urussaí', 'Vila São Judas Tadeu'
    ]
  },
  '3º Distrito - Imbariê': {
    code: '3',
    bairros: [
      'Imbariê', 'Santa Lúcia', 'Santa Cruz da Serra', 'Parada Angélica',
      'Jardim Anhangá', 'Taquara', 'Alto da Serra', 'Parque Paulista',
      'Parque Equitativa', 'Santo Antônio da Serra', 'Parada Morabi'
    ]
  },
  '4º Distrito - Xerém': {
    code: '4',
    bairros: [
      'Xerém', 'Mantiquira', 'Capivari', 'Amapá', 'Barro Branco',
      'Figueira', 'Córrego das Dores', 'Santo Antônio da Serra', 'Caminho do Ouro',
      'Vila Canaã', 'Vila Santa Cruz', 'Vila do Sapo', 'Vila Boa Esperança',
      'Pilarzinho', 'Rodilândia', 'Nova Campinas', 'Inconfidência',
      'Parque Inconfidência', 'Santa Alice', 'Santo Antônio do Boa Vista'
    ]
  }
};

/**
 * Validar coordenadas (verificar se estão dentro dos limites de Duque de Caxias)
 */
function validateCoordinates(lat, lng) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return false;
  }
  
  // Verificar se está dentro dos limites aproximados de Duque de Caxias
  const inBounds = 
    lat >= CAXIAS_BOUNDS.south && 
    lat <= CAXIAS_BOUNDS.north &&
    lng >= CAXIAS_BOUNDS.west && 
    lng <= CAXIAS_BOUNDS.east;
  
  return inBounds;
}

/**
 * Identificar distrito pelo bairro
 */
function getDistritoByBairro(bairro) {
  if (!bairro) return null;
  
  const bairroNormalized = bairro.trim().toLowerCase();
  
  for (const [distritoNome, distritoData] of Object.entries(DISTRITOS)) {
    for (const bairroDistrito of distritoData.bairros) {
      if (bairroNormalized === bairroDistrito.toLowerCase()) {
        return distritoNome;
      }
    }
  }
  
  return null;
}

// Temas de mapa disponíveis
const mapThemes = {
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  dark: {
    name: 'Dark Theme',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
  },
  topo: {
    name: 'Topográfico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  streets: {
    name: 'Ruas',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  light: {
    name: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }
};

// Cores por status
const statusColors = {
  'NOVO': '#22d3ee',      // Cyan
  'ABERTO': '#3b82f6',    // Blue
  'ATENDIMENTO': '#f59e0b', // Amber
  'ATENDIDO': '#10b981',   // Emerald
  'FECHADO': '#6b7280',    // Gray
  'RECUSADO': '#ef4444',   // Red
  'Não informado': '#94a3b8' // Slate
};

// Cores por categoria (fallback)
const categoriaColors = {
  'default': '#a78bfa' // Violet
};

/**
 * Carregar página do mapa
 */
async function loadZeladoriaMapa() {
  // Verificar se está na dashboard principal
  const page = document.getElementById('page-zeladoria-mapa');
  if (!page || page.style.display === 'none') return;
  
  try {
    // Aguardar até que lazyLibraries esteja disponível
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo
    
    while ((!window.lazyLibraries || !window.lazyLibraries.loadLeaflet) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.lazyLibraries || !window.lazyLibraries.loadLeaflet) {
      throw new Error('lazyLibraries não foi carregado. Verifique se /scripts/utils/lazy-libraries.js está sendo carregado antes deste script.');
    }
    
    // Carregar Leaflet
    await window.lazyLibraries.loadLeaflet();
    
    if (!window.L) {
      throw new Error('Leaflet não foi carregado corretamente');
    }
    
    // Carregar dados
    const data = await window.dataLoader?.load('/api/zeladoria/map', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || [];
    
    markersData = data;
    
    // Inicializar mapa se ainda não foi criado
    if (!map) {
      initMap();
    }
    
    // Verificar se há dados
    if (data.length === 0) {
      window.Logger?.warn('Nenhum dado com coordenadas encontrado');
      const content = document.getElementById('zeladoria-mapa-content');
      if (content) {
        content.innerHTML = `
          <div class="glass rounded-xl p-6 text-center text-amber-400">
            <p class="text-lg mb-2">⚠️ Nenhuma demanda com coordenadas GPS encontrada</p>
            <p class="text-sm text-slate-400">Verifique se os dados possuem campos latitude e longitude válidos</p>
          </div>
        `;
      }
      return;
    }
    
    // Renderizar marcadores
    renderMarkers(data);
    
    // Atualizar estatísticas
    updateStats(data);
    
    // Configurar filtros
    setupFilters(data);
    
  } catch (error) {
    window.Logger?.error('Erro ao carregar Mapa Zeladoria:', error);
    const content = document.getElementById('zeladoria-mapa-content');
    if (content) {
      content.innerHTML = `
        <div class="glass rounded-xl p-6 text-center text-red-400">
          <p class="text-lg mb-2">❌ Erro ao carregar mapa</p>
          <p class="text-sm text-slate-400">${error.message || 'Erro desconhecido'}</p>
        </div>
      `;
    }
  }
}

/**
 * Inicializar mapa Leaflet
 */
function initMap() {
  const mapContainer = document.getElementById('zeladoria-map-container');
  if (!mapContainer) return;
  
  // Coordenadas de Duque de Caxias (centro padrão)
  const defaultCenter = [-22.7855, -43.3093];
  const defaultZoom = 12;
  
  // Criar mapa
  map = window.L.map('zeladoria-map-container', {
    center: defaultCenter,
    zoom: defaultZoom,
    zoomControl: true,
    minZoom: 10,
    maxZoom: 19,
    preferCanvas: false // Usar SVG para melhor compatibilidade
  });
  
  console.log('✅ Mapa Leaflet criado');
  
  // Adicionar camada base inicial
  updateMapTheme(currentTheme);
  
  console.log(`✅ Tema do mapa aplicado: ${currentTheme}`);
  
  // Adicionar controle de escala
  window.L.control.scale({
    metric: true,
    imperial: false,
    position: 'bottomleft'
  }).addTo(map);
  
  // Adicionar controle de coordenadas (se habilitado)
  if (mapSettings.showCoordinates) {
    addCoordinatesControl();
  }
  
  // Adicionar legenda (se habilitada)
  if (mapSettings.showLegend) {
    addLegend();
  }
  
  // Ajustar tamanho do mapa quando container for redimensionado
  setTimeout(() => {
    map.invalidateSize();
  }, 100);
  
  // Listener para redimensionamento da janela
  window.addEventListener('resize', () => {
    if (map) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  });
}

/**
 * Atualizar tema do mapa
 */
function updateMapTheme(themeKey) {
  if (!map || !mapThemes[themeKey]) return;
  
  // Remover camadas antigas (TileLayers)
  map.eachLayer(layer => {
    if (layer instanceof window.L.TileLayer) {
      map.removeLayer(layer);
    }
  });
  
  // Adicionar nova camada
  const theme = mapThemes[themeKey];
  const newLayer = window.L.tileLayer(theme.url, {
    attribution: theme.attribution,
    maxZoom: 19
  });
  newLayer.addTo(map);
  
  currentTheme = themeKey;
  
  // Adicionar atribuição no canto inferior direito
  if (map.attributionControl) {
    map.attributionControl.setPrefix('');
  }
}

/**
 * Renderizar marcadores no mapa
 */
function renderMarkers(data) {
  if (!map) return;
  
  // Remover marcadores antigos
  if (markersLayer) {
    map.removeLayer(markersLayer);
  }
  
  // Filtrar dados
  let filteredData = data;
  
  // Filtrar apenas coordenadas válidas
  filteredData = filteredData.filter(d => {
    if (!d.coordenadasValidas && d.coordenadasValidas !== undefined) {
      return false; // Coordenadas inválidas (fora dos limites de Duque de Caxias)
    }
    // Validar coordenadas se não vierem do backend
    if (d.coordenadasValidas === undefined) {
      return validateCoordinates(d.latitude, d.longitude);
    }
    return true;
  });
  
  if (currentFilters.status) {
    filteredData = filteredData.filter(d => d.status === currentFilters.status);
  }
  if (currentFilters.categoria) {
    filteredData = filteredData.filter(d => d.categoria === currentFilters.categoria);
  }
  if (currentFilters.departamento) {
    filteredData = filteredData.filter(d => d.departamento === currentFilters.departamento);
  }
  if (currentFilters.distrito) {
    filteredData = filteredData.filter(d => d.distrito === currentFilters.distrito);
  }
  
  // Criar grupo de marcadores
  const clusterOptions = {
    chunkedLoading: true,
    maxClusterRadius: mapSettings.showClusters ? 50 : 0, // Desabilitar clusters se configurado
    iconCreateFunction: function(cluster) {
      const count = cluster.getChildCount();
      let size = 'small';
      if (count > 100) size = 'large';
      else if (count > 20) size = 'medium';
      
      return new window.L.DivIcon({
        html: `<div class="cluster-marker cluster-${size}">${count}</div>`,
        className: 'marker-cluster',
        iconSize: window.L.point(40, 40)
      });
    }
  };
  
  markersLayer = window.L.markerClusterGroup(clusterOptions);
  
  // Tamanho do marcador baseado nas configurações
  const markerSizes = {
    small: { size: [24, 34], anchor: [12, 34] },
    normal: { size: [30, 42], anchor: [15, 42] },
    large: { size: [36, 50], anchor: [18, 50] }
  };
  const markerSize = markerSizes[mapSettings.markerSize] || markerSizes.normal;
  
  // Adicionar marcadores
  filteredData.forEach((demand, index) => {
    const color = statusColors[demand.status] || statusColors['Não informado'];
    
    // Criar ícone personalizado com estilos inline para garantir visibilidade
    const pinSize = markerSize.size[0];
    const pinHtml = `
      <div style="
        width: ${pinSize}px;
        height: ${pinSize}px;
        background-color: ${color};
        border: 3px solid ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        position: relative;
        box-shadow: 0 2px 8px rgba(0,0,0,0.6);
        z-index: 1000;
      ">
        <div style="
          width: ${Math.floor(pinSize * 0.5)}px;
          height: ${Math.floor(pinSize * 0.5)}px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
        "></div>
      </div>
    `;
    
    const icon = window.L.divIcon({
      className: 'custom-marker',
      html: pinHtml,
      iconSize: markerSize.size,
      iconAnchor: markerSize.anchor,
      popupAnchor: [0, -markerSize.anchor[1]]
    });
    
    const marker = window.L.marker([demand.latitude, demand.longitude], { 
      icon: icon,
      zIndexOffset: 1000 + index,
      riseOnHover: true
    });
    
    // Criar popup
    const popupContent = createPopupContent(demand);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'custom-popup',
      autoPan: true,
      closeButton: true
    });
    
    // Adicionar tooltip simples
    marker.bindTooltip(demand.protocolo, {
      permanent: false,
      direction: 'top',
      offset: [0, -10]
    });
    
    markersLayer.addLayer(marker);
  });
  
  // Log para debug
  if (window.Logger) {
    window.Logger.info(`Marcadores renderizados: ${filteredData.length} de ${data.length} total`);
  } else {
    console.log(`✅ Marcadores renderizados: ${filteredData.length} de ${data.length} total`);
  }
  
  // Adicionar ao mapa
  map.addLayer(markersLayer);
  
  // Adicionar/atualizar heatmap se habilitado
  if (mapSettings.showHeatmap) {
    // Verificar se leaflet.heat está disponível
    if (window.L && typeof window.L.heatLayer === 'function') {
      // Remover heatmap anterior
      if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
      }
      
      // Criar pontos para o heatmap (cada demanda com peso baseado em apoios + 1)
      const heatPoints = filteredData.map(d => [
        d.latitude,
        d.longitude,
        Math.min((d.apoios || 0) + 1, 10) // Peso mínimo 1, máximo 10
      ]);
      
      if (heatPoints.length > 0) {
        try {
          heatmapLayer = window.L.heatLayer(heatPoints, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {
              0.0: 'blue',
              0.2: 'cyan',
              0.4: 'lime',
              0.6: 'yellow',
              0.8: 'orange',
              1.0: 'red'
            },
            max: 10 // Intensidade máxima
          });
          
          map.addLayer(heatmapLayer);
          console.log(`✅ Heatmap adicionado com ${heatPoints.length} pontos`);
        } catch (e) {
          console.error('Erro ao criar heatmap:', e);
        }
      }
    } else {
      console.warn('⚠️ Leaflet.heat não está disponível. Carregando...');
      // Tentar carregar dinamicamente
      const heatScript = document.createElement('script');
      heatScript.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      heatScript.onload = () => {
        // Tentar novamente após carregar
        setTimeout(() => renderMarkers(markersData), 500);
      };
      document.head.appendChild(heatScript);
    }
  } else if (heatmapLayer) {
    // Remover heatmap se desabilitado
    map.removeLayer(heatmapLayer);
    heatmapLayer = null;
  }
  
  // Verificar se os marcadores foram adicionados
  const markerCount = markersLayer.getLayers().length;
  console.log(`✅ ${markerCount} marcadores adicionados ao mapa`);
  
  if (window.Logger) {
    window.Logger.info(`${markerCount} marcadores adicionados ao mapa`);
  }
  
  // Ajustar zoom para mostrar todos os marcadores
  if (filteredData.length > 0) {
    try {
      // Aguardar um pouco para os marcadores serem renderizados
      setTimeout(() => {
        try {
          const bounds = markersLayer.getBounds();
          if (bounds && bounds.isValid && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
            console.log('✅ Bounds ajustados para mostrar todos os marcadores');
          } else {
            // Fallback: usar primeiro marcador como centro
            const firstMarker = filteredData[0];
            if (firstMarker && firstMarker.latitude && firstMarker.longitude) {
              map.setView([firstMarker.latitude, firstMarker.longitude], 13);
              console.log(`✅ Mapa centralizado em: ${firstMarker.latitude}, ${firstMarker.longitude}`);
            }
          }
        } catch (e) {
          console.error('Erro ao ajustar bounds:', e);
          const firstMarker = filteredData[0];
          if (firstMarker && firstMarker.latitude && firstMarker.longitude) {
            map.setView([firstMarker.latitude, firstMarker.longitude], 13);
          }
        }
      }, 300);
    } catch (e) {
      // Se houver erro, usar coordenadas padrão
      console.error('Erro ao ajustar view do mapa:', e);
      if (window.Logger) {
        window.Logger.warn('Erro ao ajustar bounds, usando view padrão:', e);
      }
      const firstMarker = filteredData[0];
      if (firstMarker && firstMarker.latitude && firstMarker.longitude) {
        map.setView([firstMarker.latitude, firstMarker.longitude], 13);
      }
    }
  } else {
    // Se não houver dados filtrados, mostrar mensagem
    console.warn('⚠️ Nenhum marcador para exibir após filtros');
    if (window.Logger) {
      window.Logger.warn('Nenhum marcador para exibir após filtros');
    }
  }
}

/**
 * Criar conteúdo do popup
 */
function createPopupContent(demand) {
  const statusColor = statusColors[demand.status] || statusColors['Não informado'];
  const statusBadge = `<span style="background-color: ${statusColor}; color: white; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; display: inline-block; margin-bottom: 8px;">${demand.status}</span>`;
  
  // Calcular tempo decorrido se tiver data de criação
  let tempoInfo = '';
  if (demand.dataCriacao && demand.dataCriacao !== 'N/A') {
    try {
      const dataCriacao = new Date(demand.dataCriacao);
      const hoje = new Date();
      const dias = Math.floor((hoje - dataCriacao) / (1000 * 60 * 60 * 24));
      if (dias > 0) {
        tempoInfo = `<div style="margin-bottom: 4px;"><strong>⏱️ Tempo:</strong> ${dias} dia${dias > 1 ? 's' : ''}</div>`;
      }
    } catch (e) {
      // Ignorar erro de parsing
    }
  }
  
  // Badge de apoios se houver
  const apoiosBadge = demand.apoios > 0 ? 
    `<span style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-block; margin-left: 6px;">👍 ${demand.apoios}</span>` : '';
  
  return `
    <div class="popup-content" style="font-family: system-ui, -apple-system, sans-serif; min-width: 280px;">
      <div style="margin-bottom: 10px; border-bottom: 2px solid ${statusColor}; padding-bottom: 8px;">
        <div style="font-weight: 700; color: #22d3ee; margin-bottom: 6px; font-size: 14px;">
          📋 Protocolo: <span style="color: #f1f5f9;">${demand.protocolo}</span>
        </div>
        ${statusBadge}${apoiosBadge}
      </div>
      
      <div style="font-size: 12px; color: #cbd5e1; line-height: 1.6;">
        <div style="margin-bottom: 6px;">
          <strong style="color: #94a3b8;">📍 Localização:</strong><br>
          <span style="color: #f1f5f9;">${demand.bairro}</span>
        </div>
        
        <div style="margin-bottom: 6px;">
          <strong style="color: #94a3b8;">🏷️ Categoria:</strong><br>
          <span style="color: #f1f5f9;">${demand.categoria}</span>
        </div>
        
        <div style="margin-bottom: 6px;">
          <strong style="color: #94a3b8;">🏢 Departamento:</strong><br>
          <span style="color: #f1f5f9;">${demand.departamento}</span>
        </div>
        
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #334155;">
          <div style="margin-bottom: 4px;">
            <strong style="color: #94a3b8;">📅 Criado em:</strong>
            <span style="color: #f1f5f9;">${demand.dataCriacao}</span>
          </div>
          ${demand.dataConclusao ? `
            <div style="margin-bottom: 4px;">
              <strong style="color: #94a3b8;">✅ Concluído em:</strong>
              <span style="color: #10b981;">${demand.dataConclusao}</span>
            </div>
          ` : ''}
          ${tempoInfo}
        </div>
        
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #334155;">
          <div style="font-size: 11px; color: #64748b;">
            <strong>📍 Endereço:</strong><br>
            <span style="color: #94a3b8;">${demand.endereco}</span>
          </div>
          <div style="font-size: 10px; color: #475569; margin-top: 6px;">
            📍 Coord: ${demand.latitude?.toFixed(6)}, ${demand.longitude?.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Atualizar estatísticas
 */
function updateStats(data) {
  // Filtrar apenas dados válidos
  const validData = data.filter(d => {
    if (d.coordenadasValidas === false) return false;
    if (d.coordenadasValidas === undefined) {
      return validateCoordinates(d.latitude, d.longitude);
    }
    return true;
  });
  
  const total = validData.length;
  const totalInvalid = data.length - total;
  const byStatus = {};
  const byCategoria = {};
  const byDistrito = {};
  
  validData.forEach(d => {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    byCategoria[d.categoria] = (byCategoria[d.categoria] || 0) + 1;
    if (d.distrito) {
      byDistrito[d.distrito] = (byDistrito[d.distrito] || 0) + 1;
    }
  });
  
  const statsEl = document.getElementById('zeladoria-mapa-stats');
  if (!statsEl) return;
  
  const topStatus = Object.entries(byStatus).sort((a, b) => b[1] - a[1])[0];
  const topCategoria = Object.entries(byCategoria).sort((a, b) => b[1] - a[1])[0];
  const topDistrito = Object.entries(byDistrito).sort((a, b) => b[1] - a[1])[0];
  
  statsEl.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
      <div class="glass rounded-lg p-3">
        <div class="text-slate-400 text-xs mb-1">Total Válidas</div>
        <div class="text-cyan-300 font-bold text-lg">${total.toLocaleString('pt-BR')}</div>
        ${totalInvalid > 0 ? `<div class="text-red-400 text-xs mt-1">${totalInvalid} inválidas</div>` : ''}
      </div>
      <div class="glass rounded-lg p-3">
        <div class="text-slate-400 text-xs mb-1">Status Mais Comum</div>
        <div class="text-violet-300 font-bold text-sm truncate" title="${topStatus?.[0] || 'N/A'}">${topStatus?.[0] || 'N/A'}</div>
        <div class="text-slate-500 text-xs">${topStatus?.[1] || 0} ocorrências</div>
      </div>
      <div class="glass rounded-lg p-3">
        <div class="text-slate-400 text-xs mb-1">Categoria Mais Comum</div>
        <div class="text-emerald-300 font-bold text-sm truncate" title="${topCategoria?.[0] || 'N/A'}">${topCategoria?.[0] || 'N/A'}</div>
        <div class="text-slate-500 text-xs">${topCategoria?.[1] || 0} ocorrências</div>
      </div>
      <div class="glass rounded-lg p-3">
        <div class="text-slate-400 text-xs mb-1">Distrito Mais Ativo</div>
        <div class="text-amber-300 font-bold text-xs truncate" title="${topDistrito?.[0] || 'N/A'}">${topDistrito?.[0] ? topDistrito[0].replace('Distrito - ', '') : 'N/A'}</div>
        <div class="text-slate-500 text-xs">${topDistrito?.[1] || 0} ocorrências</div>
      </div>
      <div class="glass rounded-lg p-3">
        <div class="text-slate-400 text-xs mb-1">Status Únicos</div>
        <div class="text-amber-300 font-bold text-lg">${Object.keys(byStatus).length}</div>
      </div>
    </div>
  `;
}

/**
 * Adicionar controle de coordenadas
 */
function addCoordinatesControl() {
  if (!map || !window.L) return;
  
  const coordsControl = window.L.control({ position: 'bottomright' });
  coordsControl.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'coordinates-control');
    div.style.cssText = 'background: rgba(15, 23, 42, 0.9); color: #cbd5e1; padding: 6px 10px; border-radius: 4px; font-size: 11px; font-family: monospace; z-index: 1000;';
    div.innerHTML = 'Lat: 0, Lng: 0';
    
    map.on('mousemove', (e) => {
      div.innerHTML = `Lat: ${e.latlng.lat.toFixed(6)}, Lng: ${e.latlng.lng.toFixed(6)}`;
    });
    
    return div;
  };
  coordsControl.addTo(map);
}

/**
 * Adicionar legenda
 */
function addLegend() {
  if (!map || !window.L) return;
  
  const legend = window.L.control({ position: 'topright' });
  legend.onAdd = function() {
    const div = window.L.DomUtil.create('div', 'legend-control');
    div.style.cssText = 'background: rgba(15, 23, 42, 0.95); color: #cbd5e1; padding: 12px; border-radius: 8px; font-size: 12px; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000;';
    
    let html = '<div style="font-weight: 600; margin-bottom: 8px; color: #22d3ee; border-bottom: 1px solid #334155; padding-bottom: 6px;">🎨 Legenda de Status</div>';
    
    Object.entries(statusColors).forEach(([status, color]) => {
      html += `
        <div style="display: flex; align-items: center; margin-bottom: 6px;">
          <div style="width: 16px; height: 16px; background-color: ${color}; border-radius: 50%; margin-right: 8px; border: 2px solid ${color};"></div>
          <span style="color: #cbd5e1;">${status}</span>
        </div>
      `;
    });
    
    div.innerHTML = html;
    return div;
  };
  legend.addTo(map);
}

/**
 * Configurar filtros
 */
function setupFilters(data) {
  // Filtrar apenas dados com coordenadas válidas
  const validData = data.filter(d => {
    if (d.coordenadasValidas === false) return false;
    if (d.coordenadasValidas === undefined) {
      return validateCoordinates(d.latitude, d.longitude);
    }
    return true;
  });
  
  // Obter valores únicos
  const statuses = [...new Set(validData.map(d => d.status).filter(Boolean))].sort();
  const categorias = [...new Set(validData.map(d => d.categoria).filter(Boolean))].sort();
  const departamentos = [...new Set(validData.map(d => d.departamento).filter(Boolean))].sort();
  const distritos = [...new Set(validData.map(d => d.distrito).filter(Boolean))].sort();
  
  // Status filter
  const statusSelect = document.getElementById('mapa-filter-status');
  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">Todos os Status</option>' +
      statuses.map(s => `<option value="${s}">${s}</option>`).join('');
    statusSelect.value = currentFilters.status;
    statusSelect.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      renderMarkers(markersData);
      updateStats(markersData.filter(d => {
        if (currentFilters.status && d.status !== currentFilters.status) return false;
        if (currentFilters.categoria && d.categoria !== currentFilters.categoria) return false;
        if (currentFilters.departamento && d.departamento !== currentFilters.departamento) return false;
        return true;
      }));
    });
  }
  
  // Categoria filter
  const categoriaSelect = document.getElementById('mapa-filter-categoria');
  if (categoriaSelect) {
    categoriaSelect.innerHTML = '<option value="">Todas as Categorias</option>' +
      categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    categoriaSelect.value = currentFilters.categoria;
    categoriaSelect.addEventListener('change', (e) => {
      currentFilters.categoria = e.target.value;
      renderMarkers(markersData);
      updateStats(markersData.filter(d => {
        if (currentFilters.status && d.status !== currentFilters.status) return false;
        if (currentFilters.categoria && d.categoria !== currentFilters.categoria) return false;
        if (currentFilters.departamento && d.departamento !== currentFilters.departamento) return false;
        return true;
      }));
    });
  }
  
  // Departamento filter
  const departamentoSelect = document.getElementById('mapa-filter-departamento');
  if (departamentoSelect) {
    departamentoSelect.innerHTML = '<option value="">Todos os Departamentos</option>' +
      departamentos.map(d => `<option value="${d}">${d}</option>`).join('');
    departamentoSelect.value = currentFilters.departamento;
    departamentoSelect.addEventListener('change', (e) => {
      currentFilters.departamento = e.target.value;
      renderMarkers(markersData);
      updateStats(markersData.filter(d => {
        if (currentFilters.status && d.status !== currentFilters.status) return false;
        if (currentFilters.categoria && d.categoria !== currentFilters.categoria) return false;
        if (currentFilters.departamento && d.departamento !== currentFilters.departamento) return false;
        return true;
      }));
    });
  }
  
  // Distrito filter
  const distritoSelect = document.getElementById('mapa-filter-distrito');
  if (distritoSelect) {
    distritoSelect.innerHTML = '<option value="">Todos os Distritos</option>' +
      distritos.map(d => `<option value="${d}">${d}</option>`).join('');
    distritoSelect.value = currentFilters.distrito;
    distritoSelect.addEventListener('change', (e) => {
      currentFilters.distrito = e.target.value;
      renderMarkers(markersData);
      updateStats(markersData.filter(d => {
        if (currentFilters.status && d.status !== currentFilters.status) return false;
        if (currentFilters.categoria && d.categoria !== currentFilters.categoria) return false;
        if (currentFilters.departamento && d.departamento !== currentFilters.departamento) return false;
        if (currentFilters.distrito && d.distrito !== currentFilters.distrito) return false;
        return true;
      }));
    });
  }
  
  // Botão limpar filtros
  const clearBtn = document.getElementById('mapa-clear-filters');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      currentFilters = { status: '', categoria: '', departamento: '', distrito: '' };
      if (statusSelect) statusSelect.value = '';
      if (categoriaSelect) categoriaSelect.value = '';
      if (departamentoSelect) departamentoSelect.value = '';
      if (distritoSelect) distritoSelect.value = '';
      renderMarkers(markersData);
      updateStats(markersData);
    });
  }
  
  // Seletor de tema
  const themeSelect = document.getElementById('mapa-theme-select');
  if (themeSelect) {
    themeSelect.innerHTML = Object.keys(mapThemes).map(key => 
      `<option value="${key}">${mapThemes[key].name}</option>`
    ).join('');
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', (e) => {
      updateMapTheme(e.target.value);
    });
  }
  
  // Configurações adicionais
  setupMapSettings();
}

/**
 * Configurar opções adicionais do mapa
 */
function setupMapSettings() {
  if (!map) return;
  
  // Toggle clusters
  const clusterToggle = document.getElementById('mapa-toggle-clusters');
  if (clusterToggle) {
    clusterToggle.checked = mapSettings.showClusters;
    clusterToggle.addEventListener('change', (e) => {
      mapSettings.showClusters = e.target.checked;
      renderMarkers(markersData);
    });
  }
  
  // Tamanho dos marcadores
  const markerSizeSelect = document.getElementById('mapa-marker-size');
  if (markerSizeSelect) {
    markerSizeSelect.value = mapSettings.markerSize;
    markerSizeSelect.addEventListener('change', (e) => {
      mapSettings.markerSize = e.target.value;
      renderMarkers(markersData);
    });
  }
  
  // Toggle legenda
  const legendToggle = document.getElementById('mapa-toggle-legend');
  if (legendToggle) {
    legendToggle.checked = mapSettings.showLegend;
    legendToggle.addEventListener('change', (e) => {
      mapSettings.showLegend = e.target.checked;
      // Remover legenda existente
      if (map) {
        map.eachControl(control => {
          if (control.options && control.options.className === 'legend-control') {
            map.removeControl(control);
          }
        });
        if (e.target.checked) {
          addLegend();
        }
      }
    });
  }
  
  // Toggle coordenadas
  const coordsToggle = document.getElementById('mapa-toggle-coordinates');
  if (coordsToggle) {
    coordsToggle.checked = mapSettings.showCoordinates;
    coordsToggle.addEventListener('change', (e) => {
      mapSettings.showCoordinates = e.target.checked;
      // Remover controle de coordenadas existente
      if (map) {
        map.eachControl(control => {
          if (control.options && control.options.className === 'coordinates-control') {
            map.removeControl(control);
          }
        });
        if (e.target.checked) {
          addCoordinatesControl();
        }
      }
    });
  }
  
  // Toggle heatmap
  const heatmapToggle = document.getElementById('mapa-toggle-heatmap');
  if (heatmapToggle) {
    heatmapToggle.checked = mapSettings.showHeatmap;
    heatmapToggle.addEventListener('change', (e) => {
      mapSettings.showHeatmap = e.target.checked;
      renderMarkers(markersData);
    });
  }
}

/**
 * Carregar mapa do Colab (demandas do Colab)
 */
async function loadZeladoriaColabMapa() {
  const page = document.getElementById('page-zeladoria-colab-mapa');
  if (!page || page.style.display === 'none') return;
  
  try {
    // Aguardar até que lazyLibraries esteja disponível
    let attempts = 0;
    const maxAttempts = 50;
    
    while ((!window.lazyLibraries || !window.lazyLibraries.loadLeaflet) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!window.lazyLibraries || !window.lazyLibraries.loadLeaflet) {
      throw new Error('lazyLibraries não foi carregado');
    }
    
    // Carregar Leaflet
    await window.lazyLibraries.loadLeaflet();
    
    if (!window.L) {
      throw new Error('Leaflet não foi carregado corretamente');
    }
    
    // Calcular datas (últimos 30 dias)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const startDateStr = startDate.toISOString().replace('T', ' ').substring(0, 19) + '.0000';
    const endDateStr = endDate.toISOString().replace('T', ' ').substring(0, 19) + '.9999';
    
    // Carregar demandas do Colab
    const demandas = await window.dataLoader?.load(
      `/api/colab/posts?start_date=${encodeURIComponent(startDateStr)}&end_date=${encodeURIComponent(endDateStr)}`,
      { useDataStore: true, ttl: 5 * 60 * 1000 }
    ) || [];
    
    // Filtrar apenas demandas com coordenadas
    const demandasComCoordenadas = demandas.filter(d => d.lat && d.lng && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lng)));
    
    // Converter para formato esperado pelo mapa
    const data = demandasComCoordenadas.map(d => ({
      latitude: parseFloat(d.lat),
      longitude: parseFloat(d.lng),
      status: d.status,
      categoria: d.category_id ? `Categoria ${d.category_id}` : 'Sem categoria',
      endereco: d.address || '',
      bairro: d.neighborhood || '',
      id: d.id,
      descricao: d.description || ''
    }));
    
    markersData = data;
    
    // Criar mapa específico para Colab se não existir
    const mapContainer = document.getElementById('zeladoria-colab-map-container');
    if (!mapContainer) {
      throw new Error('Container do mapa Colab não encontrado');
    }
    
    let colabMap = mapContainer._mapInstance;
    let colabMarkersLayer = mapContainer._markersLayer;
    
    if (!colabMap) {
      // Inicializar mapa no container do Colab
      colabMap = window.L.map('zeladoria-colab-map-container', {
        center: [-22.7855, -43.3093],
        zoom: 12,
        maxBounds: [[CAXIAS_BOUNDS.south, CAXIAS_BOUNDS.west], [CAXIAS_BOUNDS.north, CAXIAS_BOUNDS.east]]
      });
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(colabMap);
      
      colabMarkersLayer = window.L.layerGroup().addTo(colabMap);
      
      // Armazenar referências
      mapContainer._mapInstance = colabMap;
      mapContainer._markersLayer = colabMarkersLayer;
    }
    
    if (!colabMap || !colabMarkersLayer) {
      throw new Error('Mapa do Colab não foi inicializado');
    }
    
    // Limpar marcadores anteriores
    colabMarkersLayer.clearLayers();
    
    // Verificar se há dados
    if (data.length === 0) {
      const statsEl = document.getElementById('zeladoria-colab-mapa-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div class="glass rounded-lg p-3 text-center text-amber-400">
            ⚠️ Nenhuma demanda com coordenadas GPS encontrada
          </div>
        `;
      }
      return;
    }
    
    // Adicionar marcadores
    data.forEach(item => {
      const marker = window.L.marker([item.latitude, item.longitude], {
        icon: createColabMarkerIcon(item.status)
      });
      
      marker.bindPopup(`
        <div class="custom-popup">
          <div class="font-semibold text-cyan-300 mb-2">Demanda #${item.id}</div>
          <div class="text-sm text-slate-300 mb-1"><strong>Status:</strong> ${item.status}</div>
          <div class="text-sm text-slate-300 mb-1"><strong>Endereço:</strong> ${item.endereco}</div>
          ${item.bairro ? `<div class="text-sm text-slate-300 mb-1"><strong>Bairro:</strong> ${item.bairro}</div>` : ''}
          ${item.descricao ? `<div class="text-sm text-slate-400 mt-2">${item.descricao.substring(0, 100)}${item.descricao.length > 100 ? '...' : ''}</div>` : ''}
        </div>
      `);
      
      colabMarkersLayer.addLayer(marker);
    });
    
    // Ajustar zoom para mostrar todos os marcadores
    if (data.length > 0) {
      const group = new window.L.featureGroup(colabMarkersLayer.getLayers());
      colabMap.fitBounds(group.getBounds().pad(0.1));
    }
    
    // Atualizar estatísticas
    const statsEl = document.getElementById('zeladoria-colab-mapa-stats');
    if (statsEl) {
      const statusCounts = {};
      data.forEach(d => {
        statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
      });
      
      statsEl.innerHTML = `
        <div class="glass rounded-lg p-3">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <div>
              <div class="text-xs text-slate-400">Total</div>
              <div class="text-lg font-bold text-cyan-300">${data.length}</div>
            </div>
            ${Object.entries(statusCounts).slice(0, 3).map(([status, count]) => `
              <div>
                <div class="text-xs text-slate-400">${status}</div>
                <div class="text-lg font-bold text-amber-300">${count}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // Configurar filtros
    setupColabMapFilters(data, colabMap, colabMarkersLayer);
    
  } catch (error) {
    window.Logger?.error('Erro ao carregar Mapa Colab:', error);
    const content = document.getElementById('zeladoria-colab-mapa-content');
    if (content) {
      content.innerHTML = `
        <div class="glass rounded-xl p-6 text-center text-red-400">
          <p class="text-lg mb-2">❌ Erro ao carregar mapa</p>
          <p class="text-sm text-slate-400">${error.message || 'Erro desconhecido'}</p>
        </div>
      `;
    }
  }
}

/**
 * Criar ícone de marcador para Colab baseado no status
 */
function createColabMarkerIcon(status) {
  const statusColors = {
    'NOVO': '#a78bfa',
    'ABERTO': '#3b82f6',
    'ATENDIMENTO': '#f59e0b',
    'ATENDIDO': '#10b981',
    'FECHADO': '#059669',
    'RECUSADO': '#ef4444'
  };
  
  const color = statusColors[status] || '#94a3b8';
  
  return window.L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-pin" style="border-color: ${color}; background-color: ${color};">
        <div class="marker-pin-inner"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });
}

/**
 * Configurar filtros do mapa Colab
 */
function setupColabMapFilters(data, mapInstance, markersLayer) {
  // Obter status únicos
  const statuses = [...new Set(data.map(d => d.status))].sort();
  const categorias = [...new Set(data.map(d => d.categoria))].sort();
  
  // Preencher select de status
  const statusSelect = document.getElementById('zeladoria-colab-mapa-filter-status');
  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">Todos os Status</option>' +
      statuses.map(s => `<option value="${s}">${s}</option>`).join('');
    
    statusSelect.onchange = () => applyColabMapFilters(mapInstance, markersLayer, data);
  }
  
  // Preencher select de categoria
  const categoriaSelect = document.getElementById('zeladoria-colab-mapa-filter-categoria');
  if (categoriaSelect) {
    categoriaSelect.innerHTML = '<option value="">Todas as Categorias</option>' +
      categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    
    categoriaSelect.onchange = () => applyColabMapFilters(mapInstance, markersLayer, data);
  }
  
  // Botão limpar filtros
  const clearBtn = document.getElementById('zeladoria-colab-mapa-clear-filters');
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (statusSelect) statusSelect.value = '';
      if (categoriaSelect) categoriaSelect.value = '';
      applyColabMapFilters(mapInstance, markersLayer, data);
    };
  }
}

/**
 * Aplicar filtros no mapa Colab
 */
function applyColabMapFilters(mapInstance, markersLayer, allData) {
  const status = document.getElementById('zeladoria-colab-mapa-filter-status')?.value || '';
  const categoria = document.getElementById('zeladoria-colab-mapa-filter-categoria')?.value || '';
  
  // Filtrar dados
  let filteredData = allData;
  if (status) {
    filteredData = filteredData.filter(d => d.status === status);
  }
  if (categoria) {
    filteredData = filteredData.filter(d => d.categoria === categoria);
  }
  
  // Limpar marcadores
  markersLayer.clearLayers();
  
  // Adicionar marcadores filtrados
  filteredData.forEach(item => {
    const marker = window.L.marker([item.latitude, item.longitude], {
      icon: createColabMarkerIcon(item.status)
    });
    
    marker.bindPopup(`
      <div class="custom-popup">
        <div class="font-semibold text-cyan-300 mb-2">Demanda #${item.id}</div>
        <div class="text-sm text-slate-300 mb-1"><strong>Status:</strong> ${item.status}</div>
        <div class="text-sm text-slate-300 mb-1"><strong>Endereço:</strong> ${item.endereco}</div>
        ${item.bairro ? `<div class="text-sm text-slate-300 mb-1"><strong>Bairro:</strong> ${item.bairro}</div>` : ''}
      </div>
    `);
    
    markersLayer.addLayer(marker);
  });
  
  // Ajustar zoom
  if (filteredData.length > 0) {
    const group = new window.L.featureGroup(markersLayer.getLayers());
    mapInstance.fitBounds(group.getBounds().pad(0.1));
  }
}

// Conectar ao sistema global de filtros
if (window.chartCommunication && window.chartCommunication.createPageFilterListener) {
  window.chartCommunication.createPageFilterListener('page-zeladoria-mapa', loadZeladoriaMapa, 500);
  window.chartCommunication.createPageFilterListener('page-zeladoria-colab-mapa', loadZeladoriaColabMapa, 500);
}

window.loadZeladoriaMapa = loadZeladoriaMapa;
window.loadZeladoriaColabMapa = loadZeladoriaColabMapa;

