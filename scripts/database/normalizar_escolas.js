/**
 * Script: Normalização de Escolas
 * 
 * Objetivo:
 * - Ler ULTIMATE_escolas.json
 * - Remover \n dos nomes
 * - Normalizar bairros usando dicionário
 * - Validar dados (remover registros com numero: NaN)
 * - Gerar arquivo escolas_normalizadas.json
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
const INPUT_FILE = path.join(BANCO_DIR, 'ULTIMATE_escolas.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'escolas_normalizadas.json');
const MAPEAMENTO_BAIRROS = path.join(OUTPUT_DIR, 'mapeamento_bairros.json');

// Criar diretório de saída se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Normalizar bairro usando mapeamento
 */
function normalizarBairro(bairro) {
    if (!bairro || bairro.trim() === '') return null;

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
 * Normalizar nome (remover \n e espaços extras)
 */
function normalizarNome(nome) {
    if (!nome) return null;
    return nome.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Processar escolas
 */
function processarEscolas() {
    console.log('🔍 Lendo arquivo de escolas...');

    // Ler arquivo como texto e substituir NaN por null antes de parsear
    const textoArquivo = fs.readFileSync(INPUT_FILE, 'utf-8');
    const textoCorrigido = textoArquivo.replace(/:\s*NaN/g, ': null');
    const escolas = JSON.parse(textoCorrigido);

    const escolasNormalizadas = [];
    const escolasInvalidas = [];
    const estatisticas = {
        total: escolas.length,
        validas: 0,
        invalidas: 0,
        nomesNormalizados: 0,
        bairrosNormalizados: 0,
        semBairro: 0,
        semCep: 0,
        semViacep: 0,
        porTipo: {},
        porDistrito: {}
    };

    console.log('\n🔄 Processando escolas...\n');

    for (const escola of escolas) {
        const { id, numero, nome, tipo, distrito, bairro, endereco, endereco_completo, cep, telefone, viacep_consultado } = escola;

        // Validar número
        if (numero === null || isNaN(numero) || numero === 'xxx') {
            console.log(`⚠️  Escola inválida (numero: ${numero}): ${nome}`);
            escolasInvalidas.push({ id, numero, nome, motivo: 'numero_invalido' });
            estatisticas.invalidas++;
            continue;
        }

        console.log(`🏫 Processando: ${nome?.substring(0, 50)}...`);

        // Normalizar nome
        const nomeOriginal = nome;
        const nomeNormalizado = normalizarNome(nome);

        if (nomeNormalizado !== nomeOriginal) {
            console.log(`  ✅ Nome normalizado (removido \\n)`);
            estatisticas.nomesNormalizados++;
        }

        // Normalizar bairro
        const bairroOriginal = bairro;
        const bairroNormalizado = normalizarBairro(bairro);

        if (bairroNormalizado !== bairroOriginal && bairroNormalizado) {
            console.log(`  ✅ Bairro normalizado: "${bairroOriginal}" → "${bairroNormalizado}"`);
            estatisticas.bairrosNormalizados++;
        }

        if (!bairroNormalizado) {
            estatisticas.semBairro++;
            console.log('  ⚠️  Sem bairro');
        }

        if (!cep || cep === '') {
            estatisticas.semCep++;
        }

        if (!viacep_consultado) {
            estatisticas.semViacep++;
            console.log('  ⚠️  ViaCEP não consultado');
        }

        // Criar escola normalizada
        const escolaNormalizada = {
            codigo: id,
            numero,
            nome: nomeNormalizado,
            nomeNormalizado: nomeNormalizado?.toLowerCase(),
            tipo,
            distrito,
            bairro: bairroNormalizado,
            bairroOriginal,
            endereco,
            enderecoCompleto: endereco_completo,
            cep: cep || null,
            telefone: telefone || null,
            cidade: escola.cidade,
            estado: escola.estado,
            ddd: escola.ddd,
            codigoIbge: escola.codigo_ibge,
            viacepConsultado: viacep_consultado,
            coordenadas: {
                lat: null,
                lng: null
            }
        };

        escolasNormalizadas.push(escolaNormalizada);
        estatisticas.validas++;

        // Estatísticas por tipo
        estatisticas.porTipo[tipo] = (estatisticas.porTipo[tipo] || 0) + 1;

        // Estatísticas por distrito
        estatisticas.porDistrito[distrito] = (estatisticas.porDistrito[distrito] || 0) + 1;
    }

    // Ordenar por distrito e nome
    escolasNormalizadas.sort((a, b) => {
        if (a.distrito !== b.distrito) return a.distrito - b.distrito;
        return a.nome.localeCompare(b.nome);
    });

    // Estatísticas
    console.log('\n📊 Estatísticas:');
    console.log(`  Total de escolas: ${estatisticas.total}`);
    console.log(`  Válidas: ${estatisticas.validas}`);
    console.log(`  Inválidas: ${estatisticas.invalidas}`);
    console.log(`  Nomes normalizados: ${estatisticas.nomesNormalizados}`);
    console.log(`  Bairros normalizados: ${estatisticas.bairrosNormalizados}`);
    console.log(`  Sem bairro: ${estatisticas.semBairro}`);
    console.log(`  Sem CEP: ${estatisticas.semCep}`);
    console.log(`  Sem ViaCEP: ${estatisticas.semViacep}`);

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
            totalEscolas: estatisticas.total,
            escolasValidas: estatisticas.validas,
            escolasInvalidas: estatisticas.invalidas,
            nomesNormalizados: estatisticas.nomesNormalizados,
            bairrosNormalizados: estatisticas.bairrosNormalizados
        },
        escolas: escolasNormalizadas,
        escolasInvalidas,
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
    console.log('🚀 Iniciando normalização de escolas...\n');
    const resultado = processarEscolas();
    console.log('\n✅ Normalização concluída com sucesso!');
    process.exit(0);
} catch (error) {
    console.error('\n❌ Erro ao normalizar escolas:', error);
    process.exit(1);
}
