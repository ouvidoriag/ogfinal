/**
 * ⚙️ PÁGINA DE CONFIGURAÇÕES - Painel Administrativo
 * 
 * Permite aos administradores configurar:
 * - Cache e TTLs
 * - Notificações por email
 * - Logs do sistema
 * - Integrações (Google Sheets, Gmail, Gemini)
 * - SLA e prazos
 * - Secretarias e emails
 * - Estatísticas do sistema
 * 
 * CÉREBRO X-3
 * Data: 17/12/2025
 */

let configData = {
  cache: {},
  notifications: {},
  logs: {},
  integrations: {},
  sla: {},
  secretarias: {},
  system: {}
};

/**
 * Carregar página de configurações
 */
async function loadConfiguracoes(forceRefresh = false) {
  if (window.Logger) {
    window.Logger.debug('⚙️ loadConfiguracoes: Iniciando carregamento');
  }

  const page = document.getElementById('page-configuracoes');
  if (!page) {
    if (window.Logger) {
      window.Logger.warn('⚙️ page-configuracoes não encontrada');
    }
    return Promise.resolve();
  }

  // Garantir que a página está visível
  if (page.style.display === 'none') {
    page.style.display = 'block';
  }

  // Limpar o pageTitle para não empurrar o conteúdo
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) {
    pageTitle.innerHTML = '';
    pageTitle.style.display = 'none';
  }

  // Garantir que a página está no topo do container principal
  // Primeiro, rolar a página inteira para o topo imediatamente
  window.scrollTo({ top: 0, behavior: 'instant' });
  
  // Depois, garantir que o container #pages está no topo
  const pagesContainer = document.getElementById('pages');
  if (pagesContainer) {
    // Remover qualquer espaçamento desnecessário
    pagesContainer.style.paddingTop = '0';
    pagesContainer.style.marginTop = '0';
  }
  
  // Garantir que a seção de configurações está no topo
  page.style.marginTop = '0';
  page.style.paddingTop = '0';
  
  // Scroll suave para o topo após um pequeno delay para garantir renderização
  setTimeout(() => {
    const pagesContainerRect = pagesContainer?.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    
    // Se a página não estiver no topo visível, rolar para ela
    if (pageRect.top > 100 || pagesContainerRect?.top > 0) {
      page.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Também garantir que a janela está no topo
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 100);

  window.loadingManager?.show('Carregando configurações...');

  try {
    // Carregar configurações do backend
    const config = await window.dataLoader?.load('/api/config', {
      useDataStore: !forceRefresh,
      ttl: 60 * 1000 // 1 minuto
    }) || {};

    configData = { ...configData, ...config };

    // Renderizar apenas a primeira seção (cache) por padrão
    await renderCacheConfig();
    
    // Inicializar primeira tab como ativa
    const firstTab = document.querySelector('.config-tab');
    if (firstTab) {
      firstTab.classList.add('active');
    }

    window.loadingManager?.hide();

    if (window.Logger) {
      window.Logger.success('⚙️ Configurações carregadas');
    }
  } catch (error) {
    window.errorHandler?.handleError(error, 'loadConfiguracoes', {
      showToUser: true
    });
    window.loadingManager?.hide();
  }
}

/**
 * Renderizar configurações de Cache
 */
async function renderCacheConfig() {
  const container = document.getElementById('config-cache');
  if (!container) return;
  
  // Se já foi renderizado e está visível, não renderizar novamente
  if (container.innerHTML && container.style.display !== 'none') {
    return;
  }

  try {
    // Carregar TTLs atuais
    const cacheConfig = await window.dataLoader?.load('/api/config/cache', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || {};

    const html = `
      <div class="config-section">
        <h3 class="config-title">⚡ Configurações de Cache</h3>
        <p class="config-description">Gerencie os tempos de vida (TTL) do cache para otimizar performance</p>
        
        <div class="config-grid">
          <div class="config-item">
            <label>Dashboard Data (ms)</label>
            <input type="number" id="cache-dashboard-data" value="${cacheConfig.dashboardData || 5000}" min="1000" step="1000">
            <small>Dados principais do dashboard (padrão: 5s)</small>
          </div>
          
          <div class="config-item">
            <label>Aggregate by Month (ms)</label>
            <input type="number" id="cache-aggregate-month" value="${cacheConfig.aggregateByMonth || 600000}" min="60000" step="60000">
            <small>Agregações mensais (padrão: 10min)</small>
          </div>
          
          <div class="config-item">
            <label>Distritos (ms)</label>
            <input type="number" id="cache-distritos" value="${cacheConfig.distritos || 1800000}" min="60000" step="60000">
            <small>Dados de distritos (padrão: 30min)</small>
          </div>
          
          <div class="config-item">
            <label>Summary (ms)</label>
            <input type="number" id="cache-summary" value="${cacheConfig.summary || 5000}" min="1000" step="1000">
            <small>Resumo geral (padrão: 5s)</small>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="saveCacheConfig()">💾 Salvar Cache</button>
          <button class="btn-secondary" onclick="clearAllCache()">🗑️ Limpar Todo Cache</button>
          <button class="btn-secondary" onclick="resetCacheConfig()">🔄 Restaurar Padrões</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar cache config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar configurações de cache</p>';
  }
}

/**
 * Renderizar configurações de Notificações
 */
async function renderNotificationsConfig() {
  const container = document.getElementById('config-notifications');
  if (!container) return;

  try {
    const notifConfig = await window.dataLoader?.load('/api/config/notifications', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || {};

    const html = `
      <div class="config-section">
        <h3 class="config-title">📧 Configurações de Notificações</h3>
        <p class="config-description">Configure alertas automáticos por email para secretarias</p>
        
        <div class="config-grid">
          <div class="config-item">
            <label>Horário de Execução</label>
            <input type="time" id="notif-horario" value="${notifConfig.horario || '08:00'}" step="60">
            <small>Horário diário para envio de notificações</small>
          </div>
          
          <div class="config-item">
            <label>Alerta Preventivo (dias antes)</label>
            <input type="number" id="notif-alerta-preventivo" value="${notifConfig.alertaPreventivo || 15}" min="1" max="30">
            <small>Dias antes do vencimento para alerta preventivo</small>
          </div>
          
          <div class="config-item">
            <label>Alerta Crítico (dias após)</label>
            <input type="number" id="notif-alerta-critico" value="${notifConfig.alertaCritico || 30}" min="1" max="90">
            <small>Dias após vencimento para alerta crítico</small>
          </div>
          
          <div class="config-item">
            <label>Alerta Extrapolação (dias após)</label>
            <input type="number" id="notif-alerta-extrapolacao" value="${notifConfig.alertaExtrapolacao || 60}" min="1" max="180">
            <small>Dias após vencimento para alerta de extrapolação</small>
          </div>
          
          <div class="config-item checkbox-item">
            <label>
              <input type="checkbox" id="notif-ativo" ${notifConfig.ativo !== false ? 'checked' : ''}>
              Notificações Ativas
            </label>
            <small>Ativar/desativar sistema de notificações</small>
          </div>
          
          <div class="config-item checkbox-item">
            <label>
              <input type="checkbox" id="notif-resumo-diario" ${notifConfig.resumoDiario !== false ? 'checked' : ''}>
              Resumo Diário para Ouvidoria Geral
            </label>
            <small>Enviar resumo diário consolidado</small>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="saveNotificationsConfig()">💾 Salvar Notificações</button>
          <button class="btn-secondary" onclick="testNotification()">🧪 Testar Notificação</button>
          <button class="btn-secondary" onclick="executeNotificationsNow()">▶️ Executar Agora</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar notifications config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar configurações de notificações</p>';
  }
}

/**
 * Renderizar configurações de Logs
 */
async function renderLogsConfig() {
  const container = document.getElementById('config-logs');
  if (!container) return;

  const html = `
    <div class="config-section">
      <h3 class="config-title">📝 Configurações de Logs</h3>
      <p class="config-description">Controle os níveis de log exibidos no console do navegador</p>
      
      <div class="config-grid">
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-error" checked disabled>
            ❌ Erros (sempre ativo)
          </label>
          <small>Logs de erros críticos</small>
        </div>
        
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-warn" checked disabled>
            ⚠️ Avisos (sempre ativo)
          </label>
          <small>Logs de avisos e alertas</small>
        </div>
        
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-info" ${window.location.hostname === 'localhost' ? 'checked' : ''}>
            ℹ️ Informações
          </label>
          <small>Logs informativos gerais</small>
        </div>
        
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-debug" ${window.location.hostname === 'localhost' ? 'checked' : ''}>
            🔍 Debug
          </label>
          <small>Logs detalhados para debugging</small>
        </div>
        
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-success" ${window.location.hostname === 'localhost' ? 'checked' : ''}>
            ✅ Sucesso
          </label>
          <small>Logs de operações bem-sucedidas</small>
        </div>
        
        <div class="config-item checkbox-item">
          <label>
            <input type="checkbox" id="log-performance" ${window.location.hostname === 'localhost' ? 'checked' : ''}>
            ⚡ Performance
          </label>
          <small>Logs de medição de performance</small>
        </div>
      </div>
      
      <div class="config-actions">
        <button class="btn-primary" onclick="saveLogsConfig()">💾 Salvar Logs</button>
        <button class="btn-secondary" onclick="clearConsole()">🗑️ Limpar Console</button>
        <button class="btn-secondary" onclick="exportLogs()">📥 Exportar Logs</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Renderizar configurações de Integrações
 */
async function renderIntegrationsConfig() {
  const container = document.getElementById('config-integrations');
  if (!container) return;

  try {
    const integrations = await window.dataLoader?.load('/api/config/integrations', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || {};

    const statusGoogleSheets = integrations.googleSheets?.status || 'unknown';
    const statusGmail = integrations.gmail?.status || 'unknown';
    const statusGemini = integrations.gemini?.status || 'unknown';
    const statusMongoDB = integrations.mongodb?.status || 'unknown';

    const html = `
      <div class="config-section">
        <h3 class="config-title">🔗 Status das Integrações</h3>
        <p class="config-description">Verifique o status das integrações externas</p>
        
        <div class="config-grid">
          <div class="config-item status-item">
            <div class="status-header">
              <span class="status-icon">📊</span>
              <span class="status-name">Google Sheets</span>
              <span class="status-badge status-${statusGoogleSheets}">${getStatusLabel(statusGoogleSheets)}</span>
            </div>
            <small>${integrations.googleSheets?.message || 'Sincronização de dados'}</small>
            <button class="btn-small" onclick="testGoogleSheets()">🧪 Testar</button>
          </div>
          
          <div class="config-item status-item">
            <div class="status-header">
              <span class="status-icon">📧</span>
              <span class="status-name">Gmail API</span>
              <span class="status-badge status-${statusGmail}">${getStatusLabel(statusGmail)}</span>
            </div>
            <small>${integrations.gmail?.message || 'Envio de notificações'}</small>
            <button class="btn-small" onclick="testGmail()">🧪 Testar</button>
          </div>
          
          <div class="config-item status-item">
            <div class="status-header">
              <span class="status-icon">🤖</span>
              <span class="status-name">Gemini AI</span>
              <span class="status-badge status-${statusGemini}">${getStatusLabel(statusGemini)}</span>
            </div>
            <small>${integrations.gemini?.message || 'Chat inteligente'}</small>
            <button class="btn-small" onclick="testGemini()">🧪 Testar</button>
          </div>
          
          <div class="config-item status-item">
            <div class="status-header">
              <span class="status-icon">🗄️</span>
              <span class="status-name">MongoDB Atlas</span>
              <span class="status-badge status-${statusMongoDB}">${getStatusLabel(statusMongoDB)}</span>
            </div>
            <small>${integrations.mongodb?.message || 'Banco de dados principal'}</small>
            <button class="btn-small" onclick="testMongoDB()">🧪 Testar</button>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="refreshIntegrationsStatus()">🔄 Atualizar Status</button>
          <button class="btn-secondary" onclick="syncGoogleSheets()">📊 Sincronizar Google Sheets</button>
          <button class="btn-primary" onclick="executeDatabaseUpdate()" style="background: linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%); font-weight: 600;">🚀 Atualizar Banco de Dados</button>
        </div>
        
        <div class="mt-4 p-4 glass rounded-lg">
          <h4 class="text-lg font-semibold mb-2">📋 Pipeline de Atualização</h4>
          <p class="text-sm text-slate-400 mb-3">O pipeline completo executa:</p>
          <ol class="text-sm text-slate-300 list-decimal list-inside space-y-1">
            <li>Processa a planilha bruta do Google Drive (Python)</li>
            <li>Normaliza e ajusta todos os dados</li>
            <li>Valida e verifica integridade</li>
            <li>Atualiza o banco de dados MongoDB</li>
          </ol>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar integrations config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar status das integrações</p>';
  }
}

/**
 * Renderizar configurações de SLA
 */
async function renderSLAConfig() {
  const container = document.getElementById('config-sla');
  if (!container) return;

  try {
    const slaConfig = await window.dataLoader?.load('/api/config/sla', {
      useDataStore: true,
      ttl: 5 * 60 * 1000
    }) || {};

    const html = `
      <div class="config-section">
        <h3 class="config-title">⏱️ Configurações de SLA e Prazos</h3>
        <p class="config-description">Defina prazos padrão por tipo de manifestação</p>
        
        <div class="config-grid">
          <div class="config-item">
            <label>Prazo Padrão (dias)</label>
            <input type="number" id="sla-padrao" value="${slaConfig.padrao || 30}" min="1" max="90">
            <small>Prazo padrão para manifestações gerais</small>
          </div>
          
          <div class="config-item">
            <label>Prazo E-SIC (dias)</label>
            <input type="number" id="sla-esic" value="${slaConfig.esic || 20}" min="1" max="30">
            <small>Prazo para pedidos de informação (E-SIC)</small>
          </div>
          
          <div class="config-item">
            <label>Prazo Reclamação (dias)</label>
            <input type="number" id="sla-reclamacao" value="${slaConfig.reclamacao || 30}" min="1" max="90">
            <small>Prazo para reclamações</small>
          </div>
          
          <div class="config-item">
            <label>Prazo Denúncia (dias)</label>
            <input type="number" id="sla-denuncia" value="${slaConfig.denuncia || 30}" min="1" max="90">
            <small>Prazo para denúncias</small>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="saveSLAConfig()">💾 Salvar SLA</button>
          <button class="btn-secondary" onclick="resetSLAConfig()">🔄 Restaurar Padrões</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar SLA config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar configurações de SLA</p>';
  }
}

/**
 * Renderizar configurações de Secretarias
 */
async function renderSecretariasConfig() {
  const container = document.getElementById('config-secretarias');
  if (!container) return;

  try {
    if (window.Logger) {
      window.Logger.debug('🏛️ renderSecretariasConfig: Carregando dados...');
    }

    const response = await window.dataLoader?.load('/api/config/secretarias', {
      useDataStore: true,
      ttl: 10 * 60 * 1000
    }) || {};
    
    if (window.Logger) {
      window.Logger.debug('🏛️ renderSecretariasConfig: Resposta recebida:', {
        tipo: typeof response,
        isArray: Array.isArray(response),
        temData: !!response.data,
        temSuccess: !!response.success,
        keys: Object.keys(response)
      });
    }
    
    // Extrair array de secretarias da resposta
    let secretarias = [];
    if (Array.isArray(response)) {
      secretarias = response;
    } else if (response.data && Array.isArray(response.data)) {
      secretarias = response.data;
    } else if (response.success && Array.isArray(response.data)) {
      secretarias = response.data;
    }

    if (window.Logger) {
      window.Logger.debug(`🏛️ renderSecretariasConfig: ${secretarias.length} secretarias extraídas`);
      if (secretarias.length > 0) {
        window.Logger.debug('🏛️ renderSecretariasConfig: Primeira secretaria (amostra):', {
          _id: secretarias[0]._id,
          id: secretarias[0].id,
          nome: secretarias[0].nome,
          name: secretarias[0].name,
          email: secretarias[0].email,
          keys: Object.keys(secretarias[0])
        });
      }
    }

    let html = `
      <div class="config-section">
        <h3 class="config-title">🏛️ Configurações de Secretarias</h3>
        <p class="config-description">Gerencie emails e informações das secretarias</p>
        
        <div class="secretarias-list">
    `;

    if (Array.isArray(secretarias) && secretarias.length > 0) {
      secretarias.forEach((secretaria, index) => {
        const secretariaId = secretaria._id || secretaria.id || index;
        const nomeSecretaria = secretaria.nome || secretaria.name || 'N/A';
        const sigla = secretaria.acronym || secretaria.sigla || '';
        
      html += `
        <div class="secretaria-item" data-secretaria-id="${secretariaId}">
          <div class="secretaria-header">
            <div>
              <strong>${nomeSecretaria}</strong>
              ${sigla ? `<span class="secretaria-sigla">${sigla}</span>` : ''}
            </div>
            <span class="secretaria-badge">${secretaria.totalManifestacoes || 0} manifestações</span>
          </div>
          <div class="secretaria-body">
            <div class="config-grid">
              <div class="config-item">
                <label>📧 Email Principal</label>
                <input type="email" id="secretaria-email-${index}" value="${(secretaria.email || '').replace(/"/g, '&quot;')}" placeholder="email@duquedecaxias.rj.gov.br">
              </div>
              <div class="config-item">
                <label>📧 Email Alternativo</label>
                <input type="email" id="secretaria-email-alt-${index}" value="${(secretaria.emailAlternativo || secretaria.alternateEmail || '').replace(/"/g, '&quot;')}" placeholder="email2@duquedecaxias.rj.gov.br">
              </div>
              <div class="config-item">
                <label>📞 Telefone Principal</label>
                <input type="tel" id="secretaria-phone-${index}" value="${(secretaria.phone || '').replace(/"/g, '&quot;')}" placeholder="(21) 0000-0000">
              </div>
              <div class="config-item">
                <label>📞 Telefone Alternativo</label>
                <input type="tel" id="secretaria-phone-alt-${index}" value="${(secretaria.phoneAlt || '').replace(/"/g, '&quot;')}" placeholder="(21) 0000-0000">
              </div>
              <div class="config-item config-item-full">
                <label>📍 Endereço</label>
                <input type="text" id="secretaria-address-${index}" value="${(secretaria.address || '').replace(/"/g, '&quot;')}" placeholder="Endereço completo">
              </div>
              <div class="config-item">
                <label>🏘️ Bairro</label>
                <input type="text" id="secretaria-bairro-${index}" value="${(secretaria.bairro || '').replace(/"/g, '&quot;')}" placeholder="Nome do bairro">
              </div>
              <div class="config-item">
                <label>🗺️ Distrito</label>
                <input type="text" id="secretaria-district-${index}" value="${(secretaria.district || '').replace(/"/g, '&quot;')}" placeholder="Distrito">
              </div>
              <div class="config-item config-item-full">
                <label>📝 Observações</label>
                <textarea id="secretaria-notes-${index}" rows="2" placeholder="Observações sobre a secretaria">${(secretaria.notes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
              </div>
            </div>
            <div class="secretaria-actions">
              <button class="btn-small btn-primary" onclick="saveSecretaria(${index}, '${secretariaId}')">💾 Salvar Alterações</button>
              <button class="btn-small btn-secondary" onclick="testSecretariaEmail(${index}, '${secretariaId}')">✉️ Testar Email</button>
            </div>
          </div>
        </div>
      `;
      });
    } else {
      html += `
        <div class="text-center py-8 text-slate-400">
          <p>Nenhuma secretaria encontrada.</p>
        </div>
      `;
    }

    html += `
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="refreshSecretarias()">🔄 Atualizar Lista</button>
          <button class="btn-secondary" onclick="exportSecretarias()">📥 Exportar CSV</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar secretarias config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar secretarias</p>';
  }
}

/**
 * Renderizar configurações de Downloads
 */
async function renderDownloadsConfig() {
  const container = document.getElementById('config-downloads');
  if (!container) return;

  try {
    // Carregar opções disponíveis
    const [secretarias, statusOptions] = await Promise.all([
      window.dataLoader?.load('/api/config/secretarias', {
        useDataStore: true,
        ttl: 10 * 60 * 1000
      }).then(res => {
        let secs = [];
        if (Array.isArray(res)) secs = res;
        else if (res.data && Array.isArray(res.data)) secs = res.data;
        else if (res.success && Array.isArray(res.data)) secs = res.data;
        return secs.map(s => ({ id: s._id || s.id, nome: s.nome || s.name || 'N/A' }));
      }).catch(() => []),
      window.dataLoader?.load('/api/distinct?field=statusDemanda', {
        useDataStore: true,
        ttl: 5 * 60 * 1000
      }).then(res => {
        const data = res.data || res || [];
        return Array.isArray(data) ? data : [];
      }).catch(() => [])
    ]);

    const html = `
      <div class="config-section">
        <h3 class="config-title">📥 Download de Planilhas</h3>
        <p class="config-description">Baixe dados em formato Google Sheets ou XLS com filtros personalizados</p>
        
        <div class="config-grid" style="grid-template-columns: 1fr;">
          <!-- Formato de Download -->
          <div class="config-item">
            <label>📋 Formato de Download</label>
            <div class="flex gap-4 mt-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="download-format" value="xls" checked class="w-4 h-4">
                <span>📊 Excel (XLS)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="download-format" value="google" class="w-4 h-4">
                <span>🌐 Google Sheets</span>
              </label>
            </div>
            <small>Escolha o formato do arquivo a ser baixado</small>
          </div>

          <!-- Fonte dos Dados -->
          <div class="config-item">
            <label>🗄️ Fonte dos Dados</label>
            <select id="download-source" class="w-full p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-2">
              <option value="mongodb">📊 MongoDB Atlas (Dados Normalizados)</option>
              <option value="google-bruta">📥 Planilha Bruta (Google Drive)</option>
              <option value="google-tratada">✅ Planilha Tratada (Google Sheets)</option>
            </select>
            <small>Escolha de onde os dados serão extraídos</small>
          </div>

          <!-- Filtros -->
          <div class="config-item">
            <label>🔍 Filtros (Opcional)</label>
            <div class="mt-2 space-y-3">
              <!-- Filtro por Secretaria -->
              <div>
                <label class="text-sm text-slate-400">Secretaria</label>
                <select id="download-filter-secretaria" class="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-1">
                  <option value="">Todas as secretarias</option>
                  ${secretarias.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}
                </select>
              </div>

              <!-- Filtro por Status -->
              <div>
                <label class="text-sm text-slate-400">Status</label>
                <select id="download-filter-status" class="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-1">
                  <option value="">Todos os status</option>
                  ${statusOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>

              <!-- Filtro por Período -->
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-sm text-slate-400">Data Inicial</label>
                  <input type="date" id="download-filter-data-inicio" class="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-1">
                </div>
                <div>
                  <label class="text-sm text-slate-400">Data Final</label>
                  <input type="date" id="download-filter-data-fim" class="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-1">
                </div>
              </div>

              <!-- Filtro por Tipo de Manifestação -->
              <div>
                <label class="text-sm text-slate-400">Tipo de Manifestação</label>
                <select id="download-filter-tipo" class="w-full p-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-200 mt-1">
                  <option value="">Todos os tipos</option>
                  <option value="Reclamação">Reclamação</option>
                  <option value="Denúncia">Denúncia</option>
                  <option value="Solicitação">Solicitação</option>
                  <option value="Sugestão">Sugestão</option>
                  <option value="E-SIC">E-SIC</option>
                </select>
              </div>
            </div>
            <small>Deixe em branco para baixar todos os dados</small>
          </div>

          <!-- Opções Adicionais -->
          <div class="config-item">
            <label>⚙️ Opções Adicionais</label>
            <div class="mt-2 space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="download-include-headers" checked class="w-4 h-4">
                <span>Incluir cabeçalhos</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="download-normalize-dates" checked class="w-4 h-4">
                <span>Normalizar datas (formato ISO)</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="download-only-active" class="w-4 h-4">
                <span>Apenas registros ativos (não concluídos)</span>
              </label>
            </div>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="executeDownload()" style="background: linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%); font-weight: 600;">
            📥 Baixar Planilha
          </button>
          <button class="btn-secondary" onclick="previewDownload()">👁️ Visualizar Prévia</button>
          <button class="btn-secondary" onclick="resetDownloadFilters()">🔄 Limpar Filtros</button>
        </div>

        <!-- Área de status do download -->
        <div id="download-status" class="mt-4 p-4 glass rounded-lg hidden">
          <div class="flex items-center gap-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
            <span class="text-slate-300">Processando download...</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar downloads config:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar opções de download</p>';
  }
}

/**
 * Renderizar estatísticas do sistema
 */
async function renderSystemStats() {
  const container = document.getElementById('config-system');
  if (!container) return;

  try {
    const response = await window.dataLoader?.load('/api/config/system-stats', {
      useDataStore: true,
      ttl: 30 * 1000 // 30 segundos
    }) || {};
    
    // Extrair dados da resposta
    const stats = response.data || response || {};

    const html = `
      <div class="config-section">
        <h3 class="config-title">📊 Estatísticas do Sistema</h3>
        <p class="config-description">Informações sobre o estado atual do sistema</p>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📝</div>
            <div class="stat-value">${stats.totalManifestacoes || 0}</div>
            <div class="stat-label">Total de Manifestações</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">⏰</div>
            <div class="stat-value">${stats.manifestacoesVencidas || 0}</div>
            <div class="stat-label">Vencidas</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${stats.manifestacoesConcluidas || 0}</div>
            <div class="stat-label">Concluídas</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📧</div>
            <div class="stat-value">${stats.notificacoesEnviadas || 0}</div>
            <div class="stat-label">Notificações Enviadas (hoje)</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">💾</div>
            <div class="stat-value">${formatBytes(stats.cacheSize || 0)}</div>
            <div class="stat-label">Tamanho do Cache</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🔄</div>
            <div class="stat-value">${stats.ultimaSincronizacao ? new Date(stats.ultimaSincronizacao).toLocaleString('pt-BR') : 'N/A'}</div>
            <div class="stat-label">Última Sincronização</div>
          </div>
        </div>
        
        <div class="config-actions">
          <button class="btn-primary" onclick="refreshSystemStats()">🔄 Atualizar Estatísticas</button>
          <button class="btn-secondary" onclick="exportSystemReport()">📥 Exportar Relatório</button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    if (window.Logger) {
      window.Logger.error('Erro ao renderizar system stats:', error);
    }
    container.innerHTML = '<p class="error">Erro ao carregar estatísticas</p>';
  }
}

