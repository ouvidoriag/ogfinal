/**
 * Teste do Endpoint de Secretarias
 * Verifica como os dados estão sendo retornados
 * 
 * CÉREBRO X-3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';

const MONGODB_URI = process.env.MONGODB_URI;

async function testSecretarias() {
  try {
    console.log('🔍 Conectando ao MongoDB...\n');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado!\n');

    console.log('📊 Buscando secretarias...\n');
    
    // Teste 1: Buscar todas as secretarias
    const secretarias = await SecretariaInfo.find({})
      .select('name acronym email alternateEmail phone phoneAlt address bairro district notes')
      .sort({ name: 1 })
      .lean();

    console.log(`✅ Encontradas ${secretarias.length} secretarias\n`);

    if (secretarias.length === 0) {
      console.log('⚠️ Nenhuma secretaria encontrada no banco!\n');
      await mongoose.disconnect();
      return;
    }

    // Mostrar primeiras 5 secretarias
    console.log('📋 Primeiras 5 secretarias encontradas:\n');
    secretarias.slice(0, 5).forEach((sec, index) => {
      console.log(`${index + 1}. ID: ${sec._id}`);
      console.log(`   name: ${sec.name || 'NULL'}`);
      console.log(`   acronym: ${sec.acronym || 'NULL'}`);
      console.log(`   email: ${sec.email || 'NULL'}`);
      console.log(`   alternateEmail: ${sec.alternateEmail || 'NULL'}`);
      console.log(`   phone: ${sec.phone || 'NULL'}`);
      console.log(`   address: ${sec.address || 'NULL'}`);
      console.log('');
    });

    // Verificar estrutura
    console.log('🔍 Estrutura do primeiro registro:\n');
    const primeira = secretarias[0];
    console.log('Campos disponíveis:', Object.keys(primeira));
    console.log('');

    // Verificar se há campos diferentes
    const camposUnicos = new Set();
    secretarias.forEach(s => {
      Object.keys(s).forEach(key => camposUnicos.add(key));
    });
    console.log('📌 Todos os campos encontrados:', Array.from(camposUnicos).sort());
    console.log('');

    // Verificar quantas têm name preenchido
    const comName = secretarias.filter(s => s.name && s.name.trim() !== '');
    const semName = secretarias.filter(s => !s.name || s.name.trim() === '');
    
    console.log(`✅ Secretarias com 'name': ${comName.length}`);
    console.log(`❌ Secretarias sem 'name': ${semName.length}`);
    
    if (semName.length > 0) {
      console.log('\n⚠️ Secretarias sem name (mostrando IDs):');
      semName.slice(0, 5).forEach(s => {
        console.log(`   - ID: ${s._id}, Campos: ${Object.keys(s).join(', ')}`);
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('❌ Erro:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testSecretarias();

