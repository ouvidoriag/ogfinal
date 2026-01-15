/**
 * Script para buscar dados brutos do Google Sheets
 */
import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchRawData() {
    try {
        // Caminho para as credenciais (ajustado para o ambiente local)
        const credentialsPath = '../.github/workflows/credentials.json';
        const credentialsFile = path.resolve(__dirname, credentialsPath);

        if (!fs.existsSync(credentialsFile)) {
            console.error('❌ Arquivo de credenciais não encontrado em:', credentialsFile);
            process.exit(1);
        }

        const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
        // Como observado no main.py, pode ser base64
        let credentials;
        try {
            credentials = JSON.parse(credentialsContent);
        } catch (e) {
            // Tentar decodificar base64
            credentials = JSON.parse(Buffer.from(credentialsContent, 'base64').toString('utf-8'));
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const spreadsheetId = process.env.GOOGLE_SHEET_ID || '1SCifd4v8D54qihNbwFW2jhHlpR2YtIZVZo81u4qYhV4';

        console.log(`📊 Acessando planilha: ${spreadsheetId}`);

        // Obter metadados para saber a aba
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetName = spreadsheet.data.sheets[0].properties.title;

        console.log(`📥 Lendo aba: ${sheetName}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('⚠️ Nenhum dado encontrado.');
            return;
        }

        const headers = rows[0];
        const data = rows.slice(1);

        console.log(`✅ ${data.length} registros encontrados na planilha.`);

        // Identificar índices das colunas
        const idxServidor = headers.findIndex(h => /servidor/i.test(h));
        const idxUnidade = headers.findIndex(h => /unidade.cadastro|setor/i.test(h));

        console.log(`\n🔍 Mapeamento de Colunas:`);
        console.log(`   - Servidor: ${idxServidor >= 0 ? headers[idxServidor] : 'NÃO ENCONTRADA'}`);
        console.log(`   - Unidade Cadastro: ${idxUnidade >= 0 ? headers[idxUnidade] : 'NÃO ENCONTRADA'}`);

        if (idxServidor >= 0 && idxUnidade >= 0) {
            const servidoresSheet = new Set();
            const uacsSheet = new Set();

            data.forEach(row => {
                if (row[idxServidor]) servidoresSheet.add(row[idxServidor].trim());
                if (row[idxUnidade]) uacsSheet.add(row[idxUnidade].trim());
            });

            console.log(`\n📋 Estatísticas da Planilha:`);
            console.log(`   - Servidores Únicos: ${servidoresSheet.size}`);
            console.log(`   - UAcs Únicas: ${uacsSheet.size}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao buscar dados:', error.message);
        process.exit(1);
    }
}

fetchRawData();
