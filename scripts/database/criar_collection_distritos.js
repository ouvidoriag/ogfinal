/**
 * Script: Criar Collection de Distritos
 * 
 * Objetivo:
 * - Criar collection distritos no MongoDB
 * - Gerar dados de distritos a partir de bairros_normalizados.json
 * - Criar índices
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

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Caminhos
const DATA_DIR = path.join(__dirname, '../../data/normalized');
const INPUT_FILE = path.join(DATA_DIR, 'bairros_normalizados.json');

// Schema de Distrito
const DistritoSchema = new mongoose.Schema({
    numero: {
        type: Number,
        required: true,
        unique: true,
        index: true,
        min: 1,
        max: 4
    },
    nome: {
        type: String,
        required: true
    },
    totalBairros: {
        type: Number,
        default: 0
    },
    estatisticas: {
        escolas: { type: Number, default: 0 },
        secretarias: { type: Number, default: 0 },
        unidades_saude: { type: Number, default: 0 },
        servicos_socioassistenciais: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'distritos'
});

const Distrito = mongoose.model('Distrito', DistritoSchema);

// Nomes dos distritos
const NOMES_DISTRITOS = {
    1: 'Primeiro Distrito',
    2: 'Segundo Distrito',
    3: 'Terceiro Distrito',
    4: 'Quarto Distrito'
};

/**
 * Criar collection e importar dados
 */
async function criarCollectionDistritos() {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB');

    console.log('\n🔍 Lendo arquivo de bairros normalizados...');
    const dados = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    const bairros = dados.bairros;

    // Agregar estatísticas por distrito
    console.log('\n📊 Agregando estatísticas por distrito...');
    const estatisticasPorDistrito = {};

    bairros.forEach(bairro => {
        const distrito = bairro.distrito;

        if (!estatisticasPorDistrito[distrito]) {
            estatisticasPorDistrito[distrito] = {
                totalBairros: 0,
                escolas: 0,
                secretarias: 0,
                unidades_saude: 0,
                total: 0
            };
        }

        estatisticasPorDistrito[distrito].totalBairros++;
        estatisticasPorDistrito[distrito].escolas += bairro.estatisticas.escolas;
        estatisticasPorDistrito[distrito].secretarias += bairro.estatisticas.secretarias;
        estatisticasPorDistrito[distrito].unidades_saude += bairro.estatisticas.unidades_saude;
        estatisticasPorDistrito[distrito].total += bairro.estatisticas.total;
    });

    // Limpar collection existente
    console.log('\n🗑️  Limpando collection existente...');
    await Distrito.deleteMany({});
    console.log('✅ Collection limpa');

    // Criar distritos
    console.log('\n📥 Criando distritos...');
    let importados = 0;
    let erros = 0;

    for (let numero = 1; numero <= 4; numero++) {
        const stats = estatisticasPorDistrito[numero] || {
            totalBairros: 0,
            escolas: 0,
            secretarias: 0,
            unidades_saude: 0,
            total: 0
        };

        try {
            await Distrito.create({
                numero,
                nome: NOMES_DISTRITOS[numero],
                totalBairros: stats.totalBairros,
                estatisticas: {
                    escolas: stats.escolas,
                    secretarias: stats.secretarias,
                    unidades_saude: stats.unidades_saude,
                    servicos_socioassistenciais: 0, // Será atualizado depois
                    total: stats.total
                }
            });

            importados++;
            console.log(`  ✅ Distrito ${numero}: ${NOMES_DISTRITOS[numero]} (${stats.totalBairros} bairros)`);
        } catch (error) {
            erros++;
            console.error(`  ❌ Erro ao criar Distrito ${numero}:`, error.message);
        }
    }

    // Estatísticas
    console.log('\n📊 Estatísticas de Criação:');
    console.log(`  Total: 4`);
    console.log(`  Criados: ${importados}`);
    console.log(`  Erros: ${erros}`);

    // Verificar índices
    console.log('\n🔍 Verificando índices...');
    const indices = await Distrito.collection.getIndexes();
    console.log('  Índices criados:');
    Object.keys(indices).forEach(idx => {
        console.log(`    - ${idx}`);
    });

    // Listar distritos criados
    console.log('\n📋 Distritos Criados:');
    const distritos = await Distrito.find().sort({ numero: 1 });
    distritos.forEach(d => {
        console.log(`  ${d.numero}. ${d.nome}`);
        console.log(`     Bairros: ${d.totalBairros}`);
        console.log(`     Escolas: ${d.estatisticas.escolas}`);
        console.log(`     Secretarias: ${d.estatisticas.secretarias}`);
        console.log(`     Unidades de Saúde: ${d.estatisticas.unidades_saude}`);
        console.log(`     Total: ${d.estatisticas.total}`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');

    return { importados, erros };
}

// Executar
(async () => {
    try {
        console.log('🚀 Iniciando criação da collection de distritos...\n');
        const resultado = await criarCollectionDistritos();
        console.log('\n✅ Collection de distritos criada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar collection de distritos:', error);
        process.exit(1);
    }
})();
