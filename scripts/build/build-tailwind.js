/**
 * Script para compilar Tailwind CSS usando PostCSS
 * 
 * Solução definitiva e escalável para produção
 * 
 * Uso: node scripts/build/build-tailwind.js
 * OU: npm run build:css
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const inputFile = path.join(projectRoot, 'public/styles/tailwind.css');
const outputFile = path.join(projectRoot, 'public/styles/tailwind.min.css');
const postcssConfig = path.join(projectRoot, 'postcss.config.js');

console.log('🔨 Compilando Tailwind CSS com PostCSS...\n');

try {
  // Verificar se o arquivo de entrada existe
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Arquivo de entrada não encontrado: ${inputFile}`);
    process.exit(1);
  }

  // Verificar se PostCSS config existe
  if (!fs.existsSync(postcssConfig)) {
    console.error(`❌ Arquivo de configuração PostCSS não encontrado: ${postcssConfig}`);
    process.exit(1);
  }

  // Método 1: Usar PostCSS CLI (método oficial e mais confiável)
  console.log('📦 Compilando CSS com PostCSS CLI...');
  
  try {
    const postcssCommand = `npx postcss "${inputFile}" -o "${outputFile}" --config "${postcssConfig}"`;
    
    execSync(postcssCommand, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });

    // Verificar se o arquivo foi gerado
    if (fs.existsSync(outputFile)) {
      const stats = fs.statSync(outputFile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log('\n✅ Tailwind CSS compilado com sucesso!');
      console.log(`   Arquivo gerado: ${outputFile}`);
      console.log(`   Tamanho: ${sizeKB} KB\n`);
      process.exit(0);
    } else {
      throw new Error('Arquivo de saída não foi gerado');
    }
  } catch (cliError) {
    console.warn('\n⚠️  PostCSS CLI falhou, tentando método programático...');
    console.warn(`   Erro: ${cliError.message}\n`);
    
    // Método 2: Usar PostCSS programático (fallback robusto)
    try {
      const postcss = (await import('postcss')).default;
      const tailwindcss = (await import('@tailwindcss/postcss')).default;
      const autoprefixer = (await import('autoprefixer')).default;
      
      // Tentar importar cssnano, mas não falhar se não estiver instalado
      let cssnano;
      try {
        cssnano = (await import('cssnano')).default;
      } catch (e) {
        console.warn('⚠️  cssnano não encontrado, compilando sem minificação...');
      }
      
      const css = fs.readFileSync(inputFile, 'utf8');
      
      const plugins = [
        tailwindcss,
        autoprefixer
      ];
      
      if (cssnano) {
        plugins.push(cssnano({ preset: 'default' }));
      }
      
      const result = await postcss(plugins).process(css, {
        from: inputFile,
        to: outputFile
      });
      
      fs.writeFileSync(outputFile, result.css);
      
      const stats = fs.statSync(outputFile);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log('\n✅ Tailwind CSS compilado com sucesso (método programático)!');
      console.log(`   Arquivo gerado: ${outputFile}`);
      console.log(`   Tamanho: ${sizeKB} KB`);
      if (!cssnano) {
        console.log('   ⚠️  Compilado sem minificação (instale cssnano para minificar)');
      }
      console.log('');
      process.exit(0);
    } catch (progError) {
      console.error('\n❌ Método programático também falhou:', progError.message);
      throw progError;
    }
  }
  
} catch (error) {
  console.error('\n❌ Erro ao compilar Tailwind CSS:', error.message);
  console.error('\n💡 Soluções:');
  console.error('   1. Instale as dependências: npm install');
  console.error('   2. Verifique se postcss-cli está instalado: npm install --save-dev postcss-cli cssnano');
  console.error('   3. Verifique se postcss.config.js existe e está correto\n');
  process.exit(1);
}