// ==================== FUNÇÕES DE AÇÃO ====================

/**
 * Salvar configurações de cache
 */
async function saveCacheConfig() {
  const config = {
    dashboardData: parseInt(document.getElementById('cache-dashboard-data').value),
    aggregateByMonth: parseInt(document.getElementById('cache-aggregate-month').value),
    distritos: parseInt(document.getElementById('cache-distritos').value),
    summary: parseInt(document.getElementById('cache-summary').value)
  };

  try {
    const response = await fetch('/api/config/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config)
    });

    if (response.ok) {
      showNotification('✅ Configurações de cache salvas com sucesso!', 'success');
      if (window.dataStore) {
        window.dataStore.clear(); // Limpar cache para aplicar novos TTLs
      }
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    showNotification('❌ Erro ao salvar configurações de cache', 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao salvar cache config:', error);
    }
  }
}

/**
 * Limpar todo o cache
 */
async function clearAllCache() {
  if (!confirm('Tem certeza que deseja limpar todo o cache? Isso pode afetar a performance temporariamente.')) {
    return;
  }

  try {
    const response = await fetch('/api/config/cache/clear', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      if (window.dataStore) {
        window.dataStore.clear();
      }
      showNotification('✅ Cache limpo com sucesso!', 'success');
    } else {
      throw new Error('Erro ao limpar cache');
    }
  } catch (error) {
    showNotification('❌ Erro ao limpar cache', 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao limpar cache:', error);
    }
  }
}

