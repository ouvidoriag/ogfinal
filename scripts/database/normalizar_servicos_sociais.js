/**
 * Script: Normalização de Serviços Socioassistenciais
 * 
 * Objetivo:
 * - Ler ULTIMATE_servicos_socioassistenciais.json
 * - Converter coordenadas para endereços (usar coordenadas como metadado)
 * - Preencher bairros usando coordenadas e mapeamento
 * - Gerar arquivo servicos_sociais_normalizados.json
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
const INPUT_FILE = path.join(BANCO_DIR, 'ULTIMATE_servicos_socioassistenciais.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'servicos_sociais_normalizados.json');

// Criar diretório de saída se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extrair coordenadas do campo endereco
 */
function extrairCoordenadas(endereco) {
    if (!endereco || endereco === '-') return null;

    // Formato: "-22.792381903772878, -43.28927894961797"
    const match = endereco.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    if (match) {
        return {
            lat: parseFloat(match[1]),
            lng: parseFloat(match[2])
        };
    }

    return null;
}

/**
 * Extrair tipo do nome
 */
function extrairTipo(nome) {
    if (nome.includes('PSB')) return 'PSB';
    if (nome.includes('PSE')) return 'PSE';
    if (nome.includes('CRAS')) return 'CRAS';
    if (nome.includes('CREAS')) return 'CREAS';
    if (nome.includes('Centro POP')) return 'Centro POP';
    if (nome.includes('CADASTRO ÚNICO')) return 'Cadastro Único';
    return 'Outro';
}

/**
 * Inferir bairro do nome
 */
function inferirBairro(nome) {
    // Padrões comuns: "PSB - CRAS Beira Mar", "PSE - CREAS Centenário"
    const match = nome.match(/(?:CRAS|CREAS|Centro POP)\s+(.+)$/i);
    if (match) {
        return match[1].trim();
    }

    // Outros padrões
    if (nome.includes('Beira Mar')) return 'Parque Beira Mar';
    if (nome.includes('Gramacho') && !nome.includes('Jardim')) return 'Jardim Gramacho';
    if (nome.includes('Jardim Gramacho')) return 'Jardim Gramacho';
    if (nome.includes('Pilar')) return 'Pilar';
    if (nome.includes('Jardim Primavera')) return 'Jardim Primavera';
    if (nome.includes('Figueira')) return 'Figueira';
    if (nome.includes('Imbariê')) return 'Jardim Imbariê';
    if (nome.includes('Parada Morabi')) return 'Parada Morabi';
    if (nome.includes('Xerém')) return 'Xerém';
    if (nome.includes('Centenário')) return 'Vila Centenário';
    if (nome.includes('Vila Maria Helena')) return 'Vila Maria Helena';
    if (nome.includes('Parada Angélica')) return 'Parada Angélica';

    return null;
}

/**
 * Inferir distrito do bairro
 */
function inferirDistrito(bairro) {
    // Mapeamento simplificado (baseado em ULTIMATE_bairros_por_distrito.json)
    const distritosPorBairro = {
        'Parque Beira Mar': 1,
        'Jardim Gramacho': 1,
        'Pilar': 2,
        'Jardim Primavera': 2,
        'Figueira': 2,
        'Jardim Imbariê': 3,
        'Parada Morabi': 3,
        'Xerém': 4,
        'Vila Centenário': 1,
        'Vila Maria Helena': 2,
        'Parada Angélica': 3
    };

    return distritosPorBairro[bairro] || null;
}

/**
 * Processar serviços socioassistenciais
 */
