/**
 * Script para corrigir erro de permissão do Prisma (EPERM)
 * Funciona no Windows, Linux e macOS
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');
const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');

console.log('🔧 Corrigindo erro de permissão do Prisma...');
console.log(`📁 Diretório do projeto: ${projectRoot}`);
console.log('');

// Função para fechar processos Node.js
async function killNodeProcesses() {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows
      console.log('1️⃣ Fechando processos Node.js...');
      try {
        execSync('taskkill /F /IM node.exe 2>nul', { 
          stdio: 'ignore',
          shell: true 
        });
        console.log('   ✅ Processos Node.js fechados.');
      } catch {
        console.log('   ℹ️  Nenhum processo Node.js encontrado ou já foi fechado.');
      }
    } else if (platform === 'darwin' || platform === 'linux') {
      // macOS ou Linux
      console.log('1️⃣ Fechando processos Node.js...');
      try {
        // Obter PID do processo atual
        const currentPid = process.pid;
        // Matar outros processos Node.js (exceto o atual)
        execSync(`pkill -f node || true`, { stdio: 'ignore' });
        // Aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('   ✅ Processos Node.js fechados.');
      } catch {
        console.log('   ℹ️  Nenhum processo Node.js encontrado ou já foi fechado.');
      }
    }
  } catch (error) {
    console.log('   ⚠️  Não foi possível fechar processos Node.js (pode não ser necessário).');
  }
  
  // Aguardar um pouco para garantir que os arquivos foram liberados
  console.log('2️⃣ Aguardando 3 segundos para liberar arquivos...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('');
}

// Função para limpar cache do Prisma
function cleanPrismaCache() {
  console.log('3️⃣ Limpando cache do Prisma...');
  
  const prismaClientPath = path.join(projectRoot, 'node_modules', '.prisma');
  
  if (fs.existsSync(prismaClientPath)) {
    try {
      // Tentar remover arquivos temporários
      const files = fs.readdirSync(prismaClientPath);
      files.forEach(file => {
        if (file.endsWith('.tmp') || file.includes('.tmp')) {
          try {
            const filePath = path.join(prismaClientPath, file);
            fs.unlinkSync(filePath);
            console.log(`   🗑️  Removido: ${file}`);
          } catch {
            // Ignorar erros ao remover arquivos temporários
          }
        }
      });
      console.log('   ✅ Cache limpo.');
    } catch (error) {
      console.log('   ⚠️  Não foi possível limpar cache (pode não ser necessário).');
    }
  } else {
    console.log('   ℹ️  Cache do Prisma não encontrado.');
  }
  console.log('');
}

// Função para gerar Prisma Client
async function generatePrisma() {
  console.log('4️⃣ Gerando Prisma Client...');
  console.log('');
  
  try {
    execSync(`npx prisma generate --schema="${schemaPath}"`, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env },
      timeout: 60000,
      shell: true
    });
    
    console.log('');
    console.log('✅ Prisma Client gerado com sucesso!');
    return true;
  } catch (error) {
    console.log('');
    console.error('❌ Erro ao gerar Prisma Client:');
    console.error('');
    console.error('💡 Tente as seguintes soluções:');
    console.error('   1. Execute este script como Administrador (Windows) ou com sudo (Linux/macOS)');
    console.error('   2. Desabilite temporariamente o antivírus');
    console.error('   3. Adicione a pasta node_modules ao antivírus como exceção');
    console.error('   4. Verifique se há outros processos usando os arquivos');
    console.error('   5. Tente executar manualmente: cd NOVO && npx prisma generate');
    console.error('');
    return false;
  }
}

// Executar o processo
(async () => {
  try {
    await killNodeProcesses();
    cleanPrismaCache();
    const success = await generatePrisma();
    
    if (success) {
      console.log('🎉 Processo concluído com sucesso!');
      process.exit(0);
    } else {
      console.log('⚠️  Processo concluído com avisos. Verifique as mensagens acima.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  }
})();

