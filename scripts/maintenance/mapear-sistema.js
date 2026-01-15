/**
 * Script para Mapear e Organizar o Sistema
 * 
 * Gera um relatório completo da estrutura do sistema,
 * listando todos os arquivos e suas funções
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Contadores
const stats = {
  backend: { controllers: 0, routes: 0, utils: 0, total: 0 },
  frontend: { core: 0, pages: 0, utils: 0, total: 0 },
  scripts: 0,
  total: 0
};

/**
 * Listar arquivos recursivamente
 */
function listFiles(dir, baseDir = dir, depth = 0, maxDepth = 5) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    // Ignorar node_modules, .git, etc
    if (item.name.startsWith('.') || 
        item.name === 'node_modules' || 
        item.name === 'db-data' ||
        item.name.endsWith('.log') ||
        item.name.endsWith('.pid')) {
      continue;
    }
    
    if (item.isDirectory() && depth < maxDepth) {
      files.push({
        type: 'directory',
        name: item.name,
        path: relativePath,
        children: listFiles(fullPath, baseDir, depth + 1, maxDepth)
      });
    } else if (item.isFile() && !item.name.endsWith('.md')) {
      files.push({
        type: 'file',
        name: item.name,
        path: relativePath,
        size: fs.statSync(fullPath).size
      });
      
      // Contar por tipo
      if (relativePath.includes('src/api/controllers')) {
        stats.backend.controllers++;
        stats.backend.total++;
      } else if (relativePath.includes('src/api/routes')) {
        stats.backend.routes++;
        stats.backend.total++;
      } else if (relativePath.includes('src/utils')) {
        stats.backend.utils++;
        stats.backend.total++;
      } else if (relativePath.includes('public/scripts/core')) {
        stats.frontend.core++;
        stats.frontend.total++;
      } else if (relativePath.includes('public/scripts/pages')) {
        stats.frontend.pages++;
        stats.frontend.total++;
      } else if (relativePath.includes('public/scripts/utils')) {
        stats.frontend.utils++;
        stats.frontend.total++;
      } else if (relativePath.includes('scripts/') && item.name.endsWith('.js')) {
        stats.scripts++;
      }
      
      stats.total++;
    }
  }
  
  return files;
}

/**
 * Formatar tamanho de arquivo
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Gerar relatório
 */
function generateReport(files, output = []) {
  for (const item of files) {
    if (item.type === 'directory') {
      output.push(`📂 ${item.path}/`);
      generateReport(item.children, output);
    } else {
      const size = formatSize(item.size);
      output.push(`   📄 ${item.name} (${size})`);
    }
  }
  return output;
}

/**
 * Função principal
 */
async function main() {
  console.log('🗺️  Mapeando Sistema Completo...\n');
  console.log('='.repeat(70));
  
  // Mapear estrutura
  const srcDir = path.join(projectRoot, 'src');
  const publicDir = path.join(projectRoot, 'public');
  const scriptsDir = path.join(projectRoot, 'scripts');
  
  const structure = {
    backend: fs.existsSync(srcDir) ? listFiles(srcDir, projectRoot) : [],
    frontend: fs.existsSync(publicDir) ? listFiles(publicDir, projectRoot) : [],
    scripts: fs.existsSync(scriptsDir) ? listFiles(scriptsDir, projectRoot) : []
  };
  
  // Gerar relatório
  console.log('\n📊 ESTRUTURA DO SISTEMA\n');
  console.log('='.repeat(70));
  
  console.log('\n🔧 BACKEND (src/):');
  console.log('-'.repeat(70));
  if (structure.backend.length > 0) {
    const backendReport = generateReport(structure.backend);
    console.log(backendReport.slice(0, 50).join('\n'));
    if (backendReport.length > 50) {
      console.log(`\n... e mais ${backendReport.length - 50} arquivos`);
    }
  }
  
  console.log('\n🎨 FRONTEND (public/):');
  console.log('-'.repeat(70));
  if (structure.frontend.length > 0) {
    const frontendReport = generateReport(structure.frontend);
    console.log(frontendReport.slice(0, 50).join('\n'));
    if (frontendReport.length > 50) {
      console.log(`\n... e mais ${frontendReport.length - 50} arquivos`);
    }
  }
  
  console.log('\n🔧 SCRIPTS (scripts/):');
  console.log('-'.repeat(70));
  if (structure.scripts.length > 0) {
    const scriptsReport = generateReport(structure.scripts);
    console.log(scriptsReport.join('\n'));
  }
  
  // Estatísticas
  console.log('\n' + '='.repeat(70));
  console.log('📊 ESTATÍSTICAS\n');
  console.log('Backend:');
  console.log(`   Controllers: ${stats.backend.controllers}`);
  console.log(`   Routes: ${stats.backend.routes}`);
  console.log(`   Utils: ${stats.backend.utils}`);
  console.log(`   Total Backend: ${stats.backend.total}`);
  console.log('\nFrontend:');
  console.log(`   Core: ${stats.frontend.core}`);
  console.log(`   Pages: ${stats.frontend.pages}`);
  console.log(`   Utils: ${stats.frontend.utils}`);
  console.log(`   Total Frontend: ${stats.frontend.total}`);
  console.log(`\nScripts: ${stats.scripts}`);
  console.log(`\nTotal de Arquivos: ${stats.total}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Mapeamento concluído!\n');
  
  // Salvar em arquivo
  const reportPath = path.join(projectRoot, 'ESTRUTURA_SISTEMA.txt');
  const fullReport = [
    '🗺️ MAPEAMENTO COMPLETO DO SISTEMA',
    '='.repeat(70),
    '',
    '📊 ESTATÍSTICAS',
    '',
    `Backend:`,
    `   Controllers: ${stats.backend.controllers}`,
    `   Routes: ${stats.backend.routes}`,
    `   Utils: ${stats.backend.utils}`,
    `   Total: ${stats.backend.total}`,
    '',
    `Frontend:`,
    `   Core: ${stats.frontend.core}`,
    `   Pages: ${stats.frontend.pages}`,
    `   Utils: ${stats.frontend.utils}`,
    `   Total: ${stats.frontend.total}`,
    '',
    `Scripts: ${stats.scripts}`,
    `Total Geral: ${stats.total}`,
    '',
    '='.repeat(70),
    '',
    '📁 ESTRUTURA COMPLETA',
    '',
    ...generateReport([...structure.backend, ...structure.frontend, ...structure.scripts])
  ].join('\n');
  
  fs.writeFileSync(reportPath, fullReport, 'utf-8');
  console.log(`📄 Relatório salvo em: ${reportPath}\n`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });

