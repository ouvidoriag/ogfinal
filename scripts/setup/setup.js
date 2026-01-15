/**
 * Script de Setup do Sistema
 * Executado automaticamente no postinstall e prestart
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// projectRoot deve apontar para NOVO (onde está o package.json)
let projectRoot = path.join(__dirname, '..', '..');

console.log('🔧 Configurando o sistema...');
console.log(`📁 Diretório do projeto: ${projectRoot}`);

// Função principal de setup
async function runSetup() {
  console.log('1️⃣ Verificando ambiente...');

  // 1. Verificar Variáveis de Ambiente Críticas
  const dbUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ERRO CRÍTICO: MONGODB_ATLAS_URL não definida em produção.');
      process.exit(1);
    } else {
      console.warn('⚠️  MONGODB_ATLAS_URL não definida (ok para dev/teste).');
    }
  } else {
    // Em produção, logs devem ser mínimos
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Variável de banco de dados detectada.');
    }
  }

  // 2. Verificar e Instalar Dependências (Node_modules)
  await checkDependencies();

  // 3. Verificar Docker (Informativo)
  if (process.env.NODE_ENV !== 'production') {
    await checkDocker();
  }

  console.log('✅ Setup verificado.');
}

async function checkDependencies() {
  const nodeModulesPath = path.join(path.resolve(__dirname, '../../'), 'node_modules');
  // Usar fs importado
  const fs = await import('fs');

  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 Dependências não encontradas. Instalando automaticamente...');
    try {
      // npm install (pode demorar)
      await execAsync('npm install', { cwd: path.resolve(__dirname, '../../') });
      console.log('✅ Dependências instaladas com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao instalar dependências:', error.message);
      process.exit(1);
    }
  }
}

async function checkDocker() {
  try {
    const { stdout } = await execAsync('docker --version');
    console.log(`🐳 Docker detectado: ${stdout.trim()}`);
  } catch (error) {
    console.warn('[INFO] Docker não detectado — ambiente cPanel, seguindo sem containers');
  }
}


runSetup().catch(err => {
  console.error('❌ Erro no setup:', err);
  process.exit(1);
});
