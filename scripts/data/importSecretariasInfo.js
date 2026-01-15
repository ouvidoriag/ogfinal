/**
 * Script de Importação: Informações de Secretarias
 *
 * Lê a planilha "Dados e emails.xlsx" na raiz do projeto Dashboard
 * e grava/atualiza os registros na coleção secretarias_info.
 *
 * Uso:
 *   node NOVO/scripts/data/importSecretariasInfo.js
 *   ou, a partir da raiz do projeto:
 *   node NOVO/scripts/data/importSecretariasInfo.js
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function clean(str) {
  if (str === undefined || str === null) return null;
  const value = String(str).trim();
  if (!value || value === '-' || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') {
    return null;
  }
  return value;
}

/**
 * Faz o melhor esforço para extrair campos padronizados
 * a partir dos nomes de colunas mais comuns.
 */
function normalizeRow(row) {
  const name =
    clean(row.Secretaria) ||
    clean(row['Nome Secretaria']) ||
    clean(row['Órgão']) ||
    clean(row.Orgao) ||
    clean(row['Órgão/Secretaria']) ||
    clean(row['Órgão / Secretaria']) ||
    clean(row['Secretaria/Órgão']) ||
    clean(row['Secretaria / Órgão']) ||
    clean(row.nome) ||
    clean(row.Nome);

  const acronym =
    clean(row.Sigla) ||
    clean(row['Sigla Secretaria']) ||
    clean(row['Sigla Órgão']) ||
    clean(row.sigla);

  // Extrair email da coluna "E-mails / Observações" (pode conter email e observações)
  let emailRaw = 
    clean(row.Email) ||
    clean(row['E-mail']) ||
    clean(row['E-mail Principal']) ||
    clean(row.email) ||
    clean(row['Email Secretaria']) ||
    clean(row['E-mails']) ||
    clean(row['E-mails / Observações']);
  
  // Se emailRaw contém " / " ou " /", separar email das observações
  let email = emailRaw;
  let emailNotes = null;
  if (emailRaw && emailRaw.includes(' / ')) {
    const parts = emailRaw.split(' / ');
    email = clean(parts[0]);
    emailNotes = clean(parts.slice(1).join(' / '));
  } else if (emailRaw && emailRaw.includes(' /')) {
    const parts = emailRaw.split(' /');
    email = clean(parts[0]);
    emailNotes = clean(parts.slice(1).join(' /'));
  }
  
  // Se ainda não tem email, tentar extrair de outras colunas
  if (!email) {
    email = emailRaw;
  }

  const alternateEmail =
    clean(row['Email 2']) ||
    clean(row['Email Secundário']) ||
    clean(row['E-mail Secundário']) ||
    clean(row.email2);

  const phone =
    clean(row.Telefone) ||
    clean(row['Telefone 1']) ||
    clean(row.Telefones) ||
    clean(row['Telefones']) ||
    clean(row['Tel']) ||
    clean(row['Contato']) ||
    clean(row.telefone);

  const phoneAlt =
    clean(row['Telefone 2']) ||
    clean(row['Celular']) ||
    clean(row['WhatsApp']) ||
    clean(row.telefone2);

  const address =
    clean(row.Endereco) ||
    clean(row['Endereço']) ||
    clean(row['Endereço Completo']) ||
    clean(row['Logradouro']) ||
    clean(row.endereco);

  const bairro =
    clean(row.Bairro) ||
    clean(row.bairro);

  const district =
    clean(row.Distrito) ||
    clean(row['Distrito Administrativo']) ||
    clean(row.distrito);

  // Observações podem estar na coluna "E-mails / Observações" ou em coluna separada
  let notes = 
    clean(row.Observacao) ||
    clean(row['Observação']) ||
    clean(row['Observações']) ||
    clean(row.observacao);
  
  // Se não tem notes separado mas tem emailNotes, usar emailNotes
  if (!notes && emailNotes) {
    notes = emailNotes;
  }
  
  // Se ainda não tem notes, tentar extrair da coluna "E-mails / Observações"
  if (!notes && emailRaw && emailRaw.includes(' / ')) {
    const parts = emailRaw.split(' / ');
    if (parts.length > 1) {
      notes = clean(parts.slice(1).join(' / '));
    }
  }

  return {
    name,
    acronym,
    email,
    alternateEmail,
    phone,
    phoneAlt,
    address,
    bairro,
    district,
    notes,
  };
}

