/**
 * Lazy Loading de Bibliotecas Pesadas
 * Carrega Chart.js e Plotly.js apenas quando necessário
 * Reduz ~800KB-1.2MB do carregamento inicial
 */

async function loadChartJS() {
  if (window.Chart) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    if (window._chartJSLoading) {
      window._chartJSLoading.then(resolve).catch(reject);
      return;
    }
    
    const loadingPromise = new Promise((res, rej) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
      script.async = true;
      script.onload = () => {
        const pluginScript = document.createElement('script');
        pluginScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2/dist/chartjs-plugin-datalabels.min.js';
        pluginScript.async = true;
        pluginScript.onload = () => {
          window._chartJSLoading = null;
          res();
        };
        pluginScript.onerror = () => {
          window._chartJSLoading = null;
          if (window.Logger) {
            window.Logger.warn('Erro ao carregar chartjs-plugin-datalabels, continuando sem ele');
          }
          res();
        };
        document.head.appendChild(pluginScript);
      };
      script.onerror = () => {
        window._chartJSLoading = null;
        rej(new Error('Erro ao carregar Chart.js'));
      };
      document.head.appendChild(script);
    });
    
    window._chartJSLoading = loadingPromise;
    loadingPromise.then(resolve).catch(reject);
  });
}

async function loadPlotly() {
  if (window.Plotly) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    if (window._plotlyLoading) {
      window._plotlyLoading.then(resolve).catch(reject);
      return;
    }
    
    const loadingPromise = new Promise((res, rej) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
      script.async = true;
      script.onload = () => {
        window._plotlyLoading = null;
        res();
      };
      script.onerror = () => {
        window._plotlyLoading = null;
        rej(new Error('Erro ao carregar Plotly.js'));
      };
      document.head.appendChild(script);
    });
    
    window._plotlyLoading = loadingPromise;
    loadingPromise.then(resolve).catch(reject);
  });
}

async function loadLeaflet() {
  if (window.L) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    if (window._leafletLoading) {
      window._leafletLoading.then(resolve).catch(reject);
      return;
    }
    
    const loadingPromise = new Promise((res, rej) => {
      // CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      
      // JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => {
        // Carregar plugin de clusters
        const clusterScript = document.createElement('script');
        clusterScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
        clusterScript.async = true;
        clusterScript.onload = () => {
          const clusterCSS = document.createElement('link');
          clusterCSS.rel = 'stylesheet';
          clusterCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
          document.head.appendChild(clusterCSS);
          
          const clusterDefaultCSS = document.createElement('link');
          clusterDefaultCSS.rel = 'stylesheet';
          clusterDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
          document.head.appendChild(clusterDefaultCSS);
          
          // Carregar plugin de heatmap
          const heatScript = document.createElement('script');
          heatScript.src = 'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
          heatScript.async = true;
          heatScript.onload = () => {
            window._leafletLoading = null;
            res();
          };
          heatScript.onerror = () => {
            window._leafletLoading = null;
            if (window.Logger) {
              window.Logger.warn('Erro ao carregar leaflet.heat, continuando sem ele');
            }
            // Continuar mesmo sem heatmap
            res();
          };
          document.head.appendChild(heatScript);
        };
        clusterScript.onerror = () => {
          window._leafletLoading = null;
          if (window.Logger) {
            window.Logger.warn('Erro ao carregar leaflet.markercluster, continuando sem ele');
          }
          res();
        };
        document.head.appendChild(clusterScript);
      };
      script.onerror = () => {
        window._leafletLoading = null;
        rej(new Error('Erro ao carregar Leaflet'));
      };
      document.head.appendChild(script);
    });
    
    window._leafletLoading = loadingPromise;
    loadingPromise.then(resolve).catch(reject);
  });
}

async function loadChartLibraries() {
  return Promise.all([loadChartJS()]);
}

if (typeof window !== 'undefined') {
  if (!window.lazyLibraries) window.lazyLibraries = {};
  
  window.lazyLibraries.loadChartJS = loadChartJS;
  window.lazyLibraries.loadPlotly = loadPlotly;
  window.lazyLibraries.loadLeaflet = loadLeaflet;
  window.lazyLibraries.loadChartLibraries = loadChartLibraries;
}

