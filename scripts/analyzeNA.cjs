/**
 * Script COMPLETO para analisar dados NA/NÃO INFORMADO
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function analyzeNAData() {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL, { family: 4 });
    console.log('✅ Conectado ao MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('records');

    // Campos REAIS do schema
    const campos = [
        'tema', 'assunto', 'canal', 'prioridade',
        'tipoDeManifestacao', 'statusDemanda',
        'endereco', 'servidor', 'responsavel',
        'unidadeCadastro', 'unidadeSaude', 'orgaos'
    ];

    console.log('📊 ANÁLISE DE DADOS NA/NÃO INFORMADO');
    console.log('='.repeat(70));

    const total = await collection.countDocuments();
    console.log(`Total de registros: ${total}\n`);

    console.log('CAMPO                  | QTD NA/VAZIO  | PERCENTUAL');
    console.log('-'.repeat(70));

    for (const campo of campos) {
        const naCount = await collection.countDocuments({
            $or: [
                { [campo]: { $regex: /^(NA|N\/A|NÃO INFORMADO|Não informado|não informado)$/i } },
                { [campo]: '' },
                { [campo]: null },
                { [campo]: { $exists: false } }
            ]
        });

        const pct = ((naCount / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(pct / 5));
        console.log(`${campo.padEnd(22)} | ${naCount.toString().padStart(6)}       | ${pct.padStart(5)}% ${bar}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📋 DETALHAMENTO DOS VALORES "NÃO INFORMADO":\n');

    for (const campo of ['endereco', 'servidor', 'unidadeSaude', 'orgaos']) {
        const valores = await collection.aggregate([
            { $group: { _id: '$' + campo, count: { $sum: 1 } } },
            {
                $match: {
                    $or: [
                        { _id: { $regex: /não informad|n\/a|^na$/i } },
                        { _id: null },
                        { _id: '' }
                    ]
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        if (valores.length > 0) {
            console.log(`\n${campo.toUpperCase()}:`);
            valores.forEach(v => console.log(`  "${v._id || '[null]'}": ${v.count} registros`));
        }
    }

    // Análise de tempoDeResolucaoEmDias null
    console.log('\n' + '='.repeat(70));
    console.log('\n⏱️ TEMPO DE RESOLUÇÃO (tempoDeResolucaoEmDias):');

    const tempoNull = await collection.countDocuments({ tempoDeResolucaoEmDias: null });
    const tempoZero = await collection.countDocuments({ tempoDeResolucaoEmDias: 0 });
    const tempoValido = await collection.countDocuments({ tempoDeResolucaoEmDias: { $gt: 0 } });

    console.log(`  Null/Sem valor: ${tempoNull} (${((tempoNull / total) * 100).toFixed(1)}%)`);
    console.log(`  Zero dias: ${tempoZero} (${((tempoZero / total) * 100).toFixed(1)}%)`);
    console.log(`  Com valor > 0: ${tempoValido} (${((tempoValido / total) * 100).toFixed(1)}%)`);

    await mongoose.disconnect();
    console.log('\n✅ Análise concluída');
}

analyzeNAData().catch(console.error);
