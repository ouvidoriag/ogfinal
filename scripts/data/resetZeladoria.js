/**
 * Script de Reset e Importação de Zeladoria
 * 
 * 1. Limpa (zera) a collection de Zeladoria
 * 2. Importa dados do CSV base-de-protocolos.csv
 * 
 * CÉREBRO X-3
 * 
 * Uso: node scripts/data/resetZeladoria.js
 * OU: npm run reset:zeladoria
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Zeladoria from '../../src/models/Zeladoria.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converte data DD/MM/YYYY para YYYY-MM-DD
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '' || dateStr === '-') return null;

    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }
    return null;
}

/**
 * Limpa e normaliza string
 */
function cleanString(str) {
    if (!str || str === '-' || str === '') return null;
    const cleaned = String(str).trim();
    return cleaned === '' ? null : cleaned;
}

/**
 * Converte string para número inteiro
 */
function parseInteger(str) {
    if (!str || str === '-' || str === '') return null;
    const num = parseInt(String(str).trim().replace(/[^\d-]/g, ''), 10);
    return isNaN(num) ? null : num;
}

/**
 * Limpa coordenadas
 */
function cleanCoordinate(str) {
    if (!str || str === '-' || str === '') return null;
    return String(str).trim().replace(/^['"]|['"]$/g, '').replace(/[^\d.-]/g, '') || null;
}

/**
 * Parse CSV linha por linha
 */
function parseCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];

    // Primeira linha são os cabeçalhos
    const headers = lines[0].split(';').map(h => h.trim().replace(/^"|"$/g, ''));

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        const row = {};

        headers.forEach((header, index) => {
            let value = values[index]?.trim() || '';
            value = value.replace(/^"|"$/g, '');
            row[header] = value;
        });

        // Pular linhas vazias
        if (Object.values(row).every(v => !v || v === '')) continue;

        data.push(row);
    }

    return data;
}

/**
 * Normaliza dados do CSV
 */
function normalizeZeladoriaData(row) {
    const data = { ...row };

    return {
        data: data,
        origem: cleanString(row['Origem']),
        status: cleanString(row['Status']),
        protocoloEmpresa: cleanString(row['Protocolo da Empresa']),
        categoria: cleanString(row['Categoria']),
        responsavel: cleanString(row['Responsável']),
        endereco: cleanString(row['Endereço']),
        bairro: cleanString(row['Bairro']),
        cidade: cleanString(row['Cidade']),
        estado: cleanString(row['Estado']),
        dataCriacao: cleanString(row['Data de criação']),
        dataConclusao: cleanString(row['Data de conclusão']),
        apoios: parseInteger(row['Apoios']),
        latitude: cleanCoordinate(row['Latitude']),
        longitude: cleanCoordinate(row['Longitude']),
        departamento: cleanString(row['Departamento']),
        canal: cleanString(row['Canal']),
        prazo: cleanString(row['Prazo']),
        dataCriacaoIso: parseDate(row['Data de criação']),
        dataConclusaoIso: parseDate(row['Data de conclusão']),
    };
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando reset e importação de Zeladoria...\n');

    try {
        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_ATLAS_URL);
        console.log('✅ Conectado ao MongoDB Atlas\n');

        // PASSO 1: Limpar collection
        console.log('🗑️  PASSO 1: Limpando collection de Zeladoria...');
        const countBefore = await Zeladoria.countDocuments();
        console.log(`📊 Registros antes da limpeza: ${countBefore}`);

        const deleteResult = await Zeladoria.deleteMany({});
        console.log(`✅ ${deleteResult.deletedCount} registros removidos\n`);

        // PASSO 2: Importar dados do CSV
        console.log('📥 PASSO 2: Importando dados do CSV...');
        const csvPath = path.join(__dirname, '..', '..', '..', 'base-de-protocolos.csv');
        console.log(`📂 Lendo arquivo: ${csvPath}\n`);

        const csvContent = readFileSync(csvPath, 'utf-8');
        console.log(`📊 Arquivo lido: ${(csvContent.length / 1024).toFixed(2)} KB\n`);

        // Parse CSV
        console.log('🔄 Processando CSV...');
        const rows = parseCSV(csvContent);
        console.log(`✅ ${rows.length} linhas encontradas\n`);

        if (rows.length === 0) {
            console.log('⚠️  Nenhum dado encontrado no CSV');
            return;
        }

        // Normalizar e preparar dados
        console.log('🔄 Normalizando dados...');
        const normalizedData = [];
        let skipped = 0;
        const protocolosProcessados = new Set();
        let duplicatasIgnoradas = 0;

        for (const row of rows) {
            const normalized = normalizeZeladoriaData(row);

            if (!normalized.protocoloEmpresa) {
                skipped++;
                continue;
            }

            // Evitar duplicatas no CSV
            const protocolo = normalized.protocoloEmpresa.trim();
            if (protocolosProcessados.has(protocolo)) {
                duplicatasIgnoradas++;
                continue;
            }

            protocolosProcessados.add(protocolo);
            normalizedData.push(normalized);
        }

        console.log(`✅ ${normalizedData.length} registros válidos preparados`);
        console.log(`   - Sem protocolo (ignorados): ${skipped}`);
        console.log(`   - Duplicatas no CSV (ignoradas): ${duplicatasIgnoradas}\n`);

        // Inserir em lotes
        console.log('💾 Inserindo dados no banco...');
        let inserted = 0;
        const batchSize = 500;

        for (let i = 0; i < normalizedData.length; i += batchSize) {
            const batch = normalizedData.slice(i, i + batchSize);

            try {
                const result = await Zeladoria.insertMany(batch, { ordered: false });
                inserted += result.length;
            } catch (error) {
                // Se houver erro, tentar inserir um por um
                if (error.code === 11000 || error.message.includes('duplicate')) {
                    console.warn(`⚠️ Duplicatas detectadas no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
                    for (const item of batch) {
                        try {
                            await Zeladoria.create(item);
                            inserted++;
                        } catch (e) {
                            if (e.code !== 11000 && !e.message.includes('duplicate')) {
                                console.error(`❌ Erro ao inserir protocolo ${item.protocoloEmpresa}:`, e.message);
                            }
                        }
                    }
                } else {
                    console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
                }
            }

            const processed = Math.min(i + batchSize, normalizedData.length);
            const progress = Math.round((processed / normalizedData.length) * 100);
            console.log(`📦 Inseridos: ${processed}/${normalizedData.length} (${progress}%)`);
        }

        const countAfter = await Zeladoria.countDocuments();

        console.log('\n✅ Reset e importação concluídos!');
        console.log(`📊 Estatísticas finais:`);
        console.log(`   - Registros removidos: ${deleteResult.deletedCount}`);
        console.log(`   - Registros inseridos: ${inserted}`);
        console.log(`   - Total no banco: ${countAfter}`);
        console.log(`   - Linhas processadas do CSV: ${rows.length}`);
        console.log(`   - Sem protocolo (ignorados): ${skipped}`);
        console.log(`   - Duplicatas no CSV (ignoradas): ${duplicatasIgnoradas}`);

    } catch (error) {
        console.error('❌ Erro durante reset:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Desconectado do MongoDB');
    }
}

// Executar
main()
    .then(() => {
        console.log('\n✨ Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Erro fatal:', error);
        process.exit(1);
    });
