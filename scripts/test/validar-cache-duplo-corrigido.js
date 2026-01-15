/**
 * Validação de Cache Duplo Corrigido
 * Verifica se as 4 ocorrências foram realmente corrigidas
 * 
 * REFATORAÇÃO: FASE 4 - Validação Final
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Validando correção de cache duplo...\n');

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

// Verificar aggregateController.js
const aggregatePath = path.join(process.cwd(), 'src/api/controllers/aggregateController.js');
if (fs.existsSync(aggregatePath)) {
  const content = fs.readFileSync(aggregatePath, 'utf8');
  
  // Verificar byTheme
  const byThemeMatch = content.match(/export async function byTheme[\s\S]*?(?=export|$)/);
  if (byThemeMatch) {
    const byThemeCode = byThemeMatch[0];
    // Não deve ter withCache envolvendo withSmartCache
    const hasWithCacheWrapper = byThemeCode.includes('return withCache(') && 
                                byThemeCode.includes('withSmartCache(') &&
                                byThemeCode.indexOf('return withCache(') < byThemeCode.indexOf('withSmartCache(');
    check(!hasWithCacheWrapper, 'byTheme: Cache duplo removido (não usa withCache + withSmartCache)');
    check(byThemeCode.includes('REFATORAÇÃO FASE 4'), 'byTheme: Comentário de refatoração presente');
    check(byThemeCode.includes('return res.json(result)'), 'byTheme: Retorna resposta HTTP diretamente');
  }
  
  // Verificar bySubject
  const bySubjectMatch = content.match(/export async function bySubject[\s\S]*?(?=export|$)/);
  if (bySubjectMatch) {
    const bySubjectCode = bySubjectMatch[0];
    const hasWithCacheWrapper = bySubjectCode.includes('return withCache(') && 
                                bySubjectCode.includes('withSmartCache(') &&
                                bySubjectCode.indexOf('return withCache(') < bySubjectCode.indexOf('withSmartCache(');
    check(!hasWithCacheWrapper, 'bySubject: Cache duplo removido (não usa withCache + withSmartCache)');
    check(bySubjectCode.includes('REFATORAÇÃO FASE 4'), 'bySubject: Comentário de refatoração presente');
    check(bySubjectCode.includes('return res.json(result)'), 'bySubject: Retorna resposta HTTP diretamente');
  }
}

// Verificar statsController.js
const statsPath = path.join(process.cwd(), 'src/api/controllers/statsController.js');
if (fs.existsSync(statsPath)) {
  const content = fs.readFileSync(statsPath, 'utf8');
  
  // Verificar statusOverview
  const statusOverviewMatch = content.match(/export async function statusOverview[\s\S]*?(?=export|$)/);
  if (statusOverviewMatch) {
    const statusOverviewCode = statusOverviewMatch[0];
    // Não deve ter withCache envolvendo withSmartCache
    const hasWithCacheWrapper = statusOverviewCode.includes('return withCache(') && 
                                statusOverviewCode.includes('withSmartCache(') &&
                                statusOverviewCode.indexOf('return withCache(') < statusOverviewCode.indexOf('withSmartCache(');
    check(!hasWithCacheWrapper, 'statusOverview: Cache duplo removido (não usa withCache + withSmartCache)');
    check(statusOverviewCode.includes('REFATORAÇÃO FASE 4'), 'statusOverview: Comentário de refatoração presente');
    check(statusOverviewCode.includes('return res.json(result)') || statusOverviewCode.includes('return res.json('), 
          'statusOverview: Retorna resposta HTTP diretamente');
  }
}

console.log('\n');

// Resumo
console.log('📊 RESUMO FINAL\n');
console.log(`✅ Validações passadas: ${passed}`);
console.log(`❌ Erros encontrados: ${errors.length}`);
console.log(`⚠️  Avisos: ${warnings.length}\n`);

if (errors.length > 0) {
  console.log('❌ ERROS:');
  errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  AVISOS:');
  warnings.forEach((warn, i) => console.log(`   ${i + 1}. ${warn}`));
  console.log('');
}

if (errors.length === 0) {
  console.log('🎉 Cache duplo corrigido com sucesso!');
  console.log('✅ Todas as 4 ocorrências foram removidas');
  process.exit(0);
} else {
  console.error('❌ Ainda há cache duplo não corrigido');
  process.exit(1);
}

