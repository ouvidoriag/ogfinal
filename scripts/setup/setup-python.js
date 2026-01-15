/**
 * Script de Setup do Python
 * 
 * Instala Python e dependências automaticamente
 * Executado via npm install ou npm run setup:python
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const pipelineRoot = path.join(projectRoot, '..');

/**
 * Verificar se Python está instalado
 */
async function checkPython() {
  const pythonCommands = ['python3', 'python', 'py'];
  
  for (const cmd of pythonCommands) {
    try {
      const { stdout } = await execAsync(`${cmd} --version`);
      console.log(`✅ Python encontrado: ${cmd} - ${stdout.trim()}`);
      return { installed: true, command: cmd, version: stdout.trim() };
    } catch (error) {
      // Continuar tentando
    }
  }
  
  return { installed: false, command: null, version: null };
}

/**
 * Instalar Python no Linux (apt)
 */
async function installPythonLinux() {
  console.log('📦 Instalando Python 3 via apt...');
  try {
    await execAsync('sudo apt-get update');
    await execAsync('sudo apt-get install -y python3 python3-pip');
    console.log('✅ Python instalado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao instalar Python:', error.message);
    return false;
  }
}

/**
 * Instalar Python no Windows (choco ou winget)
 */
async function installPythonWindows() {
  console.log('📦 Tentando instalar Python via winget...');
  try {
    await execAsync('winget install Python.Python.3.11 --silent --accept-package-agreements --accept-source-agreements');
    console.log('✅ Python instalado com sucesso!');
    return true;
  } catch (error) {
    console.log('⚠️  Winget não disponível. Tentando via Chocolatey...');
    try {
      await execAsync('choco install python3 -y');
      console.log('✅ Python instalado com sucesso!');
      return true;
    } catch (error2) {
      console.error('❌ Erro ao instalar Python. Instale manualmente de: https://www.python.org/downloads/');
      return false;
    }
  }
}

/**
 * Instalar dependências Python
 */
async function installPythonDependencies(pythonCmd) {
  console.log('\n📦 Instalando dependências Python...');
  
  const requirementsPath = path.join(pipelineRoot, 'Pipeline', 'requirements.txt');
  
  if (!fs.existsSync(requirementsPath)) {
    console.log('⚠️  Arquivo requirements.txt não encontrado. Pulando instalação de dependências.');
    return false;
  }
  
  try {
    // Verificar se pip está disponível
    try {
      await execAsync(`${pythonCmd} -m pip --version`);
    } catch (error) {
      console.log('📦 Instalando pip...');
      if (os.platform() === 'linux') {
        await execAsync('sudo apt-get install -y python3-pip');
      }
    }
    
    console.log(`📦 Instalando dependências de ${requirementsPath}...`);
    await execAsync(`${pythonCmd} -m pip install -r "${requirementsPath}"`);
    console.log('✅ Dependências Python instaladas com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao instalar dependências Python:', error.message);
    console.log('   Tente executar manualmente:');
    console.log(`   ${pythonCmd} -m pip install -r "${requirementsPath}"`);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Configurando Python para o Pipeline...\n');
  console.log('='.repeat(60));
  
  // Verificar Python
  const pythonCheck = await checkPython();
  
  if (pythonCheck.installed) {
    console.log(`\n✅ Python já está instalado: ${pythonCheck.command} (${pythonCheck.version})\n`);
    
    // Instalar dependências
    await installPythonDependencies(pythonCheck.command);
    
    console.log('\n✅ Setup do Python concluído!\n');
    return;
  }
  
  // Python não está instalado - tentar instalar
  console.log('\n⚠️  Python não encontrado. Tentando instalar...\n');
  
  const platform = os.platform();
  let installed = false;
  
  if (platform === 'linux') {
    installed = await installPythonLinux();
  } else if (platform === 'win32') {
    installed = await installPythonWindows();
  } else {
    console.error('❌ Sistema operacional não suportado para instalação automática.');
    console.log('   Instale Python manualmente de: https://www.python.org/downloads/');
    process.exit(1);
  }
  
  if (!installed) {
    console.error('\n❌ Não foi possível instalar Python automaticamente.');
    console.log('   Instale manualmente de: https://www.python.org/downloads/');
    process.exit(1);
  }
  
  // Verificar novamente
  const pythonCheck2 = await checkPython();
  
  if (!pythonCheck2.installed) {
    console.error('\n❌ Python foi instalado mas não foi encontrado no PATH.');
    console.log('   Reinicie o terminal ou adicione Python ao PATH manualmente.');
    process.exit(1);
  }
  
  // Instalar dependências
  await installPythonDependencies(pythonCheck2.command);
  
  console.log('\n✅ Setup do Python concluído!\n');
}

// Executar
main()
  .then(() => {
    console.log('🎉 Setup finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro no setup:', error);
    process.exit(1);
  });

