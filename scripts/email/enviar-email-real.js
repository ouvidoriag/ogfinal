/**
 * Script para enviar email REAL com protocolos do banco de dados
 * Busca protocolos reais e envia email formatado para Secretaria de Saúde
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  getEmailSecretaria, 
  EMAIL_REMETENTE, 
  NOME_REMETENTE,
  getTemplate15Dias,
  getTemplateVencimento,
  getTemplate60Dias
} from '../../src/services/email-notifications/emailConfig.js';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';

const prisma = new PrismaClient();
const EMAIL_SAUDE = 'ouvgeral.gestao@gmail.com';
const SECRETARIA_SAUDE = 'Secretaria de Saúde';

/**
 * Obter prazo por tipo
 */
function getPrazoPorTipo(tipoDeManifestacao) {
  if (!tipoDeManifestacao) return 30;
  const tipo = String(tipoDeManifestacao).toLowerCase().trim();
  if (tipo.includes('sic') || tipo.includes('pedido de informação') || tipo.includes('pedido de informacao')) {
    return 20;
  }
  return 30;
}

/**
 * Calcular data de vencimento
 */
function calcularDataVencimento(dataCriacao, prazo) {
  if (!dataCriacao) return null;
  const data = new Date(dataCriacao + 'T00:00:00');
  if (isNaN(data.getTime())) return null;
  data.setDate(data.getDate() + prazo);
  return data.toISOString().slice(0, 10);
}

/**
 * Calcular dias restantes
 */
