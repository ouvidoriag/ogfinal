/**
 * Script para listar todas as informações do banco de dados
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
  errorFormat: 'pretty',
});

async function getDatabaseInfo() {
  try {
    console.log('🔍 Conectando ao banco de dados...\n');
    await prisma.$connect();
    console.log('✅ Conectado com sucesso!\n');
    console.log('='.repeat(80));
    console.log('📊 INFORMAÇÕES DO BANCO DE DADOS');
    console.log('='.repeat(80));
    console.log();

    // ==========================================
    // MODELO: Record (Registros da Ouvidoria)
    // ==========================================
    console.log('📋 MODELO: Record (Registros da Ouvidoria)');
    console.log('-'.repeat(80));
    
    const totalRecords = await prisma.record.count();
    console.log(`Total de registros: ${totalRecords.toLocaleString('pt-BR')}`);
    
    if (totalRecords > 0) {
      // Estatísticas por campos principais
      console.log('\n📈 Estatísticas por Campo:');
      
      // Por Status
      const byStatus = await prisma.record.groupBy({
        by: ['status'],
        _count: { id: true }
      });
      const sortedStatus = byStatus.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Status:');
      sortedStatus.forEach(s => {
        console.log(`    - ${s.status || 'Não informado'}: ${s._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Tema
      const byTema = await prisma.record.groupBy({
        by: ['tema'],
        _count: { id: true }
      });
      const sortedTema = byTema.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Tema (Top 10):');
      sortedTema.forEach(t => {
        console.log(`    - ${t.tema || 'Não informado'}: ${t._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Tipo de Manifestação
      const byTipo = await prisma.record.groupBy({
        by: ['tipoDeManifestacao'],
        _count: { id: true }
      });
      const sortedTipo = byTipo.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Tipo de Manifestação (Top 10):');
      sortedTipo.forEach(t => {
        console.log(`    - ${t.tipoDeManifestacao || 'Não informado'}: ${t._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Órgão
      const byOrgaos = await prisma.record.groupBy({
        by: ['orgaos'],
        _count: { id: true }
      });
      const sortedOrgaos = byOrgaos.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Órgãos (Top 10):');
      sortedOrgaos.forEach(o => {
        console.log(`    - ${o.orgaos || 'Não informado'}: ${o._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Prioridade
      const byPrioridade = await prisma.record.groupBy({
        by: ['prioridade'],
        _count: { id: true }
      });
      const sortedPrioridade = byPrioridade.sort((a, b) => b._count.id - a._count.id);
      console.log('\n  Prioridade:');
      sortedPrioridade.forEach(p => {
        console.log(`    - ${p.prioridade || 'Não informado'}: ${p._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Canal
      const byCanal = await prisma.record.groupBy({
        by: ['canal'],
        _count: { id: true }
      });
      const sortedCanal = byCanal.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Canal (Top 10):');
      sortedCanal.forEach(c => {
        console.log(`    - ${c.canal || 'Não informado'}: ${c._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Unidade de Cadastro
      const byUnidadeCadastro = await prisma.record.groupBy({
        by: ['unidadeCadastro'],
        _count: { id: true }
      });
      const sortedUnidadeCadastro = byUnidadeCadastro.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Unidade de Cadastro (Top 10):');
      sortedUnidadeCadastro.forEach(u => {
        console.log(`    - ${u.unidadeCadastro || 'Não informado'}: ${u._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Por Servidor
      const byServidor = await prisma.record.groupBy({
        by: ['servidor'],
        _count: { id: true }
      });
      const sortedServidor = byServidor.sort((a, b) => b._count.id - a._count.id).slice(0, 10);
      console.log('\n  Servidor (Top 10):');
      sortedServidor.forEach(s => {
        console.log(`    - ${s.servidor || 'Não informado'}: ${s._count.id.toLocaleString('pt-BR')}`);
      });
      
      // Estatísticas de datas
      console.log('\n📅 Estatísticas de Datas:');
      const recordsWithDate = await prisma.record.findMany({
        where: {
          dataCriacaoIso: { not: null }
        },
        select: { dataCriacaoIso: true },
        take: 1
      });
      
      if (recordsWithDate.length > 0) {
        const firstDate = await prisma.record.findFirst({
          where: { dataCriacaoIso: { not: null } },
          orderBy: { dataCriacaoIso: 'asc' },
          select: { dataCriacaoIso: true }
        });
        const lastDate = await prisma.record.findFirst({
          where: { dataCriacaoIso: { not: null } },
          orderBy: { dataCriacaoIso: 'desc' },
          select: { dataCriacaoIso: true }
        });
        console.log(`    Primeira data: ${firstDate?.dataCriacaoIso || 'N/A'}`);
        console.log(`    Última data: ${lastDate?.dataCriacaoIso || 'N/A'}`);
      }
      
      // Exemplo de registro
      console.log('\n📄 Exemplo de Registro:');
      const exampleRecord = await prisma.record.findFirst({
        select: {
          id: true,
          protocolo: true,
          dataDaCriacao: true,
          statusDemanda: true,
          tema: true,
          tipoDeManifestacao: true,
          orgaos: true,
          prioridade: true,
          canal: true,
          createdAt: true
        }
      });
      if (exampleRecord) {
        console.log('    Campos disponíveis:');
        Object.keys(exampleRecord).forEach(key => {
          console.log(`      - ${key}: ${exampleRecord[key] || 'N/A'}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    // ==========================================
    // MODELO: ChatMessage (Mensagens do Chat)
    // ==========================================
    console.log('\n💬 MODELO: ChatMessage (Mensagens do Chat)');
    console.log('-'.repeat(80));
    
    const totalMessages = await prisma.chatMessage.count();
    console.log(`Total de mensagens: ${totalMessages.toLocaleString('pt-BR')}`);
    
    if (totalMessages > 0) {
      const bySender = await prisma.chatMessage.groupBy({
        by: ['sender'],
        _count: { id: true }
      });
      console.log('\n  Por Remetente:');
      bySender.forEach(s => {
        console.log(`    - ${s.sender}: ${s._count.id.toLocaleString('pt-BR')}`);
      });
      
      const firstMessage = await prisma.chatMessage.findFirst({
        orderBy: { createdAt: 'asc' }
      });
      const lastMessage = await prisma.chatMessage.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      console.log(`\n  Primeira mensagem: ${firstMessage?.createdAt.toISOString() || 'N/A'}`);
      console.log(`  Última mensagem: ${lastMessage?.createdAt.toISOString() || 'N/A'}`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    // ==========================================
    // MODELO: AggregationCache (Cache de Agregações)
    // ==========================================
    console.log('\n💾 MODELO: AggregationCache (Cache de Agregações)');
    console.log('-'.repeat(80));
    
    const totalCache = await prisma.aggregationCache.count();
    console.log(`Total de entradas de cache: ${totalCache.toLocaleString('pt-BR')}`);
    
    if (totalCache > 0) {
      const cacheEntries = await prisma.aggregationCache.findMany({
        select: {
          key: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        take: 10
      });
      
      console.log('\n  Últimas 10 entradas de cache:');
      cacheEntries.forEach(c => {
        const isExpired = new Date(c.expiresAt) < new Date();
        console.log(`    - ${c.key} ${isExpired ? '(EXPIRADO)' : '(ATIVO)'}`);
        console.log(`      Criado: ${c.createdAt.toISOString()}`);
        console.log(`      Atualizado: ${c.updatedAt.toISOString()}`);
        console.log(`      Expira: ${c.expiresAt.toISOString()}`);
      });
      
      // Contar expirados vs ativos
      const now = new Date();
      const expired = await prisma.aggregationCache.count({
        where: { expiresAt: { lt: now } }
      });
      const active = totalCache - expired;
      console.log(`\n  Status: ${active} ativos, ${expired} expirados`);
    }
    
    console.log('\n' + '='.repeat(80));
    
    // ==========================================
    // RESUMO GERAL
    // ==========================================
    console.log('\n📊 RESUMO GERAL');
    console.log('-'.repeat(80));
    console.log(`Total de Registros (Record): ${totalRecords.toLocaleString('pt-BR')}`);
    console.log(`Total de Mensagens (ChatMessage): ${totalMessages.toLocaleString('pt-BR')}`);
    console.log(`Total de Cache (AggregationCache): ${totalCache.toLocaleString('pt-BR')}`);
    console.log(`Total Geral: ${(totalRecords + totalMessages + totalCache).toLocaleString('pt-BR')}`);
    
    console.log('\n✅ Consulta concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao consultar banco de dados:', error);
    if (error.code === 'P2010' || error.message?.includes('Server selection timeout')) {
      console.error('\n💡 Dica: Verifique se a variável DATABASE_URL está configurada corretamente no arquivo .env');
    }
  } finally {
    await prisma.$disconnect();
    console.log('\n🔌 Desconectado do banco de dados.');
  }
}

// Executar
getDatabaseInfo();

