/**
 * Script de Validação de Unidades de Saúde
 * 
 * Verifica se todas as unidades de saúde têm dados corretos e completos
 * 
 * Uso: node scripts/validateUnidadesSaude.js
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Carregar dados das unidades de saúde
 */
function loadUnidadesSaude() {
  const dataPath = path.join(projectRoot, 'data', 'unidades-saude.json');
  
  if (!fs.existsSync(dataPath)) {
    throw new Error(`❌ Arquivo não encontrado: ${dataPath}`);
  }
  
  const content = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(content);
}

/**
 * Validar uma unidade
 */
function validateUnidade(unidade, index) {
  const errors = [];
  const warnings = [];
  
  // Campos obrigatórios
  if (!unidade.nome || unidade.nome.trim() === '') {
    errors.push('Nome está vazio ou ausente');
  }
  
  if (!unidade.tipo || unidade.tipo.trim() === '') {
    errors.push('Tipo está vazio ou ausente');
  }
  
  if (!unidade.endereco || unidade.endereco.trim() === '') {
    errors.push('Endereço está vazio ou ausente');
  }
  
  if (!unidade.distrito || unidade.distrito.trim() === '') {
    errors.push('Distrito está vazio ou ausente');
  }
  
  if (!unidade.distritoCode || unidade.distritoCode.trim() === '') {
    errors.push('Código do distrito está vazio ou ausente');
  }
  
  if (!unidade.bairro || unidade.bairro.trim() === '') {
    errors.push('Bairro está vazio ou ausente');
  }
  
  // Campos opcionais mas importantes
  if (!unidade.servicos || !Array.isArray(unidade.servicos) || unidade.servicos.length === 0) {
    warnings.push('Nenhum serviço especificado');
  }
  
  if (!unidade.cep || unidade.cep.trim() === '') {
    warnings.push('CEP não informado');
  }
  
  if (!unidade.coordenadas) {
    warnings.push('Coordenadas geográficas não informadas');
  }
  
  // Validações específicas
  const distritoCode = String(unidade.distritoCode).trim();
  if (!['1', '2', '3', '4'].includes(distritoCode)) {
    errors.push(`Código de distrito inválido: ${distritoCode} (deve ser 1, 2, 3 ou 4)`);
  }
  
  // Validar formato do CEP (se informado)
  if (unidade.cep && unidade.cep.trim() !== '') {
    const cep = unidade.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      warnings.push(`CEP com formato inválido: ${unidade.cep}`);
    }
  }
  
  return { errors, warnings };
}

/**
 * Validar estatísticas
 */
function validateEstatisticas(estatisticas, unidades) {
  const errors = [];
  const warnings = [];
  
  // Verificar total
  if (estatisticas.totalUnidades !== unidades.length) {
    errors.push(`Total de unidades incorreto: esperado ${unidades.length}, encontrado ${estatisticas.totalUnidades}`);
  }
  
  // Verificar contagem por distrito
  const contagemPorDistrito = {};
  unidades.forEach(u => {
    const distrito = u.distrito;
    contagemPorDistrito[distrito] = (contagemPorDistrito[distrito] || 0) + 1;
  });
  
  if (JSON.stringify(contagemPorDistrito) !== JSON.stringify(estatisticas.porDistrito)) {
    warnings.push('Contagem por distrito não corresponde aos dados');
    console.log('   Esperado:', contagemPorDistrito);
    console.log('   Encontrado:', estatisticas.porDistrito);
  }
  
  // Verificar contagem por tipo
  const contagemPorTipo = {};
  unidades.forEach(u => {
    const tipo = u.tipo;
    contagemPorTipo[tipo] = (contagemPorTipo[tipo] || 0) + 1;
  });
  
  if (JSON.stringify(contagemPorTipo) !== JSON.stringify(estatisticas.porTipo)) {
    warnings.push('Contagem por tipo não corresponde aos dados');
    console.log('   Esperado:', contagemPorTipo);
    console.log('   Encontrado:', estatisticas.porTipo);
  }
  
  return { errors, warnings };
}

/**
 * Função principal
 */
