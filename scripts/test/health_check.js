
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Record from '../../src/models/Record.model.js';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import Zeladoria from '../../src/models/Zeladoria.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function healthCheck() {
    console.log('=== SYSTEM HEALTH CHECK ===\n');

    let issues = [];

    try {
        // 1. Database Connection
        console.log('1. Database Connection...');
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);
        console.log('   ✅ Connected to MongoDB Atlas');
    } catch (error) {
        console.log('   ❌ FAILED to connect to MongoDB:', error.message);
        issues.push('Database connection failed');
        return; // Can't continue without DB
    }

    try {
        // 2. Record Collection
        console.log('\n2. Record Collection...');
        const recordCount = await Record.countDocuments();
        console.log(`   ✅ ${recordCount} records found in 'records' collection`);

        if (recordCount === 0) {
            issues.push('No records found in main collection');
        }

        // 3. SecretariaInfo Collection
        console.log('\n3. SecretariaInfo Collection...');
        const secretariaCount = await SecretariaInfo.countDocuments();
        console.log(`   ✅ ${secretariaCount} secretarias found`);

        // 4. Zeladoria Collection
        console.log('\n4. Zeladoria Collection...');
        const zeladoriaCount = await Zeladoria.countDocuments();
        console.log(`   ✅ ${zeladoriaCount} zeladoria records found`);

        // 5. Check for records with missing required fields
        console.log('\n5. Data Quality Checks...');

        const missingProtocol = await Record.countDocuments({ protocolo: { $in: [null, '', undefined] } });
        if (missingProtocol > 0) {
            console.log(`   ⚠️  ${missingProtocol} records missing 'protocolo'`);
            issues.push(`${missingProtocol} records missing 'protocolo'`);
        } else {
            console.log('   ✅ All records have protocolo');
        }

        const missingStatus = await Record.countDocuments({ statusDemanda: { $in: [null, '', undefined] } });
        if (missingStatus > 0) {
            console.log(`   ⚠️  ${missingStatus} records missing 'statusDemanda'`);
            issues.push(`${missingStatus} records missing 'statusDemanda'`);
        } else {
            console.log('   ✅ All records have statusDemanda');
        }

        // 6. Check for duplicate protocols
        console.log('\n6. Duplicate Check...');
        const duplicateCheck = await Record.aggregate([
            { $group: { _id: '$protocolo', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } },
            { $limit: 5 }
        ]);

        if (duplicateCheck.length > 0) {
            console.log(`   ⚠️  Found ${duplicateCheck.length} duplicate protocols (showing 5)`);
            duplicateCheck.forEach(d => console.log(`      - ${d._id}: ${d.count}x`));
            issues.push('Duplicate protocols found');
        } else {
            console.log('   ✅ No duplicate protocols');
        }

        // 7. Recent data check
        console.log('\n7. Recent Data...');
        const lastRecord = await Record.findOne().sort({ dataCriacaoIso: -1 }).select('dataCriacaoIso protocolo').lean();
        if (lastRecord) {
            console.log(`   ✅ Most recent record: ${lastRecord.protocolo} (${lastRecord.dataCriacaoIso})`);
        }

    } catch (error) {
        console.log('   ❌ Error during checks:', error.message);
        issues.push(error.message);
    } finally {
        await mongoose.disconnect();
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    if (issues.length === 0) {
        console.log('✅ All checks passed. System is healthy.');
    } else {
        console.log(`⚠️  Found ${issues.length} issue(s):`);
        issues.forEach(i => console.log(`   - ${i}`));
    }
}

healthCheck();
