/**
 * Script: Normalização de Bairros
 * 
 * Objetivo:
 * - Ler ULTIMATE_bairros_por_distrito.json
 * - Criar lista de bairros únicos
 * - Identificar e corrigir duplicações
 * - Criar mapeamento de variações → nome correto
 * - Gerar arquivo bairros_normalizados.json
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
const INPUT_FILE = path.join(BANCO_DIR, 'ULTIMATE_bairros_por_distrito.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'bairros_normalizados.json');

// Criar diretório de saída se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Dicionário de normalização (variações → nome correto)
const NORMALIZACAO = {
    // Variações conhecidas
    'Jardim Granacho': 'Jardim Gramacho',
    'Jd. Gramacho': 'Jardim Gramacho',
    'Jd. Anhangá': 'Jardim Anhangá',
    'Vila São Luiz': 'Vila São Luís',
    'S. Bento': 'São Bento',
    'Trevo sdas Missões': 'Trevo das Missões',
    'Sarapuí': 'Vila Sarapuí',
    'Imbariê': 'Jardim Imbariê',
    'Beira Mar': 'Parque Beira Mar',
    'Dr. Laureano': 'Doutor Laureano',
    'Mantiquira': 'Mantiqueira',
    'Petropólis': 'Petrópolis',

    // Bairros problemáticos
    '3358': null, // Remover - código inválido
    '': null // Remover - vazio
};

// Duplicações entre distritos (bairro → distrito correto)
const DISTRITO_CORRETO = {
    'Vila Centenário': 1, // Aparece em distrito 1 e 2
    'Vila Santa Cruz': 2, // Aparece em distrito 2 e 3
    'Chácaras Rio-Petrópolis': 2, // Aparece em distrito 2 e 4
    'Parque Eldorado': 2, // Aparece em distrito 2 e 4
    'Santa Cruz da Serra': 3, // Aparece em distrito 3 e 4
    'Santo Antônio': 2, // Aparece em distrito 2 e 4
    'Vila Operária': 1, // Aparece em distrito 1 e 4
    'Pilar': 2 // Aparece em distrito 1 e 2
};

/**
 * Normalizar nome de bairro
 */
function normalizarNome(nome) {
    if (!nome || nome.trim() === '') return null;

    // Aplicar normalização do dicionário
    if (NORMALIZACAO.hasOwnProperty(nome)) {
        return NORMALIZACAO[nome];
    }

    return nome.trim();
}

/**
 * Processar dados
 */
