import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeDatabase } from '../../src/config/database.js';
import User from '../../src/models/User.model.js';

async function fixMaster() {
    try {
        await initializeDatabase(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);

        // Atualizar master para admin
        const master = await User.findOneAndUpdate(
            { username: 'master' },
            { $set: { role: 'admin' } },
            { new: true }
        );

        if (master) {
            console.log('✅ Usuário master atualizado para ADMIN');
        } else {
            console.log('❌ Usuário master não encontrado');
        }

    } catch (error) {
        console.error(error);
    } finally {
        mongoose.connection.close();
    }
}

fixMaster();
