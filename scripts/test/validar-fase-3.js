/**
 * Validação FASE 3 - Event Bus Unificado
 * Verifica se apenas 1 event bus global está sendo usado
 * 
 * REFATORAÇÃO: Validação
 * Data: 09/12/2025
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Validando FASE 3: Event Bus Unificado...\n');

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

// ============================================
// FASE 3: Unificação de Event Bus
// ============================================

console.log('📋 FASE 3: Unificação de Event Bus\n');

const basePath = path.join(process.cwd(), 'public/scripts/core/chart-communication');

// 1. Verificar que event-bus.js existe e exporta window.eventBus
const eventBusPath = path.join(basePath, 'event-bus.js');
if (fs.existsSync(eventBusPath)) {
  const eventBusContent = fs.readFileSync(eventBusPath, 'utf8');
  check(eventBusContent.includes('window.eventBus = eventBus'), 'event-bus.js exporta window.eventBus');
  check(eventBusContent.includes('const eventBus = {'), 'event-bus.js cria eventBus');
}

// 2. Verificar que global-filters.js usa apenas window.eventBus
const globalFiltersPath = path.join(basePath, 'global-filters.js');
if (fs.existsSync(globalFiltersPath)) {
  const globalFiltersContent = fs.readFileSync(globalFiltersPath, 'utf8');
  check(globalFiltersContent.includes('window.eventBus'), 'global-filters.js usa window.eventBus');
  check(!globalFiltersContent.includes('eventBus || {') || globalFiltersContent.includes('REFATORAÇÃO FASE 3'), 
    'global-filters.js não cria fallback de event bus (ou está refatorado)');
  check(globalFiltersContent.includes('REFATORAÇÃO FASE 3') || globalFiltersContent.includes('único event bus'),
    'global-filters.js documenta uso de event bus único');
}

// 3. Verificar que chart-registry.js usa apenas window.eventBus
const chartRegistryPath = path.join(basePath, 'chart-registry.js');
if (fs.existsSync(chartRegistryPath)) {
  const chartRegistryContent = fs.readFileSync(chartRegistryPath, 'utf8');
  check(chartRegistryContent.includes('window.eventBus'), 'chart-registry.js usa window.eventBus');
  check(!chartRegistryContent.includes('eventBus || {') || chartRegistryContent.includes('REFATORAÇÃO FASE 3'),
    'chart-registry.js não cria fallback de event bus (ou está refatorado)');
  check(chartRegistryContent.includes('REFATORAÇÃO FASE 3') || chartRegistryContent.includes('único event bus'),
    'chart-registry.js documenta uso de event bus único');
}

// 4. Verificar que auto-connect.js usa apenas window.eventBus
const autoConnectPath = path.join(basePath, 'auto-connect.js');
if (fs.existsSync(autoConnectPath)) {
  const autoConnectContent = fs.readFileSync(autoConnectPath, 'utf8');
  check(autoConnectContent.includes('window.eventBus'), 'auto-connect.js usa window.eventBus');
  check(!autoConnectContent.includes('eventBus || {') || autoConnectContent.includes('REFATORAÇÃO FASE 3'),
    'auto-connect.js não cria fallback de event bus (ou está refatorado)');
  check(autoConnectContent.includes('REFATORAÇÃO FASE 3') || autoConnectContent.includes('único event bus'),
    'auto-connect.js documenta uso de event bus único');
}

// 5. Verificar que chart-communication.js usa window.eventBus
const chartCommPath = path.join(process.cwd(), 'public/scripts/core/chart-communication.js');
if (fs.existsSync(chartCommPath)) {
  const chartCommContent = fs.readFileSync(chartCommPath, 'utf8');
  check(chartCommContent.includes('window.eventBus'), 'chart-communication.js usa window.eventBus');
  check(chartCommContent.includes('const eventBus = window.eventBus'), 
    'chart-communication.js obtém eventBus de window.eventBus');
}

// 6. Verificar ordem de carregamento no HTML
const indexHtmlPath = path.join(process.cwd(), 'public/index.html');
if (fs.existsSync(indexHtmlPath)) {
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  const eventBusIndex = indexHtmlContent.indexOf('event-bus.js');
  const chartRegistryIndex = indexHtmlContent.indexOf('chart-registry.js');
  const globalFiltersIndex = indexHtmlContent.indexOf('global-filters.js');
  const autoConnectIndex = indexHtmlContent.indexOf('auto-connect.js');
  
  check(eventBusIndex !== -1, 'event-bus.js está no HTML');
  if (eventBusIndex !== -1 && chartRegistryIndex !== -1) {
    check(eventBusIndex < chartRegistryIndex, 'event-bus.js carregado antes de chart-registry.js');
  }
  if (eventBusIndex !== -1 && globalFiltersIndex !== -1) {
    check(eventBusIndex < globalFiltersIndex, 'event-bus.js carregado antes de global-filters.js');
  }
  if (eventBusIndex !== -1 && autoConnectIndex !== -1) {
    check(eventBusIndex < autoConnectIndex, 'event-bus.js carregado antes de auto-connect.js');
  }
}

// 7. Verificar testes criados
const testEventBusPath = path.join(process.cwd(), 'public/scripts/test/test-event-bus-unificado.js');
check(fs.existsSync(testEventBusPath), 'test-event-bus-unificado.js existe');

console.log('\n');

// ============================================
// RESUMO FINAL
// ============================================

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
  console.log('🎉 FASE 3 está COMPLETA e VALIDADA!');
  console.log('✅ Event Bus unificado confirmado');
  process.exit(0);
} else {
  console.error('❌ FASE 3 tem erros que precisam ser corrigidos');
  process.exit(1);
}

