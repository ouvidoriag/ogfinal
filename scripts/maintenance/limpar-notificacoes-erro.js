/**
 * Script para limpar notificações de email com status 'erro' do banco de dados
 * 
 * Este script remove permanentemente todos os registros de notificações
 * que possuem status = 'erro' da coleção notificacoes_email.
 * 
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * 
 * Uso: node NOVO/scripts/maintenance/limpar-notificacoes-erro.js --confirm
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase, closeDatabase } from '../../src/config/database.js';
import NotificacaoEmail from '../../src/models/NotificacaoEmail.model.js';

async function limparNotificacoesErro() {
  try {
    console.log('🔍 Conectando ao banco de dados...\n');
    
    const connectionString = process.env.DATABASE_URL || process.env.MONGODB_ATLAS_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL ou MONGODB_ATLAS_URL não encontrada no .env');
    }
    
    const connected = await initializeDatabase(connectionString);
    if (!connected) {
      throw new Error('Falha ao conectar ao banco de dados');
    }
    
    console.log('✅ Conectado com sucesso!\n');
    console.log('='.repeat(80));
    console.log('🧹 LIMPEZA DE NOTIFICAÇÕES COM ERRO');
    console.log('='.repeat(80));
    console.log();

    // Contar notificações com erro antes da limpeza
    const totalErros = await NotificacaoEmail.countDocuments({ status: 'erro' });

    console.log(`📊 Total de notificações com erro encontradas: ${totalErros.toLocaleString('pt-BR')}`);
    
    if (totalErros === 0) {
      console.log('\n✅ Nenhuma notificação com erro encontrada. Nada a fazer.');
      return;
    }

    // Estatísticas detalhadas antes da limpeza
    console.log('\n📈 Estatísticas antes da limpeza:');
    console.log('-'.repeat(80));
    
    // Agrupar por tipo de notificação
    const porTipo = await NotificacaoEmail.aggregate([
      { $match: { status: 'erro' } },
      { $group: { _id: '$tipoNotificacao', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n  Por Tipo de Notificação:');
    porTipo.forEach(t => {
      console.log(`    - ${t._id}: ${t.count.toLocaleString('pt-BR')}`);
    });

    // Agrupar por secretaria (Top 10)
    const porSecretaria = await NotificacaoEmail.aggregate([
      { $match: { status: 'erro' } },
      { $group: { _id: '$secretaria', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    console.log('\n  Por Secretaria (Top 10):');
    porSecretaria.forEach(s => {
      console.log(`    - ${s._id}: ${s.count.toLocaleString('pt-BR')}`);
    });

    // Data mais antiga e mais recente
    const maisAntiga = await NotificacaoEmail.findOne({ status: 'erro' })
      .sort({ enviadoEm: 1 })
      .select('enviadoEm')
      .lean();

    const maisRecente = await NotificacaoEmail.findOne({ status: 'erro' })
      .sort({ enviadoEm: -1 })
      .select('enviadoEm')
      .lean();

    if (maisAntiga && maisRecente) {
      const dataAntiga = new Date(maisAntiga.enviadoEm).toLocaleString('pt-BR');
      const dataRecente = new Date(maisRecente.enviadoEm).toLocaleString('pt-BR');
      console.log(`\n  Data mais antiga: ${dataAntiga}`);
      console.log(`  Data mais recente: ${dataRecente}`);
    }

    // Confirmar antes de deletar
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  ATENÇÃO: Esta operação é IRREVERSÍVEL!');
    console.log('='.repeat(80));
    console.log(`\nSerão removidos ${totalErros.toLocaleString('pt-BR')} registro(s) com status 'erro'.`);
    console.log('\nPara confirmar, execute o script novamente com o parâmetro --confirm');
    console.log('Exemplo: node NOVO/scripts/maintenance/limpar-notificacoes-erro.js --confirm\n');

    // Verificar se foi passado o parâmetro --confirm
    const args = process.argv.slice(2);
    if (!args.includes('--confirm')) {
      console.log('❌ Operação cancelada. Use --confirm para executar a limpeza.');
      return;
    }

    // Executar a limpeza
    console.log('\n🗑️  Iniciando limpeza...');
    console.log('-'.repeat(80));

    const resultado = await NotificacaoEmail.deleteMany({ status: 'erro' });

    console.log(`\n✅ Limpeza concluída com sucesso!`);
    console.log(`   Registros removidos: ${resultado.deletedCount.toLocaleString('pt-BR')}`);

    // Verificar se ainda há registros com erro
    const errosRestantes = await NotificacaoEmail.countDocuments({ status: 'erro' });

    if (errosRestantes > 0) {
      console.log(`\n⚠️  Ainda existem ${errosRestantes.toLocaleString('pt-BR')} registro(s) com erro.`);
    } else {
      console.log(`\n✅ Todos os registros com erro foram removidos.`);
    }

    // Estatísticas finais
    const totalNotificacoes = await NotificacaoEmail.countDocuments();
    const porStatus = await NotificacaoEmail.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n📊 Estatísticas finais:');
    console.log('-'.repeat(80));
    console.log(`Total de notificações: ${totalNotificacoes.toLocaleString('pt-BR')}`);
    console.log('\n  Por Status:');
    porStatus.forEach(s => {
      console.log(`    - ${s._id}: ${s.count.toLocaleString('pt-BR')}`);
    });

    console.log('\n✅ Processo concluído com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro ao limpar notificações:', error);
    if (error.message?.includes('Server selection timeout') || error.name === 'MongooseError') {
      console.error('\n💡 Dica: Verifique se a variável DATABASE_URL está configurada corretamente no arquivo .env');
    }
    process.exit(1);
  } finally {
    await closeDatabase();
    console.log('\n🔌 Desconectado do banco de dados.');
  }
}

// Executar
limparNotificacoesErro();

