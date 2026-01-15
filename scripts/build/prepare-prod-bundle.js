/**
 * CÉREBRO X-3
 * Script de Preparação de Bundle para Produção (FTP)
 * --------------------------------------------------
 * Este script automatiza o processo de gerar um arquivo .zip pronto para upload via FTP.
 * Passos:
 * 1. Executa o build (Tailwind, TS, etc)
 * 2. Cria uma pasta temporária '_bundle'
 * 3. Copia apenas os arquivos necessários para produção
 * 4. Remove arquivos de desenvolvimento
 * 5. Gera um arquivo 'prod-bundle.zip'
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
// import archiver from 'archiver'; // Removed to avoid dependency

// Configurações
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const BUNDLE_DIR = path.join(ROOT_DIR, 'dist-bundle');
const OUTPUT_ZIP = path.join(ROOT_DIR, 'prod-bundle.zip');

// Lista de arquivos/pastas para incluir
const INCLUDES = [
    'src',
    'public',
    'scripts', // Scripts de runtime podem ser necessários (start, cron)
    'package.json',
    'package-lock.json',
    'README.md'
];

// Lista de padrões para excluir dentro das pastas incluídas
const EXCLUDES = [
    'scripts/test',
    'scripts/build', // Não precisamos do script de build no bundle
    'src/**/*.test.js',
    'src/**/*.spec.js',
    'public/scripts/test',
    'Dockerfile',
    'docker-compose.yml',
    '.env',
    '.env.production',
    '.env.development',
    '.git',
    '.vscode',
    '.cursor',
    '.DS_Store',
    'Thumbs.db'
];

console.log('🏁 [CÉREBRO X-3] Iniciando preparação do bundle de produção...');

// 1. Executar Build
try {
    console.log('🔨 Executando npm run build...');
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (error) {
    console.error('❌ Erro no build. Abortando.');
    process.exit(1);
}

// 2. Limpar/Criar pasta de bundle
if (fs.existsSync(BUNDLE_DIR)) {
    console.log('🧹 Limpando diretório temporário anterior...');
    fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUNDLE_DIR);

// 3. Copiar Arquivos
console.log('📂 Copiando arquivos para o bundle...');

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        // Verificar exclusões simples (pode ser melhorado com glob)
        const relativePath = path.relative(ROOT_DIR, src).replace(/\\/g, '/');

        // Verifica se deve excluir arquivos específicos
        // Exemplo simples de filtro
        if (relativePath.includes('/test/') || relativePath.endsWith('.test.js')) return;

        fs.copyFileSync(src, dest);
    }
}

INCLUDES.forEach(item => {
    const srcPath = path.join(ROOT_DIR, item);
    const destPath = path.join(BUNDLE_DIR, item);

    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
    } else {
        console.warn(`⚠️ Item não encontrado e ignorado: ${item}`);
    }
});

// Adicionar instruções de instalação
const INSTALL_INSTRUCTIONS = `
# Instruções de Instalação (FTP)

1. Faça upload de todo o conteúdo deste zip para a pasta pública do seu servidor.
2. Certifique-se de que o Node.js v18+ está instalado no servidor.
3. Crie um arquivo .env na raiz com as variáveis de produção (ver .env.example se houver, ou documentação).
4. Rode via terminal/SSH na pasta do projeto:
   npm ci --production
5. Inicie o servidor:
   npm start
`;
fs.writeFileSync(path.join(BUNDLE_DIR, 'INSTALL.txt'), INSTALL_INSTRUCTIONS);

console.log('✅ Arquivos copiados.');

// 4. Compactar (ZIP)
// Como não podemos garantir que 'archiver' esteja instalado no ambiente do usuário sem npm install,
// Vamos usar powershell para zipar no Windows, já que o usuário está no Windows.
console.log('📦 Gerando arquivo ZIP...');

try {
    // Remover zip antigo se existir
    if (fs.existsSync(OUTPUT_ZIP)) {
        fs.unlinkSync(OUTPUT_ZIP);
    }

    // Comando Powershell para zipar
    const psCommand = `Compress-Archive -Path "${BUNDLE_DIR}\\*" -DestinationPath "${OUTPUT_ZIP}"`;
    execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });

    console.log(`🎉 Sucesso! Bundle gerado em: ${OUTPUT_ZIP}`);
    console.log('🧹 Limpando diretório temporário...');
    fs.rmSync(BUNDLE_DIR, { recursive: true, force: true });

} catch (error) {
    console.error('❌ Erro ao zipar via PowerShell:', error.message);
    console.log('⚠️ Os arquivos do bundle permanecem em:', BUNDLE_DIR);
}
