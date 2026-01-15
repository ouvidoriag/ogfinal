/**
 * Script para aplicar crossfilter em todas as páginas
 * Zeladoria, E-SIC e Central
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Mapeamento de páginas e seus gráficos/campos
const pagesConfig = {
  zeladoria: {
    'zeladoria-status.js': {
      charts: [
        { id: 'zeladoria-status-chart', field: 'status', type: 'doughnut' },
        { id: 'zeladoria-status-mes-chart', field: 'status', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaStatusKPIs',
      loadFunction: 'loadZeladoriaStatus',
      rankingSelector: '#zeladoria-status-ranking > div'
    },
    'zeladoria-categoria.js': {
      charts: [
        { id: 'zeladoria-categoria-chart', field: 'categoria', type: 'bar' },
        { id: 'zeladoria-categoria-mes-chart', field: 'categoria', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaCategoriaKPIs',
      loadFunction: 'loadZeladoriaCategoria',
      rankingSelector: '#zeladoria-categoria-ranking > div'
    },
    'zeladoria-departamento.js': {
      charts: [
        { id: 'zeladoria-departamento-chart', field: 'departamento', type: 'bar' },
        { id: 'zeladoria-departamento-mes-chart', field: 'departamento', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaDepartamentoKPIs',
      loadFunction: 'loadZeladoriaDepartamento',
      rankingSelector: '#zeladoria-departamento-ranking > div'
    },
    'zeladoria-responsavel.js': {
      charts: [
        { id: 'zeladoria-responsavel-chart', field: 'responsavel', type: 'bar' },
        { id: 'zeladoria-responsavel-mes-chart', field: 'responsavel', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaResponsavelKPIs',
      loadFunction: 'loadZeladoriaResponsavel',
      rankingSelector: '#zeladoria-responsavel-ranking > div'
    },
    'zeladoria-canal.js': {
      charts: [
        { id: 'zeladoria-canal-chart', field: 'canal', type: 'bar' },
        { id: 'zeladoria-canal-mes-chart', field: 'canal', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaCanalKPIs',
      loadFunction: 'loadZeladoriaCanal',
      rankingSelector: '#zeladoria-canal-ranking > div'
    },
    'zeladoria-bairro.js': {
      charts: [
        { id: 'zeladoria-bairro-chart', field: 'bairro', type: 'bar' },
        { id: 'zeladoria-bairro-mes-chart', field: 'bairro', type: 'bar' }
      ],
      kpiFunction: 'updateZeladoriaBairroKPIs',
      loadFunction: 'loadZeladoriaBairro',
      rankingSelector: '#zeladoria-bairro-ranking > div'
    }
  },
  esic: {
    'esic-status.js': {
      charts: [
        { id: 'esic-status-chart', field: 'status', type: 'doughnut' },
        { id: 'esic-status-mes-chart', field: 'status', type: 'bar' }
      ],
      kpiFunction: 'updateEsicStatusKPIs',
      loadFunction: 'loadEsicStatus',
      rankingSelector: '#esic-status-ranking > div'
    },
    'esic-canal.js': {
      charts: [
        { id: 'esic-canal-chart', field: 'canal', type: 'bar' },
        { id: 'esic-canal-mes-chart', field: 'canal', type: 'bar' }
      ],
      kpiFunction: 'updateEsicCanalKPIs',
      loadFunction: 'loadEsicCanal',
      rankingSelector: '#esic-canal-ranking > div'
    },
    'esic-responsavel.js': {
      charts: [
        { id: 'esic-responsavel-chart', field: 'responsavel', type: 'bar' },
        { id: 'esic-responsavel-mes-chart', field: 'responsavel', type: 'bar' }
      ],
      kpiFunction: 'updateEsicResponsavelKPIs',
      loadFunction: 'loadEsicResponsavel',
      rankingSelector: '#esic-responsavel-ranking > div'
    },
    'esic-unidade.js': {
      charts: [
        { id: 'esic-unidade-chart', field: 'unidade', type: 'bar' },
        { id: 'esic-unidade-mes-chart', field: 'unidade', type: 'bar' }
      ],
      kpiFunction: 'updateEsicUnidadeKPIs',
      loadFunction: 'loadEsicUnidade',
      rankingSelector: '#esic-unidade-ranking > div'
    },
    'esic-tipo-informacao.js': {
      charts: [
        { id: 'esic-tipo-chart', field: 'tipoInformacao', type: 'bar' },
        { id: 'esic-tipo-mes-chart', field: 'tipoInformacao', type: 'bar' }
      ],
      kpiFunction: 'updateEsicTipoKPIs',
      loadFunction: 'loadEsicTipo',
      rankingSelector: '#esic-tipo-ranking > div'
    }
  }
};

console.log('🔍 Analisando páginas para aplicar crossfilter...\n');

let totalPages = 0;
let processedPages = 0;

// Processar cada seção
for (const [section, pages] of Object.entries(pagesConfig)) {
  console.log(`\n📂 Seção: ${section.toUpperCase()}`);
  console.log('='.repeat(70));
  
  for (const [fileName, config] of Object.entries(pages)) {
    totalPages++;
    const filePath = path.join(projectRoot, 'public/scripts/pages', section, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${fileName} - Arquivo não encontrado`);
      continue;
    }
    
    console.log(`\n✅ ${fileName}`);
    console.log(`   Gráficos: ${config.charts.length}`);
    console.log(`   KPI Function: ${config.kpiFunction}`);
    console.log(`   Load Function: ${config.loadFunction}`);
    processedPages++;
  }
}

console.log(`\n\n📊 RESUMO:`);
console.log(`   Total de páginas: ${totalPages}`);
console.log(`   Páginas encontradas: ${processedPages}`);
console.log(`\n💡 Execute manualmente as alterações seguindo o padrão da Ouvidoria.`);

