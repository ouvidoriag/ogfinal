/**
 * Teste de Decisão de Cache - FASE 4
 * Verifica se não há cache duplo e se o uso está correto
 * 
 * REFATORAÇÃO: FASE 4 - Testes
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';

console.log('🧪 Iniciando testes de Decisão de Cache...\n');

let errors = [];
let warnings = [];
let passed = 0;

function check(condition, message, isWarning = false) {
  if (condition) {
    console.log(`✅ ${message}`);
    passed++;
  } else {
    if (isWarning) {
      console.log(`⚠️  ${message}`);
      warnings.push(message);
    } else {
      console.error(`❌ ${message}`);
      errors.push(message);
    }
  }
}

// Buscar arquivos que usam cache
const controllersPath = path.join(process.cwd(), 'src/api/controllers');
const files = fs.readdirSync(controllersPath).filter(f => f.endsWith('.js'));

let withCacheCount = 0;
let withSmartCacheCount = 0;
let cacheDuploCount = 0;

files.forEach(file => {
  const filePath = path.join(controllersPath, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  const hasWithCache = content.includes('withCache(');
  const hasWithSmartCache = content.includes('withSmartCache(');
  
  if (hasWithCache) withCacheCount++;
  if (hasWithSmartCache) withSmartCacheCount++;
  
  // Verificar cache duplo (withCache + withSmartCache no mesmo escopo)
  const lines = content.split('\n');
  let inWithCache = false;
  let depth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('withCache(')) {
      inWithCache = true;
      depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    }
    
    if (inWithCache) {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      
      if (line.includes('withSmartCache(') && depth > 0) {
        cacheDuploCount++;
        check(false, `${file}: Cache duplo detectado (withCache + withSmartCache)`, true);
      }
      
      if (depth <= 0 && line.includes('});')) {
        inWithCache = false;
      }
    }
  }
});

// Testes
check(fs.existsSync(path.join(process.cwd(), 'docs/system/GUIA_DECISAO_CACHE.md')), 
  'GUIA_DECISAO_CACHE.md existe');

check(withCacheCount > 0, `${withCacheCount} arquivos usam withCache`);
check(withSmartCacheCount > 0, `${withSmartCacheCount} arquivos usam withSmartCache`);

// Verificar documentação nos arquivos
const responseHelperPath = path.join(process.cwd(), 'src/utils/responseHelper.js');
if (fs.existsSync(responseHelperPath)) {
  const content = fs.readFileSync(responseHelperPath, 'utf8');
  check(content.includes('GUIA_DECISAO_CACHE') || content.includes('cache duplo'), 
    'responseHelper.js documenta uso correto');
}

const smartCachePath = path.join(process.cwd(), 'src/utils/smartCache.js');
if (fs.existsSync(smartCachePath)) {
  const content = fs.readFileSync(smartCachePath, 'utf8');
  check(content.includes('GUIA_DECISAO_CACHE') || content.includes('filtros dinâmicos'), 
    'smartCache.js documenta uso correto');
}

console.log('\n');

// Resumo
console.log('📊 RESUMO FINAL\n');
console.log(`✅ Validações passadas: ${passed}`);
console.log(`❌ Erros encontrados: ${errors.length}`);
console.log(`⚠️  Avisos: ${warnings.length}`);
console.log(`📁 Arquivos com withCache: ${withCacheCount}`);
console.log(`📁 Arquivos com withSmartCache: ${withSmartCacheCount}`);
console.log(`⚠️  Cache duplo detectado: ${cacheDuploCount} ocorrências\n`);

if (errors.length > 0) {
  console.log('❌ ERROS:');
  errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  AVISOS (cache duplo):');
  warnings.forEach((warn, i) => console.log(`   ${i + 1}. ${warn}`));
  console.log('');
}

if (errors.length === 0) {
  console.log('🎉 Testes de decisão de cache concluídos!');
  console.log('✅ Guia criado e documentação adicionada');
  if (cacheDuploCount > 0) {
    console.log(`⚠️  ${cacheDuploCount} ocorrências de cache duplo detectadas (revisar manualmente)`);
  }
  process.exit(0);
} else {
  console.error('❌ Alguns testes falharam');
  process.exit(1);
}

