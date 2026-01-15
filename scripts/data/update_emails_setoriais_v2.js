
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import path from 'path';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';

// Setup environment
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EXPECTED_HEADER = ['OUVIDORIA SETORIAL', 'E-MAIL', 'SERVIDOR OUVINTE', 'E-MAIL'];
const FILE_PATH = 'c:\\Users\\501379.PMDC\\Desktop\\DRIVE\\Dashboard\\E-mails_Setoriais&Ouvintes2.xlsx';

async function connect() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);
    console.log('Connected.');
}

function cleanName(rawName) {
    if (!rawName) return '';
    let name = rawName.trim();

    // Remove prefixes
    const prefixes = [
        /Ouvidoria Setorial (de|da|do)\s*/i,
        /Servidor Ouvinte (da|do|de)?\s*Sec\.?\s*(de|da|do)?\s*/i,
        /Servidor Ouvinte (de|da|do)?\s*/i
    ];

    for (const prefix of prefixes) {
        name = name.replace(prefix, '');
    }

    return name.trim();
}

function cleanEmails(rawEmail) {
    if (!rawEmail) return [];

    // Split by common separators
    const parts = rawEmail.split(/[,;\/\n\r]+/).map(e => e.trim());

    // Filter valid-ish emails (basic check)
    return parts.filter(e => e.includes('@') && e.length > 5);
}

async function updateOrInsert(coreName, originalName, emails) {
    if (!coreName || emails.length === 0) return;

    console.log(`Processing: [${coreName}] (${emails.join(', ')})`);

    // Try to find existing secretariat
    // We try to match "Secretaria Municipal de [coreName]" or just "[coreName]" inside the name
    const regex = new RegExp(coreName, 'i');
    let matches = await SecretariaInfo.find({ name: { $regex: regex } });

    // Filter matches to avoid over-matching (e.g. "Obras" matching "Obras e Urbanismo" - acceptable, but "A" matching "Assistencia")
    // For now, accept broad matches but prioritize exact containment

    if (matches.length > 0) {
        console.log(`   Found ${matches.length} matches in DB. Updating...`);
        for (const doc of matches) {
            console.log(`   - Updating: ${doc.name}`);

            // Merge emails
            const currentEmails = doc.email ? doc.email.split(/[;,]+/).map(e => e.trim()) : [];
            const newEmails = [...new Set([...currentEmails, ...emails])];

            doc.email = newEmails.join(';');
            doc.rawData = {
                ...doc.rawData,
                updatedFromExcel: '2026-01-09',
                originalExcelName: originalName
            };

            await doc.save();
        }
    } else {
        console.log(`   No match found. Creating new record.`);
        const newName = originalName.includes('Secretaria') ? originalName : `Secretaria Municipal de ${coreName}`;

        await SecretariaInfo.create({
            name: newName,
            email: emails.join(';'),
            notes: `Importado de E-mails_Setoriais&Ouvintes2.xlsx (${originalName})`,
            rawData: {
                source: 'E-mails_Setoriais&Ouvintes2.xlsx',
                originalName: originalName,
                importedAt: new Date()
            }
        });
    }
}

async function run() {
    try {
        await connect();

        const workbook = XLSX.readFile(FILE_PATH);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });

        // Skip header
        const rows = data.slice(1);

        console.log(`Processing ${rows.length} rows...`);

        for (const row of rows) {
            // Group 1: Cols 0, 1
            const name1 = row[0];
            const email1 = row[1];
            if (name1 && email1) {
                const clean = cleanName(name1);
                const emails = cleanEmails(email1);
                await updateOrInsert(clean, name1, emails);
            }

            // Group 2: Cols 2, 3
            const name2 = row[2];
            const email2 = row[3];
            if (name2 && email2) {
                const clean = cleanName(name2);
                const emails = cleanEmails(email2);
                await updateOrInsert(clean, name2, emails);
            }
        }

        console.log('Update complete.');

    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
