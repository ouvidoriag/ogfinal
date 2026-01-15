/**
 * Script Consolidado: Criar Todas as Collections Restantes
 * 
 * Cria:
 * - Collection escolas
 * - Collection unidades_saude  
 * - Collection servicos_socioassistenciais
 * - Enriquece collection secretarias_info
 * 
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATA_DIR = path.join(__dirname, '../../data/normalized');

// ============================================
// SCHEMAS
// ============================================

// Schema Bairro (para lookups)
const BairroSchema = new mongoose.Schema({
    nome: String,
    nomeNormalizado: String,
    distrito: Number,
    aliases: [String]
}, { collection: 'bairros' });

const Bairro = mongoose.model('Bairro', BairroSchema);

// Schema Escola
const EscolaSchema = new mongoose.Schema({
    codigo: { type: String, unique: true, index: true },
    numero: Number,
    nome: { type: String, index: true },
    nomeNormalizado: { type: String, index: true },
    tipo: { type: String, index: true },
    distrito: { type: Number, index: true },
    bairro: String,
    bairroId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bairro', index: true },
    endereco: String,
    enderecoCompleto: String,
    cep: String,
    telefone: String,
    cidade: String,
    estado: String,
    ddd: String,
    codigoIbge: String,
    viacepConsultado: Boolean,
    coordenadas: { lat: Number, lng: Number }
}, { timestamps: true, collection: 'escolas' });

// Schema Unidade de Saúde
const UnidadeSaudeSchema = new mongoose.Schema({
    codigo: { type: String, unique: true, index: true },
    numero: Number,
    nome: { type: String, index: true },
    nomeNormalizado: { type: String, index: true },
    tipo: { type: String, index: true },
    distrito: { type: Number, index: true },
    bairro: String,
    bairroId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bairro', index: true },
    endereco: String,
    cep: String,
    telefone: String,
    coordenadas: { lat: Number, lng: Number }
}, { timestamps: true, collection: 'unidades_saude' });

// Schema Serviço Socioassistencial
const ServicoSocialSchema = new mongoose.Schema({
    codigo: { type: String, unique: true, index: true },
    numero: Number,
    nome: { type: String, index: true },
    nomeNormalizado: { type: String, index: true },
    unidade: String,
    tipo: { type: String, index: true },
    nivelProtecao: String,
    distrito: { type: Number, index: true },
    bairro: String,
    bairroId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bairro', index: true },
    endereco: String,
    cep: String,
    telefone: String,
    coordenadas: { lat: Number, lng: Number },
    publicoAtendido: String,
    periodo: String,
    capacidade: Number
}, { timestamps: true, collection: 'servicos_socioassistenciais' });

const Escola = mongoose.model('Escola', EscolaSchema);
const UnidadeSaude = mongoose.model('UnidadeSaude', UnidadeSaudeSchema);
const ServicoSocial = mongoose.model('ServicoSocial', ServicoSocialSchema);

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

async function buscarBairroId(nomeBairro) {
    if (!nomeBairro) return null;
    const Bairro = mongoose.model('Bairro');
    const bairro = await Bairro.findOne({
        $or: [
            { nome: nomeBairro },
            { aliases: nomeBairro },
            { nomeNormalizado: nomeBairro.toLowerCase() }
        ]
    });
    return bairro?._id || null;
}

// ============================================
// CRIAR ESCOLAS
// ============================================

async function criarEscolas() {
    console.log('\n📚 CRIANDO COLLECTION DE ESCOLAS...\n');

    const dados = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'escolas_normalizadas.json'), 'utf-8'));
    const escolas = dados.escolas;

    console.log(`📊 Total: ${escolas.length} escolas`);

    await Escola.deleteMany({});
    console.log('✅ Collection limpa');

    let importados = 0;
    for (const escola of escolas) {
        const bairroId = await buscarBairroId(escola.bairro);
        await Escola.create({ ...escola, bairroId });
        importados++;
        if (importados % 50 === 0) console.log(`  Importadas: ${importados}/${escolas.length}`);
    }

    console.log(`✅ Escolas importadas: ${importados}`);
    return importados;
}

// ============================================
// CRIAR UNIDADES DE SAÚDE
// ============================================

async function criarUnidadesSaude() {
    console.log('\n🏥 CRIANDO COLLECTION DE UNIDADES DE SAÚDE...\n');

    const dados = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'unidades_saude_normalizadas.json'), 'utf-8'));
    const unidades = dados.unidades;

    console.log(`📊 Total: ${unidades.length} unidades`);

    await UnidadeSaude.deleteMany({});
    console.log('✅ Collection limpa');

    let importados = 0;
    for (const unidade of unidades) {
        const bairroId = await buscarBairroId(unidade.bairro);
        await UnidadeSaude.create({ ...unidade, bairroId });
        importados++;
    }

    console.log(`✅ Unidades importadas: ${importados}`);
    return importados;
}

// ============================================
// CRIAR SERVIÇOS SOCIOASSISTENCIAIS
// ============================================

async function criarServicosSociais() {
    console.log('\n🏢 CRIANDO COLLECTION DE SERVIÇOS SOCIOASSISTENCIAIS...\n');

    const dados = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'servicos_sociais_normalizados.json'), 'utf-8'));
    const servicos = dados.servicos;

    console.log(`📊 Total: ${servicos.length} serviços`);

    await ServicoSocial.deleteMany({});
    console.log('✅ Collection limpa');

    let importados = 0;
    for (const servico of servicos) {
        const bairroId = await buscarBairroId(servico.bairro);
        await ServicoSocial.create({ ...servico, bairroId });
        importados++;
    }

    console.log(`✅ Serviços importados: ${importados}`);
    return importados;
}

// ============================================
// ENRIQUECER SECRETARIAS
// ============================================

async function enriquecerSecretarias() {
    console.log('\n🏛️  ENRIQUECENDO COLLECTION DE SECRETARIAS...\n');

    const dados = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'secretarias_enriquecidas.json'), 'utf-8'));
    const secretarias = dados.secretarias;

    const SecretariaInfo = mongoose.model('SecretariaInfo', new mongoose.Schema({}, { strict: false, collection: 'secretarias_info' }));

    console.log(`📊 Total: ${secretarias.length} secretarias`);

    let atualizados = 0;
    let criados = 0;

    for (const sec of secretarias) {
        const bairroId = await buscarBairroId(sec.bairro);

        const dados = {
            numero: sec.numero,
            name: sec.name,
            nomeNormalizado: sec.nomeNormalizado,
            acronym: sec.acronym,
            aliases: sec.aliases,
            email: sec.email,
            alternateEmail: sec.alternateEmail,
            phone: sec.phone,
            phoneAlt: sec.phoneAlt,
            address: sec.address,
            bairro: sec.bairro,
            bairroId,
            district: sec.district,
            cep: sec.cep,
            notes: sec.notes
        };

        const resultado = await SecretariaInfo.findOneAndUpdate(
            { numero: sec.numero },
            { $set: dados },
            { upsert: true, new: true }
        );

        if (resultado) {
            atualizados++;
        } else {
            criados++;
        }
    }

    console.log(`✅ Secretarias atualizadas: ${atualizados}`);
    console.log(`✅ Secretarias criadas: ${criados}`);
    return { atualizados, criados };
}

// ============================================
// EXECUTAR TUDO
// ============================================

(async () => {
    try {
        console.log('🚀 INICIANDO CRIAÇÃO DE COLLECTIONS...\n');

        await mongoose.connect(process.env.MONGODB_ATLAS_URL);
        console.log('✅ Conectado ao MongoDB\n');

        const resultados = {
            escolas: await criarEscolas(),
            unidadesSaude: await criarUnidadesSaude(),
            servicosSociais: await criarServicosSociais(),
            secretarias: await enriquecerSecretarias()
        };

        console.log('\n📊 RESUMO FINAL:');
        console.log(`  Escolas: ${resultados.escolas}`);
        console.log(`  Unidades de Saúde: ${resultados.unidadesSaude}`);
        console.log(`  Serviços Sociais: ${resultados.servicosSociais}`);
        console.log(`  Secretarias: ${resultados.secretarias.atualizados + resultados.secretarias.criados}`);

        await mongoose.disconnect();
        console.log('\n🔌 Desconectado do MongoDB');
        console.log('\n✅ TODAS AS COLLECTIONS CRIADAS COM SUCESSO!');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    }
})();
