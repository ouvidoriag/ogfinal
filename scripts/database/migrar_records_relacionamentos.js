/**
 * Script: Migrar Relacionamentos em Records
 * 
 * Objetivo:
 * - Atualizar collection records
 * - Popular campos de relacionamento (secretariaId, bairroId, distritoId, etc.)
 * - Fazer matching inteligente entre campos de texto e IDs
 * - Gerar relatório de matching
 * 
 * CÉREBRO X-3
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Schemas simplificados
const RecordSchema = new mongoose.Schema({}, { strict: false, collection: 'records' });
const BairroSchema = new mongoose.Schema({}, { strict: false, collection: 'bairros' });
const DistritoSchema = new mongoose.Schema({}, { strict: false, collection: 'distritos' });
const SecretariaSchema = new mongoose.Schema({}, { strict: false, collection: 'secretarias_info' });
const EscolaSchema = new mongoose.Schema({}, { strict: false, collection: 'escolas' });
const UnidadeSaudeSchema = new mongoose.Schema({}, { strict: false, collection: 'unidades_saude' });

const Record = mongoose.model('Record', RecordSchema);
const Bairro = mongoose.model('Bairro', BairroSchema);
const Distrito = mongoose.model('Distrito', DistritoSchema);
const Secretaria = mongoose.model('Secretaria', SecretariaSchema);
const Escola = mongoose.model('Escola', EscolaSchema);
const UnidadeSaude = mongoose.model('UnidadeSaude', UnidadeSaudeSchema);

// Cache para otimizar lookups
const cache = {
    bairros: new Map(),
    secretarias: new Map(),
    escolas: new Map(),
    unidadesSaude: new Map()
};

async function carregarCaches() {
    console.log('📦 Carregando caches...');

    // Bairros
    const bairros = await Bairro.find().lean();
    bairros.forEach(b => {
        cache.bairros.set(b.nome, b);
        cache.bairros.set(b.nomeNormalizado, b);
        b.aliases?.forEach(alias => cache.bairros.set(alias.toLowerCase(), b));
    });

    // Secretarias
    const secretarias = await Secretaria.find().lean();
    secretarias.forEach(s => {
        cache.secretarias.set(s.name?.toLowerCase(), s);
        s.aliases?.forEach(alias => cache.secretarias.set(alias.toLowerCase(), s));
    });

    // Escolas
    const escolas = await Escola.find().lean();
    escolas.forEach(e => {
        cache.escolas.set(e.nome?.toLowerCase(), e);
    });

    // Unidades de Saúde
    const unidades = await UnidadeSaude.find().lean();
    unidades.forEach(u => {
        cache.unidadesSaude.set(u.nome?.toLowerCase(), u);
    });

    console.log(`  Bairros: ${cache.bairros.size}`);
    console.log(`  Secretarias: ${cache.secretarias.size}`);
    console.log(`  Escolas: ${cache.escolas.size}`);
    console.log(`  Unidades de Saúde: ${cache.unidadesSaude.size}`);
}

function buscarBairro(nome) {
    if (!nome) return null;
    return cache.bairros.get(nome) || cache.bairros.get(nome.toLowerCase()) || null;
}

function buscarSecretaria(nome) {
    if (!nome) return null;
    const key = nome.toLowerCase();

    // Busca exata
    let sec = cache.secretarias.get(key);
    if (sec) return sec;

    // Busca parcial (contém)
    for (const [k, v] of cache.secretarias.entries()) {
        if (k.includes(key) || key.includes(k)) {
            return v;
        }
    }

    return null;
}

function buscarEscola(nome) {
    if (!nome) return null;
    return cache.escolas.get(nome.toLowerCase()) || null;
}

function buscarUnidadeSaude(nome) {
    if (!nome) return null;
    return cache.unidadesSaude.get(nome.toLowerCase()) || null;
}

async function migrarRelacionamentos() {
    console.log('\n🔄 MIGRANDO RELACIONAMENTOS...\n');

    const totalRecords = await Record.countDocuments();
    console.log(`📊 Total de records: ${totalRecords}`);

    const stats = {
        total: totalRecords,
        processados: 0,
        comBairro: 0,
        comSecretaria: 0,
        comEscola: 0,
        comUnidadeSaude: 0,
        comDistrito: 0
    };

    const BATCH_SIZE = 1000;
    let skip = 0;

    while (skip < totalRecords) {
        const records = await Record.find().skip(skip).limit(BATCH_SIZE).lean();

        const bulkOps = [];

        for (const record of records) {
            const updates = {};

            // Buscar bairro
            if (record.bairro) {
                const bairro = buscarBairro(record.bairro);
                if (bairro) {
                    updates.bairroId = bairro._id;
                    updates.distritoId = bairro.distrito;
                    stats.comBairro++;
                    stats.comDistrito++;
                }
            }

            // Buscar secretaria
            if (record.orgaos) {
                const secretaria = buscarSecretaria(record.orgaos);
                if (secretaria) {
                    updates.secretariaId = secretaria._id;
                    stats.comSecretaria++;
                }
            }

            // Buscar escola
            if (record.unidadeCadastro) {
                const escola = buscarEscola(record.unidadeCadastro);
                if (escola) {
                    updates.escolaId = escola._id;
                    stats.comEscola++;
                }
            }

            // Buscar unidade de saúde
            if (record.unidadeSaude) {
                const unidade = buscarUnidadeSaude(record.unidadeSaude);
                if (unidade) {
                    updates.unidadeSaudeId = unidade._id;
                    stats.comUnidadeSaude++;
                }
            }

            if (Object.keys(updates).length > 0) {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: record._id },
                        update: { $set: updates }
                    }
                });
            }

            stats.processados++;
        }

        if (bulkOps.length > 0) {
            await Record.bulkWrite(bulkOps);
        }

        skip += BATCH_SIZE;
        console.log(`  Processados: ${stats.processados}/${totalRecords}`);
    }

    return stats;
}

(async () => {
    try {
        console.log('🚀 INICIANDO MIGRAÇÃO DE RELACIONAMENTOS...\n');

        await mongoose.connect(process.env.MONGODB_ATLAS_URL);
        console.log('✅ Conectado ao MongoDB\n');

        await carregarCaches();

        const stats = await migrarRelacionamentos();

        console.log('\n📊 ESTATÍSTICAS FINAIS:');
        console.log(`  Total processados: ${stats.processados}`);
        console.log(`  Com bairroId: ${stats.comBairro} (${(stats.comBairro / stats.total * 100).toFixed(1)}%)`);
        console.log(`  Com secretariaId: ${stats.comSecretaria} (${(stats.comSecretaria / stats.total * 100).toFixed(1)}%)`);
        console.log(`  Com escolaId: ${stats.comEscola} (${(stats.comEscola / stats.total * 100).toFixed(1)}%)`);
        console.log(`  Com unidadeSaudeId: ${stats.comUnidadeSaude} (${(stats.comUnidadeSaude / stats.total * 100).toFixed(1)}%)`);
        console.log(`  Com distritoId: ${stats.comDistrito} (${(stats.comDistrito / stats.total * 100).toFixed(1)}%)`);

        // Salvar relatório
        const relatorio = {
            dataGeracao: new Date().toISOString(),
            estatisticas: stats,
            percentuais: {
                bairro: (stats.comBairro / stats.total * 100).toFixed(2),
                secretaria: (stats.comSecretaria / stats.total * 100).toFixed(2),
                escola: (stats.comEscola / stats.total * 100).toFixed(2),
                unidadeSaude: (stats.comUnidadeSaude / stats.total * 100).toFixed(2),
                distrito: (stats.comDistrito / stats.total * 100).toFixed(2)
            }
        };

        const relatorioPath = path.join(__dirname, '../../data/normalized/relatorio_migracao.json');
        fs.writeFileSync(relatorioPath, JSON.stringify(relatorio, null, 2));
        console.log(`\n✅ Relatório salvo: ${relatorioPath}`);

        await mongoose.disconnect();
        console.log('\n🔌 Desconectado do MongoDB');
        console.log('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    }
})();
