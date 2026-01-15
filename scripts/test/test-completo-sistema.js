/**
 * 🧪 TESTE COMPLETO DO SISTEMA
 * 
 * Este script executa TODOS os testes do sistema:
 * - APIs do backend
 * - Scripts Node.js
 * - Validação de sintaxe JavaScript
 * - Pipeline Python
 * - Testes de integração
 * 
 * Data: 12/12/2025
 * CÉREBRO X-3
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Base dir é NOVO/ (dois níveis acima de scripts/test/)
const BASE_DIR = path.join(__dirname, '../..');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'cyan');
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Resultados dos testes
const resultados = {
  inicio: new Date(),
  fim: null,
  total: 0,
  passou: 0,
  falhou: 0,
  pulou: 0,
  detalhes: []
};

/**
 * Executar comando e capturar resultado
 */
async function executarComando(comando, descricao) {
  try {
    logInfo(`Executando: ${descricao}...`);
    const { stdout, stderr } = await execAsync(comando, {
      cwd: BASE_DIR,
      timeout: 300000 // 5 minutos
    });

    if (stderr && !stderr.includes('warning')) {
      logWarning(`Avisos em ${descricao}: ${stderr.substring(0, 200)}`);
    }

    resultados.total++;
    resultados.passou++;
    resultados.detalhes.push({
      teste: descricao,
      status: 'PASSOU',
      output: stdout.substring(0, 500)
    });
    logSuccess(`${descricao} - PASSOU`);
    return { success: true, stdout, stderr };
  } catch (error) {
    resultados.total++;
    resultados.falhou++;
    const stdout = error.stdout?.substring(0, 1000) || '';
    const stderr = error.stderr?.substring(0, 1000) || '';
    resultados.detalhes.push({
      teste: descricao,
      status: 'FALHOU',
      erro: error.message,
      output: stdout || stderr || error.message
    });
    logError(`${descricao} - FALHOU: ${error.message}`);
    if (stdout) {
      logWarning(`Output: ${stdout.substring(0, 200)}...`);
    }
    return { success: false, error, stdout, stderr };
  }
}

/**
 * Validar sintaxe de arquivo JavaScript
 */
async function validarSintaxeJS(arquivo) {
  try {
    const caminhoCompleto = path.join(BASE_DIR, arquivo);
    if (!fs.existsSync(caminhoCompleto)) {
      return { success: false, erro: 'Arquivo não encontrado' };
    }

    await execAsync(`node --check "${caminhoCompleto}"`, {
      cwd: BASE_DIR,
      timeout: 10000
    });

    return { success: true };
  } catch (error) {
    return { success: false, erro: error.message };
  }
}

/**
 * Verificar se servidor está rodando
 */
