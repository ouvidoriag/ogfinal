/**
 * Script para Verificar Execução do Scheduler às 10h
 * 
 * Verifica se o scheduler de atualização de dados do Google Sheets
 * executou hoje às 10h da manhã.
 * 
 * Uso: node scripts/maintenance/verificarScheduler10h.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';

/**
 * Verificar última atualização de registros
 */
async function verificarUltimaAtualizacao() {
  try {
    // Buscar o registro mais recente atualizado hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Buscar registros atualizados hoje
    const registrosHoje = await Record.find({
      updatedAt: { $gte: hoje }
    })
    .sort({ updatedAt: -1 })
    .limit(10)
    .select('protocolo updatedAt createdAt')
    .lean();
    
    // Buscar o registro mais recente (independente da data)
    const ultimoRegistro = await Record.findOne()
      .sort({ updatedAt: -1 })
      .select('protocolo updatedAt createdAt')
      .lean();
    
    // Contar total de registros
    const totalRegistros = await Record.countDocuments();
    
    // Contar registros atualizados hoje
    const totalHoje = await Record.countDocuments({
      updatedAt: { $gte: hoje }
    });
    
    return {
      totalRegistros,
      totalAtualizadosHoje: totalHoje,
      ultimoRegistro: ultimoRegistro ? {
        protocolo: ultimoRegistro.protocolo,
        atualizadoEm: ultimoRegistro.updatedAt,
        criadoEm: ultimoRegistro.createdAt
      } : null,
      registrosRecentesHoje: registrosHoje.map(r => ({
        protocolo: r.protocolo,
        atualizadoEm: r.updatedAt
      }))
    };
  } catch (error) {
    console.error('❌ Erro ao verificar atualizações:', error);
    throw error;
  }
}

/**
 * Verificar status do scheduler
 */
async function verificarStatusScheduler() {
  try {
    // Importar dinamicamente o scheduler
    const { getStatusSchedulerAtualizacao } = await import('../../src/services/data-sync/scheduler.js');
    const status = getStatusSchedulerAtualizacao();
    
    return status;
  } catch (error) {
    console.error('❌ Erro ao verificar status do scheduler:', error);
    return { erro: error.message };
  }
}

/**
 * Verificar se precisa executar catch-up
 */
async function verificarCatchUp() {
  try {
    const { getStatusSchedulerAtualizacao } = await import('../../src/services/data-sync/scheduler.js');
    const status = getStatusSchedulerAtualizacao();
    
    if (status.precisaCatchUp) {
      console.log('\n⚠️ ATENÇÃO: Execução perdida detectada!');
      console.log('   O servidor estava desligado às 10h e não executou.');
      console.log('   O scheduler executará automaticamente na próxima inicialização.');
      console.log('   Ou você pode executar manualmente via API: POST /api/data-sync/execute');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Erro ao verificar catch-up:', error);
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🔍 Verificando execução do scheduler às 10h...\n');
  
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Verificar status do scheduler
    console.log('📊 Status do Scheduler:');
    const statusScheduler = await verificarStatusScheduler();
    
    console.log(`   Ativo: ${statusScheduler.ativo ? '✅ Sim' : '❌ Não'}`);
    console.log(`   Próxima execução: ${statusScheduler.proximaExecucao}`);
    console.log(`   Já executou hoje: ${statusScheduler.jaExecutouHoje ? '✅ Sim' : '❌ Não'}`);
    
    if (statusScheduler.ultimaExecucao) {
      console.log(`   Última execução: ${statusScheduler.ultimaExecucao.dataFormatada}`);
    } else {
      console.log('   Última execução: Nenhuma registrada');
    }
    
    if (statusScheduler.precisaCatchUp) {
      console.log('\n⚠️ ATENÇÃO: Execução perdida detectada!');
      console.log('   O servidor estava desligado às 10h e não executou.');
      console.log('   O scheduler executará automaticamente na próxima inicialização do servidor.');
      console.log('   Ou execute manualmente: POST /api/data-sync/execute\n');
    } else if (!statusScheduler.ativo) {
      console.log('\n⚠️ ATENÇÃO: O scheduler está INATIVO!');
      console.log('   Isso pode significar que:');
      console.log('   1. O servidor não está rodando');
      console.log('   2. O scheduler não foi iniciado');
      console.log('\n   Para verificar se o servidor está rodando, execute:');
      console.log('   node scripts/server/status.sh (Linux/Mac)');
      console.log('   ou verifique manualmente se o processo Node.js está ativo\n');
    } else {
      console.log('\n✅ Scheduler está ATIVO e agendado para executar às 10h\n');
    }
    
    // Verificar última atualização
    console.log('📅 Verificando última atualização de registros...');
    const atualizacoes = await verificarUltimaAtualizacao();
    
    console.log('\n📈 Estatísticas:');
    console.log(`   Total de registros: ${atualizacoes.totalRegistros}`);
    console.log(`   Registros atualizados hoje: ${atualizacoes.totalAtualizadosHoje}`);
    
    if (atualizacoes.ultimoRegistro) {
      const ultimaAtualizacao = new Date(atualizacoes.ultimoRegistro.atualizadoEm);
      const agora = new Date();
      const diffHoras = Math.floor((agora - ultimaAtualizacao) / (1000 * 60 * 60));
      const diffMinutos = Math.floor((agora - ultimaAtualizacao) / (1000 * 60));
      
      console.log(`\n🕐 Última atualização:`);
      console.log(`   Protocolo: ${atualizacoes.ultimoRegistro.protocolo}`);
      console.log(`   Data/Hora: ${ultimaAtualizacao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      console.log(`   Há ${diffHoras}h ${diffMinutos % 60}min`);
      
      // Verificar se executou hoje às 10h
      const hojeCheck = new Date();
      hojeCheck.setHours(0, 0, 0, 0);
      const dezHoras = new Date(hojeCheck);
      dezHoras.setHours(10, 0, 0, 0);
      const agoraCheck = new Date();
      
      if (ultimaAtualizacao >= dezHoras && ultimaAtualizacao < agoraCheck) {
        console.log('\n✅ Scheduler provavelmente executou hoje!');
        console.log(`   Última atualização foi após 10h de hoje`);
      } else if (ultimaAtualizacao < dezHoras) {
        console.log('\n⚠️ Scheduler pode não ter executado hoje às 10h');
        console.log(`   Última atualização foi antes das 10h de hoje`);
      } else {
        console.log('\n⚠️ Última atualização é no futuro (verificar timezone)');
      }
    } else {
      console.log('\n⚠️ Nenhum registro encontrado no banco');
    }
    
    if (atualizacoes.registrosRecentesHoje.length > 0) {
      console.log('\n📋 Últimos registros atualizados hoje:');
      atualizacoes.registrosRecentesHoje.slice(0, 5).forEach((r, idx) => {
        const data = new Date(r.atualizadoEm);
        console.log(`   ${idx + 1}. ${r.protocolo} - ${data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      });
    }
    
    console.log('\n✅ Verificação concluída!');
    
    // Fechar conexão
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    process.exit(1);
  }
}

// Executar
main();

