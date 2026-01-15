/**
 * Script de Diagnóstico de Dados
 * Extrai estatísticas de servidores e unidades de cadastro
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from './src/config/database.js';
import Record from './src/models/Record.model.js';

async function diagnose() {
    try {
        const mongoUrl = process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL;
        if (!mongoUrl) {
            console.error('❌ MONGODB_ATLAS_URL ou DATABASE_URL não definido no .env');
            process.exit(1);
        }

        await initializeDatabase(mongoUrl);
        console.log('✅ Conectado ao banco de dados');

        const total = await Record.countDocuments();
        console.log(`\n📊 Total de registros: ${total}`);

        const servidores = await Record.distinct('servidor');
        console.log(`👥 Total de Cadastrantes (servidor) únicos: ${servidores.length}`);

        const uacs = await Record.distinct('unidadeCadastro');
        console.log(`🏥 Total de UAcs (unidadeCadastro) únicas: ${uacs.length}`);

        // Contagem por servidor (top 10)
        console.log('\n🔝 Top 10 Cadastrantes:');
        const topServidores = await Record.aggregate([
            { $group: { _id: '$servidor', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        topServidores.forEach(s => console.log(`   - ${s._id || 'N/A'}: ${s.count}`));

        // Contagem por UAC (top 10)
        console.log('\n🔝 Top 10 UAcs (unidadeCadastro):');
        const topUacs = await Record.aggregate([
            { $group: { _id: '$unidadeCadastro', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        topUacs.forEach(u => console.log(`   - ${u._id || 'N/A'}: ${u.count}`));

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        process.exit(1);
    }
}

diagnose();
