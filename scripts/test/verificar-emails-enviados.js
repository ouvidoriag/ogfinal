/**
 * Script para verificar para quais emails estão sendo enviados os protocolos
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getEmailSecretaria, EMAIL_PADRAO, SECRETARIAS_EMAILS } from '../../src/services/email-notifications/emailConfig.js';

const prisma = new PrismaClient();

async function verificarEmails() {
  console.log('📧 Verificando configuração de emails...\n');
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 MAPEAMENTO DE SECRETARIAS:\n');
  
  console.log('Secretarias com email específico:');
  Object.entries(SECRETARIAS_EMAILS).forEach(([nome, email]) => {
    console.log(`   - ${nome}: ${email}`);
  });
  
  console.log(`\nEmail padrão (para secretarias não mapeadas): ${EMAIL_PADRAO}\n`);
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('🔍 TESTANDO ALGUMAS SECRETARIAS:\n');
  
  const secretariasTeste = [
    'Secretaria de Saúde',
    'Secretaria de Esporte e Lazer',
    'Secretaria de Segurança Pública',
    'Secretaria de Meio Ambiente',
    'Secretaria de Educação',
    'Secretaria de Obras'
  ];
  
  secretariasTeste.forEach(secretaria => {
    const email = getEmailSecretaria(secretaria);
    const temMapeamento = Object.values(SECRETARIAS_EMAILS).some(e => 
      Object.keys(SECRETARIAS_EMAILS).some(k => 
        k.toLowerCase().includes(secretaria.toLowerCase()) || 
        secretaria.toLowerCase().includes(k.toLowerCase())
      )
    );
    
    console.log(`   ${secretaria}:`);
    console.log(`      → ${email}`);
    console.log(`      ${temMapeamento ? '✅ Mapeada' : '⚠️  Usando email padrão'}`);
    console.log('');
  });
  
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📊 RESUMO:\n');
  
  const totalMapeadas = Object.keys(SECRETARIAS_EMAILS).length;
  console.log(`   Secretarias mapeadas: ${totalMapeadas}`);
  console.log(`   Email padrão: ${EMAIL_PADRAO}`);
  console.log('');
  console.log('   ⚠️  ATENÇÃO: Secretarias não mapeadas receberão emails no email padrão!');
  console.log('   Para adicionar emails específicos, edite SECRETARIAS_EMAILS em emailConfig.js\n');
  
  await prisma.$disconnect();
}

verificarEmails().catch(console.error);

