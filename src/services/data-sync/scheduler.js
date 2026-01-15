/**
 * Scheduler para Atualização Automática de Dados do Google Sheets
 * Executa atualização diária dos dados às 10:00
 * 
 * Fluxo de execução:
 * 1. Atualiza dados da planilha tratada (Google Sheets)
 * 2. Sincroniza datas de conclusão da planilha bruta com o banco de dados
 * 
 * CÉREBRO X-3
 * Data: 2025-01-XX
 */

import cron from 'node-cron';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tarefaAgendada = null;

// Arquivo para rastrear última execução
const LAST_EXECUTION_FILE = path.join(__dirname, '../../../db-data/last-scheduler-execution.json');

/**
 * Salvar timestamp da última execução
 */
function salvarUltimaExecucao() {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(LAST_EXECUTION_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      ultimaExecucao: new Date().toISOString(),
      dataExecucao: new Date().toISOString().split('T')[0], // Data no formato YYYY-MM-DD
      timestamp: Date.now()
    };

    fs.writeFileSync(LAST_EXECUTION_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`📝 Última execução registrada: ${data.ultimaExecucao}`);
  } catch (error) {
    console.error('⚠️ Erro ao salvar última execução:', error.message);
  }
}

/**
 * Verificar se já executou hoje
 */
function jaExecutouHoje() {
  try {
    if (!fs.existsSync(LAST_EXECUTION_FILE)) {
      return false;
    }

    const data = JSON.parse(fs.readFileSync(LAST_EXECUTION_FILE, 'utf8'));
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    return data.dataExecucao === hoje;
  } catch (error) {
    console.error('⚠️ Erro ao verificar última execução:', error.message);
    return false;
  }
}

/**
 * Obter última execução
 */
function getUltimaExecucao() {
  try {
    if (!fs.existsSync(LAST_EXECUTION_FILE)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(LAST_EXECUTION_FILE, 'utf8'));
    return {
      ultimaExecucao: new Date(data.ultimaExecucao),
      dataExecucao: data.dataExecucao,
      timestamp: data.timestamp
    };
  } catch (error) {
    console.error('⚠️ Erro ao ler última execução:', error.message);
    return null;
  }
}

/**
 * Verificar se precisa executar (catch-up)
 * Retorna true se já passou das 10h hoje e ainda não executou
 */
function precisaExecutarCatchUp() {
  const agora = new Date();
  const horaAtual = agora.getHours();
  const minutoAtual = agora.getMinutes();

  // Se já passou das 10h (10:00)
  if (horaAtual > 10 || (horaAtual === 10 && minutoAtual >= 0)) {
    // Verificar se já executou hoje
    if (!jaExecutouHoje()) {
      return true;
    }
  }

  return false;
}

/**
 * Executar sincronização de datas de conclusão da planilha bruta
 */