function main() {
  console.log('🏥 Validando Unidades de Saúde...\n');
  
  try {
    // Carregar dados
    console.log('📂 Carregando arquivo de unidades de saúde...');
    const data = loadUnidadesSaude();
    console.log('✅ Arquivo carregado com sucesso\n');
    
    const unidades = data.unidades || [];
    const estatisticas = data.estatisticas || {};
    
    console.log(`📊 Total de unidades: ${unidades.length}\n`);
    
    if (unidades.length === 0) {
      console.error('❌ Nenhuma unidade encontrada no arquivo!');
      process.exit(1);
    }
    
    // Validar cada unidade
    console.log('🔍 Validando unidades individuais...\n');
    let totalErrors = 0;
    let totalWarnings = 0;
    const unidadesComErros = [];
    const unidadesComAvisos = [];
    
    unidades.forEach((unidade, index) => {
      const { errors, warnings } = validateUnidade(unidade, index);
      
      if (errors.length > 0 || warnings.length > 0) {
        console.log(`\n${index + 1}. ${unidade.nome}`);
        console.log(`   Tipo: ${unidade.tipo}`);
        console.log(`   Distrito: ${unidade.distrito} (${unidade.distritoCode})`);
        
        if (errors.length > 0) {
          console.log(`   ❌ ERROS (${errors.length}):`);
          errors.forEach(error => console.log(`      - ${error}`));
          totalErrors += errors.length;
          unidadesComErros.push({ unidade, errors });
        }
        
        if (warnings.length > 0) {
          console.log(`   ⚠️  AVISOS (${warnings.length}):`);
          warnings.forEach(warning => console.log(`      - ${warning}`));
          totalWarnings += warnings.length;
          unidadesComAvisos.push({ unidade, warnings });
        }
      }
    });
    
    // Validar estatísticas
    console.log('\n📊 Validando estatísticas...\n');
    const { errors: statsErrors, warnings: statsWarnings } = validateEstatisticas(estatisticas, unidades);
    
    if (statsErrors.length > 0) {
      console.log('❌ ERROS nas estatísticas:');
      statsErrors.forEach(error => console.log(`   - ${error}`));
      totalErrors += statsErrors.length;
    }
    
    if (statsWarnings.length > 0) {
      console.log('⚠️  AVISOS nas estatísticas:');
      statsWarnings.forEach(warning => console.log(`   - ${warning}`));
      totalWarnings += statsWarnings.length;
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DA VALIDAÇÃO');
    console.log('='.repeat(60));
    console.log(`Total de unidades: ${unidades.length}`);
    console.log(`Unidades sem problemas: ${unidades.length - unidadesComErros.length - unidadesComAvisos.length}`);
    console.log(`Unidades com erros: ${unidadesComErros.length}`);
    console.log(`Unidades com avisos: ${unidadesComAvisos.length}`);
    console.log(`Total de erros: ${totalErrors}`);
    console.log(`Total de avisos: ${totalWarnings}`);
    console.log('='.repeat(60) + '\n');
    
    // Estatísticas por distrito
    console.log('📊 Distribuição por distrito:');
    const distritos = {};
    unidades.forEach(u => {
      const distrito = u.distrito;
      distritos[distrito] = (distritos[distrito] || 0) + 1;
    });
    Object.entries(distritos).sort().forEach(([distrito, count]) => {
      console.log(`   ${distrito}: ${count} unidades`);
    });
    
    // Estatísticas por tipo
    console.log('\n📊 Distribuição por tipo:');
    const tipos = {};
    unidades.forEach(u => {
      const tipo = u.tipo;
      tipos[tipo] = (tipos[tipo] || 0) + 1;
    });
    Object.entries(tipos).sort().forEach(([tipo, count]) => {
      console.log(`   ${tipo}: ${count} unidades`);
    });
    
    // Verificar unidades sem CEP
    const semCep = unidades.filter(u => !u.cep || u.cep.trim() === '');
    if (semCep.length > 0) {
      console.log(`\n⚠️  Unidades sem CEP (${semCep.length}):`);
      semCep.forEach(u => console.log(`   - ${u.nome}`));
    }
    
    // Verificar unidades sem coordenadas
    const semCoordenadas = unidades.filter(u => !u.coordenadas);
    if (semCoordenadas.length > 0) {
      console.log(`\n⚠️  Unidades sem coordenadas (${semCoordenadas.length}):`);
      semCoordenadas.forEach(u => console.log(`   - ${u.nome}`));
    }
    
    // Resultado final
    if (totalErrors > 0) {
      console.log('\n❌ VALIDAÇÃO FALHOU: Existem erros que precisam ser corrigidos!');
      process.exit(1);
    } else if (totalWarnings > 0) {
      console.log('\n⚠️  VALIDAÇÃO CONCLUÍDA COM AVISOS: Todos os dados estão corretos, mas há informações faltando.');
      process.exit(0);
    } else {
      console.log('\n✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO: Todas as unidades estão corretas!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ Erro durante validação:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar
main();

