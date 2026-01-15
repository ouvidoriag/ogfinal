/**
 * Script para enviar resumo de demandas vencidas HOJE para Ouvidoria Geral
 * Usa dados REAIS do banco de dados
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../src/services/email-notifications/gmailService.js';
import { 
  EMAIL_REMETENTE, 
  NOME_REMETENTE,
  EMAIL_OUVIDORIA_GERAL,
  getTemplateResumoOuvidoriaGeral
} from '../src/services/email-notifications/emailConfig.js';
import { getDataCriacao, isConcluido } from '../src/utils/dateUtils.js';

const prisma = new PrismaClient();

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
function calcularDataVencimentoComPrazo(dataCriacao, prazo) {
  if (!dataCriacao) return null;
  
  const data = new Date(dataCriacao + 'T00:00:00');
  
  if (isNaN(data.getTime())) return null;
  
  // Adicionar prazo em dias
  data.setDate(data.getDate() + prazo);
  
  return data.toISOString().slice(0, 10);
}

/**
 * Calcula dias restantes até o vencimento
 */
function calcularDiasRestantes(dataVencimento, hoje) {
  if (!dataVencimento) return null;
  
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;
  
  const diff = vencimento - hoje;
  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  return dias;
}

/**
 * Buscar demandas que vencem HOJE (26/11/2025)
 */
async function buscarDemandasVencimentoHoje(prisma) {
  const hoje = new Date('2025-11-26T00:00:00');
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  console.log(`📅 Buscando demandas que vencem em: ${hojeStr}`);
  
  const records = await prisma.record.findMany({
    where: {
      OR: [
        { dataCriacaoIso: { not: null } },
        { dataDaCriacao: { not: null } }
      ]
    },
    select: {
      id: true,
      protocolo: true,
      dataCriacaoIso: true,
      dataDaCriacao: true,
      tipoDeManifestacao: true,
      tema: true,
      assunto: true,
      orgaos: true,
      status: true,
      statusDemanda: true,
      data: true
    }
  });
  
  console.log(`📊 Total de registros encontrados: ${records.length}`);
  
  const demandas = [];
  
  for (const record of records) {
    // Pular concluídos
    if (isConcluido(record)) continue;
    
    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;
    
    const tipo = record.tipoDeManifestacao || 
                 (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                 '';
    
    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimentoComPrazo(dataCriacao, prazo);
    if (!dataVencimento) continue;
    
    // Verificar se vence HOJE (26/11/2025)
    if (dataVencimento === hojeStr) {
      const protocolo = record.protocolo || 
                        (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                        'N/A';
      
      const secretaria = record.orgaos || 
                        (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                        'N/A';
      
      const assunto = record.assunto || 
                     (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
                     '';
      
      const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
      
      demandas.push({
        protocolo,
        secretaria,
        dataVencimento,
        diasRestantes,
        assunto,
        tipoManifestacao: tipo
      });
    }
  }
  
  console.log(`✅ Demandas vencendo hoje encontradas: ${demandas.length}`);
  
  return demandas;
}

/**
 * Enviar resumo para Ouvidoria Geral
 */
async function enviarResumo() {
  try {
    console.log('📧 Iniciando busca de demandas vencidas hoje...\n');
    
    // Buscar demandas vencendo hoje
    const demandas = await buscarDemandasVencimentoHoje(prisma);
    
    if (demandas.length === 0) {
      console.log('⚠️ Nenhuma demanda vencendo hoje encontrada.');
      console.log('📧 Resumo não será enviado.');
      return;
    }
    
    // Agrupar por secretaria
    const porSecretaria = {};
    for (const demanda of demandas) {
      const secretaria = demanda.secretaria || 'N/A';
      if (!porSecretaria[secretaria]) {
        porSecretaria[secretaria] = [];
      }
      porSecretaria[secretaria].push(demanda);
    }
    
    console.log(`\n📊 Resumo por secretaria:`);
    for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
      console.log(`   ${secretaria}: ${protocolos.length} protocolo(s)`);
    }
    
    console.log(`\n📧 Preparando email resumo para Ouvidoria Geral...`);
    console.log(`   Destinatário: ${EMAIL_OUVIDORIA_GERAL}`);
    console.log(`   Total de demandas: ${demandas.length}`);
    console.log(`   Secretarias envolvidas: ${Object.keys(porSecretaria).length}\n`);
    
    // Gerar template
    const template = await getTemplateResumoOuvidoriaGeral(porSecretaria, prisma);
    
    console.log(`📤 Enviando email...`);
    
    // Enviar email
    const { messageId, threadId } = await sendEmail(
      EMAIL_OUVIDORIA_GERAL,
      template.subject,
      template.html,
      template.text,
      EMAIL_REMETENTE,
      NOME_REMETENTE
    );
    
    console.log('\n✅ Email enviado com sucesso!');
    console.log(`📧 Message ID: ${messageId}`);
    console.log(`🔗 Thread ID: ${threadId}`);
    console.log(`📬 Verifique a caixa de entrada de: ${EMAIL_OUVIDORIA_GERAL}\n`);
    
    // Mostrar detalhes dos protocolos
    console.log('📋 Protocolos incluídos no resumo:');
    for (const [secretaria, protocolos] of Object.entries(porSecretaria)) {
      console.log(`\n   ${secretaria}:`);
      for (const p of protocolos) {
        console.log(`      - ${p.protocolo} (Vence: ${p.dataVencimento})`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao enviar resumo:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
enviarResumo();

