/**
 * Script de Simulação: Executar Verificação de Vencimentos
 * 
 * Simula a execução do cron para verificar se está funcionando corretamente
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { executarVerificacaoManual } from '../../src/cron/vencimentos.cron.js';

const prisma = new PrismaClient();

async function simularCron() {
  console.log('🔔 Simulando execução do cron de vencimentos...\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const resultados = await executarVerificacaoManual(prisma);
    
    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('📊 RESULTADOS DA EXECUÇÃO:\n');
    console.log(`   15 dias antes: ${resultados['15_dias'].enviados} enviados, ${resultados['15_dias'].erros} erros`);
    console.log(`   Vencimento hoje: ${resultados['vencimento'].enviados} enviados, ${resultados['vencimento'].erros} erros`);
    console.log(`   60 dias vencido: ${resultados['60_dias_vencido'].enviados} enviados, ${resultados['60_dias_vencido'].erros} erros`);
    
    const totalEnviados = resultados['15_dias'].enviados + 
                          resultados['vencimento'].enviados + 
                          resultados['60_dias_vencido'].enviados;
    
    const totalErros = resultados['15_dias'].erros + 
                       resultados['vencimento'].erros + 
                       resultados['60_dias_vencido'].erros;
    
    console.log(`\n   📧 Total: ${totalEnviados} emails enviados, ${totalErros} erros\n`);
    
    if (resultados['vencimento'].enviados > 0) {
      console.log('   ✅ Protocolos vencendo hoje foram identificados e emails foram enviados!');
    } else {
      console.log('   ⚠️  Nenhum protocolo vencendo hoje foi encontrado.');
      console.log('   Isso é normal se realmente não houver protocolos vencendo hoje.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao executar verificação:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simularCron();

