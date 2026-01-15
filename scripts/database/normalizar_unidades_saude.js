/**
 * Script: Normalização de Unidades de Saúde
 * 
 * Objetivo:
 * - Ler ULTIMATE_unidades_saude.json
 * - Normalizar bairros usando dicionário
 * - Validar telefones (remover "N/A")
 * - Gerar arquivo unidades_saude_normalizadas.json
 * 
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminhos
const BANCO_DIR = path.join(__dirname, '../../BANCO');
const OUTPUT_DIR = path.join(__dirname, '../../data/normalized');
const INPUT_FILE = path.join(BANCO_DIR, 'ULTIMATE_unidades_saude.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'unidades_saude_normalizadas.json');
const MAPEAMENTO_BAIRROS = path.join(OUTPUT_DIR, 'mapeamento_bairros.json');

// Criar diretório de saída se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Normalizar bairro usando mapeamento
 */
function normalizarBairro(bairro) {
    if (!bairro) return null;

    // Carregar mapeamento
    try {
        if (fs.existsSync(MAPEAMENTO_BAIRROS)) {
            const mapeamento = JSON.parse(fs.readFileSync(MAPEAMENTO_BAIRROS, 'utf-8'));
            return mapeamento[bairro] || bairro;
        }
    } catch (error) {
        console.warn('⚠️  Não foi possível carregar mapeamento de bairros');
    }

    return bairro;
}

/**
 * Validar e normalizar telefone
 */
function normalizarTelefone(telefone) {
    if (!telefone || telefone === 'N/A') return null;
    return telefone.trim();
}

/**
 * Processar unidades de saúde
 */
function processarUnidadesSaude() {
    console.log('🔍 Lendo arquivo de unidades de saúde...');
    const unidades = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    const unidadesNormalizadas = [];
    const estatisticas = {
        total: unidades.length,
        comTelefone: 0,
        semTelefone: 0,
        bairrosNormalizados: 0,
        porTipo: {},
        porDistrito: {}
    };

    console.log('\n🔄 Processando unidades de saúde...\n');

    for (const unidade of unidades) {
        const { id, numero, nome, tipo, endereco, bairro, cep, telefone, distrito } = unidade;

        console.log(`🏥 Processando: ${nome}`);

        // Normalizar bairro
        const bairroOriginal = bairro;
        const bairroNormalizado = normalizarBairro(bairro);

        if (bairroNormalizado !== bairroOriginal) {
            console.log(`  ✅ Bairro normalizado: "${bairroOriginal}" → "${bairroNormalizado}"`);
            estatisticas.bairrosNormalizados++;
        }

        // Normalizar telefone
        const telefoneNormalizado = normalizarTelefone(telefone);

        if (telefoneNormalizado) {
            estatisticas.comTelefone++;
        } else {
            estatisticas.semTelefone++;
            console.log('  ⚠️  Telefone inválido ou ausente');
        }

        // Criar unidade normalizada
        const unidadeNormalizada = {
            codigo: id,
            numero,
            nome,
            nomeNormalizado: nome.toLowerCase(),
            tipo,
            distrito,
            bairro: bairroNormalizado,
            bairroOriginal,
            endereco,
            cep,
            telefone: telefoneNormalizado,
            coordenadas: {
                lat: null,
                lng: null
            }
        };

        unidadesNormalizadas.push(unidadeNormalizada);

        // Estatísticas por tipo
        estatisticas.porTipo[tipo] = (estatisticas.porTipo[tipo] || 0) + 1;

        // Estatísticas por distrito
        estatisticas.porDistrito[distrito] = (estatisticas.porDistrito[distrito] || 0) + 1;
    }

    // Ordenar por distrito e nome
    unidadesNormalizadas.sort((a, b) => {
        if (a.distrito !== b.distrito) return a.distrito - b.distrito;
        return a.nome.localeCompare(b.nome);
    });

    // Estatísticas
    console.log('\n📊 Estatísticas:');
    console.log(`  Total de unidades: ${estatisticas.total}`);
    console.log(`  Com telefone: ${estatisticas.comTelefone}`);
    console.log(`  Sem telefone: ${estatisticas.semTelefone}`);
    console.log(`  Bairros normalizados: ${estatisticas.bairrosNormalizados}`);

    console.log('\n  Distribuição por tipo:');
    Object.keys(estatisticas.porTipo).sort().forEach(tipo => {
        console.log(`    ${tipo}: ${estatisticas.porTipo[tipo]}`);
    });

    console.log('\n  Distribuição por distrito:');
    Object.keys(estatisticas.porDistrito).sort().forEach(d => {
        console.log(`    Distrito ${d}: ${estatisticas.porDistrito[d]}`);
    });

    // Salvar resultado
    const resultado = {
        metadata: {
            dataGeracao: new Date().toISOString(),
            totalUnidades: estatisticas.total,
            comTelefone: estatisticas.comTelefone,
            semTelefone: estatisticas.semTelefone,
            bairrosNormalizados: estatisticas.bairrosNormalizados
        },
        unidades: unidadesNormalizadas,
        estatisticas: {
            porTipo: estatisticas.porTipo,
            porDistrito: estatisticas.porDistrito
        }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`\n✅ Arquivo gerado: ${OUTPUT_FILE}`);

    return resultado;
}

// Executar
try {
    console.log('🚀 Iniciando normalização de unidades de saúde...\n');
    const resultado = processarUnidadesSaude();
    console.log('\n✅ Normalização concluída com sucesso!');
    process.exit(0);
} catch (error) {
    console.error('\n❌ Erro ao normalizar unidades de saúde:', error);
    process.exit(1);
}
