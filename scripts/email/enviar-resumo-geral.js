/**
 * Script para Enviar Resumo Geral para Ouvidoria Geral
 * Envia resumo de todas as demandas vencidas hoje
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import Record from '../../src/models/Record.model.js';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  EMAIL_OUVIDORIA_GERAL,
  EMAIL_REMETENTE,
  NOME_REMETENTE,
  getTemplateResumoOuvidoriaGeral
} from '../../src/services/email-notifications/emailConfig.js';

/**
 * Obter prazo por tipo de manifestação
 */
function getPrazoPorTipo(tipoDeManifestacao) {
  if (!tipoDeManifestacao) return 30;
  
  const tipo = String(tipoDeManifestacao).toLowerCase().trim();
  
  if (tipo.includes('sic') || 
      tipo.includes('pedido de informação') || 
      tipo.includes('pedido de informacao') ||
      tipo.includes('informação') ||
      tipo.includes('informacao')) {
    return 20;
  }
  
  return 30;
}

/**
 * Calcula a data de vencimento baseado na data de criação e prazo em dias
 */
function calcularDataVencimento(dataCriacao, prazo) {
  if (!dataCriacao) return null;
  
  const data = new Date(dataCriacao + 'T00:00:00');
  if (isNaN(data.getTime())) return null;
  
  data.setDate(data.getDate() + prazo);
  return data.toISOString().slice(0, 10);
}

/**
 * Verificar se está concluído
 */
function isConcluido(record) {
  const status = record.statusDemanda || 
                 (record.data && typeof record.data === 'object' ? record.data.status_demanda : null) ||
                 '';
  
  return status && (
    status.toLowerCase().includes('concluído') ||
    status.toLowerCase().includes('concluido') ||
    status.toLowerCase().includes('encerrado') ||
    status.toLowerCase().includes('arquivado')
  );
}

/**
 * Obter data de criação
 */
function getDataCriacao(record) {
  return record.dataCriacaoIso || 
         record.dataDaCriacao ||
         (record.data && typeof record.data === 'object' ? record.data.data_da_criacao : null) ||
         null;
}

async function enviarResumoGeral() {
  console.log('📧 Enviando resumo geral para Ouvidoria Geral...\n');
  
  try {
    const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
    }
    
    await initializeDatabase(mongoUrl);
    console.log('✅ Conectado ao banco de dados\n');
    
    if (!EMAIL_OUVIDORIA_GERAL) {
      throw new Error('❌ EMAIL_OUVIDORIA_GERAL não configurado no .env');
    }
    
    console.log(`📧 Email destino: ${EMAIL_OUVIDORIA_GERAL}\n`);
    
    // Calcular data de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().slice(0, 10);
    
    // Buscar protocolos vencidos hoje
    console.log('🔍 Buscando protocolos vencidos hoje...\n');
    
    // Buscar registros não concluídos
    const records = await Record.find({
      $or: [
        { dataCriacaoIso: { $exists: true, $ne: null } },
        { dataDaCriacao: { $exists: true, $ne: null } }
      ]
    }).lean();
    
    console.log(`📊 Total de registros encontrados: ${records.length}\n`);
    
    // Agrupar por secretaria
    const porSecretaria = {};
    
    for (const record of records) {
      if (isConcluido(record)) continue;
      
      const dataCriacao = getDataCriacao(record);
      if (!dataCriacao) continue;
      
      const tipoManifest = record.tipoDeManifestacao || 
                          (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                          '';
      
      const prazo = getPrazoPorTipo(tipoManifest);
      const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
      if (!dataVencimento) continue;
      
      // Verificar se vence hoje
      if (dataVencimento !== hojeStr) continue;
      
      const protocolo = record.protocolo || 
                        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                        'N/A';
      
      const secretaria = record.orgaos || 
                        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                        'N/A';
      
      if (secretaria === 'N/A' || !secretaria) continue;
      
      const assunto = record.assunto || 
                     (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
                     '';
      
      const diasRestantes = 0; // Vencendo hoje
      
      if (!porSecretaria[secretaria]) {
        porSecretaria[secretaria] = [];
      }
      
      porSecretaria[secretaria].push({
        protocolo,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipoManifest,
        secretaria
      });
    }
    
    // Calcular total
    const totalDemandas = Object.values(porSecretaria).reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalDemandas === 0) {
      console.log('⚠️  Nenhuma demanda vencendo hoje encontrada.\n');
      console.log('📧 Resumo não será enviado.\n');
      await mongoose.disconnect();
      return;
    }
    
    console.log(`✅ Encontradas ${totalDemandas} demanda(s) vencendo hoje:\n`);
    Object.entries(porSecretaria).forEach(([secretaria, protocolos]) => {
      console.log(`   ${secretaria}: ${protocolos.length} protocolo(s)`);
    });
    console.log('');
    
    // Gerar template
    console.log('📝 Gerando template do resumo...\n');
    const template = await getTemplateResumoOuvidoriaGeral(porSecretaria);
    
    // Separar múltiplos emails (separados por vírgula)
    const emails = EMAIL_OUVIDORIA_GERAL.split(',').map(e => e.trim()).filter(e => e);
    
    console.log(`📧 Enviando resumo para ${emails.length} email(s)...\n`);
    
    const resultados = [];
    
    // Enviar para cada email
    for (const email of emails) {
      try {
        console.log(`📧 Enviando para: ${email}...`);
        const { messageId } = await sendEmail(
          email,
          template.subject,
          template.html,
          template.text,
          EMAIL_REMETENTE,
          NOME_REMETENTE
        );
        
        console.log(`✅ Enviado para ${email}`);
        console.log(`   Message ID: ${messageId}\n`);
        
        resultados.push({ email, messageId, status: 'enviado' });
      } catch (error) {
        console.error(`❌ Erro ao enviar para ${email}:`, error.message);
        resultados.push({ email, status: 'erro', erro: error.message });
      }
    }
    
    console.log('='.repeat(60));
    console.log('📊 RESUMO DO ENVIO:');
    console.log('='.repeat(60));
    console.log(`   Total de emails: ${emails.length}`);
    console.log(`   Enviados com sucesso: ${resultados.filter(r => r.status === 'enviado').length}`);
    console.log(`   Erros: ${resultados.filter(r => r.status === 'erro').length}`);
    console.log(`   Total de demandas: ${totalDemandas}\n`);
    
    resultados.forEach(r => {
      if (r.status === 'enviado') {
        console.log(`   ✅ ${r.email} - Message ID: ${r.messageId}`);
      } else {
        console.log(`   ❌ ${r.email} - Erro: ${r.erro}`);
      }
    });
    console.log('='.repeat(60) + '\n');
    
    await mongoose.disconnect();
    console.log('✅ Script finalizado!\n');
    
  } catch (error) {
    console.error('❌ Erro ao enviar resumo:', error);
    process.exit(1);
  }
}

enviarResumoGeral();