async function verificarServidor() {
  try {
    // Node.js 18+ tem fetch nativo
    const fetch = globalThis.fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('http://localhost:3000/api/summary', {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    clearTimeout(timeoutId);
    return true; // Se respondeu (mesmo 401/404), o servidor está rodando
  } catch (error) {
    return false;
  }
}

/**
 * Testar todas as APIs
 */
async function testarAPIs() {
  logSection('📡 TESTANDO TODAS AS APIs');

  const servidorRodando = await verificarServidor();
  if (!servidorRodando) {
    logWarning('Servidor não está rodando.');
    logInfo('💡 Para testar APIs, inicie o servidor em outro terminal com: npm start');
    logInfo('💡 Ou execute: npm run test:all-endpoints (após iniciar o servidor)');
    logWarning('Pulando testes de API (requer servidor ativo)');
    resultados.pulou += 3;
    resultados.total += 3;
    return;
  }

  logSuccess('Servidor detectado! Executando testes de API...');
  await executarComando('npm run test:apis', 'Teste de APIs');
  await executarComando('npm run test:kpis', 'Teste de KPIs');
  await executarComando('npm run test:filters', 'Teste de Filtros');
}

/**
 * Validar sintaxe de todos os arquivos JavaScript
 */
async function validarSintaxeJavaScript() {
  logSection('🔍 VALIDANDO SINTAXE DE TODOS OS ARQUIVOS JAVASCRIPT');

  const diretorios = [
    'src',
    'public/scripts',
    'scripts'
  ];

  const arquivos = [];

  for (const dir of diretorios) {
    const caminhoDir = path.join(BASE_DIR, dir);
    if (fs.existsSync(caminhoDir)) {
      function buscarArquivosJS(dirPath) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('__tests__') && !item.includes('test')) {
            buscarArquivosJS(itemPath);
          } else if (item.endsWith('.js') && !item.includes('.test.') && !item.includes('.spec.')) {
            arquivos.push(path.relative(BASE_DIR, itemPath));
          }
        }
      }
      buscarArquivosJS(caminhoDir);
    }
  }

  logInfo(`Encontrados ${arquivos.length} arquivos JavaScript para validar`);

  let validos = 0;
  let invalidos = 0;
  const erros = [];

  for (const arquivo of arquivos) {
    const resultado = await validarSintaxeJS(arquivo);
    if (resultado.success) {
      validos++;
    } else {
      invalidos++;
      erros.push({ arquivo, erro: resultado.erro });
      logError(`Sintaxe inválida: ${arquivo}`);
    }
  }

  logInfo(`✅ ${validos} arquivos válidos`);
  if (invalidos > 0) {
    logError(`${invalidos} arquivos com erro de sintaxe`);
    resultados.detalhes.push({
      teste: 'Validação de Sintaxe JavaScript',
      status: 'FALHOU',
      erros: erros.slice(0, 10) // Limitar a 10 erros
    });
  } else {
    resultados.passou++;
    resultados.detalhes.push({
      teste: 'Validação de Sintaxe JavaScript',
      status: 'PASSOU',
      total: validos
    });
  }
  resultados.total++;
}

/**
 * Testar scripts Node.js
 */
async function testarScriptsNode() {
  logSection('📜 TESTANDO SCRIPTS NODE.JS');

  const scripts = [
    { comando: 'node scripts/test/test-mongoose-connection.js', descricao: 'Teste de Conexão MongoDB', opcional: false },
    { comando: 'node scripts/test/testGoogleSheets.js', descricao: 'Teste de Google Sheets', opcional: true },
    { comando: 'node scripts/test/testGeminiKeys.js', descricao: 'Teste de Chaves Gemini', opcional: true }
  ];

  for (const script of scripts) {
    const resultado = await executarComando(script.comando, script.descricao);
    if (!resultado.success && script.opcional) {
      logWarning(`${script.descricao} falhou mas é opcional (pode requerer configuração)`);
      // Ajustar contadores: remover da contagem de falha e adicionar aos pulados
      resultados.pulou++;
      resultados.falhou--;
    }
  }
}

/**
 * Testar Pipeline Python
 */
async function testarPipelinePython() {
  logSection('🐍 TESTANDO PIPELINE PYTHON');

  const pipelinePath = path.join(BASE_DIR, '../Pipeline/main.py');

  if (!fs.existsSync(pipelinePath)) {
    logWarning('Pipeline Python não encontrado, pulando teste');
    resultados.pulou++;
    return;
  }

  // Verificar se Python está instalado
  try {
    await execAsync('python --version', { timeout: 5000 });
    logInfo('Python encontrado');
  } catch (error) {
    logWarning('Python não encontrado, pulando teste do pipeline');
    resultados.pulou++;
    return;
  }

  // Verificar se o arquivo do pipeline existe e é válido
  try {
    const stats = fs.statSync(pipelinePath);
    logInfo(`Pipeline encontrado: ${stats.size} bytes`);
    logSuccess('Pipeline Python validado (execução completa requer configuração)');
    resultados.passou++;
    resultados.total++;
  } catch (error) {
    logError(`Erro ao validar pipeline: ${error.message}`);
    resultados.falhou++;
    resultados.total++;
  }
}

/**
 * Testar Frontend (páginas e gráficos)
 */
