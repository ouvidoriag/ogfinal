/**
 * Script para mostrar amostra de dados
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function showSample() {
    await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL, { family: 4 });
    console.log('✅ Conectado\n');

    const db = mongoose.connection.db;
    const sample = await db.collection('records').findOne();

    console.log('📋 CAMPOS DO DOCUMENTO:\n');
    console.log(Object.keys(sample).join('\n'));

    console.log('\n📊 AMOSTRA DE VALORES:\n');
    console.log(JSON.stringify(sample, null, 2));

    await mongoose.disconnect();
}

showSample().catch(console.error);
