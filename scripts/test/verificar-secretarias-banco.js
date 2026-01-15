/**
 * Script para verificar secretarias no banco de dados
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verificarSecretarias() {
  console.log('🔍 Verificando secretarias no banco de dados...\n');
  
  // Buscar todas as secretarias
  const secretarias = await prisma.secretariaInfo.findMany({
    select: {
      name: true,
      email: true,
      alternateEmail: true
    },
    orderBy: { name: 'asc' }
  });
  
  console.log(`📊 Total de secretarias cadastradas: ${secretarias.length}\n`);
  
  // Procurar por "Segurança" e "Saúde"
  console.log('🔍 Buscando secretarias relacionadas:\n');
  
  const buscaSeguranca = secretarias.filter(s => 
    s.name && s.name.toLowerCase().includes('segurança')
  );
  
  const buscaSaude = secretarias.filter(s => 
    s.name && (s.name.toLowerCase().includes('saúde') || s.name.toLowerCase().includes('saude'))
  );
  
  console.log('📋 Secretarias com "Segurança":');
  buscaSeguranca.forEach(s => {
    console.log(`   - ${s.name}`);
    console.log(`     Email: ${s.email || 'N/A'}`);
    console.log(`     Email Alt: ${s.alternateEmail || 'N/A'}`);
    console.log('');
  });
  
  console.log('📋 Secretarias com "Saúde":');
  buscaSaude.forEach(s => {
    console.log(`   - ${s.name}`);
    console.log(`     Email: ${s.email || 'N/A'}`);
    console.log(`     Email Alt: ${s.alternateEmail || 'N/A'}`);
    console.log('');
  });
  
  // Mostrar todas as secretarias
  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('📋 TODAS AS SECRETARIAS CADASTRADAS:\n');
  
  secretarias.forEach((s, index) => {
    console.log(`${index + 1}. ${s.name || 'N/A'}`);
    if (s.email) {
      const emails = s.email.split(/[;,]/).map(e => e.trim()).filter(e => e);
      emails.forEach(email => {
        console.log(`   📧 ${email}`);
      });
    }
    if (s.alternateEmail) {
      const emails = s.alternateEmail.split(/[;,]/).map(e => e.trim()).filter(e => e);
      emails.forEach(email => {
        console.log(`   📧 (Alt) ${email}`);
      });
    }
    if (!s.email && !s.alternateEmail) {
      console.log(`   ⚠️  Sem email cadastrado`);
    }
    console.log('');
  });
  
  await prisma.$disconnect();
}

verificarSecretarias().catch(console.error);

