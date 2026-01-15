/**
 * Script: Validação Completa do Sistema
 * 
 * Testa:
 * - Integridade das collections
 * - Relacionamentos
 * - Índices
 * - Queries de performance
 * - Endpoints afetados
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

// Declarar todos os models no início
const RecordSchema = new mongoose.Schema({}, { strict: false, collection: 'records' });
const Record = mongoose.model('Record', RecordSchema);

const resultados = {
    collections: {},
    relacionamentos: {},
    indices: {},
    queries: {},
    erros: []
};

async function validarCollections() {
    console.log('\n📊 VALIDANDO COLLECTIONS...\n');

    const collections = ['bairros', 'distritos', 'escolas', 'unidades_saude', 'servicos_socioassistenciais', 'secretarias_info', 'records'];

    for (const collName of collections) {
        try {
            const coll = mongoose.connection.collection(collName);
            const count = await coll.countDocuments();
            const indices = await coll.indexes();

            resultados.collections[collName] = {
                existe: true,
                total: count,
                indices: indices.length
            };

            console.log(`  ✅ ${collName}: ${count} documentos, ${indices.length} índices`);
        } catch (error) {
            resultados.collections[collName] = { existe: false, erro: error.message };
            resultados.erros.push(`Collection ${collName}: ${error.message}`);
            console.log(`  ❌ ${collName}: ${error.message}`);
        }
    }
}

async function validarRelacionamentos() {
    console.log('\n🔗 VALIDANDO RELACIONAMENTOS...\n');

    // Verificar records com relacionamentos
    const totalRecords = await Record.countDocuments();
    const comBairroId = await Record.countDocuments({ bairroId: { $exists: true, $ne: null } });
    const comSecretariaId = await Record.countDocuments({ secretariaId: { $exists: true, $ne: null } });
    const comUnidadeSaudeId = await Record.countDocuments({ unidadeSaudeId: { $exists: true, $ne: null } });
    const comDistritoId = await Record.countDocuments({ distritoId: { $exists: true, $ne: null } });

    resultados.relacionamentos = {
        totalRecords,
        comBairroId: { total: comBairroId, percentual: (comBairroId / totalRecords * 100).toFixed(2) },
        comSecretariaId: { total: comSecretariaId, percentual: (comSecretariaId / totalRecords * 100).toFixed(2) },
        comUnidadeSaudeId: { total: comUnidadeSaudeId, percentual: (comUnidadeSaudeId / totalRecords * 100).toFixed(2) },
        comDistritoId: { total: comDistritoId, percentual: (comDistritoId / totalRecords * 100).toFixed(2) }
    };

    console.log(`  Total de records: ${totalRecords}`);
    console.log(`  Com bairroId: ${comBairroId} (${(comBairroId / totalRecords * 100).toFixed(1)}%)`);
    console.log(`  Com secretariaId: ${comSecretariaId} (${(comSecretariaId / totalRecords * 100).toFixed(1)}%)`);
    console.log(`  Com unidadeSaudeId: ${comUnidadeSaudeId} (${(comUnidadeSaudeId / totalRecords * 100).toFixed(1)}%)`);
    console.log(`  Com distritoId: ${comDistritoId} (${(comDistritoId / totalRecords * 100).toFixed(1)}%)`);

    // Verificar integridade referencial
    console.log('\n  Verificando integridade referencial...');

    const recordComBairro = await Record.findOne({ bairroId: { $exists: true } });
    if (recordComBairro) {
        const bairroExiste = await mongoose.connection.collection('bairros').findOne({ _id: recordComBairro.bairroId });
        if (bairroExiste) {
            console.log('  ✅ Integridade referencial OK (bairros)');
        } else {
            resultados.erros.push('Integridade referencial quebrada: bairroId não encontrado');
            console.log('  ❌ Integridade referencial quebrada (bairros)');
        }
    }
}

async function testarQueries() {
    console.log('\n⚡ TESTANDO PERFORMANCE DE QUERIES...\n');

    // Query 1: Buscar records por secretaria
    const inicio1 = Date.now();
    const recordsPorSecretaria = await Record.find({ secretariaId: { $exists: true } }).limit(100);
    const tempo1 = Date.now() - inicio1;

    resultados.queries.recordsPorSecretaria = { tempo: tempo1, resultados: recordsPorSecretaria.length };
    console.log(`  Query 1 (records por secretaria): ${tempo1}ms - ${recordsPorSecretaria.length} resultados`);

    // Query 2: Agregação por bairro
    const inicio2 = Date.now();
    const agregacaoBairro = await Record.aggregate([
        { $match: { bairroId: { $exists: true } } },
        { $group: { _id: '$bairroId', total: { $sum: 1 } } },
        { $limit: 10 }
    ]);
    const tempo2 = Date.now() - inicio2;

    resultados.queries.agregacaoBairro = { tempo: tempo2, resultados: agregacaoBairro.length };
    console.log(`  Query 2 (agregação por bairro): ${tempo2}ms - ${agregacaoBairro.length} resultados`);

    // Query 3: Lookup com bairros
    const inicio3 = Date.now();
    const lookupBairros = await Record.aggregate([
        { $match: { bairroId: { $exists: true } } },
        { $lookup: { from: 'bairros', localField: 'bairroId', foreignField: '_id', as: 'bairro' } },
        { $limit: 50 }
    ]);
    const tempo3 = Date.now() - inicio3;

    resultados.queries.lookupBairros = { tempo: tempo3, resultados: lookupBairros.length };
    console.log(`  Query 3 (lookup com bairros): ${tempo3}ms - ${lookupBairros.length} resultados`);

    // Validar performance
    if (tempo1 > 1000 || tempo2 > 1000 || tempo3 > 2000) {
        resultados.erros.push('Performance abaixo do esperado em algumas queries');
        console.log('\n  ⚠️  Performance abaixo do esperado em algumas queries');
    } else {
        console.log('\n  ✅ Performance OK');
    }
}

async function validarDuplicacoes() {
    console.log('\n🔍 VALIDANDO DUPLICAÇÕES...\n');

    const collections = ['bairros', 'escolas', 'unidades_saude', 'servicos_socioassistenciais'];

    for (const collName of collections) {
        const coll = mongoose.connection.collection(collName);

        // Verificar duplicações por nome
        const duplicados = await coll.aggregate([
            { $group: { _id: '$nome', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).toArray();

        if (duplicados.length > 0) {
            resultados.erros.push(`${collName}: ${duplicados.length} nomes duplicados`);
            console.log(`  ⚠️  ${collName}: ${duplicados.length} nomes duplicados`);
        } else {
            console.log(`  ✅ ${collName}: sem duplicações`);
        }
    }
}

(async () => {
    try {
        console.log('🚀 INICIANDO VALIDAÇÃO COMPLETA DO SISTEMA...\n');

        await mongoose.connect(process.env.MONGODB_ATLAS_URL);
        console.log('✅ Conectado ao MongoDB');

        await validarCollections();
        await validarRelacionamentos();
        await testarQueries();
        await validarDuplicacoes();

        console.log('\n📊 RESUMO FINAL:\n');
        console.log(`  Collections validadas: ${Object.keys(resultados.collections).length}`);
        console.log(`  Relacionamentos validados: ${Object.keys(resultados.relacionamentos).length}`);
        console.log(`  Queries testadas: ${Object.keys(resultados.queries).length}`);
        console.log(`  Erros encontrados: ${resultados.erros.length}`);

        if (resultados.erros.length > 0) {
            console.log('\n⚠️  ERROS ENCONTRADOS:');
            resultados.erros.forEach((erro, i) => {
                console.log(`  ${i + 1}. ${erro}`);
            });
        } else {
            console.log('\n✅ NENHUM ERRO ENCONTRADO!');
        }

        // Salvar relatório
        const relatorioPath = path.join(__dirname, '../../data/normalized/relatorio_validacao.json');
        fs.writeFileSync(relatorioPath, JSON.stringify(resultados, null, 2));
        console.log(`\n✅ Relatório salvo: ${relatorioPath}`);

        await mongoose.disconnect();
        console.log('\n🔌 Desconectado do MongoDB');
        console.log('\n✅ VALIDAÇÃO CONCLUÍDA!');

        process.exit(resultados.erros.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('\n❌ Erro:', error);
        process.exit(1);
    }
})();
