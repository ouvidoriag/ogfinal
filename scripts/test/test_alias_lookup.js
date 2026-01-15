
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testLookup() {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);

        const terms = [
            'Secretaria Municipal de Saúde', // Exact official
            'Saúde', // Alias
            'SMS', // Alias
            'Obras', // Alias
            'Urbanismo', // Alias
            'NonExistent'
        ];

        console.log('--- Testing findByName with Aliases ---');

        for (const term of terms) {
            const result = await SecretariaInfo.findByName(term);
            const found = result ? `✅ FOUND: ${result.name}` : '❌ NOT FOUND';
            console.log(`Query: "${term}" -> ${found}`);
        }

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

testLookup();