/**
 * Restaurar configurações padrão de cache
 */
async function resetCacheConfig() {
  if (!confirm('Restaurar configurações padrão de cache?')) {
    return;
  }

  const dashboardData = document.getElementById('cache-dashboard-data');
  const aggregateMonth = document.getElementById('cache-aggregate-month');
  const distritos = document.getElementById('cache-distritos');
  const summary = document.getElementById('cache-summary');

  if (dashboardData) dashboardData.value = 5000;
  if (aggregateMonth) aggregateMonth.value = 600000;
  if (distritos) distritos.value = 1800000;
  if (summary) summary.value = 5000;

  showNotification('ℹ️ Valores restaurados. Clique em "Salvar" para aplicar.', 'info');
}

/**
 * Salvar configurações de notificações
 */
async function saveNotificationsConfig() {
  const config = {
    horario: document.getElementById('notif-horario').value,
    alertaPreventivo: parseInt(document.getElementById('notif-alerta-preventivo').value),
    alertaCritico: parseInt(document.getElementById('notif-alerta-critico').value),
    alertaExtrapolacao: parseInt(document.getElementById('notif-alerta-extrapolacao').value),
    ativo: document.getElementById('notif-ativo').checked,
    resumoDiario: document.getElementById('notif-resumo-diario').checked
  };

  try {
    const response = await fetch('/api/config/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config)
    });

    if (response.ok) {
      showNotification('✅ Configurações de notificações salvas!', 'success');
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    showNotification('❌ Erro ao salvar configurações de notificações', 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao salvar notifications config:', error);
    }
  }
}

