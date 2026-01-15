/**
 * Script para enviar TODOS os tipos de emails de teste
 * Envia: 15 dias, vencimento hoje, 60 dias vencido, e resumo completo
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getDataCriacao, isConcluido } from '../../src/utils/formatting/dateUtils.js';
import { sendEmail } from '../../src/services/email-notifications/gmailService.js';
import { 
  getEmailSecretaria, 
  EMAIL_REMETENTE, 
  NOME_REMETENTE,
  EMAIL_OUVIDORIA_GERAL,
  EMAIL_PADRAO,
  getTemplate15Dias,
  getTemplateVencimento,
  getTemplate60Dias,
  getTemplateResumoOuvidoriaGeral
} from '../../src/services/email-notifications/emailConfig.js';

const prisma = new PrismaClient();

function getPrazoPorTipo(tipoDeManifestacao) {
  if (!tipoDeManifestacao) return 30;
  const tipo = String(tipoDeManifestacao).toLowerCase().trim();
  if (tipo.includes('sic') || tipo.includes('pedido de informação') || 
      tipo.includes('pedido de informacao') || tipo.includes('informação') || 
      tipo.includes('informacao')) {
    return 20;
  }
  return 30;
}

function calcularDataVencimento(dataCriacao, prazo) {
  if (!dataCriacao) return null;
  const data = new Date(dataCriacao + 'T00:00:00');
  if (isNaN(data.getTime())) return null;
  data.setDate(data.getDate() + prazo);
  return data.toISOString().slice(0, 10);
}

function calcularDiasRestantes(dataVencimento, hoje) {
  if (!dataVencimento) return null;
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  if (isNaN(vencimento.getTime())) return null;
  const diff = vencimento - hoje;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function buscarDadosReais(prisma) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().slice(0, 10);
  
  // Calcular datas
  const data15Dias = new Date(hoje);
  data15Dias.setDate(data15Dias.getDate() + 15);
  const data15DiasStr = data15Dias.toISOString().slice(0, 10);
  
  const data60Dias = new Date(hoje);
  data60Dias.setDate(data60Dias.getDate() - 60);
  const data60DiasStr = data60Dias.toISOString().slice(0, 10);
  
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
    },
    take: 1000 // Limitar para performance
  });
  
  const dados = {
    '15_dias': {},
    'vencimento': {},
    '60_dias': {}
  };
  
  for (const record of records) {
    if (isConcluido(record)) continue;
    
    const dataCriacao = getDataCriacao(record);
    if (!dataCriacao) continue;
    
    const tipo = record.tipoDeManifestacao || 
                 (record.data && typeof record.data === 'object' ? record.data.tipo_de_manifestacao : null) ||
                 '';
    
    const prazo = getPrazoPorTipo(tipo);
    const dataVencimento = calcularDataVencimento(dataCriacao, prazo);
    if (!dataVencimento) continue;
    
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
    
    const protocoloData = {
      protocolo,
      secretaria,
      dataVencimento,
      diasRestantes,
      assunto,
      tipoManifestacao: tipo
    };
    
    // 15 dias antes
    if (dataVencimento === data15DiasStr) {
      if (!dados['15_dias'][secretaria]) {
        dados['15_dias'][secretaria] = [];
      }
      dados['15_dias'][secretaria].push(protocoloData);
    }
    
    // Vencendo hoje
    if (dataVencimento === hojeStr) {
      if (!dados['vencimento'][secretaria]) {
        dados['vencimento'][secretaria] = [];
      }
      dados['vencimento'][secretaria].push(protocoloData);
    }
    
    // 60 dias vencido
    if (dataVencimento === data60DiasStr) {
      if (!dados['60_dias'][secretaria]) {
        dados['60_dias'][secretaria] = [];
      }
      dados['60_dias'][secretaria].push(protocoloData);
    }
  }
  
  return dados;
}

async function enviarTodosTiposEmailTeste() {
  console.log('📧 TESTE COMPLETO - Enviando todos os tipos de emails...\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const emailTeste = EMAIL_PADRAO;
  console.log(`📬 Email de destino para testes: ${emailTeste}\n`);
  
  // Buscar dados reais
  console.log('🔍 Buscando dados reais do banco de dados...\n');
  const dados = await buscarDadosReais(prisma);
  
  let totalEnviados = 0;
  let totalErros = 0;
  
  // 1. EMAIL DE 15 DIAS
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 1. ENVIANDO EMAIL DE 15 DIAS ANTES DO VENCIMENTO\n');
  
  if (Object.keys(dados['15_dias']).length > 0) {
    for (const [secretaria, protocolos] of Object.entries(dados['15_dias'])) {
      try {
        console.log(`   Secretaria: ${secretaria}`);
        console.log(`   Protocolos: ${protocolos.length}`);
        console.log(`   Email: ${emailTeste}`);
        
        const template = await getTemplate15Dias({
          secretaria,
          protocolos: protocolos
        }, prisma);
        
        const { messageId } = await sendEmail(
          emailTeste,
          template.subject,
          template.html,
          template.text,
          EMAIL_REMETENTE,
          NOME_REMETENTE
        );
        
        console.log(`   ✅ Enviado! Assunto: ${template.subject}`);
        console.log(`   📧 Message ID: ${messageId}\n`);
        totalEnviados++;
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}\n`);
        totalErros++;
      }
    }
  } else {
    // Criar exemplo se não houver dados
    console.log('   ⚠️  Nenhum protocolo encontrado. Criando exemplo...\n');
    try {
      const exemplo = {
        secretaria: 'Secretaria de Saúde',
        protocolos: [{
          protocolo: 'TESTE-15-DIAS-001',
          secretaria: 'Secretaria de Saúde',
          dataVencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          diasRestantes: 15,
          assunto: 'Exemplo de protocolo vencendo em 15 dias',
          tipoManifestacao: 'Reclamação'
        }]
      };
      
      const template = await getTemplate15Dias(exemplo, prisma);
      const { messageId } = await sendEmail(
        emailTeste,
        template.subject,
        template.html,
        template.text,
        EMAIL_REMETENTE,
        NOME_REMETENTE
      );
      
      console.log(`   ✅ Email de exemplo enviado!`);
      console.log(`   📧 Assunto: ${template.subject}`);
      console.log(`   📧 Message ID: ${messageId}\n`);
      totalEnviados++;
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
      totalErros++;
    }
  }
  
  // 2. EMAIL DE VENCIMENTO HOJE
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 2. ENVIANDO EMAIL DE VENCIMENTO HOJE\n');
  
  if (Object.keys(dados['vencimento']).length > 0) {
    for (const [secretaria, protocolos] of Object.entries(dados['vencimento'])) {
      try {
        console.log(`   Secretaria: ${secretaria}`);
        console.log(`   Protocolos: ${protocolos.length}`);
        console.log(`   Email: ${emailTeste}`);
        
        const template = await getTemplateVencimento({
          secretaria,
          protocolos: protocolos
        }, prisma);
        
        const { messageId } = await sendEmail(
          emailTeste,
          template.subject,
          template.html,
          template.text,
          EMAIL_REMETENTE,
          NOME_REMETENTE
        );
        
        console.log(`   ✅ Enviado! Assunto: ${template.subject}`);
        console.log(`   📧 Message ID: ${messageId}\n`);
        totalEnviados++;
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}\n`);
        totalErros++;
      }
    }
  } else {
    // Criar exemplo se não houver dados
    console.log('   ⚠️  Nenhum protocolo encontrado. Criando exemplo...\n');
    try {
      const exemplo = {
        secretaria: 'Secretaria de Saúde',
        protocolos: [{
          protocolo: 'TESTE-VENCIDO-HOJE-001',
          secretaria: 'Secretaria de Saúde',
          dataVencimento: new Date().toISOString().slice(0, 10),
          diasRestantes: 0,
          assunto: 'Exemplo de protocolo vencido hoje',
          tipoManifestacao: 'Reclamação'
        }]
      };
      
      const template = await getTemplateVencimento(exemplo, prisma);
      const { messageId } = await sendEmail(
        emailTeste,
        template.subject,
        template.html,
        template.text,
        EMAIL_REMETENTE,
        NOME_REMETENTE
      );
      
      console.log(`   ✅ Email de exemplo enviado!`);
      console.log(`   📧 Assunto: ${template.subject}`);
      console.log(`   📧 Message ID: ${messageId}\n`);
      totalEnviados++;
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
      totalErros++;
    }
  }
  
  // 3. EMAIL DE 60 DIAS VENCIDO
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 3. ENVIANDO EMAIL DE 60+ DIAS VENCIDO\n');
  
  if (Object.keys(dados['60_dias']).length > 0) {
    for (const [secretaria, protocolos] of Object.entries(dados['60_dias'])) {
      try {
        console.log(`   Secretaria: ${secretaria}`);
        console.log(`   Protocolos: ${protocolos.length}`);
        console.log(`   Email: ${emailTeste}`);
        
        const template = await getTemplate60Dias({
          secretaria,
          protocolos: protocolos
        }, prisma);
        
        const { messageId } = await sendEmail(
          emailTeste,
          template.subject,
          template.html,
          template.text,
          EMAIL_REMETENTE,
          NOME_REMETENTE
        );
        
        console.log(`   ✅ Enviado! Assunto: ${template.subject}`);
        console.log(`   📧 Message ID: ${messageId}\n`);
        totalEnviados++;
      } catch (error) {
        console.error(`   ❌ Erro: ${error.message}\n`);
        totalErros++;
      }
    }
  } else {
    // Criar exemplo se não houver dados
    console.log('   ⚠️  Nenhum protocolo encontrado. Criando exemplo...\n');
    try {
      const data60Dias = new Date();
      data60Dias.setDate(data60Dias.getDate() - 60);
      
      const exemplo = {
        secretaria: 'Secretaria de Saúde',
        protocolos: [{
          protocolo: 'TESTE-60-DIAS-001',
          secretaria: 'Secretaria de Saúde',
          dataVencimento: data60Dias.toISOString().slice(0, 10),
          diasRestantes: -60,
          assunto: 'Exemplo de protocolo vencido há 60+ dias',
          tipoManifestacao: 'Reclamação'
        }]
      };
      
      const template = await getTemplate60Dias(exemplo, prisma);
      const { messageId } = await sendEmail(
        emailTeste,
        template.subject,
        template.html,
        template.text,
        EMAIL_REMETENTE,
        NOME_REMETENTE
      );
      
      console.log(`   ✅ Email de exemplo enviado!`);
      console.log(`   📧 Assunto: ${template.subject}`);
      console.log(`   📧 Message ID: ${messageId}\n`);
      totalEnviados++;
    } catch (error) {
      console.error(`   ❌ Erro: ${error.message}\n`);
      totalErros++;
    }
  }
  
  // 4. EMAIL RESUMO COMPLETO
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 4. ENVIANDO EMAIL RESUMO COMPLETO (OUVIDORIA GERAL)\n');
  
  try {
    // Usar dados de vencimento hoje para o resumo
    const dadosResumo = Object.keys(dados['vencimento']).length > 0 
      ? dados['vencimento'] 
      : {
          'Secretaria de Saúde': [{
            protocolo: 'TESTE-RESUMO-001',
            secretaria: 'Secretaria de Saúde',
            dataVencimento: new Date().toISOString().slice(0, 10),
            diasRestantes: 0,
            assunto: 'Exemplo de protocolo no resumo',
            tipoManifestacao: 'Reclamação'
          }]
        };
    
    console.log(`   Email: ${EMAIL_OUVIDORIA_GERAL}`);
    console.log(`   Secretarias: ${Object.keys(dadosResumo).length}`);
    
    const template = await getTemplateResumoOuvidoriaGeral(dadosResumo, prisma);
    const { messageId } = await sendEmail(
      EMAIL_OUVIDORIA_GERAL,
      template.subject,
      template.html,
      template.text,
      EMAIL_REMETENTE,
      NOME_REMETENTE
    );
    
    console.log(`   ✅ Resumo enviado! Assunto: ${template.subject}`);
    console.log(`   📧 Message ID: ${messageId}\n`);
    totalEnviados++;
  } catch (error) {
    console.error(`   ❌ Erro: ${error.message}\n`);
    totalErros++;
  }
  
  // RESUMO FINAL
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMO FINAL DO TESTE:\n');
  console.log(`   ✅ Emails enviados: ${totalEnviados}`);
  console.log(`   ❌ Erros: ${totalErros}`);
  console.log(`   📧 Email de teste: ${emailTeste}`);
  console.log(`   📧 Email resumo: ${EMAIL_OUVIDORIA_GERAL}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('✅ Teste completo finalizado!');
  console.log('📬 Verifique a caixa de entrada dos emails acima.\n');
  
  await prisma.$disconnect();
}

enviarTodosTiposEmailTeste().catch(console.error);

