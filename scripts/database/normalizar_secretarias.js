/**
 * Script: Normalização de Secretarias
 * 
 * Objetivo:
 * - Ler ULTIMATE_secretarias.json
 * - Ler collection secretarias_info do MongoDB
 * - Fazer matching entre os dois
 * - Identificar lacunas (telefones, emails, siglas)
 * - Gerar relatório de dados faltantes
 * - Gerar arquivo secretarias_enriquecidas.json
 * 
 * CÉREBRO X-3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Caminhos
const BANCO_DIR = path.join(__dirname, '../../BANCO');
const OUTPUT_DIR = path.join(__dirname, '../../data/normalized');
const INPUT_FILE = path.join(BANCO_DIR, 'ULTIMATE_secretarias.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'secretarias_enriquecidas.json');
const MAPEAMENTO_BAIRROS = path.join(OUTPUT_DIR, 'mapeamento_bairros.json');

// Criar diretório de saída se não existir
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Schema simplificado de SecretariaInfo
const SecretariaInfoSchema = new mongoose.Schema({
    name: String,
    acronym: String,
    aliases: [String],
    email: String,
    alternateEmail: String,
    phone: String,
    phoneAlt: String,
    address: String,
    bairro: String,
    district: Number,
    notes: String,
    rawData: mongoose.Schema.Types.Mixed
}, { collection: 'secretarias_info' });

const SecretariaInfo = mongoose.model('SecretariaInfo', SecretariaInfoSchema);

// Dicionário de siglas/acrônimos
const ACRONIMOS = {
    'FUNDEC – FUNDAÇÃO DE APOIO À ESCOLA TÉCNICA, TECNOLOGIA, ESPORTE, LAZER, CULTURA E POLÍTICAS SOCIAIS DE DUQUE DE CAXIAS': 'FUNDEC',
    'IPMDC – INSTITUTO DE PREVIDÊNCIA DOS SERVIDORES PÚBLICOS DO MUNICÍPIO DE DUQUE DE CAXIAS': 'IPMDC',
    'OUVIDORIA GERAL DO MUNICÍPIO': 'OGM',
    'PROCURADORIA-GERAL DO MUNICÍPIO (PGM)': 'PGM',
    'SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO, PLANEJAMENTO E ORÇAMENTO': 'SMAPO',
    'SECRETARIA MUNICIPAL DE ARTICULAÇÃO INSTITUCIONAL': 'SMAI',
    'SECRETARIA MUNICIPAL DE ASSISTÊNCIA SOCIAL E DIREITOS HUMANOS': 'SMASDH',
    'SECRETARIA MUNICIPAL DE COMUNICAÇÃO SOCIAL E RELAÇÕES PÚBLICAS': 'SMCSRP',
    'SECRETARIA MUNICIPAL DE CULTURA E TURISMO': 'SMCT',
    'SECRETARIA MUNICIPAL DE DEFESA CIVIL': 'SMDC',
    'SECRETARIA MUNICIPAL DE EDUCAÇÃO': 'SME',
    'SECRETARIA MUNICIPAL DE ESPORTE E LAZER': 'SMEL',
    'SECRETARIA MUNICIPAL DE EVENTOS': 'SMEV',
    'SECRETARIA MUNICIPAL DE FAZENDA': 'SMF',
    'SECRETARIA MUNICIPAL DE GESTÃO E INCLUSÃO E MULHER': 'SMGIM',
    'SECRETARIA MUNICIPAL DE GOVERNO': 'SMG',
    'SECRETARIA MUNICIPAL DE MEIO AMBIENTE': 'SMMA',
    'SECRETARIA MUNICIPAL DE OBRAS E AGRICULTURA': 'SMOA',
    'SECRETARIA MUNICIPAL DE PROTEÇÃO ANIMAL': 'SMPA',
    'SECRETARIA MUNICIPAL DE SAÚDE': 'SMS',
    'SECRETARIA MUNICIPAL DE SEGURANÇA PÚBLICA': 'SMSP',
    'SECRETARIA MUNICIPAL DE TRABALHO, EMPREGO E RENDA': 'SMTER',
    'SECRETARIA MUNICIPAL DE TRANSPORTES E SERVIÇOS PÚBLICOS': 'SMTSP',
    'SECRETARIA MUNICIPAL DE URBANISMO E HABITAÇÃO': 'SMUH'
};

// Aliases conhecidos
const ALIASES_CONHECIDOS = {
    'SECRETARIA MUNICIPAL DE EDUCAÇÃO': ['SME', 'Educação', 'Sec. Educação'],
    'SECRETARIA MUNICIPAL DE SAÚDE': ['SMS', 'Saúde', 'Sec. Saúde'],
    'SECRETARIA MUNICIPAL DE ASSISTÊNCIA SOCIAL E DIREITOS HUMANOS': ['SMASDH', 'Assistência Social', 'Sec. Assistência Social'],
    'SECRETARIA MUNICIPAL DE TRANSPORTES E SERVIÇOS PÚBLICOS': ['SMTSP', 'Transportes', 'Sec. Transportes', 'Zeladoria'],
    'SECRETARIA MUNICIPAL DE SEGURANÇA PÚBLICA': ['SMSP', 'Segurança Pública', 'Sec. Segurança'],
    'OUVIDORIA GERAL DO MUNICÍPIO': ['OGM', 'Ouvidoria', 'Ouvidoria Geral']
};

/**
 * Normalizar bairro usando mapeamento
 */
