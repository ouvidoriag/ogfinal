import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

const uri = process.env.MONGODB_ATLAS_URL;
const client = new MongoClient(uri);

// Caminhos dos arquivos JSON
const APS_FILE = path.join(projectRoot, 'BANCO', 'APS_2025_completo.json');
const ESP_FILE = path.join(projectRoot, 'BANCO', 'SAUDE_ESPECIALIZADA_2025.json');

async function run() {
    try {
        console.log('🔍 Iniciando Auditoria de Dados de Saúde 2025...\n');
        await client.connect();
        const db = client.db();

        // 1. Carregar Dados dos JSONs
        console.log('📂 Lendo arquivos JSON...');

        const rawAps = JSON.parse(fs.readFileSync(APS_FILE, 'utf8'));
        // Filtrar metadados do final do arquivo APS (itens sem 'cnes' numérico ou com id de texto descritivo)
        // O arquivo tem metadados no final. Vamos pegar apenas os que tem estrutura de unidade.
        // Olhando o arquivo, ids vão de aps_1 a aps_60, depois começam metadados.
        const apsData = rawAps.filter(item => item.id && item.id.startsWith('aps_') && item.endereco && item.endereco !== 'N/A' && item.endereco !== 'ENDEREÇO' && parseInt(item.numero));

        console.log(`- APS_2025_completo.json: ${rawAps.length} itens totais -> ${apsData.length} unidades válidas`);

        const espData = JSON.parse(fs.readFileSync(ESP_FILE, 'utf8'));
        console.log(`- SAUDE_ESPECIALIZADA_2025.json: ${espData.length} unidades`);

        // 2. Analisar Coleção 'bairros' (Suspeita de ser APS)
        console.log('\n🕵️  Analisando coleção "bairros"...');
        const bairrosDocs = await db.collection('bairros').find({}).toArray();
        console.log(`- Documentos encontrados: ${bairrosDocs.length}`);

        if (bairrosDocs.length > 0) {
            console.log('Amostra (primeiro item):', JSON.stringify(bairrosDocs[0], null, 2));

            // Comparar nomes para ver se batem com APS
            let matchesAps = 0;
            for (const doc of bairrosDocs) {
                if (apsData.find(aps => aps.nome === doc.nome || (doc.nome && aps.nome && doc.nome.includes(aps.nome.split(' (')[0])))) {
                    matchesAps++;
                }
            }
            console.log(`- Coincidências de nome com JSON APS: ${matchesAps}/${bairrosDocs.length}`);
        }

        // 3. Analisar Coleção 'unidades_saude'
        console.log('\n🕵️  Analisando coleção "unidades_saude"...');
        const unidadesDocs = await db.collection('unidades_saude').find({}).toArray();
        console.log(`- Documentos encontrados: ${unidadesDocs.length}`);

        if (unidadesDocs.length > 0) {
            console.log('Amostra (primeiro item):', JSON.stringify(unidadesDocs[0], null, 2));

            // Comparar com Especializada
            let matchesEsp = 0;
            for (const doc of unidadesDocs) {
                if (espData.find(esp => esp.nome === doc.nome)) {
                    matchesEsp++;
                }
            }
            console.log(`- Coincidências de nome com JSON Especializada: ${matchesEsp}/${unidadesDocs.length}`);
        }

        // 4. Verificar se precisamos atualizar
        console.log('\n📊 Conclusão Preliminar:');

        if (bairrosDocs.length === apsData.length) {
            console.log('✅ Coleção "bairros" parece estar sincronizada com APS_2025 (Quantidade bate).');
        } else {
            console.log(`⚠️  Diferença de quantidade em APS: JSON(${apsData.length}) vs Banco(${bairrosDocs.length})`);
        }

        if (unidadesDocs.length === espData.length) {
            console.log('✅ Coleção "unidades_saude" parece estar sincronizada com SAUDE_ESPECIALIZADA_2025 (Quantidade bate).');
        } else {
            console.log(`⚠️  Diferença de quantidade em Especializada: JSON(${espData.length}) vs Banco(${unidadesDocs.length})`);
        }

    } catch (err) {
        console.error('❌ Erro na auditoria:', err);
    } finally {
        await client.close();
    }
}

run();
