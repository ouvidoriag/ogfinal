/**
 * Validar Estrutura dos Testes para Execução
 * 
 * Verifica se todos os testes podem ser executados no navegador
 * 
 * CÉREBRO X-3
 * Data: 18/12/2025
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

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

console.log('🔍 VALIDANDO ESTRUTURA DOS TESTES PARA EXECUÇÃO\n');
console.log('='.repeat(70));

// Teste 1: Verificar se testCrossfilter está exportado
function testTestCrossfilter() {
  const filePath = path.join(projectRoot, 'public/scripts/test/test-crossfilter.js');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasExport = content.includes('window.testCrossfilter') || 
                     content.includes('testCrossfilter.runAll');
    recordTest('testCrossfilter.runAll() exportado', hasExport,
      hasExport ? 'Função exportada corretamente' : 'Função não encontrada');
    
    const hasRunAll = content.includes('runAll') || content.includes('runAll:');
    recordTest('testCrossfilter tem método runAll', hasRunAll,
      hasRunAll ? 'Método runAll presente' : 'Método runAll não encontrado');
  } catch (error) {
    recordTest('testCrossfilter arquivo', false, `Erro: ${error.message}`);
  }
}

// Teste 2: Verificar se testCrossfilterInteractive está exportado
function testTestCrossfilterInteractive() {
  const filePath = path.join(projectRoot, 'public/scripts/test/test-crossfilter-interactive.js');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasExport = content.includes('window.testCrossfilterInteractive') || 
                     content.includes('testCrossfilterInteractive.run');
    recordTest('testCrossfilterInteractive.run() exportado', hasExport,
      hasExport ? 'Função exportada corretamente' : 'Função não encontrada');
    
    const hasRun = content.includes('run:') || content.includes('run: runInteractiveTest');
    recordTest('testCrossfilterInteractive tem método run', hasRun,
      hasRun ? 'Método run presente' : 'Método run não encontrado');
  } catch (error) {
    recordTest('testCrossfilterInteractive arquivo', false, `Erro: ${error.message}`);
  }
}

// Teste 3: Verificar se testCrossfilterComplete está exportado
function testTestCrossfilterComplete() {
  const filePath = path.join(projectRoot, 'public/scripts/test/test-crossfilter-complete.js');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasExport = content.includes('window.testCrossfilterComplete') || 
                     content.includes('testCrossfilterComplete.run');
    recordTest('testCrossfilterComplete.run() exportado', hasExport,
      hasExport ? 'Função exportada corretamente' : 'Função não encontrada');
    
    const hasRun = content.includes('run:') || content.includes('run: runCompleteTests');
    recordTest('testCrossfilterComplete tem método run', hasRun,
      hasRun ? 'Método run presente' : 'Método run não encontrado');
  } catch (error) {
    recordTest('testCrossfilterComplete arquivo', false, `Erro: ${error.message}`);
  }
}

// Teste 4: Verificar se checkElementCrossfilter está exportado
function testCheckElementCrossfilter() {
  const filePath = path.join(projectRoot, 'public/scripts/utils/kpi-filter-helper.js');
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasExport = content.includes('window.checkElementCrossfilter') || 
                     content.includes('checkElementCrossfilter = function');
    recordTest('checkElementCrossfilter() exportado', hasExport,
      hasExport ? 'Função exportada corretamente' : 'Função não encontrada');
  } catch (error) {
    recordTest('checkElementCrossfilter arquivo', false, `Erro: ${error.message}`);
  }
}

// Teste 5: Verificar dependências
function testDependencies() {
  const testFiles = [
    'public/scripts/test/test-crossfilter.js',
    'public/scripts/test/test-crossfilter-interactive.js',
    'public/scripts/test/test-crossfilter-complete.js'
  ];

  testFiles.forEach(testFile => {
    const fullPath = path.join(projectRoot, testFile);
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const fileName = path.basename(testFile);
        
        // Verificar se usa window.Logger (opcional)
        const usesLogger = content.includes('window.Logger') || content.includes('Logger');
        
        // Verificar se tem estrutura básica (funções ou exports)
        const hasStructure = (content.includes('function') || content.includes('const') || content.includes('window.')) && 
                            (content.includes('run') || content.includes('click') || content.includes('checkState'));
        
        recordTest(`Estrutura ${fileName}`, hasStructure,
          hasStructure ? 'Estrutura válida' : 'Estrutura incompleta');
      }
    } catch (error) {
      recordTest(`Arquivo ${path.basename(testFile)}`, false, `Erro: ${error.message}`);
    }
  });
}

// Executar todos os testes
testTestCrossfilter();
testTestCrossfilterInteractive();
testTestCrossfilterComplete();
testCheckElementCrossfilter();
testDependencies();

// Mostrar resultados
console.log('\n' + '='.repeat(70));
console.log('📊 RESULTADOS DA VALIDAÇÃO\n');
console.log('='.repeat(70));

results.tests.forEach(test => {
  const icon = test.passed ? '✅' : '❌';
  const warning = test.warning ? '⚠️' : '';
  const color = test.passed ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon} ${warning}${reset} ${test.name}`);
  if (test.message && (!test.passed || test.warning)) {
    console.log(`   ${test.message}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log(`✅ Passou: ${results.passed}`);
console.log(`❌ Falhou: ${results.failed}`);
console.log(`⚠️ Avisos: ${results.warnings}`);
console.log(`📊 Total: ${results.tests.length}`);
console.log('='.repeat(70));

// Instruções de execução
console.log('\n📋 INSTRUÇÕES PARA EXECUTAR TESTES NO NAVEGADOR:\n');
console.log('1. Abra o dashboard no navegador');
console.log('2. Abra o Console do Desenvolvedor (F12)');
console.log('3. Execute os comandos:\n');
console.log('   // Teste completo (recomendado)');
console.log('   testCrossfilterComplete.run();\n');
console.log('   // Teste básico');
console.log('   testCrossfilter.runAll();\n');
console.log('   // Teste interativo');
console.log('   testCrossfilterInteractive.run();\n');
console.log('   // Verificar elemento específico');
console.log('   checkElementCrossfilter(\'.rank-item\');\n');
console.log('4. Aguarde os resultados no console\n');

const success = results.failed === 0;
if (success) {
  console.log('🎉 Todos os testes estão prontos para execução!');
  process.exit(0);
} else {
  console.log('⚠️ Alguns testes têm problemas. Verifique os detalhes acima.');
  process.exit(1);
}

