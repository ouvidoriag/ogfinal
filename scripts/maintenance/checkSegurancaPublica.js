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

        const secretarias = await SecretariaInfo.find({
            $or: [
                { name: /Segurança/i },
                { name: /Seguranca/i },
                { acronym: /SMPS/i },
                { email: /smps/i }
            ]
        });

        console.log(`📊 Found ${secretarias.length} records matching 'Segurança' or 'SMPS':`);
        secretarias.forEach(s => {
            console.log('------------------------------------------------');
            console.log(`ID: ${s._id}`);
            console.log(`Name: ${s.name}`);
            console.log(`Acronym: ${s.acronym}`);
            console.log(`Email: ${s.email}`);
            console.log(`Address: ${s.address}`);
            console.log(`Phone: ${s.phone}`);
            console.log('------------------------------------------------');
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected');
    }
}

main();
