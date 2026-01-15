/**
 * Global Type Declarations
 * 
 * MIGRAÇÃO: Declarações de tipos globais para TypeScript
 * Data: 03/12/2025
 * CÉREBRO X-3
 */

// Este arquivo contém todas as declarações de tipos globais
// Usado por todos os arquivos TypeScript do projeto

// Global Window Augmentations
declare global {
  // Re-declarar tipos dentro do bloco global para garantir reconhecimento
  type EventCallback = (data?: any) => void;
  type UnsubscribeFunction = () => void;
  type PageLoaderFunction = (forceRefresh?: boolean) => void | Promise<void>;
  
  interface EventBus {
    listeners: Map<string, EventCallback[]>;
    on(event: string, callback: EventCallback): UnsubscribeFunction;
    emit(event: string, data?: any): void;
    off(event: string): void;
    clear(): void;
    listenerCount(event: string): number;
    getEvents(): string[];
  }
  
  interface FieldMapping {
    field: string | null;
    op: string | null;
  }
  
  interface ChartConfig {
    type?: string;
    field?: string | null;
    operator?: string | null;
    horizontal?: boolean;
    [key: string]: any;
  }
  
  interface ChartRegistryEntry extends ChartConfig {
    id: string;
    createdAt: number;
  }
  
  interface ChartRegistry {
    charts: Map<string, ChartRegistryEntry>;
    register(chartId: string, config: ChartConfig): void;
    unregister(chartId: string): void;
    get(chartId: string): ChartRegistryEntry | null;
    getAll(): ChartRegistryEntry[];
    getByField(field: string): ChartRegistryEntry[];
    getFieldMapping(chartId: string): FieldMapping | null;
    getFieldMappings(): Record<string, FieldMapping>;
  }
  
  interface Feedback {
    show(chartId: string, label: string, value: number): void;
  }
  
  interface Filter {
    field: string;
    value: string;
    operator?: string;
    chartId?: string | null;
  }
  
  interface FilterOptions {
    toggle?: boolean;
    operator?: string;
    clearPrevious?: boolean;
    debounce?: number;
  }
  
  interface GlobalFilters {
    filters: Filter[];
    activeField: string | null;   
    activeValue: string | null;
    persist: boolean;
    _debounceTimer: any;
    _pendingFilter: { field: string; value: string; chartId: string | null; options: FilterOptions } | null;
    apply(field: string, value: string, chartId?: string | null, options?: FilterOptions): void;
    _applyImmediate(field: string, value: string, chartId?: string | null, options?: FilterOptions): void;
    clear(): void;
    remove(field: string, value: string): void;
    isActive(field: string, value: string): boolean;
    save(): void;
    load(restoreFilters?: boolean): void;
    invalidateData(): void;
    updateUI(): void;
    updateFilterIndicator(): void;
    getFieldEmoji(field: string): string;
    getFieldLabel(field: string): string;
    updatePageTitle(): void;
    updateHighlights(): void;
    notifyAllCharts(): void;
    getCurrentVisiblePage(): string | null;
  }
  
  interface LoadOptions {
    fallback?: any;
    timeout?: number | null;
    retries?: number;
    useDataStore?: boolean;
    priority?: 'high' | 'normal' | 'low';
    ttl?: number;
    deepCopy?: boolean;
  }
  
  interface LoadManyResult {
    endpoint: string;
    data: any;
    error: Error | null;
  }
  
  interface QueueStats {
    active: number;
    queued: number;
    maxConcurrent: number;
  }
  
  interface DataStoreStats {
    dashboardDataAge: number | null;
    cacheSize: number;
    listenersCount: number;
    keys: string[];
  }
  
  interface ChartInstance {
    canvas: HTMLCanvasElement;
    data: {
      labels: string[];
      datasets: ChartDataset[];
    };
    update: (mode?: string) => void;
    destroy: () => void;
    getElementsAtEventForMode: (evt: Event, mode: string, options: any, useFinalPosition: boolean) => ChartPoint[];
    getDatasetMeta: (index: number) => ChartMeta;
    chartArea?: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
  }
  
  interface ChartDataset {
    label?: string;
    data: number[] | number[][];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    [key: string]: any;
  }
  
  interface ChartPoint {
    index: number;
    datasetIndex: number;
  }
  
  interface ChartMeta {
    data: ChartElement[];
  }
  
  interface ChartElement {
    x: number;
    y: number;
  }
  
  interface ChartOptions {
    horizontal?: boolean;
    colorIndex?: number;
    label?: string;
    labels?: string[];
    field?: string;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    onClick?: boolean | ((evt: Event, points: ChartPoint[], chart: ChartInstance) => void);
    onClickCallback?: (evt: Event, points: ChartPoint[], chart: ChartInstance) => void;
    clearPrevious?: boolean;
    legendContainer?: string;
    type?: string;
    chartOptions?: any;
    [key: string]: any;
  }
  
  interface ChartFactory {
    createBarChart: (canvasId: string, labels: string[], values: number[] | ChartDataset[], options?: ChartOptions) => Promise<ChartInstance | null>;
    createLineChart: (canvasId: string, labels: string[], values: number[] | ChartDataset[], options?: ChartOptions) => Promise<ChartInstance | null>;
    createDoughnutChart: (canvasId: string, labels: string[], values: number[], options?: ChartOptions) => Promise<ChartInstance | null>;
    updateChart: (canvasId: string, labels?: string[], values?: number[] | ChartDataset[], options?: ChartOptions) => Promise<ChartInstance | null>;
    destroyChartSafely: (chartId: string | string[]) => boolean;
    destroyCharts: (chartIds: string[]) => number;
    createReactiveChart: (canvasId: string, dataStoreKey: string, dataTransformer: (data: any) => { labels: string[]; values: number[] }, chartOptions?: ChartOptions) => () => void;
  }
  
  interface LegendController {
    update: () => void;
    render: () => void;
    getVisibility: () => Record<string, boolean>;
    setVisibility: (label: string, visible: boolean) => void;
  }
  
  interface ChartLegend {
    createInteractiveLegend: (chartId: string, containerId: string, datasets: ChartDataset[], options?: any) => LegendController | undefined;
    createDoughnutLegend: (chartId: string, containerId: string, labels: string[], values: number[], colors?: string[] | null, options?: any) => LegendController | undefined;
    getColorFromPalette: (index: number) => string;
  }

  interface Window {
    eventBus?: EventBus;
    chartRegistry?: ChartRegistry;
    chartFieldMap?: Record<string, FieldMapping>;
    chartFeedback?: Feedback;
    globalFilters?: GlobalFilters;
    createPageFilterListener?: (pageId: string, reloadFunction: PageLoaderFunction, debounceMs?: number) => UnsubscribeFunction;
    autoConnectAllPages?: () => void;
    Logger?: {
      error?: (message: string, error?: any) => void;
      debug?: (message: string, data?: any) => void;
      warn?: (message: string, data?: any) => void;
      success?: (message: string, data?: any) => void;
      info?: (message: string, data?: any) => void;
    };
    timerManager?: {
      setTimeout?: (fn: () => void, delay: number, key?: string) => any;
      clearTimeout?: (timer: any) => void;
    };
    dataStore?: {
      get?: (key: string, ttl?: number | null, returnCopy?: boolean) => any;
      set?: (key: string, value: any, deepCopy?: boolean) => void;
      clear?: (key?: string | null) => void;
      invalidate?: (keys?: string[] | string) => void;
      subscribe?: (key: string, callback: (data: any, key: string) => void) => () => void;
      getStats?: () => DataStoreStats;
      getDefaultTTL?: () => number;
      setDefaultTTL?: (ttl: number) => void;
      getPersistent?: (key: string, ttl?: number | null) => any;
      setPersistent?: (key: string, data: any, ttl?: number | null) => void;
      clearPersistent?: (key?: string | null) => void;
      clearOldPersistent?: () => void;
    };
    dataLoader?: {
      load?: (endpoint: string, options?: LoadOptions) => Promise<any>;
      loadMany?: (endpoints: string[], options?: LoadOptions) => Promise<LoadManyResult[]>;
      getQueueStats?: () => QueueStats;
      clearQueue?: () => void;
    };
    chartCommunication?: {
      on?: (event: string, callback: (data?: any) => void) => () => void;
      off?: (event: string) => void;
      emit?: (event: string, data?: any) => void;
    };
    Chart?: {
      getChart?: (canvas: HTMLCanvasElement) => any;
      new?: (ctx: CanvasRenderingContext2D, config: any) => ChartInstance;
    };
    chartFactory?: ChartFactory;
    chartLegend?: ChartLegend;
    lazyLibraries?: {
      loadChartJS?: () => Promise<void>;
    };
    reloadAllData?: () => void;
    updateKPIsVisualState?: () => void;
    config?: {
      CHART_CONFIG?: {
        COLOR_PALETTE?: string[];
        PERFORMANCE?: {
          ANIMATION_DURATION?: number;
        };
        TOOLTIP?: {
          BACKGROUND?: string;
          TITLE_COLOR?: string;
          BODY_COLOR?: string;
          BORDER_COLOR?: string;
          BORDER_WIDTH?: number;
          PADDING?: number;
        };
      };
      getColorByTipoManifestacao?: (tipo: string) => string | null;
    };
    // Funções de carregamento de páginas (adicionadas dinamicamente)
    loadOverview?: PageLoaderFunction;
    loadOrgaoMes?: PageLoaderFunction;
    loadTipo?: PageLoaderFunction;
    loadStatusPage?: PageLoaderFunction;
    loadTema?: PageLoaderFunction;
    loadAssunto?: PageLoaderFunction;
    loadBairro?: PageLoaderFunction;
    loadCanal?: PageLoaderFunction;
    loadPrioridade?: PageLoaderFunction;
    loadResponsavel?: PageLoaderFunction;
    loadUnidadesSaude?: PageLoaderFunction;
    loadReclamacoes?: PageLoaderFunction;
    loadTempoMedio?: PageLoaderFunction;
    loadCadastrante?: PageLoaderFunction;
    loadProjecao2026?: PageLoaderFunction;
    loadVencimento?: PageLoaderFunction;
    loadNotificacoes?: PageLoaderFunction;
    loadZeladoriaOverview?: PageLoaderFunction;
    loadZeladoriaStatus?: PageLoaderFunction;
    loadZeladoriaCategoria?: PageLoaderFunction;
    loadZeladoriaDepartamento?: PageLoaderFunction;
    loadZeladoriaBairro?: PageLoaderFunction;
    loadZeladoriaResponsavel?: PageLoaderFunction;
    loadZeladoriaCanal?: PageLoaderFunction;
    loadZeladoriaTempo?: PageLoaderFunction;
    loadZeladoriaMensal?: PageLoaderFunction;
    loadZeladoriaGeografica?: PageLoaderFunction;
    loadColabDemandas?: PageLoaderFunction;
    loadZeladoriaColabCriar?: PageLoaderFunction;
    loadZeladoriaColabCategorias?: PageLoaderFunction;
    [key: string]: any; // Permitir propriedades dinâmicas adicionais
  }
}

export {};

