import 'dotenv/config';
import mongoose from 'mongoose';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';

async function main() {
    try {
        const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
        if (!uri) {
            throw new Error('MONGODB_URI or DATABASE_URL not defined in .env');
        }

        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const id = '692dd62ec1a85eb972cd16d2';
        const record = await SecretariaInfo.findById(id);

        if (!record) {
            console.log('❌ Record not found!');
            return;
        }

        console.log('📊 Current Data:', record.toObject());

        // Update with data from image
        record.email = 'smps.pmdc@gmail.com';
        record.alternateEmail = 'imprensa@duquedecaxias.rj.gov.br';
        record.acronym = 'SMPS';
        record.notes = 'Horário de Atendimento: de segunda a sexta-feira das 9h às 17h';

        await record.save();
        console.log('✅ Record updated successfully:', record.toObject());

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected');
    }
}

main();