/**
 * Testar notificação
 */
async function testNotification() {
  try {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      credentials: 'include'
    });

    if (response.ok) {
      showNotification('✅ Notificação de teste enviada!', 'success');
    } else {
      throw new Error('Erro ao enviar notificação de teste');
    }
  } catch (error) {
    showNotification('❌ Erro ao enviar notificação de teste', 'error');
  }
}

/**
 * Executar notificações agora
 */
async function executeNotificationsNow() {
  if (!confirm('Executar todas as notificações pendentes agora?')) {
    return;
  }

  try {
    const response = await fetch('/api/notifications/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tipo: 'todas' })
    });

    if (response.ok) {
      showNotification('✅ Notificações executadas!', 'success');
    } else {
      throw new Error('Erro ao executar notificações');
    }
  } catch (error) {
    showNotification('❌ Erro ao executar notificações', 'error');
  }
}

/**
 * Salvar configurações de logs
 */
async function saveLogsConfig() {
  const config = {
    info: document.getElementById('log-info').checked,
    debug: document.getElementById('log-debug').checked,
    success: document.getElementById('log-success').checked,
    performance: document.getElementById('log-performance').checked
  };

  // Aplicar configurações no logger
  if (window.Logger && window.LOG_CONFIG) {
    window.LOG_CONFIG.levels.info = config.info;
    window.LOG_CONFIG.levels.debug = config.debug;
    window.LOG_CONFIG.levels.log = config.success;
    // Performance não tem nível separado, é sempre baseado em environment
  }

  showNotification('✅ Configurações de logs aplicadas!', 'success');
}

/**
 * Limpar console
 */
function clearConsole() {
  if (console.clear) {
    console.clear();
    showNotification('✅ Console limpo!', 'success');
  }
}

/**
 * Exportar logs
 */
function exportLogs() {
  showNotification('ℹ️ Funcionalidade em desenvolvimento', 'info');
}

/**
 * Salvar configurações de SLA
 */
async function saveSLAConfig() {
  const config = {
    padrao: parseInt(document.getElementById('sla-padrao').value),
    esic: parseInt(document.getElementById('sla-esic').value),
    reclamacao: parseInt(document.getElementById('sla-reclamacao').value),
    denuncia: parseInt(document.getElementById('sla-denuncia').value)
  };

  try {
    const response = await fetch('/api/config/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(config)
    });

    if (response.ok) {
      showNotification('✅ Configurações de SLA salvas!', 'success');
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    showNotification('❌ Erro ao salvar configurações de SLA', 'error');
  }
}

/**
 * Funções auxiliares
 */
function getStatusLabel(status) {
  const labels = {
    'connected': 'Conectado',
    'disconnected': 'Desconectado',
    'error': 'Erro',
    'unknown': 'Desconhecido'
  };
  return labels[status] || 'Desconhecido';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
  if (window.errorHandler && window.errorHandler.showNotification) {
    window.errorHandler.showNotification(message, type);
  } else {
    alert(message);
  }
}

/**
 * Função para alternar entre tabs
 */