function processarServicosSociais() {
    console.log('🔍 Lendo arquivo de serviços socioassistenciais...');
    const servicos = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    const servicosNormalizados = [];
    const estatisticas = {
        total: servicos.length,
        comCoordenadas: 0,
        semCoordenadas: 0,
        bairrosInferidos: 0,
        distritosInferidos: 0,
        porTipo: {}
    };

    console.log('\n🔄 Processando serviços socioassistenciais...\n');

    for (const servico of servicos) {
        const { id, numero, nome, unidade, tipo, nivel_protecao, endereco, bairro, cep, telefone, publico_atendido, periodo, capacidade } = servico;

        console.log(`🏢 Processando: ${nome}`);

        // Extrair coordenadas
        const coordenadas = extrairCoordenadas(endereco);

        if (coordenadas) {
            estatisticas.comCoordenadas++;
            console.log(`  ✅ Coordenadas extraídas: ${coordenadas.lat}, ${coordenadas.lng}`);
        } else {
            estatisticas.semCoordenadas++;
            console.log('  ⚠️  Sem coordenadas');
        }

        // Extrair tipo
        const tipoExtraido = tipo || extrairTipo(nome);

        // Inferir bairro
        const bairroInferido = bairro || inferirBairro(nome);

        if (bairroInferido && !bairro) {
            estatisticas.bairrosInferidos++;
            console.log(`  ✅ Bairro inferido: ${bairroInferido}`);
        }

        // Inferir distrito
        const distritoInferido = inferirDistrito(bairroInferido);

        if (distritoInferido) {
            estatisticas.distritosInferidos++;
            console.log(`  ✅ Distrito inferido: ${distritoInferido}`);
        }

        // Criar serviço normalizado
        const servicoNormalizado = {
            codigo: id,
            numero,
            nome,
            nomeNormalizado: nome.toLowerCase(),
            unidade,
            tipo: tipoExtraido,
            nivelProtecao: nivel_protecao,
            distrito: distritoInferido,
            bairro: bairroInferido,
            endereco: null, // Será preenchido manualmente ou via geocoding reverso
            cep: cep || null,
            telefone: telefone || null,
            coordenadas: coordenadas || { lat: null, lng: null },
            publicoAtendido: publico_atendido,
            periodo: periodo || null,
            capacidade: capacidade || null
        };

        servicosNormalizados.push(servicoNormalizado);

        // Estatísticas por tipo
        estatisticas.porTipo[tipoExtraido] = (estatisticas.porTipo[tipoExtraido] || 0) + 1;
    }

    // Ordenar por tipo e nome
    servicosNormalizados.sort((a, b) => {
        if (a.tipo !== b.tipo) return a.tipo.localeCompare(b.tipo);
        return a.nome.localeCompare(b.nome);
    });

    // Estatísticas
    console.log('\n📊 Estatísticas:');
    console.log(`  Total de serviços: ${estatisticas.total}`);
    console.log(`  Com coordenadas: ${estatisticas.comCoordenadas}`);
    console.log(`  Sem coordenadas: ${estatisticas.semCoordenadas}`);
    console.log(`  Bairros inferidos: ${estatisticas.bairrosInferidos}`);
    console.log(`  Distritos inferidos: ${estatisticas.distritosInferidos}`);

    console.log('\n  Distribuição por tipo:');
    Object.keys(estatisticas.porTipo).sort().forEach(tipo => {
        console.log(`    ${tipo}: ${estatisticas.porTipo[tipo]}`);
    });

    // Salvar resultado
    const resultado = {
        metadata: {
            dataGeracao: new Date().toISOString(),
            totalServicos: estatisticas.total,
            comCoordenadas: estatisticas.comCoordenadas,
            bairrosInferidos: estatisticas.bairrosInferidos,
            observacao: 'Endereços textuais devem ser preenchidos manualmente ou via geocoding reverso'
        },
        servicos: servicosNormalizados,
        estatisticas: {
            porTipo: estatisticas.porTipo
        }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`\n✅ Arquivo gerado: ${OUTPUT_FILE}`);

    console.log('\n⚠️  ATENÇÃO: Endereços textuais precisam ser preenchidos manualmente.');
    console.log('   Considere usar API de geocoding reverso (Google Maps, OpenStreetMap, etc.)');

    return resultado;
}

// Executar
try {
    console.log('🚀 Iniciando normalização de serviços socioassistenciais...\n');
    const resultado = processarServicosSociais();
    console.log('\n✅ Normalização concluída com sucesso!');
    process.exit(0);
} catch (error) {
    console.error('\n❌ Erro ao normalizar serviços socioassistenciais:', error);
    process.exit(1);
}