function calcularDiasRestantes(dataVencimento, hoje) {
  if (!dataVencimento) return null;
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;
  const diff = vencimento - hoje;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Buscar protocolos reais da Secretaria de Saúde
 */
async function buscarProtocolosReais() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  // Data de vencimento em 15 dias
  const data15Dias = new Date(hoje);
  data15Dias.setDate(hoje.getDate() + 15);
  const data15DiasStr = data15Dias.toISOString().slice(0, 10);
  
  // Data de vencimento há 60 dias
  const data60Dias = new Date(hoje);
  data60Dias.setDate(hoje.getDate() - 60);
  const data60DiasStr = data60Dias.toISOString().slice(0, 10);
  
  console.log('🔍 Buscando protocolos reais não concluídos...\n');
  
  // Buscar registros não concluídos (de qualquer secretaria, mas vamos enviar para Saúde)
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
      dataDaConclusao: true,
      dataConclusaoIso: true,
      data: true
    },
    take: 2000 // Buscar mais registros
  });
  
  console.log(`📊 Encontrados ${records.length} registros no total\n`);
  
  const protocolos15Dias = [];
  const protocolosVencimento = [];
  const protocolos60Dias = [];
  
  for (const record of records) {
    // Pular concluídos
    if (isConcluido(record)) continue;
    
    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;
    
    const tipo = record.tipoDeManifestacao || 
                 (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                 '';
    
    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
    if (!dataVencimento) continue;
    
    const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
    
    const protocolo = record.protocolo || 
                      (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                      'N/A';
    
    // Usar a secretaria real do registro, mas se for vazio, usar Secretaria de Saúde
    let secretaria = record.orgaos || 
                     (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                     SECRETARIA_SAUDE;
    
    // Se a secretaria não for Saúde, ainda assim vamos incluir no email para Saúde (como exemplo)
    // Mas vamos marcar a secretaria original
    const secretariaOriginal = secretaria;
    
    const assunto = record.assunto || 
                   (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
                   '';
    
    const protocoloData = {
      protocolo,
      secretaria: SECRETARIA_SAUDE, // Sempre usar Secretaria de Saúde para o email
      secretariaOriginal, // Manter a original para referência
      dataVencimento,
      diasRestantes,
      assunto,
      tipoManifestacao: tipo
    };
    
    // Classificar protocolos (com margem maior para encontrar protocolos)
    if (diasRestantes >= 0 && diasRestantes <= 20) {
      // Protocolos próximos (0 a 20 dias)
      if (diasRestantes >= 14 && diasRestantes <= 16) {
        protocolos15Dias.push(protocoloData);
      } else if (diasRestantes >= -1 && diasRestantes <= 1) {
        protocolosVencimento.push(protocoloData);
      } else if (diasRestantes <= 20) {
        // Se não encontrou exatos, adicionar próximos para exemplo
        protocolos15Dias.push(protocoloData);
      }
    } else if (diasRestantes < -60) {
      protocolos60Dias.push(protocoloData);
    } else if (diasRestantes < 0 && diasRestantes >= -60) {
      // Protocolos vencidos mas não tanto
      protocolosVencimento.push(protocoloData);
    }
  }
  
  return {
    protocolos15Dias: protocolos15Dias.slice(0, 20), // Limitar a 20 para não sobrecarregar o email
    protocolosVencimento: protocolosVencimento.slice(0, 20),
    protocolos60Dias: protocolos60Dias.slice(0, 20)
  };
}

/**
 * Enviar email real
 */
async function enviarEmailReal() {
  try {
    console.log('📧 Preparando email REAL para Secretaria de Saúde...\n');
    
    // Buscar protocolos reais
    const { protocolos15Dias, protocolosVencimento, protocolos60Dias } = await buscarProtocolosReais();
    
    console.log(`📊 Protocolos encontrados:`);
    console.log(`   - 15 dias: ${protocolos15Dias.length}`);
    console.log(`   - Vencimento hoje: ${protocolosVencimento.length}`);
    console.log(`   - 60+ dias: ${protocolos60Dias.length}\n`);
    
    // Escolher qual tipo enviar (prioridade: vencimento > 15 dias > 60 dias)
    // Se não encontrar exatos, usar os mais próximos encontrados
    let template = null;
    let tipo = '';
    let protocolos = [];
    
    if (protocolosVencimento.length > 0) {
      tipo = 'vencimento';
      protocolos = protocolosVencimento.slice(0, 15); // Limitar a 15 protocolos
      template = await getTemplateVencimento({
        secretaria: SECRETARIA_SAUDE,
        protocolos: protocolos
      }, prisma);
      console.log('🚨 Enviando email de VENCIMENTO (urgente)');
    } else if (protocolos15Dias.length > 0) {
      tipo = '15_dias';
      protocolos = protocolos15Dias.slice(0, 15); // Limitar a 15 protocolos
      template = await getTemplate15Dias({
        secretaria: SECRETARIA_SAUDE,
        protocolos: protocolos
      }, prisma);
      console.log('⏰ Enviando email de 15 DIAS');
    } else if (protocolos60Dias.length > 0) {
      tipo = '60_dias';
      protocolos = protocolos60Dias.slice(0, 15); // Limitar a 15 protocolos
      template = await getTemplate60Dias({
        secretaria: SECRETARIA_SAUDE,
        protocolos: protocolos
      }, prisma);
      console.log('⚠️ Enviando email de 60+ DIAS');
    } else {
      // Se não encontrou nenhum, buscar os 10 protocolos mais próximos do vencimento
      console.log('ℹ️ Nenhum protocolo encontrado nas categorias exatas.');
      console.log('   Buscando protocolos próximos do vencimento...\n');
      
      // Usar os records já buscados
      const todosRecords = records;
      
      // Buscar todos os protocolos não concluídos e ordenar por dias restantes
      const todosProtocolos = [];
      for (const record of todosRecords) {
        if (isConcluido(record)) continue;
        const dataCriacao = getDataCriacao(record);
        if (!dataCriacao) continue;
        const tipo = record.tipoDeManifestacao || 
                     (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) || '';
        const prazo = getPrazoPorTipo(tipo);
        const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
        if (!dataVencimento) continue;
        const diasRestantes = calcularDiasRestantes(dataVencimento, hoje);
        
        const protocolo = record.protocolo || 
                          (record.data && typeof record.data === 'object' ? record.data.protocolo : null) ||
                          'N/A';
        const secretariaOriginal = record.orgaos || 
                                   (record.data && typeof record.data === 'object' ? record.data.orgaos : null) ||
                                   'Não informado';
        const assunto = record.assunto || 
                       (record.data && typeof record.data === 'object' ? record.data.assunto : null) ||
                       '';
        
        todosProtocolos.push({
          protocolo,
          secretaria: SECRETARIA_SAUDE, // Sempre usar Secretaria de Saúde para o email
          secretariaOriginal, // Manter a original para referência
          dataVencimento,
          diasRestantes,
          assunto,
          tipoManifestacao: tipo
        });
      }
      
      // Ordenar por dias restantes (mais próximos primeiro)
      todosProtocolos.sort((a, b) => {
        if (a.diasRestantes < 0 && b.diasRestantes >= 0) return -1;
        if (a.diasRestantes >= 0 && b.diasRestantes < 0) return 1;
        return a.diasRestantes - b.diasRestantes;
      });
      
      if (todosProtocolos.length > 0) {
        protocolos = todosProtocolos.slice(0, 10); // Pegar os 10 mais próximos
        tipo = '15_dias';
        template = await getTemplate15Dias({
          secretaria: SECRETARIA_SAUDE,
          protocolos: protocolos
        }, prisma);
        console.log(`⏰ Enviando email com ${protocolos.length} protocolos próximos do vencimento`);
      } else {
        console.log('ℹ️ Nenhum protocolo não concluído encontrado.');
        console.log('   O sistema está funcionando, mas não há protocolos que precisem de notificação agora.\n');
        return;
      }
    }
    
    if (!template) {
      console.error('❌ Erro: Template não gerado');
      return;
    }
    
    console.log(`\n📤 Enviando email...`);
    console.log(`   Para: ${EMAIL_SAUDE}`);
    console.log(`   Assunto: ${template.subject}`);
    console.log(`   Protocolos: ${protocolos.length}\n`);
    
    const resultado = await sendEmail(
      EMAIL_SAUDE,
      template.subject,
      template.html,
      template.text,
      EMAIL_REMETENTE,
      NOME_REMETENTE
    );
    
    console.log('✅ Email REAL enviado com sucesso!');
    console.log(`📧 Message ID: ${resultado.messageId}`);
    console.log(`🔗 Thread ID: ${resultado.threadId}`);
    console.log(`📋 Protocolos incluídos: ${protocolos.length}`);
    console.log(`\n🎉 Email real enviado para a Secretaria de Saúde!`);
    console.log(`📬 Verifique a caixa de entrada de: ${EMAIL_SAUDE}\n`);
    
    // Mostrar alguns protocolos enviados
    if (protocolos.length > 0) {
      console.log('📋 Protocolos incluídos no email:');
      protocolos.slice(0, 10).forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.protocolo} - Vence em ${p.diasRestantes} dias`);
      });
      if (protocolos.length > 10) {
        console.log(`   ... e mais ${protocolos.length - 10} protocolos`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao enviar email real:', error.message);
    console.error('\n💡 Verifique:');
    console.error('   - Se o Gmail está autorizado (npm run gmail:auth)');
    console.error('   - Se o servidor está rodando');
    console.error('   - Se as credenciais estão corretas\n');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
enviarEmailReal()
  .then(() => {
    console.log('✅ Processo concluído');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

