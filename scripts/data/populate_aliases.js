
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SecretariaInfo from '../../src/models/SecretariaInfo.model.js';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ALIASES_MAP = {
    'Secretaria Municipal de Saúde': ['SMS', 'Saúde', 'Saude', 'SMSDC'],
    'Secretaria Municipal de Obras e Agricultura': ['Obras', 'Agricultura', 'SMOUH'],
    'Secretaria Municipal de Educação': ['Educação', 'Educacao', 'SME', 'SMEDC'],
    'Secretaria Municipal de Administração, Planejamento e Orçamento': ['Administração', 'Administracao', 'Planejamento', 'Orçamento', 'SMA'],
    'Secretaria Municipal de Fazenda': ['Fazenda', 'Finanças', 'SEFAZ'],
    'Secretaria Municipal de Assistência Social e Direitos Humanos': ['Assistência Social', 'Assistencia Social', 'Direitos Humanos', 'SMASDH'],
    'Secretaria Municipal de Serviços Públicos': ['Serviços Públicos', 'Servicos Publicos', 'SMSP'],
    'Secretaria Municipal de Transportes e Serviços Públicos': ['Transportes', 'Smtsp', 'Serviços Públicos'],
    'Secretaria Municipal de Segurança Pública': ['Segurança Pública', 'Seguranca Publica', 'SMSP'],
    'Secretaria Municipal de Urbanismo e Habitação': ['Urbanismo', 'Habitação', 'Habitacao', 'SMH', 'SEMUH'],
    'Secretaria Municipal de Meio Ambiente': ['Meio Ambiente', 'SMMA'],
    'Secretaria Municipal de Cultura e Turismo': ['Cultura', 'Turismo', 'SMCT'],
    'Secretaria Municipal de Esporte e Lazer': ['Esporte', 'Lazer', 'SMEL'],
    'Secretaria Municipal de Governo': ['Governo', 'SEGOV'],
    'Secretaria Municipal de Defesa Civil': ['Defesa Civil', 'Civil', 'SESDEC', 'DC'],
    'Secretaria Municipal de Proteção Animal': ['Proteção Animal', 'Animal', 'SMPA'],
    'Secretaria Municipal de Gestão e Inclusão e Mulher': ['Gestão', 'Inclusão', 'Mulher', 'SMDTI'],
    'Procuradoria-Geral do Município (PGM)': ['Procuradoria', 'PGM'],
    'Ouvidoria Geral do Município': ['Ouvidoria Geral', 'OGM'],
    'IPMDC – Instituto de Previdência dos Servidores Públicos do Município de Duque de Caxias': ['IPMDC'],
    'FUNDEC – Fundação de Apoio à Escola Técnica, Tecnologia, Esporte, Lazer, Cultura e Políticas Sociais de Duque de Caxias': ['FUNDEC']
};

async function updateAliases() {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URL || process.env.DATABASE_URL);
        console.log('Connected to MongoDB');

        for (const [officialName, aliases] of Object.entries(ALIASES_MAP)) {
            const result = await SecretariaInfo.updateOne(
                { name: officialName },
                { $addToSet: { aliases: { $each: aliases } } }
            );

            if (result.matchedCount > 0) {
                console.log(`Updated aliases for: ${officialName} (+${result.modifiedCount})`);
            } else {
                console.warn(`WARNING: Secretariat not found: "${officialName}"`);
            }
        }

        console.log('Done.');

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

updateAliases();
