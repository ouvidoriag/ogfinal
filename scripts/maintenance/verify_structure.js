import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../../'); // Assumes script is in scripts/maintenance/

const checks = [
    { path: 'prisma', shouldExist: false },
    { path: 'mapa', shouldExist: false },
    { path: 'Backgound', shouldExist: false },
    { path: 'public/Backgound', shouldExist: false },
    { path: 'public/videos', shouldExist: true },
    { path: 'docs/06-arquitetura', shouldExist: true },
    { path: 'docs/architecture_map', shouldExist: false },
    { path: 'scripts/data/fetch_bruta_data.js', shouldExist: true },
    { path: 'scripts/data/fetch_sheet_data.js', shouldExist: true },
    { path: 'scripts/maintenance/diagnostico_dados.js', shouldExist: true },
    // Phase 2 Checks
    { path: 'scripts/maintenance/analisar-crossfilter.js', shouldExist: true },
    { path: 'scripts/maintenance/analyze-architecture.js', shouldExist: true },
    { path: 'scripts/tools/generate-api-docs.js', shouldExist: true },
    { path: 'scripts/test/test-cache-decision.js', shouldExist: true },
    { path: 'scripts/test-results.json', shouldExist: false },
    // Phase 3 Checks (Utils & Docs)
    { path: 'src/utils/cora/coraCache.js', shouldExist: true },
    { path: 'src/utils/cache/dbCache.js', shouldExist: true },
    { path: 'src/utils/filters/validateFilters.js', shouldExist: true },
    { path: 'src/utils/formatting/dateUtils.js', shouldExist: true }
];

let allPassed = true;

console.log(`Verifying structure in ${rootDir}...\n`);

checks.forEach(check => {
    const fullPath = path.join(rootDir, check.path);
    const exists = fs.existsSync(fullPath);

    if (exists === check.shouldExist) {
        console.log(`[PASS] ${check.path} ${check.shouldExist ? 'exists' : 'does not exist'}`);
    } else {
        console.log(`[FAIL] ${check.path} ${check.shouldExist ? 'should exist' : 'should NOT exist'} but ${exists ? 'does' : 'does not'}`);
        allPassed = false;
    }
});

// Check content of videos and maps
try {
    const videoFiles = fs.readdirSync(path.join(rootDir, 'public/videos'));
    console.log(`\n[INFO] public/videos contains ${videoFiles.length} files: ${videoFiles.join(', ')}`);
    if (videoFiles.length === 0) {
        console.log('[FAIL] public/videos is empty');
        allPassed = false;
    } else {
        console.log('[PASS] public/videos has content');
    }
} catch (e) {
    console.log(`[FAIL] Could not read public/videos: ${e.message}`);
    allPassed = false;
}

try {
    const mapFiles = fs.readdirSync(path.join(rootDir, 'docs/06-arquitetura'));
    console.log(`\n[INFO] docs/06-arquitetura contains ${mapFiles.length} files`);
    if (mapFiles.length === 0) {
        console.log('[FAIL] docs/06-arquitetura is empty');
        allPassed = false;
    } else {
        console.log('[PASS] docs/06-arquitetura has content');
    }
} catch (e) {
    console.log(`[FAIL] Could not read docs/06-arquitetura: ${e.message}`);
    allPassed = false;
}

if (allPassed) {
    console.log('\n✅ VERIFICATION SUCCESSFUL: 100% ORGANIZED');
    process.exit(0);
} else {
    console.error('\n❌ VERIFICATION FAILED');
    process.exit(1);
}
