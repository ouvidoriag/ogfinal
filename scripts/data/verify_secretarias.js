
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function listAll() {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);

        const all = await SecretariaInfo.find().sort({ name: 1 });

        console.log('--- Current Secretarias List ---');
        all.forEach(s => {
            const emailCount = s.email ? s.email.split(';').length : 0;
            const source = s.rawData.updatedFromExcel ? 'UPDATED' : (s.rawData.source === 'E-mails_Setoriais&Ouvintes2.xlsx' ? 'NEW' : 'ORIGINAL');
            console.log(`[${source}] ${s.name} (${emailCount} emails)`);
            if (s.email) console.log(`      Emails: ${s.email}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

listAll();
