/**
 * Script Node.js para executar testes de páginas automaticamente
 * Usa Puppeteer para automatizar o navegador
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const MAIN_PAGE = `${SERVER_URL}/`;
const TEST_PAGE = `${SERVER_URL}/test-pages.html`;

/**
 * Verificar se o servidor está rodando
 */
function checkServer() {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_URL);
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    
    req.on('error', () => {
      reject(new Error('Servidor não está rodando. Inicie com: npm start'));
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Timeout ao conectar com o servidor'));
    });
  });
}

/**
 * Executar testes usando Puppeteer (se disponível)
 */
async function runTestsWithPuppeteer() {
  try {
    const puppeteer = await import('puppeteer');
    console.log('🚀 Iniciando testes com Puppeteer...\n');
    
    const browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Interceptar console do navegador
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        console.error(`❌ ${text}`);
      } else if (type === 'warning') {
        console.warn(`⚠️ ${text}`);
      } else {
        console.log(text);
      }
    });
    
    // Interceptar erros
    page.on('pageerror', error => {
      console.error(`❌ Erro na página: ${error.message}`);
    });
    
    console.log(`📡 Conectando na página principal...`);
    await page.goto(MAIN_PAGE, { waitUntil: 'networkidle0', timeout: 30000 });
    
    console.log('✅ Página principal carregada. Carregando script de teste...');
    
    // Carregar script de teste
    await page.addScriptTag({ url: `${SERVER_URL}/scripts/test-all-pages.js` });
    
    // Aguardar script carregar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar se o script foi carregado
    const scriptLoaded = await page.evaluate(() => {
      return typeof window.testAllPages !== 'undefined';
    });
    
    if (!scriptLoaded) {
      throw new Error('Script de teste não foi carregado');
    }
    
    console.log('🧪 Executando testes...\n');
    
    // Executar testes e capturar resultados
    const results = await page.evaluate(async () => {
      try {
        const testResults = await window.testAllPages.runAllTests({
          skipOuvidoria: false,
          skipZeladoria: false,
          skipUnits: true, // Pular unidades para não demorar muito
          delayBetweenPages: 500
        });
        
        // Retornar apenas os dados necessários (serializáveis)
        if (!testResults || !testResults.summary) {
          return null;
        }
        
        return {
          summary: {
            total: testResults.summary.total || 0,
            passed: testResults.summary.passed || 0,
            failed: testResults.summary.failed || 0,
            skipped: testResults.summary.skipped || 0,
            successRate: testResults.summary.successRate || 0,
            totalTime: testResults.summary.totalTime || 0,
            chartsFound: testResults.summary.chartsFound || 0,
            chartsMissing: testResults.summary.chartsMissing || 0
          },
          details: {
            passed: (testResults.details?.passed || []).map(r => ({
              pageId: r.pageId || '',
              section: r.section || '',
              success: r.success || false,
              chartsCount: (r.charts || []).length,
              errorsCount: (r.errors || []).length
            })),
            failed: (testResults.details?.failed || []).map(r => ({
              pageId: r.pageId || '',
              section: r.section || '',
              errors: (r.errors || []).map(e => typeof e === 'string' ? e : String(e)),
              chartsCount: (r.charts || []).length
            })),
            charts: {
              found: (testResults.details?.charts?.found || []).map(c => ({
                pageId: c.pageId || '',
                chartId: c.chartId || ''
              })),
              missing: (testResults.details?.charts?.missing || []).map(c => ({
                pageId: c.pageId || '',
                chartId: c.chartId || '',
                reason: c.reason || 'Desconhecido'
              }))
            },
            errors: (testResults.details?.errors || []).map(e => ({
              pageId: e.pageId || '',
              error: typeof e.error === 'string' ? e.error : String(e.error || '')
            }))
          }
        };
      } catch (error) {
        return {
          error: error.message || String(error)
        };
      }
    });
    
    // Exibir resultados
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTADOS DOS TESTES');
    console.log('='.repeat(80));
    
    if (!results) {
      console.error('❌ Erro: Nenhum resultado retornado');
      await browser.close();
      process.exit(1);
    }
    
    if (results.error) {
      console.error(`❌ Erro ao executar testes: ${results.error}`);
      await browser.close();
      process.exit(1);
    }
    
    if (!results.summary) {
      console.error('❌ Erro: Resultados não retornaram estrutura esperada');
      await browser.close();
      process.exit(1);
    }
    
    const summary = results.summary;
    console.log(`\n⏱️  Tempo total: ${(summary.totalTime / 1000).toFixed(2)}s`);
    console.log(`\n✅ Páginas passaram: ${summary.passed}`);
    console.log(`❌ Páginas falharam: ${summary.failed}`);
    console.log(`⏭️  Páginas puladas: ${summary.skipped}`);
    console.log(`📈 Taxa de sucesso: ${summary.successRate.toFixed(2)}%`);
    console.log(`\n📊 Gráficos encontrados: ${summary.chartsFound}`);
    console.log(`⚠️  Gráficos com problemas: ${summary.chartsMissing}`);
    
    if (results.details && results.details.failed && results.details.failed.length > 0) {
      console.log('\n❌ PÁGINAS QUE FALHARAM:');
      results.details.failed.forEach(result => {
        console.log(`  - ${result.pageId} (${result.section || 'N/A'})`);
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(err => {
            const errMsg = typeof err === 'string' ? err : err.message || JSON.stringify(err);
            console.log(`    Erro: ${errMsg}`);
          });
        }
      });
    }
    
    if (results.details && results.details.charts && results.details.charts.missing && results.details.charts.missing.length > 0) {
      console.log('\n⚠️ GRÁFICOS COM PROBLEMAS:');
      results.details.charts.missing.slice(0, 10).forEach(chart => {
        console.log(`  - ${chart.chartId} em ${chart.pageId}: ${chart.reason}`);
      });
      if (results.details.charts.missing.length > 10) {
        console.log(`  ... e mais ${results.details.charts.missing.length - 10} gráficos com problemas`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    await browser.close();
    
    // Retornar código de saída baseado nos resultados
    const exitCode = summary && summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.error('\n❌ Puppeteer não está instalado.');
      console.log('\n💡 Para instalar: npm install --save-dev puppeteer');
      console.log('💡 Ou execute os testes manualmente em: http://localhost:3000/test-pages.html\n');
    } else {
      console.error('\n❌ Erro ao executar testes:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Executar testes sem Puppeteer (apenas verificação básica)
 */
async function runBasicTests() {
  console.log('⚠️  Puppeteer não está disponível.');
  console.log('📋 Verificando se o servidor está acessível...\n');
  
  try {
    const isRunning = await checkServer();
    if (isRunning) {
      console.log('✅ Servidor está rodando!');
      console.log(`\n💡 Para executar os testes completos:`);
      console.log(`   1. Abra: ${TEST_PAGE}`);
      console.log(`   2. Clique em "Executar Todos os Testes"`);
      console.log(`\n💡 Ou instale Puppeteer para testes automáticos:`);
      console.log(`   npm install --save-dev puppeteer\n`);
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    console.log(`\n💡 Inicie o servidor com: cd NOVO && npm start\n`);
    process.exit(1);
  }
}

/**
 * Main
 */
async function main() {
  console.log('🧪 Script de Teste de Páginas e Gráficos\n');
  
  // Verificar se servidor está rodando
  try {
    await checkServer();
    console.log(`✅ Servidor acessível em ${SERVER_URL}\n`);
  } catch (error) {
    console.error(`❌ ${error.message}\n`);
    process.exit(1);
  }
  
  // Tentar executar com Puppeteer
  try {
    await runTestsWithPuppeteer();
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      await runBasicTests();
    } else {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

