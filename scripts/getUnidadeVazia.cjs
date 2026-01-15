const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL, { family: 4 });
    const db = mongoose.connection.db;

    const docs = await db.collection('records').find({
        $or: [
            { unidadeCadastro: null },
            { unidadeCadastro: '' },
            { unidadeCadastro: { $exists: false } }
        ]
    }).project({
        protocolo: 1,
        unidadeCadastro: 1,
        tema: 1,
        orgaos: 1,
        statusDemanda: 1,
        dataDaCriacao: 1
    }).toArray();

    console.log('\n📋 Protocolos com unidadeCadastro vazio/null:\n');
    console.log('='.repeat(80));

    docs.forEach(d => {
        console.log(`\nProtocolo: ${d.protocolo}`);
        console.log(`  Data: ${d.dataDaCriacao}`);
        console.log(`  Status: ${d.statusDemanda}`);
        console.log(`  Tema: ${d.tema}`);
        console.log(`  Órgãos: ${d.orgaos}`);
        console.log(`  unidadeCadastro: [${d.unidadeCadastro === null ? 'null' : d.unidadeCadastro === '' ? 'vazio' : 'inexistente'}]`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`Total: ${docs.length} registros`);

    await mongoose.disconnect();
})();
