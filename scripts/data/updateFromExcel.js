/**
 * Script de Atualização de Dados do Excel
 * 
 * Atualiza o banco de dados com dados da planilha Excel
 * - Atualiza registros existentes baseado no protocolo
 * - Insere novos registros
 * - Normaliza campos principais
 * 
 * Uso: node scripts/updateFromExcel.js
 * OU: npm run update:excel
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { normalizeDate } from '../src/utils/dateUtils.js';
import fs from 'fs';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Normaliza um campo string
 */
function cleanString(str) {
  if (!str || str === '-' || str === '' || str === 'null' || str === 'undefined') return null;
  const cleaned = String(str).trim();
  return cleaned || null;
}

/**
 * Normaliza dados de um registro do Excel
 */
function normalizeRecordData(row) {
  // Extrair protocolo (pode estar em diferentes formatos)
  const protocolo = cleanString(row.protocolo || row.Protocolo || row.PROTOCOLO);
  
  // Normalizar campos principais conforme schema do Prisma
  const normalized = {
    data: row, // JSON completo
    protocolo: protocolo,
    dataDaCriacao: cleanString(row.data_da_criacao || row.dataDaCriacao || row['Data da Criação'] || row['Data da criação']),
    statusDemanda: cleanString(row.status_demanda || row.statusDemanda || row['Status Demanda'] || row['Status da Demanda']),
    prazoRestante: cleanString(row.prazo_restante || row.prazoRestante || row['Prazo Restante']),
    dataDaConclusao: cleanString(row.data_da_conclusao || row.dataDaConclusao || row['Data da Conclusão'] || row['Data da conclusão']),
    tempoDeResolucaoEmDias: cleanString(row.tempo_de_resolucao_em_dias || row.tempoDeResolucaoEmDias || row['Tempo de Resolução em Dias']),
    prioridade: cleanString(row.prioridade || row.Prioridade || row['Prioridade']),
    tipoDeManifestacao: cleanString(row.tipo_de_manifestacao || row.tipoDeManifestacao || row['Tipo de Manifestação'] || row['Tipo']),
    tema: cleanString(row.tema || row.Tema || row['Tema']),
    assunto: cleanString(row.assunto || row.Assunto || row['Assunto']),
    canal: cleanString(row.canal || row.Canal || row['Canal']),
    endereco: cleanString(row.endereco || row.Endereco || row['Endereço'] || row['Endereco']),
    unidadeCadastro: cleanString(row.unidade_cadastro || row.unidadeCadastro || row['Unidade Cadastro'] || row['Setor'] || row.setor),
    unidadeSaude: cleanString(row.unidade_saude || row.unidadeSaude || row['Unidade Saúde'] || row['Unidade Saude']),
    status: cleanString(row.status || row.Status || row['Status']),
    servidor: cleanString(row.servidor || row.Servidor || row['Servidor']),
    responsavel: cleanString(row.responsavel || row.Responsavel || row['Responsável'] || row['Responsavel']),
    verificado: cleanString(row.verificado || row.Verificado || row['Verificado']),
    orgaos: cleanString(row.orgaos || row.Orgaos || row['Órgãos'] || row['Orgaos'] || row['Secretaria'] || row.secretaria),
  };

  // Normalizar datas ISO (YYYY-MM-DD)
  normalized.dataCriacaoIso = normalizeDate(normalized.dataDaCriacao);
  normalized.dataConclusaoIso = normalizeDate(normalized.dataDaConclusao);

  return normalized;
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando atualização de dados do Excel...\n');
  
  try {
    // Verificar conexão
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados\n');
    
    // Obter caminho do arquivo Excel
    // Sempre procurar na raiz do Dashboard primeiro
    const rootPath = path.join(__dirname, '..', '..');
    let excelPath = null;
    
    // Procurar qualquer arquivo .xlsx na raiz que contenha "Dashboard" e "Ouvidoria"
    try {
      const files = fs.readdirSync(rootPath);
      const xlsxFiles = files.filter(f => 
        f.endsWith('.xlsx') && 
        f.includes('Dashboard') && 
        f.includes('Ouvidoria') &&
        f.includes('ATUALIZADA')
      );
      if (xlsxFiles.length > 0) {
        // Priorizar arquivo com número mais alto (mais recente)
        // Ordenar por número no nome do arquivo (ex: (5) > (4) > (3))
        const sortedFiles = xlsxFiles.sort((a, b) => {
          const matchA = a.match(/\((\d+)\)/);
          const matchB = b.match(/\((\d+)\)/);
          const numA = matchA ? parseInt(matchA[1]) : 0;
          const numB = matchB ? parseInt(matchB[1]) : 0;
          return numB - numA; // Ordem decrescente (maior primeiro)
        });
        excelPath = path.join(rootPath, sortedFiles[0]);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao ler diretório raiz:', error.message);
    }
    
    // Se não encontrou, tentar usar o caminho do .env
    if (!excelPath) {
      const fileFromEnv = process.env.EXCEL_FILE;
      if (fileFromEnv) {
        excelPath = path.isAbsolute(fileFromEnv)
          ? fileFromEnv
          : path.join(rootPath, fileFromEnv);
      }
    }
    
    // Se ainda não encontrou, usar nome padrão (tentar (5) primeiro, depois (4))
    if (!excelPath) {
      const defaultFile5 = path.join(rootPath, 'Dashboard_Duque_de_Caxias_Ouvidoria_Duque_de_Caxias_Tabela_ATUALIZADA (5).xlsx');
      const defaultFile4 = path.join(rootPath, 'Dashboard_Duque_de_Caxias_Ouvidoria_Duque_de_Caxias_Tabela_ATUALIZADA (4).xlsx');
      excelPath = fs.existsSync(defaultFile5) ? defaultFile5 : defaultFile4;
    }
    
    console.log(`📂 Lendo planilha: ${excelPath}\n`);
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Arquivo não encontrado: ${excelPath}`);
      console.error('💡 Verifique o caminho do arquivo no .env (EXCEL_FILE) ou coloque o arquivo na raiz do Dashboard');
      process.exit(1);
    }
    
    // Ler planilha Excel
    const wb = XLSX.readFile(excelPath, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: null });
    
    console.log(`✅ Linhas encontradas na planilha: ${json.length}\n`);
    
    if (json.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha');
      return;
    }
    
    // Contar registros antes
    const countBefore = await prisma.record.count();
    console.log(`📊 Registros no banco antes: ${countBefore}\n`);
    
    // Buscar protocolos existentes
    console.log('🔍 Buscando protocolos existentes no banco...');
    const existingProtocols = await prisma.record.findMany({
      select: { protocolo: true, id: true },
      where: { protocolo: { not: null } }
    });
    const protocolMap = new Map(existingProtocols.map(r => [String(r.protocolo), r.id]));
    console.log(`✅ ${protocolMap.size} protocolos encontrados no banco\n`);
    
    // Preparar dados para inserção e atualização
    const toInsert = [];
    const toUpdate = [];
    let skipped = 0;
    
    console.log('🔄 Processando e normalizando dados...');
    for (const row of json) {
      const normalized = normalizeRecordData(row);
      
      if (!normalized.protocolo) {
        skipped++;
        continue;
      }
      
      const existingId = protocolMap.get(normalized.protocolo);
      
      if (existingId) {
        toUpdate.push({
          id: existingId,
          data: normalized
        });
      } else {
        toInsert.push(normalized);
      }
    }
    
    console.log(`📊 Preparados: ${toUpdate.length} para atualizar, ${toInsert.length} para inserir, ${skipped} sem protocolo\n`);
    
    // Processar atualizações
    let updated = 0;
    const batchSize = 500;
    
    if (toUpdate.length > 0) {
      console.log('🔄 Atualizando registros existentes...');
      for (let i = 0; i < toUpdate.length; i += batchSize) {
        const slice = toUpdate.slice(i, i + batchSize);
        
        const updatePromises = slice.map(item => 
          prisma.record.update({
            where: { id: item.id },
            data: item.data
          }).catch(error => {
            console.error(`❌ Erro ao atualizar protocolo ${item.data.protocolo}:`, error.message);
            return null;
          })
        );
        
        const results = await Promise.all(updatePromises);
        updated += results.filter(r => r !== null).length;
        
        const processed = Math.min(i + batchSize, toUpdate.length);
        const progress = Math.round((processed / toUpdate.length) * 100);
        console.log(`📦 Atualizados: ${processed}/${toUpdate.length} (${progress}%)`);
      }
      console.log('');
    }
    
    // Processar inserções
    let inserted = 0;
    
    if (toInsert.length > 0) {
      console.log('➕ Inserindo novos registros...');
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const slice = toInsert.slice(i, i + batchSize);
        
        try {
          await prisma.record.createMany({
            data: slice,
            skipDuplicates: true
          });
          inserted += slice.length;
        } catch (error) {
          // Se createMany falhar, inserir um por um
          if (error.code === 11000 || error.message.includes('duplicate')) {
            console.warn(`⚠️ Duplicatas detectadas no lote ${Math.floor(i / batchSize) + 1}, inserindo individualmente...`);
            for (const item of slice) {
              try {
                await prisma.record.create({ data: item });
                inserted++;
              } catch (e) {
                if (e.code !== 11000 && !e.message.includes('duplicate')) {
                  console.error(`❌ Erro ao inserir protocolo ${item.protocolo}:`, e.message);
                }
              }
            }
          } else {
            console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
            // Tentar inserir um por um
            for (const item of slice) {
              try {
                await prisma.record.create({ data: item });
                inserted++;
              } catch (e) {
                console.error(`❌ Erro ao inserir protocolo ${item.protocolo}:`, e.message);
              }
            }
          }
        }
        
        const processed = Math.min(i + batchSize, toInsert.length);
        const progress = Math.round((processed / toInsert.length) * 100);
        console.log(`📦 Inseridos: ${processed}/${toInsert.length} (${progress}%)`);
      }
      console.log('');
    }
    
    const countAfter = await prisma.record.count();
    
    console.log('✅ Atualização concluída!');
    console.log(`📊 Estatísticas:`);
    console.log(`   - Registros antes: ${countBefore}`);
    console.log(`   - Registros após: ${countAfter}`);
    console.log(`   - Atualizados: ${updated}`);
    console.log(`   - Inseridos: ${inserted}`);
    console.log(`   - Sem protocolo (ignorados): ${skipped}`);
    console.log(`   - Total de novos registros: ${countAfter - countBefore}`);
    console.log(`\n💡 Execute: npm run db:normalize para normalizar campos adicionais (se necessário)`);
    
  } catch (error) {
    console.error('❌ Erro durante atualização:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main()
  .then(() => {
    console.log('\n🎉 Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });

