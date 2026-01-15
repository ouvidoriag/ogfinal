/**
 * Controller para Sincronização de Dados
 * Endpoints para atualização manual e status do scheduler
 * 
 * CÉREBRO X-3
 * Data: 2025-01-XX
 */

import {
  executarAtualizacaoManual,
  getStatusSchedulerAtualizacao
} from '../../services/data-sync/scheduler.js';
import { logger } from '../../utils/logger.js';

/**
 * POST /api/data-sync/execute
 * Executar atualização manual de dados do Google Sheets
 */
export async function executeDataSync(req, res) {
  try {
    logger.info('📊 Executando atualização manual de dados...');
    
    const resultado = await executarAtualizacaoManual();
    
    res.json({
      success: true,
      message: 'Atualização de dados executada com sucesso',
      resultado
    });
  } catch (error) {
    logger.error('❌ Erro ao executar atualização de dados:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/data-sync/status
 * Obter status do scheduler de atualização
 */
export async function getDataSyncStatus(req, res) {
  try {
    const status = getStatusSchedulerAtualizacao();
    
    // Adicionar informações adicionais
    const agora = new Date();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();
    
    let mensagem = '';
    if (status.precisaCatchUp) {
      mensagem = '⚠️ Execução perdida detectada! O servidor estava desligado às 10h. Execute manualmente ou reinicie o servidor.';
    } else if (status.jaExecutouHoje) {
      mensagem = '✅ Já executou hoje. Tudo certo!';
    } else if (horaAtual < 10) {
      const minutosRestantes = (10 - horaAtual) * 60 - minutoAtual;
      mensagem = `⏳ Aguardando execução às 10h (em ${minutosRestantes} minutos)`;
    } else if (horaAtual >= 10) {
      mensagem = '⏰ Execução agendada para amanhã às 10h';
    }
    
    res.json({
      success: true,
      status: {
        ...status,
        mensagem,
        horaAtual: `${horaAtual.toString().padStart(2, '0')}:${minutoAtual.toString().padStart(2, '0')}`
      }
    });
  } catch (error) {
    logger.error('❌ Erro ao obter status do scheduler:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

