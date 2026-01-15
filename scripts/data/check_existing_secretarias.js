
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);
        console.log("Connected to MongoDB");

        const count = await SecretariaInfo.countDocuments();
        console.log(`Total SecretariaInfo records: ${count}`);

        if (count > 0) {
            const samples = await SecretariaInfo.find().limit(5);
            console.log("Samples:", JSON.stringify(samples, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mongoose.disconnect();
    }
};

checkData();
