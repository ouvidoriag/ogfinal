/**
 * Script para buscar dados brutos da pasta do Google Drive
 */
import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchBrutaData() {
    try {
        const credentialsPath = '../.github/workflows/credentials.json';
        const credentialsFile = path.resolve(__dirname, credentialsPath);

        if (!fs.existsSync(credentialsFile)) {
            console.error('❌ Arquivo de credenciais não encontrado.');
            process.exit(1);
        }

        const credentialsContent = fs.readFileSync(credentialsFile, 'utf-8');
        let credentials;
        try {
            credentials = JSON.parse(credentialsContent);
        } catch (e) {
            credentials = JSON.parse(Buffer.from(credentialsContent, 'base64').toString('utf-8'));
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.metadata.readonly'
            ],
        });

        const authClient = await auth.getClient();
        const drive = google.drive({ version: 'v3', auth: authClient });
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        const folderId = '1qXj9eGauvOREKVgRPOfKjRlLSKhefXI5'; // GOOGLE_FOLDER_BRUTA

        console.log(`📂 Listando arquivos na pasta bruta: ${folderId}`);

        const res = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            orderBy: 'modifiedTime desc',
            pageSize: 1,
            fields: 'files(id, name, modifiedTime)',
        });

        const files = res.data.files;
        if (!files || files.length === 0) {
            console.log('⚠️ Nenhuma planilha encontrada na pasta bruta.');
            process.exit(1);
        }

        const latestFile = files[0];
        console.log(`📄 Última planilha: ${latestFile.name} (ID: ${latestFile.id}, Modificada em: ${latestFile.modifiedTime})`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: latestFile.id,
            range: 'A:Z', // Tentar ler as primeiras colunas
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('⚠️ Nenhum dado encontrado.');
            return;
        }

        const headers = rows[0];
        const data = rows.slice(1);

        console.log(`✅ ${data.length} registros encontrados na planilha BRUTA.`);

        const idxProtocolo = headers.findIndex(h => /protocolo/i.test(h));
        const idxServidor = headers.findIndex(h => /servidor/i.test(h));
        const idxUnidade = headers.findIndex(h => /unidade.cadastro|setor/i.test(h));
        const idxUac = headers.findIndex(h => /uac/i.test(h));

        console.log(`\n🔍 Mapeamento de Colunas (BRUTA):`);
        console.log(`   - Protocolo: ${idxProtocolo >= 0 ? headers[idxProtocolo] : 'NÃO ENCONTRADA'}`);
        console.log(`   - Servidor: ${idxServidor >= 0 ? headers[idxServidor] : 'NÃO ENCONTRADA'}`);
        console.log(`   - Unidade Cadastro: ${idxUnidade >= 0 ? headers[idxUnidade] : 'NÃO ENCONTRADA'}`);
        console.log(`   - UAc: ${idxUac >= 0 ? headers[idxUac] : 'NÃO ENCONTRADA'}`);

        const servidoresSet = new Set();
        const uacsSet = new Set();

        data.forEach(row => {
            const servidor = row[idxServidor];
            const unidade = row[idxUnidade] || row[idxUac];

            if (servidor && servidor.trim()) servidoresSet.add(servidor.trim());
            if (unidade && unidade.trim()) uacsSet.add(unidade.trim());
        });

        console.log(`\n📋 Estatísticas da Planilha BRUTA:`);
        console.log(`   - Servidores Únicos: ${servidoresSet.size}`);
        console.log(`   - UAcs Únicas: ${uacsSet.size}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

fetchBrutaData();
