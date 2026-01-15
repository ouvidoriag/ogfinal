/**
 * Script para analisar dados NA/NÃO INFORMADO no banco
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function analyzeNAData() {
    const uri = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;

    await mongoose.connect(uri, { family: 4 });
    console.log('✅ Conectado ao MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('records');

    // Campos principais para verificar
    const campos = [
        'secretaria', 'tema', 'assunto', 'categoria', 'bairro',
        'tipoDeManifestacao', 'statusDemanda', 'canal', 'prioridade',
        'servidor', 'departamento', 'localizacao'
    ];

    console.log('📊 ANÁLISE DE DADOS NA/NÃO INFORMADO');
    console.log('='.repeat(60));

    const total = await collection.countDocuments();
    console.log(`Total de registros: ${total}\n`);

    for (const campo of campos) {
        const naCount = await collection.countDocuments({
            $or: [
                { [campo]: 'NA' },
                { [campo]: 'N/A' },
                { [campo]: 'NÃO INFORMADO' },
                { [campo]: 'Não Informado' },
                { [campo]: 'não informado' },
                { [campo]: '' },
                { [campo]: null },
                { [campo]: { $exists: false } }
            ]
        });

        if (naCount > 0) {
            const pct = ((naCount / total) * 100).toFixed(1);
            console.log(`${campo.padEnd(20)}: ${naCount.toString().padStart(5)} registros (${pct}%)`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n📋 VALORES ESPECÍFICOS POR CAMPO:\n');

    for (const campo of ['secretaria', 'tema', 'assunto', 'bairro', 'statusDemanda']) {
        const valores = await collection.aggregate([
            { $group: { _id: '$' + campo, count: { $sum: 1 } } },
            {
                $match: {
                    $or: [
                        { _id: { $in: ['NA', 'N/A', 'NÃO INFORMADO', 'Não Informado', '', null] } },
                        { _id: null }
                    ]
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        if (valores.length > 0) {
            console.log(`\n${campo.toUpperCase()}:`);
            valores.forEach(v => console.log(`  '${v._id}': ${v.count} registros`));
        }
    }

    await mongoose.disconnect();
    console.log('\n✅ Análise concluída');
}

analyzeNAData().catch(console.error);