function normalizarBairro(bairro) {
    if (!bairro) return null;

    // Tentar carregar mapeamento
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
 * Fazer matching entre nome da secretaria e dados do MongoDB
 */
function matchSecretaria(nomeArquivo, secretariasDB) {
    // Matching exato
    let match = secretariasDB.find(s => s.name === nomeArquivo);
    if (match) return match;

    // Matching por aliases
    match = secretariasDB.find(s => s.aliases && s.aliases.includes(nomeArquivo));
    if (match) return match;

    // Matching parcial (contém)
    match = secretariasDB.find(s => s.name.includes(nomeArquivo) || nomeArquivo.includes(s.name));
    if (match) return match;

    return null;
}

/**
 * Processar secretarias
 */
async function processarSecretarias() {
    console.log('🔍 Lendo arquivo de secretarias...');
    const secretariasArquivo = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_ATLAS_URL);
    console.log('✅ Conectado ao MongoDB');

    console.log('📊 Buscando secretarias do banco...');
    const secretariasDB = await SecretariaInfo.find().lean();
    console.log(`  Encontradas ${secretariasDB.length} secretarias no banco`);

    const secretariasEnriquecidas = [];
    const dadosFaltantes = {
        telefone: [],
        email: [],
        sigla: [],
        aliases: []
    };

    console.log('\n🔄 Processando secretarias...\n');

    for (const secArquivo of secretariasArquivo) {
        const { numero, nome, distrito, bairro, endereco, cep } = secArquivo;

        console.log(`📍 Processando: ${nome.substring(0, 50)}...`);

        // Fazer matching com banco
        const secDB = matchSecretaria(nome, secretariasDB);

        // Normalizar bairro
        const bairroNormalizado = normalizarBairro(bairro);

        // Criar sigla
        const acronym = ACRONIMOS[nome] || secDB?.acronym || null;

        // Criar aliases
        const aliases = ALIASES_CONHECIDOS[nome] || secDB?.aliases || [];
        if (acronym && !aliases.includes(acronym)) {
            aliases.push(acronym);
        }

        // Dados enriquecidos
        const secretariaEnriquecida = {
            numero,
            name: nome,
            nomeNormalizado: nome.toLowerCase(),
            acronym,
            aliases,
            email: secDB?.email || null,
            alternateEmail: secDB?.alternateEmail || null,
            phone: secDB?.phone || null,
            phoneAlt: secDB?.phoneAlt || null,
            address: endereco,
            bairro: bairroNormalizado,
            district: distrito,
            cep: cep !== 'Não informado' ? cep : null,
            notes: secDB?.notes || null,
            rawData: {
                arquivo: secArquivo,
                banco: secDB || null
            },
            // Metadados
            fonteEndereco: 'arquivo',
            fonteBairro: 'arquivo',
            fonteDistrito: 'arquivo',
            fonteCep: 'arquivo',
            fonteEmail: secDB?.email ? 'banco' : null,
            fonteTelefone: secDB?.phone ? 'banco' : null
        };

        // Identificar dados faltantes
        if (!secretariaEnriquecida.phone) {
            dadosFaltantes.telefone.push(nome);
            console.log('  ⚠️  Falta: telefone');
        }
        if (!secretariaEnriquecida.email) {
            dadosFaltantes.email.push(nome);
            console.log('  ⚠️  Falta: email');
        }
        if (!secretariaEnriquecida.acronym) {
            dadosFaltantes.sigla.push(nome);
            console.log('  ⚠️  Falta: sigla');
        }
        if (secretariaEnriquecida.aliases.length === 0) {
            dadosFaltantes.aliases.push(nome);
            console.log('  ⚠️  Falta: aliases');
        }

        if (secDB) {
            console.log('  ✅ Match encontrado no banco');
        } else {
            console.log('  ⚠️  Não encontrado no banco');
        }

        secretariasEnriquecidas.push(secretariaEnriquecida);
    }

    // Estatísticas
    console.log('\n📊 Estatísticas:');
    console.log(`  Total de secretarias: ${secretariasEnriquecidas.length}`);
    console.log(`  Matches com banco: ${secretariasEnriquecidas.filter(s => s.rawData.banco).length}`);
    console.log(`  Sem telefone: ${dadosFaltantes.telefone.length}`);
    console.log(`  Sem email: ${dadosFaltantes.email.length}`);
    console.log(`  Sem sigla: ${dadosFaltantes.sigla.length}`);
    console.log(`  Sem aliases: ${dadosFaltantes.aliases.length}`);

    // Salvar resultado
    const resultado = {
        metadata: {
            dataGeracao: new Date().toISOString(),
            totalSecretarias: secretariasEnriquecidas.length,
            matchesComBanco: secretariasEnriquecidas.filter(s => s.rawData.banco).length,
            dadosFaltantes: {
                telefone: dadosFaltantes.telefone.length,
                email: dadosFaltantes.email.length,
                sigla: dadosFaltantes.sigla.length,
                aliases: dadosFaltantes.aliases.length
            }
        },
        secretarias: secretariasEnriquecidas,
        relatorio: {
            semTelefone: dadosFaltantes.telefone,
            semEmail: dadosFaltantes.email,
            semSigla: dadosFaltantes.sigla,
            semAliases: dadosFaltantes.aliases
        }
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`\n✅ Arquivo gerado: ${OUTPUT_FILE}`);

    // Gerar relatório de dados faltantes
    const relatorioFile = path.join(OUTPUT_DIR, 'relatorio_secretarias_faltantes.txt');
    let relatorioTexto = '# Relatório de Dados Faltantes - Secretarias\n\n';
    relatorioTexto += `Data: ${new Date().toISOString()}\n\n`;

    if (dadosFaltantes.telefone.length > 0) {
        relatorioTexto += '## Secretarias sem Telefone:\n';
        dadosFaltantes.telefone.forEach(nome => {
            relatorioTexto += `- ${nome}\n`;
        });
        relatorioTexto += '\n';
    }

    if (dadosFaltantes.email.length > 0) {
        relatorioTexto += '## Secretarias sem Email:\n';
        dadosFaltantes.email.forEach(nome => {
            relatorioTexto += `- ${nome}\n`;
        });
        relatorioTexto += '\n';
    }

    fs.writeFileSync(relatorioFile, relatorioTexto, 'utf-8');
    console.log(`✅ Relatório gerado: ${relatorioFile}`);

    await mongoose.disconnect();
    console.log('🔌 Desconectado do MongoDB');

    return resultado;
}

// Executar
(async () => {
    try {
        console.log('🚀 Iniciando normalização de secretarias...\n');
        await processarSecretarias();
        console.log('\n✅ Normalização concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao normalizar secretarias:', error);
        process.exit(1);
    }
})();