async function executarSincronizacaoDatas() {
  console.log('🔄 Iniciando sincronização de datas de conclusão da planilha bruta...');

  try {
    // Executar o script de sincronização como processo filho
    const scriptPath = path.join(__dirname, '../../../scripts/maintenance/sincronizar-datas-conclusao.js');

    return new Promise((resolve, reject) => {
      const processo = spawn('node', [scriptPath], {
        cwd: path.join(__dirname, '../../../'),
        stdio: 'inherit', // Herdar stdout/stderr para ver logs
        shell: true
      });

      processo.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Sincronização de datas concluída com sucesso');
          resolve({ sucesso: true, codigo: code });
        } else {
          console.error(`⚠️ Sincronização de datas falhou com código ${code} (continuando mesmo assim)`);
          // Não rejeitar - continuar mesmo se a sincronização falhar
          resolve({ sucesso: false, codigo: code });
        }
      });

      processo.on('error', (error) => {
        console.error('⚠️ Erro ao executar sincronização de datas:', error.message);
        // Não rejeitar - continuar mesmo se a sincronização falhar
        resolve({ sucesso: false, erro: error.message });
      });
    });
  } catch (error) {
    console.error('⚠️ Erro na sincronização de datas:', error.message);
    // Não lançar erro - continuar mesmo se a sincronização falhar
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Executar atualização de dados do Google Sheets
 */
async function executarAtualizacao() {
  console.log('⏰ Iniciando atualização automática de dados do Google Sheets...');

  try {
    // Executar o script de atualização como processo filho
    const scriptPath = path.join(__dirname, '../../../scripts/data/updateFromGoogleSheets.js');

    return new Promise((resolve, reject) => {
      const processo = spawn('node', [scriptPath], {
        cwd: path.join(__dirname, '../../../'),
        stdio: 'inherit', // Herdar stdout/stderr para ver logs
        shell: true
      });

      processo.on('close', async (code) => {
        if (code === 0) {
          console.log('✅ Atualização automática concluída com sucesso');

          // Após atualização bem-sucedida, sincronizar datas de conclusão da planilha bruta
          console.log('\n🔄 Iniciando sincronização de datas de conclusão...');
          await executarSincronizacaoDatas();

          // Salvar timestamp da execução bem-sucedida
          salvarUltimaExecucao();
          resolve({ sucesso: true, codigo: code });
        } else {
          console.error(`❌ Atualização automática falhou com código ${code}`);
          reject(new Error(`Processo falhou com código ${code}`));
        }
      });

      processo.on('error', (error) => {
        console.error('❌ Erro ao executar atualização automática:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ Erro na atualização automática:', error);
    throw error;
  }
}

/**
 * Iniciar scheduler
 * Executa atualização diária às 10h da manhã
 * Verifica se precisa executar catch-up (se servidor estava desligado às 10h)
 * CÉREBRO X-3
 */
export async function iniciarSchedulerAtualizacao() {
  if (tarefaAgendada) {
    console.log('⚠️ Scheduler de atualização já está em execução');
    return;
  }

  // Verificar se precisa executar catch-up (execução perdida)
  if (precisaExecutarCatchUp()) {
    const ultimaExec = getUltimaExecucao();
    console.log('🔄 Verificando execução perdida...');

    if (ultimaExec) {
      console.log(`   Última execução: ${ultimaExec.ultimaExecucao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    } else {
      console.log('   Nenhuma execução anterior registrada');
    }

    console.log('⏰ Executando atualização catch-up (servidor estava desligado às 10h)...');

    try {
      await executarAtualizacao();
      console.log('✅ Catch-up executado com sucesso');
    } catch (error) {
      console.error('❌ Erro no catch-up:', error.message);
      // Continuar mesmo com erro no catch-up
    }
  } else {
    const ultimaExec = getUltimaExecucao();
    if (ultimaExec) {
      console.log(`📅 Última execução: ${ultimaExec.ultimaExecucao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    }

    const agora = new Date();
    const horaAtual = agora.getHours();
    const minutoAtual = agora.getMinutes();

    if (horaAtual < 10) {
      const minutosRestantes = (10 - horaAtual) * 60 - minutoAtual;
      console.log(`⏳ Próxima execução agendada para 10h (em aproximadamente ${minutosRestantes} minutos)`);
    } else if (jaExecutouHoje()) {
      console.log('✅ Já executou hoje. Próxima execução: amanhã às 10h');
    }
  }

  // Executar diariamente às 10h da manhã
  // Formato: segundo minuto hora dia mês dia-da-semana
  tarefaAgendada = cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Executando atualização automática de dados (10h)...');
    await executarAtualizacao();
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo'
  });

  console.log('✅ Scheduler de atualização de dados iniciado (execução diária às 10h)');
}

/**
 * Parar scheduler
 */
export function pararSchedulerAtualizacao() {
  if (tarefaAgendada) {
    tarefaAgendada.stop();
    tarefaAgendada = null;
    console.log('✅ Scheduler de atualização parado');
  }
}

/**
 * Executar atualização manual
 */
export async function executarAtualizacaoManual() {
  return await executarAtualizacao();
}

/**
 * Verificar status do scheduler
 */
export function getStatusSchedulerAtualizacao() {
  const ultimaExec = getUltimaExecucao();
  const jaExecutou = jaExecutouHoje();
  const precisaCatchUp = precisaExecutarCatchUp();

  return {
    ativo: tarefaAgendada !== null,
    proximaExecucao: tarefaAgendada ? 'Diariamente às 10h (horário de Brasília)' : 'Não agendado',
    ultimaExecucao: ultimaExec ? {
      data: ultimaExec.ultimaExecucao.toISOString(),
      dataFormatada: ultimaExec.ultimaExecucao.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      dataExecucao: ultimaExec.dataExecucao
    } : null,
    jaExecutouHoje: jaExecutou,
    precisaCatchUp: precisaCatchUp && !jaExecutou
  };
}