function processarBairros() {
    console.log('🔍 Lendo arquivo de bairros...');
    const dados = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    const bairrosMap = new Map(); // nome → dados do bairro
    const variacoesMap = new Map(); // nome normalizado → lista de variações
    const duplicacoes = [];

    // Processar cada distrito
    Object.keys(dados).forEach(distritoKey => {
        const numeroDistrito = parseInt(distritoKey.replace('distrito_', ''));
        const distrito = dados[distritoKey];

        console.log(`\n📍 Processando Distrito ${numeroDistrito}...`);

        Object.keys(distrito.bairros).forEach(nomeBairro => {
            const stats = distrito.bairros[nomeBairro];

            // Normalizar nome
            const nomeNormalizado = normalizarNome(nomeBairro);

            // Ignorar bairros inválidos
            if (!nomeNormalizado) {
                console.log(`  ⚠️  Ignorando bairro inválido: "${nomeBairro}"`);
                return;
            }

            // Verificar distrito correto (para duplicações)
            const distritoFinal = DISTRITO_CORRETO[nomeNormalizado] || numeroDistrito;

            // Verificar se já existe
            if (bairrosMap.has(nomeNormalizado)) {
                const existente = bairrosMap.get(nomeNormalizado);

                // Se for duplicação entre distritos
                if (existente.distrito !== distritoFinal) {
                    duplicacoes.push({
                        nome: nomeNormalizado,
                        distritos: [existente.distrito, numeroDistrito],
                        distritoCorreto: distritoFinal
                    });

                    console.log(`  🔄 Duplicação: "${nomeNormalizado}" (distritos ${existente.distrito} e ${numeroDistrito}, correto: ${distritoFinal})`);

                    // Atualizar para o distrito correto
                    if (distritoFinal === numeroDistrito) {
                        existente.distrito = distritoFinal;
                        existente.estatisticas = stats;
                    }
                } else {
                    // Somar estatísticas se for mesmo distrito
                    existente.estatisticas.escolas += stats.escolas;
                    existente.estatisticas.secretarias += stats.secretarias;
                    existente.estatisticas.unidades_saude += stats.unidades_saude;
                    existente.estatisticas.total += stats.total;
                }

                // Adicionar variação
                if (nomeBairro !== nomeNormalizado) {
                    if (!variacoesMap.has(nomeNormalizado)) {
                        variacoesMap.set(nomeNormalizado, [nomeNormalizado]);
                    }
                    if (!variacoesMap.get(nomeNormalizado).includes(nomeBairro)) {
                        variacoesMap.get(nomeNormalizado).push(nomeBairro);
                    }
                }
            } else {
                // Criar novo bairro
                bairrosMap.set(nomeNormalizado, {
                    nome: nomeNormalizado,
                    nomeNormalizado: nomeNormalizado.toLowerCase(),
                    distrito: distritoFinal,
                    estatisticas: {
                        escolas: stats.escolas,
                        secretarias: stats.secretarias,
                        unidades_saude: stats.unidades_saude,
                        total: stats.total
                    }
                });

                // Adicionar variação se diferente
                if (nomeBairro !== nomeNormalizado) {
                    variacoesMap.set(nomeNormalizado, [nomeNormalizado, nomeBairro]);
                    console.log(`  ✅ Normalizado: "${nomeBairro}" → "${nomeNormalizado}"`);
                } else {
                    variacoesMap.set(nomeNormalizado, [nomeNormalizado]);
                }
            }
        });
    });

    // Adicionar aliases aos bairros
    const bairrosArray = Array.from(bairrosMap.values()).map(bairro => {
        const aliases = variacoesMap.get(bairro.nome) || [bairro.nome];
        return {
            ...bairro,
            aliases: aliases.filter((v, i, a) => a.indexOf(v) === i) // remover duplicatas
        };
    });

    // Ordenar por distrito e nome
    bairrosArray.sort((a, b) => {
        if (a.distrito !== b.distrito) return a.distrito - b.distrito;
        return a.nome.localeCompare(b.nome);
    });

    // Estatísticas
    console.log('\n📊 Estatísticas:');
    console.log(`  Total de bairros normalizados: ${bairrosArray.length}`);
    console.log(`  Duplicações resolvidas: ${duplicacoes.length}`);
    console.log(`  Variações mapeadas: ${Array.from(variacoesMap.values()).reduce((acc, v) => acc + v.length - 1, 0)}`);

    // Distribuição por distrito
    const porDistrito = bairrosArray.reduce((acc, b) => {
        acc[b.distrito] = (acc[b.distrito] || 0) + 1;
        return acc;
    }, {});

    console.log('\n  Distribuição por distrito:');
    Object.keys(porDistrito).sort().forEach(d => {
        console.log(`    Distrito ${d}: ${porDistrito[d]} bairros`);
    });

    // Gerar relatório de duplicações
    if (duplicacoes.length > 0) {
        console.log('\n⚠️  Duplicações resolvidas:');
        duplicacoes.forEach(dup => {
            console.log(`  - ${dup.nome}: distritos ${dup.distritos.join(', ')} → distrito correto: ${dup.distritoCorreto}`);
        });
    }

    // Salvar resultado
    const resultado = {
        metadata: {
            dataGeracao: new Date().toISOString(),
            totalBairros: bairrosArray.length,
            duplicacoesResolvidas: duplicacoes.length,
            variacoesMapeadas: Array.from(variacoesMap.values()).reduce((acc, v) => acc + v.length - 1, 0)
        },
        bairros: bairrosArray,
        duplicacoes: duplicacoes
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`\n✅ Arquivo gerado: ${OUTPUT_FILE}`);

    // Gerar também arquivo de mapeamento de variações
    const mapeamentoFile = path.join(OUTPUT_DIR, 'mapeamento_bairros.json');
    const mapeamento = {};
    variacoesMap.forEach((aliases, nome) => {
        aliases.forEach(alias => {
            if (alias !== nome) {
                mapeamento[alias] = nome;
            }
        });
    });

    fs.writeFileSync(mapeamentoFile, JSON.stringify(mapeamento, null, 2), 'utf-8');
    console.log(`✅ Mapeamento gerado: ${mapeamentoFile}`);

    return resultado;
}

// Executar
try {
    console.log('🚀 Iniciando normalização de bairros...\n');
    const resultado = processarBairros();
    console.log('\n✅ Normalização concluída com sucesso!');
    process.exit(0);
} catch (error) {
    console.error('\n❌ Erro ao normalizar bairros:', error);
    process.exit(1);
}
