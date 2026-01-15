/**
 * Script para atualizar o mapeamento de emails das secretarias
 * Busca todas as secretarias do banco de dados e atualiza o emailConfig.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function atualizarEmailsSecretarias() {
  console.log('🔍 Buscando secretarias e emails do banco de dados...\n');
  
  // Buscar todas as secretarias com email
  const secretarias = await prisma.secretariaInfo.findMany({
    where: {
      email: { not: null },
      name: { not: null }
    },
    select: {
      name: true,
      email: true,
      acronym: true
    },
    orderBy: { name: 'asc' }
  });
  
  console.log(`📊 Encontradas ${secretarias.length} secretarias com email cadastrado\n`);
  
  if (secretarias.length === 0) {
    console.log('⚠️  Nenhuma secretaria com email encontrada no banco de dados.');
    await prisma.$disconnect();
    return;
  }
  
  // Função para extrair primeiro email válido
  function extrairEmailValido(emailString) {
    if (!emailString) return null;
    
    // Remover espaços
    emailString = emailString.trim();
    
    // Separar por ponto e vírgula ou vírgula
    const emails = emailString.split(/[;,]/).map(e => e.trim()).filter(e => e);
    
    // Validar email (formato básico)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    for (const email of emails) {
      // Remover links e outros dados não-email
      const emailLimpo = email.split(/\s/)[0].trim();
      if (emailRegex.test(emailLimpo) && !emailLimpo.startsWith('http')) {
        return emailLimpo;
      }
    }
    
    return null;
  }
  
  // Criar mapeamento
  const mapeamento = {};
  const secretariasProcessadas = new Set();
  
  for (const secretaria of secretarias) {
    const nome = secretaria.name.trim();
    const emailRaw = secretaria.email.trim();
    
    if (!nome || !emailRaw) continue;
    
    // Extrair email válido
    const email = extrairEmailValido(emailRaw);
    if (!email) {
      console.log(`⚠️  Email inválido ignorado para "${nome}": ${emailRaw}`);
      continue;
    }
    
    // Adicionar nome principal
    if (!secretariasProcessadas.has(nome.toLowerCase())) {
      mapeamento[nome] = email;
      secretariasProcessadas.add(nome.toLowerCase());
    }
    
    // Adicionar variações comuns
    const nomeLower = nome.toLowerCase();
    
    // Variações de "Secretaria de"
    if (nomeLower.includes('secretaria de')) {
      const semPrefixo = nome.replace(/^secretaria de /i, '').trim();
      if (semPrefixo && !mapeamento[semPrefixo]) {
        mapeamento[semPrefixo] = email;
      }
    }
    
    // Variações de acentuação (Saúde/Saude)
    if (nomeLower.includes('saúde')) {
      mapeamento[nome.replace(/saúde/gi, 'Saude')] = email;
      mapeamento[nome.replace(/saúde/gi, 'Saúde')] = email;
    }
    
    // Adicionar sigla se existir
    if (secretaria.acronym && secretaria.acronym.trim()) {
      const sigla = secretaria.acronym.trim().toUpperCase();
      if (!mapeamento[sigla]) {
        mapeamento[sigla] = email;
      }
    }
  }
  
  console.log('📋 Mapeamento criado:\n');
  for (const [nome, email] of Object.entries(mapeamento)) {
    console.log(`   ${nome} → ${email}`);
  }
  
  // Ler arquivo emailConfig.js
  const configPath = join(__dirname, '../../src/services/email-notifications/emailConfig.js');
  let conteudo = readFileSync(configPath, 'utf-8');
  
  // Encontrar e substituir o objeto SECRETARIAS_EMAILS usando regex
  const regex = /export const SECRETARIAS_EMAILS = \{[\s\S]*?\};/;
  
  if (!regex.test(conteudo)) {
    console.error('❌ Não foi possível encontrar SECRETARIAS_EMAILS no arquivo');
    await prisma.$disconnect();
    return;
  }
  
  // Criar novo mapeamento formatado
  const linhas = ['export const SECRETARIAS_EMAILS = {'];
  
  // Ordenar por nome
  const entradasOrdenadas = Object.entries(mapeamento).sort((a, b) => 
    a[0].localeCompare(b[0], 'pt-BR')
  );
  
  for (const [nome, email] of entradasOrdenadas) {
    // Escapar aspas no nome se necessário
    const nomeEscapado = nome.replace(/'/g, "\\'").replace(/\n/g, ' ');
    linhas.push(`  '${nomeEscapado}': '${email}',`);
  }
  
  linhas.push('};');
  
  const novoMapeamento = linhas.join('\n');
  
  // Substituir no conteúdo
  conteudo = conteudo.replace(regex, novoMapeamento);
  
  // Salvar arquivo
  writeFileSync(configPath, conteudo, 'utf-8');
  
  console.log('\n✅ Arquivo emailConfig.js atualizado com sucesso!');
  console.log(`📝 Total de ${entradasOrdenadas.length} entradas no mapeamento\n`);
  
  await prisma.$disconnect();
}

atualizarEmailsSecretarias().catch(console.error);

