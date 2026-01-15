import 'dotenv/config';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_ATLAS_URL;

if (!uri) {
    console.error('MONGODB_ATLAS_URL is required');
    process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db();
        console.log(`Connected to database: ${db.databaseName}`);

        const collections = await db.listCollections().toArray();
        console.log('\nCollections found:');

        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`- ${col.name} (${count} documents)`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