function showConfigTab(tabName) {
  // Esconder todos os conteúdos
  document.querySelectorAll('.config-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // Remover active de todas as tabs
  document.querySelectorAll('.config-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Mostrar conteúdo selecionado
  const content = document.getElementById(`config-${tabName}`);
  if (content) {
    content.style.display = 'block';
  }
  
  // Ativar tab selecionada usando data-attribute ou texto
  const tabMap = {
    'cache': '⚡',
    'notifications': '📧',
    'logs': '📝',
    'sla': '⏱️',
    'integrations': '🔗',
    'secretarias': '🏛️',
    'downloads': '📥',
    'system': '📊'
  };
  
  const icon = tabMap[tabName];
  if (icon) {
    const tabs = document.querySelectorAll('.config-tab');
    tabs.forEach(tab => {
      if (tab.textContent.includes(icon)) {
        tab.classList.add('active');
      }
    });
  }
  
  // Carregar dados da seção se necessário
  const renderMap = {
    'cache': renderCacheConfig,
    'notifications': renderNotificationsConfig,
    'logs': renderLogsConfig,
    'sla': renderSLAConfig,
    'integrations': renderIntegrationsConfig,
    'secretarias': renderSecretariasConfig,
    'downloads': renderDownloadsConfig,
    'system': renderSystemStats
  };
  
  const renderFn = renderMap[tabName];
  if (renderFn && typeof renderFn === 'function') {
    renderFn();
  }
}

// Funções auxiliares adicionais
/**
 * Salvar informações de uma secretaria
 */
/**
 * Salvar informações de uma secretaria
 */
async function saveSecretaria(index, id) {
  const email = document.getElementById(`secretaria-email-${index}`)?.value?.trim() || '';
  const emailAlt = document.getElementById(`secretaria-email-alt-${index}`)?.value?.trim() || '';
  const phone = document.getElementById(`secretaria-phone-${index}`)?.value?.trim() || '';
  const phoneAlt = document.getElementById(`secretaria-phone-alt-${index}`)?.value?.trim() || '';
  const address = document.getElementById(`secretaria-address-${index}`)?.value?.trim() || '';
  const bairro = document.getElementById(`secretaria-bairro-${index}`)?.value?.trim() || '';
  const district = document.getElementById(`secretaria-district-${index}`)?.value?.trim() || '';
  const notes = document.getElementById(`secretaria-notes-${index}`)?.value?.trim() || '';

  // Validação básica de email
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showNotification('❌ Email principal inválido', 'error');
    return;
  }

  if (emailAlt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAlt)) {
    showNotification('❌ Email alternativo inválido', 'error');
    return;
  }

  try {
    window.loadingManager?.show('Salvando informações da secretaria...');
    
    const response = await fetch(`/api/config/secretarias/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        email, 
        emailAlternativo: emailAlt,
        phone,
        phoneAlt,
        address,
        bairro,
        district,
        notes
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showNotification('✅ Informações da secretaria atualizadas com sucesso!', 'success');
      // Recarregar lista após salvar
      setTimeout(() => {
        renderSecretariasConfig();
      }, 500);
    } else {
      throw new Error(result.message || 'Erro ao atualizar secretaria');
    }
  } catch (error) {
    showNotification(`❌ Erro ao atualizar secretaria: ${error.message}`, 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao salvar secretaria:', error);
    }
  } finally {
    window.loadingManager?.hide();
  }
}

/**
 * Testar envio de email para uma secretaria
 */
async function testSecretariaEmail(index, id) {
  const email = document.getElementById(`secretaria-email-${index}`)?.value?.trim();
  
  if (!email) {
    showNotification('❌ Configure um email principal antes de testar', 'error');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showNotification('❌ Email inválido', 'error');
    return;
  }

  try {
    window.loadingManager?.show('Enviando email de teste...');
    
    const response = await fetch(`/api/config/secretarias/${id}/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showNotification('✅ Email de teste enviado com sucesso!', 'success');
    } else {
      throw new Error(result.message || 'Erro ao enviar email de teste');
    }
  } catch (error) {
    showNotification(`❌ Erro ao enviar email de teste: ${error.message}`, 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao testar email:', error);
    }
  } finally {
    window.loadingManager?.hide();
  }
}

async function refreshSecretarias() {
  await renderSecretariasConfig();
  showNotification('✅ Lista de secretarias atualizada!', 'success');
}

/**
 * Exportar lista de secretarias para CSV
 */
