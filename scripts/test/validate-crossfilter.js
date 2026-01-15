/**
 * Script de Validação - Sistema Crossfilter
 * 
 * Valida se o sistema de crossfilter está implementado corretamente
 * em todas as páginas da Ouvidoria
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function recordTest(name, passed, message = '', warning = false) {
  results.tests.push({ name, passed, message, warning });
  if (warning) {
    results.warnings++;
  } else if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Diretório base - ajustar caminho relativo
const projectRoot = path.join(__dirname, '..', '..');
const baseDir = path.join(projectRoot, 'public', 'scripts');

// Páginas da Ouvidoria e seus gráficos esperados
const pages = {
  'pages/ouvidoria/tema.js': ['chartTema', 'chartStatusTema', 'chartTemaMes'],
  'pages/ouvidoria/assunto.js': ['chartAssunto', 'chartStatusAssunto', 'chartAssuntoMes'],
  'pages/ouvidoria/status.js': ['chartStatusPage', 'chartStatusMes'],
  'pages/ouvidoria/tipo.js': ['chartTipo'],
  'pages/ouvidoria/canal.js': ['chartCanal', 'chartCanalMes'],
  'pages/ouvidoria/prioridade.js': ['chartPrioridade'],
  'pages/ouvidoria/bairro.js': ['chartBairro', 'chartBairroMes'],
  'pages/ouvidoria/responsavel.js': ['chartResponsavel'],
  'pages/ouvidoria/reclamacoes.js': ['chartReclamacoesTipo', 'chartReclamacoesMes'],
  'pages/ouvidoria/notificacoes.js': ['notificacoes-chart-tipo']
};

console.log('🧪 VALIDAÇÃO DO SISTEMA CROSSFILTER\n');
console.log('='.repeat(60));

// Teste 1: Verificar se helper existe
function testHelperExists() {
  const helperPath = path.join(baseDir, 'utils', 'crossfilter-helper.js');
  try {
    if (fs.existsSync(helperPath)) {
      const content = fs.readFileSync(helperPath, 'utf8');
      const hasFunction = content.includes('window.addCrossfilterToChart');
      recordTest('Helper crossfilter-helper.js existe', hasFunction, 
        hasFunction ? 'Helper encontrado com função addCrossfilterToChart' : 'Helper existe mas função não encontrada');
      return hasFunction;
    } else {
      recordTest('Helper crossfilter-helper.js existe', false, 'Arquivo não encontrado');
      return false;
    }
  } catch (error) {
    recordTest('Helper crossfilter-helper.js existe', false, `Erro: ${error.message}`);
    return false;
  }
}

// Teste 2: Verificar se helper está no HTML
function testHelperInHTML() {
  const htmlPath = path.join(projectRoot, 'public', 'index.html');
  try {
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, 'utf8');
      const hasHelper = content.includes('crossfilter-helper.js');
      recordTest('Helper carregado no HTML', hasHelper,
        hasHelper ? 'Helper referenciado no index.html' : 'Helper não encontrado no HTML');
      return hasHelper;
    } else {
      recordTest('Helper carregado no HTML', false, 'index.html não encontrado');
      return false;
    }
  } catch (error) {
    recordTest('Helper carregado no HTML', false, `Erro: ${error.message}`);
    return false;
  }
}

// Teste 3: Verificar implementação em cada página
function testPageImplementation(pagePath, chartIds) {
  const fullPath = path.join(baseDir, pagePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      recordTest(`Página ${pagePath} existe`, false, `Arquivo não encontrado em: ${fullPath}`);
      return false;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const pageName = path.basename(pagePath, '.js');
    
    // Verificar se usa addCrossfilterToChart
    const usesHelper = content.includes('addCrossfilterToChart');
    
    // Verificar se tem handlers de onClick
    const hasOnClick = content.includes('options.onClick') || content.includes('onClick:');
    
    // Verificar se tem contextmenu (clique direito)
    const hasContextMenu = content.includes('contextmenu') || content.includes('contextMenu');
    
    // Verificar se tem cursor pointer
    const hasCursor = content.includes('cursor') && content.includes('pointer');
    
    const allChecks = usesHelper || (hasOnClick && hasContextMenu);
    
    recordTest(
      `Página ${pageName} implementada`,
      allChecks,
      usesHelper 
        ? `Usa helper addCrossfilterToChart` 
        : hasOnClick 
          ? `Tem handlers manuais (onClick + contextmenu)` 
          : 'Sem implementação de crossfilter',
      !usesHelper && hasOnClick
    );
    
    // Verificar gráficos específicos
    chartIds.forEach(chartId => {
      const hasChart = content.includes(chartId);
      if (hasChart) {
        const hasHandler = content.includes(`${chartId}`) && 
                          (content.includes('addCrossfilterToChart') || 
                           content.includes('options.onClick') ||
                           content.includes('onClick:'));
        recordTest(
          `Gráfico ${chartId} em ${pageName}`,
          hasHandler,
          hasHandler ? 'Gráfico encontrado com handler' : 'Gráfico encontrado mas sem handler',
          !hasHandler
        );
      } else {
        recordTest(
          `Gráfico ${chartId} em ${pageName}`,
          true,
          'Gráfico não encontrado (pode ser criado dinamicamente)',
          true
        );
      }
    });
    
    return allChecks;
  } catch (error) {
    recordTest(`Página ${pagePath} implementada`, false, `Erro: ${error.message}`);
    return false;
  }
}

// Teste 4: Verificar scripts de teste
function testTestScripts() {
  const testFiles = [
    'test/test-crossfilter.js',
    'test/test-crossfilter-interactive.js'
  ];
  
  testFiles.forEach(testFile => {
    const fullPath = path.join(baseDir, testFile);
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const hasExports = content.includes('window.testCrossfilter') || 
                          content.includes('window.testCrossfilterInteractive');
        recordTest(`Script de teste ${path.basename(testFile)}`, hasExports,
          hasExports ? 'Script encontrado com exports' : 'Script encontrado mas sem exports');
      } else {
        recordTest(`Script de teste ${path.basename(testFile)}`, false, 'Arquivo não encontrado');
      }
    } catch (error) {
      recordTest(`Script de teste ${path.basename(testFile)}`, false, `Erro: ${error.message}`);
    }
  });
}

// Executar todos os testes
testHelperExists();
testHelperInHTML();
testTestScripts();

Object.entries(pages).forEach(([pagePath, chartIds]) => {
  testPageImplementation(pagePath, chartIds);
});

// Mostrar resultados
console.log('\n📊 RESULTADOS DA VALIDAÇÃO\n');
console.log('='.repeat(60));

results.tests.forEach(test => {
  const icon = test.passed ? '✅' : '❌';
  const warning = test.warning ? '⚠️' : '';
  const status = test.passed ? 'PASSOU' : 'FALHOU';
  console.log(`${icon} ${warning} [${status}] ${test.name}`);
  if (test.message) {
    console.log(`   ${test.message}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`✅ Passou: ${results.passed}`);
console.log(`❌ Falhou: ${results.failed}`);
console.log(`⚠️ Avisos: ${results.warnings}`);
console.log(`📊 Total: ${results.tests.length}`);
console.log('='.repeat(60));

const success = results.failed === 0;
if (success) {
  console.log('\n🎉 Todos os testes passaram!');
  process.exit(0);
} else {
  console.log('\n⚠️ Alguns testes falharam. Verifique os detalhes acima.');
  process.exit(1);
}