async function main() {
  console.log('🏛️ Iniciando importação de informações de secretarias...\n');

  try {
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Caminho raiz do projeto Dashboard (2 níveis acima de NOVO/scripts/data)
    const rootPath = path.join(__dirname, '..', '..', '..');

    let excelPath = null;

    // 1) Procurar especificamente por "Dados e emails.xlsx" na raiz
    const candidate = path.join(rootPath, 'Dados e emails.xlsx');
    if (fs.existsSync(candidate)) {
      excelPath = candidate;
    } else {
      // 2) Como fallback, procurar por qualquer .xlsx com "Dados" e "email" no nome
      try {
        const files = fs.readdirSync(rootPath);
        const xlsxFiles = files.filter(
          (f) =>
            f.endsWith('.xlsx') &&
            f.toLowerCase().includes('dado') &&
            f.toLowerCase().includes('email')
        );
        if (xlsxFiles.length > 0) {
          excelPath = path.join(rootPath, xlsxFiles[0]);
        }
      } catch (err) {
        console.warn('⚠️ Erro ao ler diretório raiz para localizar planilha de secretarias:', err.message);
      }
    }

    if (!excelPath) {
      console.error('❌ Planilha "Dados e emails.xlsx" não encontrada na raiz do projeto.');
      console.error('   Coloque o arquivo na raiz (mesmo nível da pasta NOVO) e tente novamente.');
      process.exit(1);
    }

    console.log(`📂 Lendo planilha de secretarias: ${excelPath}\n`);

    const wb = XLSX.readFile(excelPath, { cellDates: false });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });

    console.log(`✅ Linhas encontradas na planilha de secretarias: ${json.length}\n`);

    if (json.length === 0) {
      console.log('⚠️ Nenhum dado encontrado na planilha de secretarias.');
      return;
    }

    // Vamos limpar a coleção antes de importar (dados vêm sempre da planilha)
    const countBefore = await prisma.secretariaInfo.count();
    console.log(`📊 Registros de secretarias antes: ${countBefore}\n`);

    console.log('🧹 Apagando registros antigos de secretarias_info...');
    await prisma.secretariaInfo.deleteMany({});

    const toInsert = [];

    for (const row of json) {
      const normalized = normalizeRow(row);

      // Se não tiver pelo menos nome ou email, ignorar linha
      if (!normalized.name && !normalized.email) {
        continue;
      }

      toInsert.push({
        ...normalized,
        rawData: row,
      });
    }

    console.log(`📦 Preparados ${toInsert.length} registros para inserção\n`);

    if (toInsert.length === 0) {
      console.log('⚠️ Nenhum registro válido encontrado para inserir.');
      return;
    }

    // Inserção em lote
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < toInsert.length; i += batchSize) {
      const slice = toInsert.slice(i, i + batchSize);
      await prisma.secretariaInfo.createMany({
        data: slice,
      });
      inserted += slice.length;
      const processed = Math.min(i + batchSize, toInsert.length);
      const progress = Math.round((processed / toInsert.length) * 100);
      console.log(`📥 Inseridos: ${processed}/${toInsert.length} (${progress}%)`);
    }

    const countAfter = await prisma.secretariaInfo.count();

    console.log('\n✅ Importação de secretarias concluída!');
    console.log('📊 Estatísticas:');
    console.log(`   - Registros antes: ${countBefore}`);
    console.log(`   - Registros após: ${countAfter}`);
    console.log(`   - Inseridos (novos): ${inserted}`);
  } catch (error) {
    console.error('💥 Erro durante importação de secretarias:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n🎉 Script de secretarias finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal no script de secretarias:', error);
    process.exit(1);
  });


