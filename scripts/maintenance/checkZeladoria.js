/**
 * Script para verificar dados de Zeladoria no banco
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error'],
});

async function checkZeladoria() {
  try {
    console.log('🔍 Verificando dados de Zeladoria no banco...\n');
    
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Contar total de registros
    const total = await prisma.zeladoria.count();
    console.log(`📊 Total de registros: ${total.toLocaleString('pt-BR')}\n`);
    
    if (total === 0) {
      console.log('⚠️  NENHUM REGISTRO ENCONTRADO!');
      console.log('💡 Execute: npm run import:zeladoria para importar os dados\n');
      return;
    }
    
    // Estatísticas por status
    const statusCount = await prisma.zeladoria.groupBy({
      by: ['status'],
      _count: true
    });
    
    console.log('📊 Por Status:');
    statusCount.sort((a, b) => b._count - a._count).forEach(s => {
      console.log(`   ${s.status || 'Não informado'}: ${s._count.toLocaleString('pt-BR')}`);
    });
    console.log('');
    
    // Estatísticas por categoria
    const categoriaCount = await prisma.zeladoria.groupBy({
      by: ['categoria'],
      _count: true,
      take: 10
    });
    
    console.log('📂 Top 10 Categorias:');
    categoriaCount.sort((a, b) => b._count - a._count).forEach(c => {
      console.log(`   ${c.categoria || 'Não informado'}: ${c._count.toLocaleString('pt-BR')}`);
    });
    console.log('');
    
    // Estatísticas por departamento
    const departamentoCount = await prisma.zeladoria.groupBy({
      by: ['departamento'],
      _count: true,
      take: 10
    });
    
    console.log('🏢 Top 10 Departamentos:');
    departamentoCount.sort((a, b) => b._count - a._count).forEach(d => {
      console.log(`   ${d.departamento || 'Não informado'}: ${d._count.toLocaleString('pt-BR')}`);
    });
    console.log('');
    
    // Verificar alguns registros de exemplo
    const samples = await prisma.zeladoria.findMany({
      take: 3,
      select: {
        protocoloEmpresa: true,
        status: true,
        categoria: true,
        bairro: true,
        dataCriacao: true
      }
    });
    
    console.log('📋 Exemplos de registros:');
    samples.forEach((r, i) => {
      console.log(`   ${i + 1}. Protocolo: ${r.protocoloEmpresa || 'N/A'}, Status: ${r.status || 'N/A'}, Categoria: ${r.categoria || 'N/A'}`);
    });
    
    console.log('\n✅ Verificação concluída!');
    
  } catch (error) {
    if (error.message.includes('zeladoria') || error.message.includes('Zeladoria')) {
      console.error('❌ ERRO: Modelo Zeladoria não encontrado no Prisma Client!');
      console.error('💡 Execute: npm run prisma:generate para regenerar o cliente\n');
    } else {
      console.error('❌ Erro:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkZeladoria()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

