/**
 * Script para verificar se os emails das secretarias na página de notificações estão corretos
 * Compara emails do banco, mapeamento estático e endpoint de vencimentos
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import { getEmailSecretaria, SECRETARIAS_EMAILS, EMAIL_PADRAO } from '../../src/services/email-notifications/emailConfig.js';

async function verificarEmailsNotificacoes() {
  console.log('🔍 Verificando emails das secretarias na página de notificações...\n');
  
  try {
    // Conectar ao MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!mongoUri) {
      throw new Error('MONGODB_URI ou DATABASE_URL não encontrado nas variáveis de ambiente');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB\n');
    
    // Buscar todas as secretarias do banco
    const secretariasBanco = await SecretariaInfo.find({
      $or: [
        { email: { $ne: null, $exists: true } },
        { alternateEmail: { $ne: null, $exists: true } }
      ]
    })
    .select('name email alternateEmail')
    .lean();
    
    console.log(`📊 Total de secretarias no banco com email: ${secretariasBanco.length}\n`);
    
    // Criar mapa de emails do banco
    const emailsBanco = new Map();
    secretariasBanco.forEach(s => {
      if (s.name && s.email) {
        emailsBanco.set(s.name.toLowerCase().trim(), {
          name: s.name,
          email: s.email,
          alternateEmail: s.alternateEmail
        });
      }
    });
    
    // Criar mapa de emails do mapeamento estático
    const emailsEstaticos = new Map();
    Object.entries(SECRETARIAS_EMAILS).forEach(([nome, email]) => {
      emailsEstaticos.set(nome.toLowerCase().trim(), { name: nome, email });
    });
    
    // Comparar e verificar
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 COMPARAÇÃO DE EMAILS:\n');
    
    const todasSecretarias = new Set([
      ...Array.from(emailsBanco.keys()),
      ...Array.from(emailsEstaticos.keys())
    ]);
    
    let totalVerificadas = 0;
    let totalCorretas = 0;
    let totalIncorretas = 0;
    let totalSemEmail = 0;
    const problemas = [];
    
    for (const nomeLower of todasSecretarias) {
      const infoBanco = emailsBanco.get(nomeLower);
      const infoEstatico = emailsEstaticos.get(nomeLower);
      
      const nome = infoBanco?.name || infoEstatico?.name || nomeLower;
      
      // Testar função getEmailSecretaria
      const emailFuncao = getEmailSecretaria(nome);
      
      // Determinar email esperado (prioridade: banco > estático > padrão)
      let emailEsperado = null;
      let fonte = '';
      
      if (infoBanco?.email) {
        emailEsperado = infoBanco.email;
        fonte = 'BANCO';
      } else if (infoEstatico?.email) {
        emailEsperado = infoEstatico.email;
        fonte = 'ESTÁTICO';
      } else {
        emailEsperado = EMAIL_PADRAO;
        fonte = 'PADRÃO';
      }
      
      // Verificar se está correto
      const emailCorreto = emailFuncao === emailEsperado || 
                          (emailEsperado === EMAIL_PADRAO && emailFuncao === EMAIL_PADRAO);
      
      totalVerificadas++;
      
      if (!emailEsperado || emailEsperado === EMAIL_PADRAO) {
        totalSemEmail++;
        problemas.push({
          secretaria: nome,
          problema: 'Sem email cadastrado (usando padrão)',
          emailAtual: emailFuncao,
          fonte
        });
      } else if (!emailCorreto) {
        totalIncorretas++;
        problemas.push({
          secretaria: nome,
          problema: 'Email não corresponde',
          emailEsperado,
          emailAtual: emailFuncao,
          fonte
        });
      } else {
        totalCorretas++;
      }
    }
    
    // Exibir resumo
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 RESUMO DA VERIFICAÇÃO:\n');
    console.log(`   Total verificadas: ${totalVerificadas}`);
    console.log(`   ✅ Corretas: ${totalCorretas}`);
    console.log(`   ❌ Incorretas: ${totalIncorretas}`);
    console.log(`   ⚠️  Sem email (usando padrão): ${totalSemEmail}\n`);
    
    // Exibir problemas
    if (problemas.length > 0) {
      console.log('═══════════════════════════════════════════════════════════\n');
      console.log('⚠️  PROBLEMAS ENCONTRADOS:\n');
      
      problemas.forEach((p, index) => {
        console.log(`${index + 1}. ${p.secretaria}`);
        console.log(`   Problema: ${p.problema}`);
        if (p.emailEsperado) {
          console.log(`   Email esperado: ${p.emailEsperado} (${p.fonte})`);
        }
        console.log(`   Email atual: ${p.emailAtual}`);
        console.log('');
      });
    } else {
      console.log('✅ Nenhum problema encontrado! Todos os emails estão corretos.\n');
    }
    
    // Verificar secretarias comuns que aparecem em vencimentos
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔍 VERIFICAÇÃO DE SECRETARIAS COMUNS:\n');
    
    const secretariasComuns = [
      'Secretaria Municipal de Saúde',
      'Secretaria Municipal de Educação',
      'Secretaria Municipal de Obras e Agricultura',
      'Secretaria Municipal de Assistência Social e Direitos Humanos',
      'Secretaria Municipal de Segurança Pública',
      'Secretaria Municipal de Meio Ambiente',
      'Secretaria Municipal de Transportes e Serviços Públicos'
    ];
    
    for (const nome of secretariasComuns) {
      const emailFuncao = getEmailSecretaria(nome);
      const infoBanco = Array.from(emailsBanco.values()).find(s => 
        s.name && s.name.toLowerCase().includes(nome.toLowerCase())
      );
      
      console.log(`   ${nome}:`);
      console.log(`      Email (função): ${emailFuncao}`);
      if (infoBanco) {
        console.log(`      Email (banco): ${infoBanco.email || 'N/A'}`);
        if (infoBanco.alternateEmail) {
          console.log(`      Email alt (banco): ${infoBanco.alternateEmail}`);
        }
      } else {
        console.log(`      Email (banco): Não encontrado no banco`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar emails:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Desconectado do MongoDB');
  }
}

// Executar
verificarEmailsNotificacoes().catch(console.error);

