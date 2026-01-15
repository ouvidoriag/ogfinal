
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function mergeDuplicates() {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);
        console.log('Connected. Searching for duplicates based on email...');

        const all = await SecretariaInfo.find();

        // Map email -> [docs]
        const emailMap = new Map();

        for (const doc of all) {
            if (!doc.email) continue;
            const emails = doc.email.split(/[;,]+/).map(e => e.trim());
            for (const email of emails) {
                if (!emailMap.has(email)) {
                    emailMap.set(email, []);
                }
                emailMap.get(email).push(doc);
            }
        }

        const processedIds = new Set();

        for (const [email, docs] of emailMap) {
            if (docs.length > 1) {
                // Determine the "Master" record (prefer one that is NOT strict 'NEW' if possible, or longer name)
                // Filter out already processed valid/master docs to avoid re-merging

                // Let's identify the pair
                const ids = docs.map(d => d._id.toString());
                const uniqueIds = [...new Set(ids)];

                if (uniqueIds.length <= 1) continue;

                if (processedIds.has(uniqueIds.sort().join(','))) continue;
                processedIds.add(uniqueIds.sort().join(','));

                console.log(`\nConflict found for email: ${email}`);
                console.log(`Records involved: ${docs.map(d => `"${d.name}" (${d._id})`).join(', ')}`);

                // Strategy: Keep the one with the most metadata or oldest.
                // Usually the 'ORIGINAL' (older creation) is better.
                docs.sort((a, b) => a.createdAt - b.createdAt); // Oldest first

                const master = docs[0];
                const duplicates = docs.slice(1);

                console.log(`   -> Merging into MASTER: "${master.name}"`);

                for (const dup of duplicates) {
                    if (dup._id.toString() === master._id.toString()) continue;

                    console.log(`   -> Merging data from "${dup.name}"...`);

                    // Merge emails
                    const masterEmails = master.email ? master.email.split(';') : [];
                    const dupEmails = dup.email ? dup.email.split(';') : [];
                    const allEmails = [...new Set([...masterEmails, ...dupEmails])].filter(Boolean);

                    master.email = allEmails.join(';');

                    // Merge Notes
                    if (dup.notes && (!master.notes || !master.notes.includes(dup.notes))) {
                        master.notes = (master.notes || '') + ' | ' + dup.notes;
                    }

                    // Save master
                    await master.save();
                    console.log(`   -> Master updated.`);

                    // ⚠️ DELETE Duplicate
                    await SecretariaInfo.findByIdAndDelete(dup._id);
                    console.log(`   -> Duplicate "${dup.name}" DELETED.`);
                }
            }
        }

        console.log('\nMerge complete.');

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

mergeDuplicates();
