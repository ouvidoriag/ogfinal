/**
 * Script de Validação de Ambiente de Produção
 * CÉREBRO X-3
 * 
 * Verifica se todas as variáveis de ambiente necessárias para produção estão definidas.
 * Uso: node scripts/deploy/validate-env.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

const REQUIRED_VARS = [
    'MONGODB_ATLAS_URL',
    'GOOGLE_SHEET_ID',
    'GEMINI_API_KEY',
    'EMAIL_REMETENTE',
    'SESSION_SECRET'
];

const OPTIONAL_VARS = [
    'PORT',
    'NODE_ENV',
    'GOOGLE_CREDENTIALS_FILE'
];

console.log('🔍 Iniciando validação de ambiente para produção...\n');

let hasError = false;

// 1. Verificar Variáveis Obrigatórias
console.log('📋 Verificando variáveis de ambiente:');
REQUIRED_VARS.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`❌ ERRO: Variável ${varName} não está definida!`);
        hasError = true;
    } else {
        // Mascarar valores sensíveis
        const value = process.env[varName];
        const masked = value.length > 8 ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` : '****';
        console.log(`✅ ${varName} = ${masked}`);
    }
});

// 2. Verificar Variáveis Opcionais
OPTIONAL_VARS.forEach(varName => {
    if (process.env[varName]) {
        console.log(`ℹ️  ${varName} = ${process.env[varName]}`);
    } else {
        console.log(`⚠️  ${varName} não definida (usando padrão)`);
    }
});

// 3. Verificar Arquivos Críticos
console.log('\n📂 Verificando arquivos críticos:');
const CRITICAL_FILES = [
    'package.json',
    'src/server.js',
    'google-credentials.json'
];

CRITICAL_FILES.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} encontrado`);
    } else {
        if (file === 'google-credentials.json') {
            console.warn(`⚠️  ${file} não encontrado (necessário para produção, mas pode não estar no repo)`);
        } else {
            console.error(`❌ ERRO: Arquivo ${file} não encontrado!`);
            hasError = true;
        }
    }
});

console.log('\nResultados:');
if (hasError) {
    console.error('❌ Validação falhou! Corrija os erros acima antes de fazer deploy.');
    process.exit(1);
} else {
    console.log('✅ Ambiente parece configurado corretamente para produção!');
    process.exit(0);
}
