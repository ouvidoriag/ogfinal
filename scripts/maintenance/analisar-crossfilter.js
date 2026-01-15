/**
 * Script de Análise Completa do Sistema Crossfilter
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
const pagesDir = path.join(projectRoot, 'public/scripts/pages');

const resultados = {
  total: 0,
  comGraficos: 0,
  comCrossfilter: 0,
  comOnClickFalse: 0,
  detalhes: []
};

function analisarArquivo(filePath, relPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const temGraficos = /createBarChart|createDoughnutChart|createLineChart/.test(content);
  const temCrossfilter = /addCrossfilterToChart/.test(content);
  const temOnClickFalse = /onClick:\s*false|onClick.*false/.test(content);
  
  resultados.total++;
  
  if (temGraficos) {
    resultados.comGraficos++;
    
    const detalhe = {
      arquivo: relPath,
      graficos: {
        bar: (content.match(/createBarChart/g) || []).length,
        doughnut: (content.match(/createDoughnutChart/g) || []).length,
        line: (content.match(/createLineChart/g) || []).length
      },
      temCrossfilter,
      temOnClickFalse,
      status: temCrossfilter ? '✅' : '❌'
    };
    
    resultados.detalhes.push(detalhe);
    
    if (temCrossfilter) {
      resultados.comCrossfilter++;
    }
    
    if (temOnClickFalse) {
      resultados.comOnClickFalse++;
    }
  }
}

function walkDir(dir, baseDir = '') {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relPath = path.join(baseDir, file).replace(/\\/g, '/');
    
    if (stat.isDirectory()) {
      walkDir(filePath, relPath);
    } else if (file.endsWith('.js')) {
      analisarArquivo(filePath, relPath);
    }
  });
}

console.log('🔍 Analisando todas as páginas...\n');
walkDir(pagesDir);

// Agrupar por seção
const porSecao = {
  ouvidoria: [],
  zeladoria: [],
  esic: [],
  central: []
};

resultados.detalhes.forEach(d => {
  if (d.arquivo.includes('ouvidoria/')) {
    porSecao.ouvidoria.push(d);
  } else if (d.arquivo.includes('zeladoria/')) {
    porSecao.zeladoria.push(d);
  } else if (d.arquivo.includes('esic/')) {
    porSecao.esic.push(d);
  } else if (d.arquivo.includes('central/')) {
    porSecao.central.push(d);
  }
});

console.log('='.repeat(80));
console.log('📊 RELATÓRIO DE ANÁLISE - SISTEMA CROSSFILTER');
console.log('='.repeat(80));
console.log(`\n📁 Total de páginas analisadas: ${resultados.total}`);
console.log(`📊 Páginas com gráficos Chart.js: ${resultados.comGraficos}`);
console.log(`✅ Páginas com crossfilter implementado: ${resultados.comCrossfilter}`);
console.log(`⚠️  Páginas com onClick: false: ${resultados.comOnClickFalse}`);
console.log(`\n🎯 Taxa de Cobertura: ${((resultados.comCrossfilter / resultados.comGraficos) * 100).toFixed(1)}%\n`);

console.log('='.repeat(80));
console.log('📋 DETALHAMENTO POR SEÇÃO');
console.log('='.repeat(80));

Object.entries(porSecao).forEach(([secao, arquivos]) => {
  if (arquivos.length === 0) return;
  
  const comCrossfilter = arquivos.filter(a => a.temCrossfilter).length;
  const comOnClickFalse = arquivos.filter(a => a.temOnClickFalse).length;
  
  console.log(`\n📂 ${secao.toUpperCase()}: ${arquivos.length} páginas com gráficos`);
  console.log(`   ✅ Com crossfilter: ${comCrossfilter}/${arquivos.length}`);
  console.log(`   ⚠️  Com onClick: false: ${comOnClickFalse}`);
  
  arquivos.forEach(arq => {
    const totalGraficos = arq.graficos.bar + arq.graficos.doughnut + arq.graficos.line;
    console.log(`   ${arq.status} ${arq.arquivo} (${totalGraficos} gráfico${totalGraficos > 1 ? 's' : ''})`);
    if (arq.temOnClickFalse) {
      console.log(`      ⚠️  Contém onClick: false`);
    }
  });
});

console.log('\n' + '='.repeat(80));
console.log('✅ PÁGINAS COMPLETAS (com crossfilter)');
console.log('='.repeat(80));
resultados.detalhes
  .filter(d => d.temCrossfilter)
  .forEach(d => {
    const totalGraficos = d.graficos.bar + d.graficos.doughnut + d.graficos.line;
    console.log(`✅ ${d.arquivo} (${totalGraficos} gráfico${totalGraficos > 1 ? 's' : ''})`);
  });

if (resultados.detalhes.some(d => d.temGraficos && !d.temCrossfilter)) {
  console.log('\n' + '='.repeat(80));
  console.log('❌ PÁGINAS PENDENTES (sem crossfilter)');
  console.log('='.repeat(80));
  resultados.detalhes
    .filter(d => !d.temCrossfilter)
    .forEach(d => {
      const totalGraficos = d.graficos.bar + d.graficos.doughnut + d.graficos.line;
      console.log(`❌ ${d.arquivo} (${totalGraficos} gráfico${totalGraficos > 1 ? 's' : ''})`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('🎉 ANÁLISE CONCLUÍDA');
console.log('='.repeat(80));