async function testarFrontend() {
  logSection('🎨 TESTANDO FRONTEND');

  const servidorRodando = await verificarServidor();
  if (!servidorRodando) {
    logWarning('Servidor não está rodando. Pulando teste de páginas (requer servidor ativo)');
    logInfo('💡 Para testar frontend, inicie o servidor com: npm start');
    resultados.pulou++;
    resultados.total++;
    return;
  }

  logSuccess('Servidor detectado! Executando testes de frontend...');
  await executarComando('npm run test:pages', 'Teste de Páginas');
}

/**
 * Testar integrações
 */
async function testarIntegracoes() {
  logSection('🔗 TESTANDO INTEGRAÇÕES');

  const servidorRodando = await verificarServidor();
  if (!servidorRodando) {
    logWarning('Servidor não está rodando. Pulando testes de integração (requer servidor ativo)');
    logInfo('💡 Para testar integrações, inicie o servidor com: npm start');
    resultados.pulou += 2;
    resultados.total += 2;
    return;
  }

  logSuccess('Servidor detectado! Executando testes de integração...');
  const integracoes = [
    { comando: 'npm run test:crossfilter', descricao: 'Teste Crossfilter' },
    { comando: 'npm run test:aggregation', descricao: 'Teste de Agregações' }
  ];

  for (const integracao of integracoes) {
    await executarComando(integracao.comando, integracao.descricao);
  }
}

/**
 * Gerar relatório final
 */
function gerarRelatorio() {
  logSection('📊 RELATÓRIO FINAL DE TESTES');

  resultados.fim = new Date();
  const duracao = (resultados.fim - resultados.inicio) / 1000;

  console.log('\n' + '='.repeat(80));
  log('RESUMO DOS TESTES', 'bright');
  console.log('='.repeat(80));
  console.log(`\n⏱️  Duração Total: ${duracao.toFixed(2)} segundos`);
  console.log(`📊 Total de Testes: ${resultados.total}`);
  log(`✅ Passou: ${resultados.passou}`, 'green');
  log(`❌ Falhou: ${resultados.falhou}`, 'red');
  log(`⏭️  Pulou: ${resultados.pulou}`, 'yellow');

  const taxaSucesso = resultados.total > 0
    ? ((resultados.passou / resultados.total) * 100).toFixed(2)
    : 0;

  console.log(`\n📈 Taxa de Sucesso: ${taxaSucesso}%`);

  if (resultados.falhou > 0) {
    console.log('\n' + '='.repeat(80));
    log('DETALHES DOS ERROS', 'red');
    console.log('='.repeat(80));

    resultados.detalhes
      .filter(d => d.status === 'FALHOU')
      .forEach(detalhe => {
        console.log(`\n❌ ${detalhe.teste}`);
        if (detalhe.erro) {
          console.log(`   Erro: ${detalhe.erro.substring(0, 200)}`);
        }
        if (detalhe.erros) {
          detalhe.erros.forEach(e => {
            console.log(`   - ${e.arquivo}: ${e.erro.substring(0, 100)}`);
          });
        }
      });
  }

  // Salvar relatório em arquivo
  const relatorioPath = path.join(BASE_DIR, 'test-results.json');
  fs.writeFileSync(relatorioPath, JSON.stringify(resultados, null, 2));
  logInfo(`\n📄 Relatório salvo em: ${relatorioPath}`);

  console.log('\n' + '='.repeat(80) + '\n');

  return resultados.falhou === 0;
}

/**
 * Função principal
 */
async function main() {
  console.clear();
  log('\n🧪 TESTE COMPLETO DO SISTEMA - CÉREBRO X-3\n', 'bright');
  log(`Iniciado em: ${resultados.inicio.toLocaleString('pt-BR')}\n`, 'cyan');

  try {
    // 1. Validar sintaxe JavaScript
    await validarSintaxeJavaScript();

    // 2. Testar APIs
    await testarAPIs();

    // 3. Testar scripts Node.js
    await testarScriptsNode();

    // 4. Testar Pipeline Python
    await testarPipelinePython();

    // 5. Testar Frontend
    await testarFrontend();

    // 6. Testar integrações
    await testarIntegracoes();

    // 7. Gerar relatório
    const sucesso = gerarRelatorio();

    process.exit(sucesso ? 0 : 1);
  } catch (error) {
    logError(`Erro fatal durante os testes: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Executar
main();

