/**
 * Script de Atualização Incremental de Zeladoria
 * 
 * Atualiza o banco de dados com dados do CSV base-de-protocolos.csv
 * - Compara registros existentes com os novos
 * - Atualiza APENAS os campos que mudaram
 * - Insere apenas novos registros
 * - NÃO duplica dados
 * 
 * CÉREBRO X-3 - Baseado no pipeline da Ouvidoria
 * 
 * Uso: node scripts/data/updateZeladoriaFromCSV.js
 * OU: npm run update:zeladoria
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

    // Formato: DD/MM/YYYY
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
 * Limpa coordenadas (remove aspas e caracteres especiais)
 */
function cleanCoordinate(str) {
    if (!str || str === '-' || str === '') return null;
    return String(str).trim().replace(/^['"]|['"]$/g, '').replace(/[^\d.-]/g, '') || null;
}

/**
 * Normaliza protocolo para comparação
 */
function normalizeProtocolo(protocolo) {
    if (!protocolo) return null;
    return String(protocolo).trim().replace(/\s+/g, '');
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
            // Remover aspas duplas no início e fim
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
 * Normaliza dados do CSV para o modelo Zeladoria
 */
function normalizeZeladoriaData(row) {
    const data = { ...row }; // JSON completo

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
 * Compara dois valores considerando null/undefined
 */
function valuesEqual(val1, val2) {
    const v1 = val1 === null || val1 === undefined ? null : String(val1).trim();
    const v2 = val2 === null || val2 === undefined ? null : String(val2).trim();
    return v1 === v2;
}

/**
 * Identifica campos que mudaram
 */
function getChangedFields(newData, existingRecord) {
    const changedFields = {};
    let hasChanges = false;

    // Campos para comparar
    const fieldsToCompare = [
        'origem', 'status', 'protocoloEmpresa', 'categoria', 'responsavel',
        'endereco', 'bairro', 'cidade', 'estado', 'dataCriacao', 'dataConclusao',
        'apoios', 'latitude', 'longitude', 'departamento', 'canal', 'prazo',
        'dataCriacaoIso', 'dataConclusaoIso'
    ];

    // Comparar cada campo
    for (const field of fieldsToCompare) {
        const newValue = newData[field];
        const existingValue = existingRecord[field];

        if (!valuesEqual(newValue, existingValue)) {
            changedFields[field] = newValue;
            hasChanges = true;
        }
    }

    // Verificar se o JSON completo mudou
    const newDataJson = newData.data || {};
    const existingDataJson = existingRecord.data || {};

    const jsonKeys = new Set([
        ...Object.keys(newDataJson),
        ...Object.keys(existingDataJson)
    ]);

    let jsonChanged = false;
    for (const key of jsonKeys) {
        if (!valuesEqual(newDataJson[key], existingDataJson[key])) {
            jsonChanged = true;
            break;
        }
    }

    if (jsonChanged) {
        changedFields.data = newData.data;
        hasChanges = true;
    }

    return { changedFields, hasChanges };
}

/**
 * Função principal
 */
async function main() {
    console.log('🚀 Iniciando atualização incremental de Zeladoria...\n');

    try {
        // Conectar ao MongoDB
        await mongoose.connect(process.env.MONGODB_ATLAS_URL);
        console.log('✅ Conectado ao MongoDB Atlas\n');

        // Caminho do arquivo CSV na raiz do projeto
        const csvPath = path.join(__dirname, '..', '..', '..', 'base-de-protocolos.csv');
        console.log(`📂 Lendo arquivo: ${csvPath}\n`);

        // Ler arquivo CSV
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

        // Contar registros antes
        const countBefore = await Zeladoria.countDocuments();
        console.log(`📊 Registros no banco antes: ${countBefore}\n`);

        // Buscar registros existentes
        console.log('🔍 Buscando registros existentes no banco...');
        const existingRecords = await Zeladoria.find({
            protocoloEmpresa: { $ne: null, $exists: true }
        }).lean();

        // Criar mapa para acesso rápido
        const protocolMap = new Map(); // protocolo normalizado -> registro completo

        existingRecords.forEach(record => {
            const protocoloNormalizado = normalizeProtocolo(record.protocoloEmpresa);
            if (protocoloNormalizado) {
                protocolMap.set(protocoloNormalizado, record);
            }
        });

        console.log(`✅ ${protocolMap.size} registros encontrados no banco\n`);

        // Preparar dados para inserção e atualização
        const toInsert = [];
        const toUpdate = [];
        let skipped = 0;
        let unchanged = 0;
        let duplicatasIgnoradas = 0;

        // Set para rastrear protocolos já processados (evitar duplicatas no CSV)
        const protocolosProcessados = new Set();

        console.log('🔄 Comparando dados e identificando mudanças...');
        for (const row of rows) {
            const normalized = normalizeZeladoriaData(row);

            if (!normalized.protocoloEmpresa) {
                skipped++;
                continue;
            }

            const protocoloNormalizado = normalizeProtocolo(normalized.protocoloEmpresa);

            if (!protocoloNormalizado) {
                skipped++;
                continue;
            }

            // Se já processamos este protocolo, ignorar (duplicata no CSV)
            if (protocolosProcessados.has(protocoloNormalizado)) {
                duplicatasIgnoradas++;
                continue;
            }

            // Marcar como processado
            protocolosProcessados.add(protocoloNormalizado);

            const existingRecord = protocolMap.get(protocoloNormalizado);

            if (existingRecord) {
                // Comparar e identificar mudanças
                const { changedFields, hasChanges } = getChangedFields(normalized, existingRecord);

                if (hasChanges) {
                    toUpdate.push({
                        _id: existingRecord._id,
                        protocolo: protocoloNormalizado,
                        changedFields: changedFields
                    });
                } else {
                    unchanged++;
                }
            } else {
                // Novo registro
                toInsert.push(normalized);
            }
        }

        console.log(`\n📊 Análise completa:`);
        console.log(`   - Para atualizar: ${toUpdate.length}`);
        console.log(`   - Para inserir: ${toInsert.length}`);
        console.log(`   - Sem mudanças: ${unchanged}`);
        console.log(`   - Sem protocolo: ${skipped}`);
        console.log(`   - Duplicatas no CSV: ${duplicatasIgnoradas}\n`);

        // Processar atualizações
        let updated = 0;
        let fieldsUpdated = 0;
        const batchSize = 500;

        if (toUpdate.length > 0) {
            console.log(`🔄 Atualizando ${toUpdate.length} registros (apenas campos alterados)...`);
            for (let i = 0; i < toUpdate.length; i += batchSize) {
                const slice = toUpdate.slice(i, i + batchSize);

                const updatePromises = slice.map(item => {
                    return Zeladoria.findByIdAndUpdate(
                        item._id,
                        { $set: item.changedFields },
                        { new: true }
                    ).then(result => {
                        fieldsUpdated += Object.keys(item.changedFields).length;
                        return result;
                    }).catch(error => {
                        console.error(`❌ Erro ao atualizar protocolo ${item.protocolo}:`, error.message);
                        return null;
                    });
                });

                const results = await Promise.all(updatePromises);
                updated += results.filter(r => r !== null).length;

                const processed = Math.min(i + batchSize, toUpdate.length);
                const progress = Math.round((processed / toUpdate.length) * 100);
                console.log(`📦 Atualizados: ${processed}/${toUpdate.length} (${progress}%) - ${fieldsUpdated} campos modificados`);
            }
            console.log('');
        }

        // Processar inserções
        let inserted = 0;

        if (toInsert.length > 0) {
            console.log(`➕ Inserindo ${toInsert.length} novos registros...`);
            for (let i = 0; i < toInsert.length; i += batchSize) {
                const slice = toInsert.slice(i, i + batchSize);

                try {
                    const result = await Zeladoria.insertMany(slice, { ordered: false });
                    inserted += result.length;
                } catch (error) {
                    // Se houver erro de duplicata, inserir um por um
                    if (error.code === 11000 || error.message.includes('duplicate')) {
                        console.warn(`⚠️ Duplicatas detectadas no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
                        for (const item of slice) {
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

                const processed = Math.min(i + batchSize, toInsert.length);
                const progress = Math.round((processed / toInsert.length) * 100);
                console.log(`📦 Inseridos: ${processed}/${toInsert.length} (${progress}%)`);
            }
            console.log('');
        }

        const countAfter = await Zeladoria.countDocuments();

        console.log('✅ Atualização incremental concluída!');
        console.log(`📊 Estatísticas finais:`);
        console.log(`   - Registros antes: ${countBefore}`);
        console.log(`   - Registros após: ${countAfter}`);
        console.log(`   - Registros atualizados: ${updated} (apenas campos que mudaram)`);
        console.log(`   - Total de campos modificados: ${fieldsUpdated}`);
        console.log(`   - Registros sem mudanças: ${unchanged}`);
        console.log(`   - Novos registros inseridos: ${inserted}`);
        console.log(`   - Sem protocolo (ignorados): ${skipped}`);
        console.log(`   - Duplicatas no CSV (ignoradas): ${duplicatasIgnoradas}`);
        console.log(`   - Diferença total: ${countAfter - countBefore} registros`);

    } catch (error) {
        console.error('❌ Erro durante atualização:', error);
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