function exportSecretarias() {
  try {
    const container = document.getElementById('config-secretarias');
    if (!container) {
      showNotification('❌ Erro ao exportar: dados não encontrados', 'error');
      return;
    }

    // Buscar dados do dataStore ou fazer nova requisição
    window.dataLoader?.load('/api/config/secretarias', {
      useDataStore: true,
      ttl: 0 // Sem cache
    }).then(response => {
      let secretarias = [];
      if (Array.isArray(response)) {
        secretarias = response;
      } else if (response.data && Array.isArray(response.data)) {
        secretarias = response.data;
      } else if (response.success && Array.isArray(response.data)) {
        secretarias = response.data;
      }

      if (secretarias.length === 0) {
        showNotification('❌ Nenhuma secretaria encontrada para exportar', 'error');
        return;
      }

      // Criar CSV
      const headers = ['Nome', 'Sigla', 'Email Principal', 'Email Alternativo', 'Telefone', 'Telefone Alt', 'Endereço', 'Bairro', 'Distrito', 'Total Manifestações', 'Observações'];
      const rows = secretarias.map(s => [
        s.nome || s.name || '',
        s.acronym || '',
        s.email || '',
        s.emailAlternativo || s.alternateEmail || '',
        s.phone || '',
        s.phoneAlt || '',
        s.address || '',
        s.bairro || '',
        s.district || '',
        s.totalManifestacoes || 0,
        (s.notes || '').replace(/"/g, '""') // Escapar aspas no CSV
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Criar blob e download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `secretarias_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('✅ Lista de secretarias exportada com sucesso!', 'success');
    }).catch(error => {
      showNotification('❌ Erro ao exportar secretarias', 'error');
      if (window.Logger) {
        window.Logger.error('Erro ao exportar:', error);
      }
    });
  } catch (error) {
    showNotification('❌ Erro ao exportar secretarias', 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao exportar:', error);
    }
  }
}

async function refreshSystemStats() {
  await renderSystemStats();
  showNotification('✅ Estatísticas atualizadas!', 'success');
}

function exportSystemReport() {
  showNotification('ℹ️ Funcionalidade em desenvolvimento', 'info');
}

async function testGoogleSheets() {
  try {
    window.loadingManager?.show('Testando Google Sheets...');
    const response = await fetch('/api/config/integrations', {
      credentials: 'include'
    });
    const result = await response.json();
    const status = result.data?.googleSheets?.status || 'unknown';
    
    if (status === 'connected') {
      showNotification('✅ Google Sheets conectado e funcionando!', 'success');
    } else {
      showNotification('⚠️ Google Sheets não está conectado. Verifique as credenciais.', 'warning');
    }
  } catch (error) {
    showNotification('❌ Erro ao testar Google Sheets: ' + error.message, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

async function testGmail() {
  try {
    window.loadingManager?.show('Testando Gmail API...');
    const response = await fetch('/api/config/integrations', {
      credentials: 'include'
    });
    const result = await response.json();
    const status = result.data?.gmail?.status || 'unknown';
    
    if (status === 'connected') {
      showNotification('✅ Gmail API conectada e funcionando!', 'success');
    } else {
      showNotification('⚠️ Gmail API não está conectada. Verifique as credenciais.', 'warning');
    }
  } catch (error) {
    showNotification('❌ Erro ao testar Gmail API: ' + error.message, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

async function testGemini() {
  try {
    window.loadingManager?.show('Testando Gemini AI...');
    const response = await fetch('/api/config/integrations', {
      credentials: 'include'
    });
    const result = await response.json();
    const status = result.data?.gemini?.status || 'unknown';
    
    if (status === 'connected') {
      showNotification('✅ Gemini AI conectado e funcionando!', 'success');
    } else {
      showNotification('⚠️ Gemini AI não está conectado. Verifique a API key.', 'warning');
    }
  } catch (error) {
    showNotification('❌ Erro ao testar Gemini AI: ' + error.message, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

async function testMongoDB() {
  try {
    window.loadingManager?.show('Testando MongoDB Atlas...');
    const response = await fetch('/api/config/integrations', {
      credentials: 'include'
    });
    const result = await response.json();
    const status = result.data?.mongodb?.status || 'unknown';
    
    if (status === 'connected') {
      showNotification('✅ MongoDB Atlas conectado e funcionando!', 'success');
    } else {
      showNotification('❌ MongoDB Atlas não está conectado. Verifique a conexão.', 'error');
    }
  } catch (error) {
    showNotification('❌ Erro ao testar MongoDB: ' + error.message, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

async function refreshIntegrationsStatus() {
  await renderIntegrationsConfig();
  showNotification('✅ Status das integrações atualizado!', 'success');
}

async function syncGoogleSheets() {
  if (!confirm('Sincronizar dados do Google Sheets agora?\n\nIsso irá atualizar o banco de dados com os dados mais recentes da planilha.')) {
    return;
  }

  try {
    window.loadingManager?.show('Sincronizando Google Sheets...');
    
    const response = await fetch('/api/data-sync/execute', {
      method: 'POST',
      credentials: 'include'
    });

    const result = await response.json();

    if (result.success) {
      showNotification('✅ Sincronização concluída com sucesso!', 'success');
      // Atualizar estatísticas
      if (window.refreshSystemStats) {
        await window.refreshSystemStats();
      }
    } else {
      throw new Error(result.error || 'Erro desconhecido');
    }
  } catch (error) {
    showNotification('❌ Erro ao sincronizar: ' + error.message, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

/**
 * Executar pipeline completo de atualização do banco de dados
 */
async function executeDatabaseUpdate() {
  if (!confirm('🚀 Executar pipeline completo de atualização do banco de dados?\n\nIsso irá:\n1. Processar a planilha bruta (Python)\n2. Normalizar dados\n3. Atualizar banco de dados MongoDB\n\nEste processo pode levar alguns minutos. Continuar?')) {
    return;
  }

  const button = event?.target || document.querySelector('[onclick*="executeDatabaseUpdate"]');
  const originalText = button?.textContent;
  
  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Executando pipeline...';
  }

  // AbortController com timeout de 6 minutos (360000ms)
  // Backend tem timeout de 5 minutos, então damos 1 minuto extra
  const TIMEOUT_MS = 6 * 60 * 1000;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, TIMEOUT_MS);

  try {
    window.loadingManager?.show('Executando pipeline completo... Aguarde, este processo pode levar alguns minutos...');
    
    const response = await fetch('/api/config/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    // Verificar se a resposta é válida
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `Erro HTTP ${response.status}` };
      }
      throw new Error(errorData.message || errorData.error || `Erro HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const stats = result.data?.stats || {};
      const message = `✅ Pipeline executado com sucesso!\n\n` +
        `📊 Estatísticas:\n` +
        `   - Processados: ${stats.registrosProcessados || 0}\n` +
        `   - Atualizados: ${stats.registrosAtualizados || 0}\n` +
        `   - Inseridos: ${stats.registrosInseridos || 0}\n` +
        `   - Sem mudanças: ${stats.registrosSemMudancas || 0}\n` +
        `   - Total no banco: ${stats.totalNoBanco || 0}`;
      
      showNotification(message, 'success');
      
      // Atualizar estatísticas do sistema
      if (window.refreshSystemStats) {
        await window.refreshSystemStats();
      }
    } else {
      throw new Error(result.message || result.error || 'Erro desconhecido');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Tratar diferentes tipos de erro
    let errorMessage = 'Erro ao executar pipeline';
    
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
      errorMessage = '⏱️ Timeout: O pipeline demorou mais de 6 minutos. O processo pode estar executando em segundo plano. Verifique os logs do servidor.';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('ERR_EMPTY_RESPONSE')) {
      errorMessage = '⚠️ Conexão perdida: O pipeline pode estar executando em segundo plano. Aguarde alguns minutos e verifique os logs do servidor. O processo não foi interrompido.';
    } else {
      errorMessage = `❌ ${error.message || 'Erro desconhecido'}`;
    }
    
    showNotification(errorMessage, 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao executar pipeline:', error);
    }
  } finally {
    if (button) {
      button.disabled = false;
      if (originalText) button.textContent = originalText;
    }
    window.loadingManager?.hide();
  }
}

async function resetSLAConfig() {
  if (!confirm('Restaurar configurações padrão de SLA?')) {
    return;
  }

  const padrao = document.getElementById('sla-padrao');
  const esic = document.getElementById('sla-esic');
  const reclamacao = document.getElementById('sla-reclamacao');
  const denuncia = document.getElementById('sla-denuncia');

  if (padrao) padrao.value = 30;
  if (esic) esic.value = 20;
  if (reclamacao) reclamacao.value = 30;
  if (denuncia) denuncia.value = 30;

  showNotification('ℹ️ Valores restaurados. Clique em "Salvar" para aplicar.', 'info');
}

/**
 * Executar download de planilha
 */
async function executeDownload() {
  try {
    // Coletar opções do formulário
    const format = document.querySelector('input[name="download-format"]:checked')?.value || 'xls';
    const source = document.getElementById('download-source')?.value || 'mongodb';
    const secretaria = document.getElementById('download-filter-secretaria')?.value || '';
    const status = document.getElementById('download-filter-status')?.value || '';
    const dataInicio = document.getElementById('download-filter-data-inicio')?.value || '';
    const dataFim = document.getElementById('download-filter-data-fim')?.value || '';
    const tipo = document.getElementById('download-filter-tipo')?.value || '';
    const includeHeaders = document.getElementById('download-include-headers')?.checked !== false;
    const normalizeDates = document.getElementById('download-normalize-dates')?.checked !== false;
    const onlyActive = document.getElementById('download-only-active')?.checked || false;

    // Montar filtros
    const filters = {};
    if (secretaria) filters.secretaria = secretaria;
    if (status) filters.statusDemanda = status;
    if (dataInicio) filters.dataInicio = dataInicio;
    if (dataFim) filters.dataFim = dataFim;
    if (tipo) filters.tipoDeManifestacao = tipo;
    if (onlyActive) filters.onlyActive = true;

    // Mostrar status
    const statusDiv = document.getElementById('download-status');
    if (statusDiv) {
      statusDiv.classList.remove('hidden');
    }

    window.loadingManager?.show('Preparando download...');

    // Fazer requisição para o backend
    const response = await fetch('/api/config/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        format,
        source,
        filters,
        options: {
          includeHeaders,
          normalizeDates
        }
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(error.message || `Erro HTTP ${response.status}`);
    }

    // Se for Google Sheets, retornará URL
    if (format === 'google') {
      const result = await response.json();
      if (result.success && result.url) {
        window.open(result.url, '_blank');
        showNotification('✅ Planilha Google Sheets criada com sucesso!', 'success');
      } else {
        throw new Error(result.message || 'Erro ao criar planilha Google Sheets');
      }
    } else {
      // Se for XLS, fazer download do blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Nome do arquivo baseado na data e filtros
      const dateStr = new Date().toISOString().split('T')[0];
      const filterStr = secretaria ? `_${secretaria}` : '';
      link.download = `manifestacoes_${dateStr}${filterStr}.xls`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showNotification('✅ Planilha XLS baixada com sucesso!', 'success');
    }
  } catch (error) {
    showNotification(`❌ Erro ao baixar planilha: ${error.message}`, 'error');
    if (window.Logger) {
      window.Logger.error('Erro ao executar download:', error);
    }
  } finally {
    window.loadingManager?.hide();
    const statusDiv = document.getElementById('download-status');
    if (statusDiv) {
      statusDiv.classList.add('hidden');
    }
  }
}

/**
 * Visualizar prévia dos dados antes de baixar
 */
async function previewDownload() {
  try {
    const source = document.getElementById('download-source')?.value || 'mongodb';
    const secretaria = document.getElementById('download-filter-secretaria')?.value || '';
    const status = document.getElementById('download-filter-status')?.value || '';
    const dataInicio = document.getElementById('download-filter-data-inicio')?.value || '';
    const dataFim = document.getElementById('download-filter-data-fim')?.value || '';
    const tipo = document.getElementById('download-filter-tipo')?.value || '';
    const onlyActive = document.getElementById('download-only-active')?.checked || false;

    const filters = {};
    if (secretaria) filters.secretaria = secretaria;
    if (status) filters.statusDemanda = status;
    if (dataInicio) filters.dataInicio = dataInicio;
    if (dataFim) filters.dataFim = dataFim;
    if (tipo) filters.tipoDeManifestacao = tipo;
    if (onlyActive) filters.onlyActive = true;

    window.loadingManager?.show('Carregando prévia...');

    const response = await fetch('/api/config/download/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        source,
        filters,
        limit: 10 // Apenas 10 registros para prévia
      })
    });

    const result = await response.json();

    if (result.success) {
      const preview = `
📊 Prévia dos Dados

Total de registros que serão baixados: ${result.total || 0}
Registros na prévia: ${result.preview?.length || 0}

${result.preview?.length > 0 ? 'Primeiros registros:\n' + JSON.stringify(result.preview.slice(0, 3), null, 2) : 'Nenhum registro encontrado com os filtros selecionados.'}
      `;
      alert(preview);
    } else {
      throw new Error(result.message || 'Erro ao gerar prévia');
    }
  } catch (error) {
    showNotification(`❌ Erro ao visualizar prévia: ${error.message}`, 'error');
  } finally {
    window.loadingManager?.hide();
  }
}

/**
 * Limpar todos os filtros de download
 */
function resetDownloadFilters() {
  document.getElementById('download-filter-secretaria').value = '';
  document.getElementById('download-filter-status').value = '';
  document.getElementById('download-filter-data-inicio').value = '';
  document.getElementById('download-filter-data-fim').value = '';
  document.getElementById('download-filter-tipo').value = '';
  document.getElementById('download-only-active').checked = false;
  showNotification('✅ Filtros limpos!', 'success');
}

// Exportar todas as funções para uso global
window.loadConfiguracoes = loadConfiguracoes;
window.showConfigTab = showConfigTab;
window.saveCacheConfig = saveCacheConfig;
window.clearAllCache = clearAllCache;
window.resetCacheConfig = resetCacheConfig;
window.saveNotificationsConfig = saveNotificationsConfig;
window.testNotification = testNotification;
window.executeNotificationsNow = executeNotificationsNow;
window.saveLogsConfig = saveLogsConfig;
window.clearConsole = clearConsole;
window.exportLogs = exportLogs;
window.saveSLAConfig = saveSLAConfig;
window.resetSLAConfig = resetSLAConfig;
window.saveSecretaria = saveSecretaria;
window.testSecretariaEmail = testSecretariaEmail;
window.refreshSecretarias = refreshSecretarias;
window.exportSecretarias = exportSecretarias;
window.refreshSystemStats = refreshSystemStats;
window.exportSystemReport = exportSystemReport;
window.testGoogleSheets = testGoogleSheets;
window.testGmail = testGmail;
window.testGemini = testGemini;
window.testMongoDB = testMongoDB;
window.refreshIntegrationsStatus = refreshIntegrationsStatus;
window.syncGoogleSheets = syncGoogleSheets;
window.executeDatabaseUpdate = executeDatabaseUpdate;
window.renderDownloadsConfig = renderDownloadsConfig;
window.executeDownload = executeDownload;
window.previewDownload = previewDownload;
window.resetDownloadFilters = resetDownloadFilters;

