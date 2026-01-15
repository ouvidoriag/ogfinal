/**
 * Script: Criar Collection de Bairros
 * 
 * Objetivo:
 * - Criar collection bairros no MongoDB
 * - Importar dados de bairros_normalizados.json
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

// Schema de Bairro
const BairroSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    nomeNormalizado: {
        type: String,
        required: true,
        index: true
    },
    distrito: {
        type: Number,
        required: true,
        index: true,
        min: 1,
        max: 4
    },
    aliases: {
        type: [String],
        default: [],
        index: true
    },
    estatisticas: {
        escolas: { type: Number, default: 0 },
        secretarias: { type: Number, default: 0 },
        unidades_saude: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    coordenadas: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    }
}, {
    timestamps: true,
    collection: 'bairros'
});

// Índices compostos
BairroSchema.index({ distrito: 1, nome: 1 });
BairroSchema.index({ nomeNormalizado: 1 });

const Bairro = mongoose.model('Bairro', BairroSchema);

/**
 * Criar collection e importar dados
 */
async function criarCollectionBairros() {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB');

    console.log('\n🔍 Lendo arquivo de bairros normalizados...');
    const dados = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    const bairros = dados.bairros;

    console.log(`📊 Total de bairros a importar: ${bairros.length}`);

    // Limpar collection existente
    console.log('\n🗑️  Limpando collection existente...');
    await Bairro.deleteMany({});
    console.log('✅ Collection limpa');

    // Importar bairros
    console.log('\n📥 Importando bairros...');
    let importados = 0;
    let erros = 0;

    for (const bairro of bairros) {
        try {
            await Bairro.create(bairro);
            importados++;
            console.log(`  ✅ ${bairro.nome} (Distrito ${bairro.distrito})`);
        } catch (error) {
            erros++;
            console.error(`  ❌ Erro ao importar ${bairro.nome}:`, error.message);
        }
    }

    // Estatísticas
    console.log('\n📊 Estatísticas de Importação:');
    console.log(`  Total: ${bairros.length}`);
    console.log(`  Importados: ${importados}`);
    console.log(`  Erros: ${erros}`);

    // Verificar índices
    console.log('\n🔍 Verificando índices...');
    const indices = await Bairro.collection.getIndexes();
    console.log('  Índices criados:');
    Object.keys(indices).forEach(idx => {
        console.log(`    - ${idx}`);
    });

    // Estatísticas por distrito
    console.log('\n📊 Distribuição por Distrito:');
    const porDistrito = await Bairro.aggregate([
        { $group: { _id: '$distrito', total: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    porDistrito.forEach(d => {
        console.log(`  Distrito ${d._id}: ${d.total} bairros`);
    });

    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');

    return { importados, erros };
}

// Executar
(async () => {
    try {
        console.log('🚀 Iniciando criação da collection de bairros...\n');
        const resultado = await criarCollectionBairros();
        console.log('\n✅ Collection de bairros criada com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao criar collection de bairros:', error);
        process.exit(1);
    }
})();
