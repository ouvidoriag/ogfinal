import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

const uri = process.env.MONGODB_ATLAS_URL;
const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 60000, // 60s timeout
    connectTimeoutMS: 60000,
    socketTimeoutMS: 60000,
    family: 4 // Force IPv4
});

const APS_FILE = path.join(projectRoot, 'BANCO', 'APS_2025_completo.json');

function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim();
}

function determineTipo(nome) {
    const norm = normalizeText(nome);
    if (norm.includes('clinica da familia') || norm.includes('cf ')) return 'Clínica da Família';
    if (norm.includes('usf') || norm.includes('saude da familia')) return 'USF';
    if (norm.includes('ubs') || norm.includes('basica de saude')) return 'UBS';
    if (norm.includes('centro de saude') || norm.includes('cms')) return 'CMS';
    return 'Outros'; // Default
}

async function run() {
    try {
        console.log('🚀 Iniciando Importação de Dados APS 2025...\n');
        await client.connect();
        const db = client.db();
        const collection = db.collection('unidades_saude');

        // 1. Ler e Filtrar JSON
        console.log('📂 Lendo arquivo JSON...');
        const rawData = JSON.parse(fs.readFileSync(APS_FILE, 'utf8'));

        // Filtrar apenas unidades válidas (ignorar metadados/cabeçalhos do final)
        // Critério: ter ID começando com "aps_" e ter número válido
        const validUnits = rawData.filter(item =>
            item.id &&
            item.id.toString().startsWith('aps_') &&
            item.endereco &&
            item.endereco !== 'N/A' &&
            item.endereco !== 'ENDEREÇO' &&
            parseInt(item.numero)
        );

        console.log(`- Itens encontrados: ${rawData.length}`);
        console.log(`- Unidades válidas para importação: ${validUnits.length}`);

        // 2. Processar e Importar
        console.log('\n🔄 Processando e importando...');
        let updated = 0;
        let inserted = 0;

        for (const unit of validUnits) {
            // Normalização
            const tipo = determineTipo(unit.nome);
            const nomeNormalizado = normalizeText(unit.nome);

            // Preparar objeto para o banco (schema compatível com unidades existentes)
            const doc = {
                codigo: unit.id,          // Mapear id -> codigo
                numero: parseInt(unit.numero),
                nome: unit.nome.trim(),
                nomeNormalizado: nomeNormalizado,
                tipo: tipo,
                cnes: unit.cnes !== 'N/A' ? unit.cnes : null,
                endereco: unit.endereco.trim(),
                cep: unit.cep !== 'N/A' ? unit.cep : null,
                distrito: parseInt(unit.distrito) || null,
                // Tentar extrair bairro grosseiramente se possível, ou deixar null para preenchimento futuro
                // A geolocalização e bairroId serão enriquecidos depois se necessário
                updatedAt: new Date()
            };

            // Upsert: Atualizar se existir (pelo código), inserir se não
            const result = await collection.updateOne(
                { codigo: unit.id },
                {
                    $set: doc,
                    $setOnInsert: { createdAt: new Date() }
                },
                { upsert: true }
            );

            if (result.upsertedCount > 0) inserted++;
            if (result.modifiedCount > 0) updated++;

            process.stdout.write('.');
        }

        console.log('\n\n✅ Importação concluída!');
        console.log(`- Inseridos (Novos): ${inserted}`);
        console.log(`- Atualizados: ${updated}`);
        console.log(`- Total processado: ${validUnits.length}`);

        // 3. Verificação Final
        const totalCount = await collection.countDocuments();
        const apsCount = await collection.countDocuments({ codigo: { $regex: /^aps_/ } });
        const espCount = await collection.countDocuments({ codigo: { $regex: /^saude_/ } });

        console.log('\n📊 Estatísticas da Coleção "unidades_saude":');
        console.log(`- Total Geral: ${totalCount}`);
        console.log(`- APS (Novos): ${apsCount}`);
        console.log(`- Especializada (Antigos): ${espCount}`);

    } catch (err) {
        console.error('❌ Erro na importação:', err);
    } finally {
        await client.close();
    }
}

run();
