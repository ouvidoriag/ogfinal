/**
 * Auto-Connect Pages - Sistema Automático de Conexão de Páginas
 *
 * REFATORAÇÃO: Extraído de chart-communication.js
 * MIGRAÇÃO: Migrado para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 *
 * Responsabilidade: Conectar automaticamente todas as páginas ao sistema de filtros
 */
/// <reference path="./global.d.ts" />
(function () {
    'use strict';
    // REFATORAÇÃO FASE 3: Usar APENAS window.eventBus global (único event bus)
    // event-bus.js é carregado antes deste módulo no HTML
    const win = window;
    if (!win.eventBus) {
        if (window.Logger) {
            window.Logger.error('eventBus global não encontrado. Verifique se event-bus.js está carregado antes de auto-connect.js');
        }
        throw new Error('eventBus global não encontrado. Carregue event-bus.js antes de auto-connect.js');
    }
    const eventBus = win.eventBus;
    // ============================================
    // PAGE FILTER LISTENER - Utilitário para páginas
    // ============================================
    /**
     * Criar listener genérico de filtros para uma página
     * FILTROS LOCAIS POR PÁGINA: Só atualiza se a página estiver visível
     * @param pageId - ID da página (ex: 'page-tema')
     * @param reloadFunction - Função para recarregar dados da página
     * @param debounceMs - Tempo de debounce em ms (padrão: 500)
     * @returns Função para remover listeners
     */
    function createPageFilterListener(pageId, reloadFunction, debounceMs = 500) {
        if (!window.chartCommunication) {
            if (window.Logger) {
                window.Logger.warn?.(`Sistema de comunicação não disponível. Listener para ${pageId} não será criado.`);
            }
            return () => { }; // Retornar função vazia se não houver sistema
        }
        let updateTimeout = null;
        const timeoutKey = `${pageId}UpdateTimeout`;
        const handleFilterChange = () => {
            const page = document.getElementById(pageId);
            // FILTROS LOCAIS POR PÁGINA: Só atualizar se a página estiver visível
            if (!page || page.style.display === 'none') {
                if (window.Logger) {
                    window.Logger.debug?.(`⏭️ Página ${pageId} não está visível, ignorando mudança de filtro`);
                }
                return; // Página não está visível, não precisa atualizar
            }
            // Verificar se a página está realmente visível (não apenas display !== 'none')
            const isVisible = page.offsetParent !== null ||
                page.style.display === 'block' ||
                window.getComputedStyle(page).display !== 'none';
            if (!isVisible) {
                if (window.Logger) {
                    window.Logger.debug?.(`⏭️ Página ${pageId} não está realmente visível, ignorando mudança de filtro`);
                }
                return;
            }
            // Invalidar cache do dataStore para forçar recarregamento
            if (window.dataStore) {
                window.dataStore.invalidate?.();
            }
            // Debounce para evitar múltiplas atualizações simultâneas
            clearTimeout(window[timeoutKey]);
            window[timeoutKey] = setTimeout(() => {
                if (window.Logger) {
                    window.Logger.debug?.(`🔄 Filtro mudou, recarregando ${pageId}...`);
                }
                reloadFunction(true); // forceRefresh = true
            }, debounceMs);
        };
        // Escutar eventos de filtro
        window.chartCommunication?.on?.('filter:applied', handleFilterChange);
        window.chartCommunication?.on?.('filter:removed', handleFilterChange);
        window.chartCommunication?.on?.('filter:cleared', handleFilterChange);
        window.chartCommunication?.on?.('charts:update-requested', handleFilterChange);
        if (window.Logger) {
            window.Logger.debug?.(`✅ Listener de filtro criado para ${pageId} (filtros locais por página)`);
        }
        // Retornar função para remover listeners (opcional)
        return () => {
            if (window.chartCommunication) {
                window.chartCommunication.off?.('filter:applied');
                window.chartCommunication.off?.('filter:removed');
                window.chartCommunication.off?.('filter:cleared');
                window.chartCommunication.off?.('charts:update-requested');
            }
            clearTimeout(window[timeoutKey]);
        };
    }
    // ============================================
    // AUTO-CONNECT PAGES - Sistema Automático de Conexão
    // ============================================
    /**
     * Conectar automaticamente todas as páginas ao sistema de filtros
     * FILTROS LOCAIS POR PÁGINA: Cada página só atualiza quando está visível
     * Os listeners verificam se a página está visível antes de atualizar
     */
    function autoConnectAllPages() {
        if (!window.chartCommunication) {
            return;
        }
        // Mapeamento de páginas para suas funções de carregamento
        const pageLoaders = {
            'page-main': window.loadOverview,
            'page-orgao-mes': window.loadOrgaoMes,
            'page-tipo': window.loadTipo,
            'page-status': window.loadStatusPage,
            'page-tema': window.loadTema,
            'page-assunto': window.loadAssunto,
            'page-bairro': window.loadBairro,
            'page-canal': window.loadCanal,
            'page-prioridade': window.loadPrioridade,
            'page-responsavel': window.loadResponsavel,
            'page-unidades-saude': window.loadUnidadesSaude,
            'page-reclamacoes': window.loadReclamacoes,
            'page-tempo-medio': window.loadTempoMedio,
            'page-cadastrante': window.loadCadastrante,
            'page-projecao-2026': window.loadProjecao2026,
            'page-vencimento': window.loadVencimento,
            'page-notificacoes': window.loadNotificacoes,
            'page-zeladoria-overview': window.loadZeladoriaOverview,
            'page-zeladoria-status': window.loadZeladoriaStatus,
            'page-zeladoria-categoria': window.loadZeladoriaCategoria,
            'page-zeladoria-departamento': window.loadZeladoriaDepartamento,
            'page-zeladoria-bairro': window.loadZeladoriaBairro,
            'page-zeladoria-responsavel': window.loadZeladoriaResponsavel,
            'page-zeladoria-canal': window.loadZeladoriaCanal,
            'page-zeladoria-tempo': window.loadZeladoriaTempo,
            'page-zeladoria-mensal': window.loadZeladoriaMensal,
            'page-zeladoria-geografica': window.loadZeladoriaGeografica,
            'page-zeladoria-colab-demandas': window.loadColabDemandas,
            'page-zeladoria-colab-criar': window.loadZeladoriaColabCriar,
            'page-zeladoria-colab-categorias': window.loadZeladoriaColabCategorias
        };
        // Conectar todas as páginas que têm loader
        Object.entries(pageLoaders).forEach(([pageId, loader]) => {
            if (loader && typeof loader === 'function') {
                try {
                    createPageFilterListener(pageId, loader, 500);
                    if (window.Logger) {
                        window.Logger.debug?.(`✅ Página ${pageId} conectada automaticamente ao sistema de filtros`);
                    }
                }
                catch (error) {
                    if (window.Logger) {
                        window.Logger.warn?.(`Erro ao conectar página ${pageId}:`, error);
                    }
                }
            }
        });
        if (window.Logger) {
            window.Logger.success?.(`✅ Sistema de filtros locais por página ativado - ${Object.keys(pageLoaders).length} páginas conectadas`);
        }
    }
    // Exportar para uso global
    if (typeof window !== 'undefined') {
        window.createPageFilterListener = createPageFilterListener;
        window.autoConnectAllPages = autoConnectAllPages;
    }
    // Exportar para módulos ES6 (se disponível)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createPageFilterListener, autoConnectAllPages };
    }
})();
