/**
 * Scheduler para Notificações por Email
 * Executa verificações periódicas e envia notificações
 */

import cron from 'node-cron';
import { executarTodasNotificacoes } from './notificationService.js';

let tarefaAgendada = null;

/**
 * Executar verificação de notificações
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 */
async function executarVerificacao() {
  console.log('⏰ Iniciando verificação agendada de notificações...');
  
  try {
    // REFATORAÇÃO: executarTodasNotificacoes não precisa mais de prisma
    const resultados = await executarTodasNotificacoes(null);
    
    console.log('✅ Verificação concluída:', {
      totalEnviados: resultados.totalEnviados,
      totalErros: resultados.totalErros,
      detalhes: {
        '15_dias': resultados['15_dias'].length,
        'vencimento': resultados['vencimento'].length,
        '60_dias_vencido': resultados['60_dias_vencido'].length
      }
    });
    
    return resultados;
  } catch (error) {
    console.error('❌ Erro na verificação agendada:', error);
    throw error;
  }
}

/**
 * Iniciar scheduler
 * Executa verificações diárias às 8h da manhã
 * REFATORAÇÃO: Prisma → Mongoose
 * Data: 03/12/2025
 * CÉREBRO X-3
 * @param {*} prismaClient - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 */
export function iniciarScheduler(prismaClient) {
  // REFATORAÇÃO: prisma não é mais necessário, mas mantido para compatibilidade
  
  if (tarefaAgendada) {
    console.log('⚠️ Scheduler já está em execução');
    return;
  }
  
  // Executar diariamente às 8h da manhã
  // Formato: segundo minuto hora dia mês dia-da-semana
  tarefaAgendada = cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Executando verificação agendada de notificações (8h)...');
    await executarVerificacao();
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  });
  
  console.log('✅ Scheduler de notificações iniciado (execução diária às 8h)');
  
  // Executar também imediatamente na inicialização (opcional)
  // Descomente a linha abaixo se quiser executar na inicialização
  // executarVerificacao();
}

/**
 * Parar scheduler
 */
export function pararScheduler() {
  if (tarefaAgendada) {
    tarefaAgendada.stop();
    tarefaAgendada = null;
    console.log('✅ Scheduler de notificações parado');
  }
}

/**
 * Executar verificação manual
 */
export async function executarVerificacaoManual() {
  return await executarVerificacao();
}

/**
 * Verificar status do scheduler
 */
export function getStatusScheduler() {
  return {
    ativo: tarefaAgendada !== null,
    proximaExecucao: tarefaAgendada ? 'Diariamente às 8h' : 'Não agendado'
  };
}

