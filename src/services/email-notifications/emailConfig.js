/**
 * Configuração de Emails
 * Mapeamento de secretarias para emails corporativos
 */

import { isConcluido, getDataCriacao } from '../../utils/formatting/dateUtils.js';
import SecretariaInfo from '../../models/SecretariaInfo.model.js';
import Record from '../../models/Record.model.js';

/**
 * Mapeamento de secretarias para emails
 * Formato: { nomeSecretaria: 'email@dominio.gov.br' }
 */
export const SECRETARIAS_EMAILS = {
  'FUNDEC – Fundação de Apoio à Escola Técnica, Tecnologia, Esporte, Lazer, Cultura e Políticas Sociais de Duque de Caxias': 'educacao@fundec.rj.gov.br',
  'IPMDC – Instituto de Previdência dos Servidores Públicos do Município de Duque de Caxias': 'faleconosco@ipmdc.com.br',
  'Ouvidoria Geral do Município': 'ouvidoria@duquedecaxias.rj.gov.br',
  'Procuradoria-Geral do Município (PGM)': 'gabineteadm.pgmdc@gmail.com',
  'Secretaria Municipal de Administração, Planejamento e Orçamento': 'sma@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Assistência Social e Direitos Humanos': 'ouvidoria.smasdh@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Articulação Institucional': 'pregaoduquedecaxias@gmail.com',
  'Secretaria Municipal de Comunicação Social e Relações Públicas': 'imprensa@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Cultura e Turismo': 'adm.smct@gmail.com',
  'Secretaria Municipal de Defesa Civil': 'sesdec.dc@gmail.com',
  'Secretaria Municipal de Educação': 'ouvidoriasme@smeduquedecaxias.rj.gov.br',
  'Secretaria Municipal de Esporte e Lazer': 'smel@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Eventos': 'semev.gabinete@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Fazenda': 'anistiafiscal@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Gestão e Inclusão e Mulher': 'smddti@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Governo': 'segov@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Meio Ambiente': 'ostmeioambientedc@gmail.com',
  'Secretaria Municipal de Obras e Agricultura': 'obraspmdc@gmail.com',
  'Secretaria Municipal de Procuradoria Geral': 'gabineteadm.pgmdc@gmail.com',
  'Secretaria Municipal de Proteção Animal': 'comunicacao.smpadc@gmail.com',
  'Secretaria Municipal de Saúde': 'smsdc@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Segurança Pública': 'gabinete.smsp@gmail.com',
  'Secretaria Municipal de Trabalho, Emprego e Renda': 'smter.gabinete@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Transportes e Serviços Públicos': 'smtsp@duquedecaxias.rj.gov.br',
  'Secretaria Municipal de Urbanismo e Habitação': 'semuh.pmdc@gmail.com',
};

/**
 * Email padrão para secretarias sem email cadastrado
 * MODO TESTE: Todos os emails vão para ouvidoria@duquedecaxias.rj.gov.br
 * Forçando para teste (ignorando variável de ambiente)
 */
export const EMAIL_PADRAO = 'ouvidoria@duquedecaxias.rj.gov.br'; // MODO TESTE - Forçado

/**
 * Email remetente (do sistema)
 */
export const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'ouvidoria@duquedecaxias.rj.gov.br';

/**
 * Nome do remetente
 */
export const NOME_REMETENTE = process.env.NOME_REMETENTE || 'Ouvidoria Geral de Duque de Caxias';

/**
 * Email da Ouvidoria Geral (recebe resumo diário)
 * Pode ser um email único ou múltiplos emails separados por vírgula
 */
export const EMAIL_OUVIDORIA_GERAL = process.env.EMAIL_OUVIDORIA_GERAL || 'ouvgeral.gestao@gmail.com,ouvidoria020@gmail.com,dfreitas001.adm@gmail.com';

/**
 * Obter email de uma secretaria (versão síncrona - usa mapeamento estático)
 * @param {string} secretaria - Nome da secretaria
 * @returns {string} - Email da secretaria ou email padrão
 */
export function getEmailSecretaria(secretaria) {
  if (!secretaria) return EMAIL_PADRAO;

  const secretariaLower = secretaria.toLowerCase().trim();

  // Buscar correspondência exata
  for (const [nome, email] of Object.entries(SECRETARIAS_EMAILS)) {
    if (nome.toLowerCase().trim() === secretariaLower) {
      return email;
    }
  }

  // Buscar correspondência parcial (caso a secretaria tenha variações no nome)
  for (const [nome, email] of Object.entries(SECRETARIAS_EMAILS)) {
    if (secretariaLower.includes(nome.toLowerCase()) ||
      nome.toLowerCase().includes(secretariaLower)) {
      return email;
    }
  }

  return EMAIL_PADRAO;
}

/**
 * Extrair todos os emails válidos de uma string
 * @param {string} emailString - String com emails (pode ter múltiplos separados por ; ou ,)
 * @returns {string[]} - Array com emails válidos
 */
function extrairEmailsValidos(emailString) {
  if (!emailString) return [];

  const emails = emailString.split(/[;,]/).map(e => e.trim()).filter(e => e);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailsValidos = [];

  for (const email of emails) {
    const emailLimpo = email.split(/\s/)[0].trim();
    if (emailRegex.test(emailLimpo) && !emailLimpo.startsWith('http')) {
      emailsValidos.push(emailLimpo);
    }
  }

  return emailsValidos;
}

/**
 * Obter TODOS os emails de uma secretaria do banco de dados
 * Busca primeiro no banco, depois usa mapeamento estático como fallback
 * @param {string} secretaria - Nome da secretaria
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @returns {Promise<string[]>} - Array com todos os emails da secretaria
 */
export async function getEmailsSecretariaFromDB(secretaria, prisma) {
  if (!secretaria) return [EMAIL_PADRAO];

  try {
    // Normalizar nome da secretaria para busca
    const secretariaNormalizada = secretaria
      .replace(/^secretaria de /i, '')
      .replace(/^secretaria municipal de /i, '')
      .trim();

    // Buscar no banco de dados - tentar múltiplas estratégias
    // REFATORAÇÃO: Prisma → Mongoose
    let secretariaInfo = await SecretariaInfo.findOne({
      $and: [
        {
          $or: [
            { name: { $regex: new RegExp(`^${secretaria}$`, 'i') } },
            { name: { $regex: new RegExp(secretaria, 'i') } },
            { name: { $regex: new RegExp(secretariaNormalizada, 'i') } }
          ]
        },
        {
          $or: [
            { email: { $ne: null, $exists: true } },
            { alternateEmail: { $ne: null, $exists: true } }
          ]
        }
      ]
    })
      .select('name email alternateEmail')
      .lean();

    // Se não encontrou, tentar busca mais flexível
    if (!secretariaInfo) {
      const todasSecretarias = await SecretariaInfo.find({
        $or: [
          { email: { $ne: null, $exists: true } },
          { alternateEmail: { $ne: null, $exists: true } }
        ]
      })
        .select('name email alternateEmail')
        .lean();

      // Buscar correspondência parcial mais flexível
      for (const sec of todasSecretarias) {
        if (!sec.name) continue;

        const nomeSec = sec.name.toLowerCase();
        const nomeBusca = secretaria.toLowerCase();
        const nomeBuscaNormalizado = secretariaNormalizada.toLowerCase();

        // Verificar se há correspondência significativa
        if (nomeSec.includes(nomeBusca) ||
          nomeBusca.includes(nomeSec) ||
          nomeSec.includes(nomeBuscaNormalizado) ||
          nomeBuscaNormalizado.includes(nomeSec)) {
          secretariaInfo = sec;
          break;
        }
      }
    }

    if (secretariaInfo) {
      const emails = [];

      // Adicionar emails do campo principal
      if (secretariaInfo.email) {
        const emailsPrincipais = extrairEmailsValidos(secretariaInfo.email);
        emails.push(...emailsPrincipais);
      }

      // Adicionar emails alternativos
      if (secretariaInfo.alternateEmail) {
        const emailsAlternativos = extrairEmailsValidos(secretariaInfo.alternateEmail);
        emails.push(...emailsAlternativos);
      }

      // Remover duplicatas
      const emailsUnicos = [...new Set(emails)];

      if (emailsUnicos.length > 0) {
        return emailsUnicos;
      }
    }
  } catch (error) {
    console.error('Erro ao buscar emails do banco:', error);
  }

  // Fallback para mapeamento estático (retorna array com um email)
  const emailEstatico = getEmailSecretaria(secretaria);
  return [emailEstatico];
}

/**
 * Obter email de uma secretaria do banco de dados (versão assíncrona - retorna primeiro email)
 * Busca primeiro no banco, depois usa mapeamento estático como fallback
 * @param {string} secretaria - Nome da secretaria
 * @param {*} prisma - Parâmetro mantido para compatibilidade (não usado - sistema migrado para Mongoose)
 * @returns {Promise<string>} - Primeiro email da secretaria ou email padrão
 */
export async function getEmailSecretariaFromDB(secretaria, prisma) {
  const emails = await getEmailsSecretariaFromDB(secretaria, prisma);
  return emails[0] || EMAIL_PADRAO;
}

/**
 * Contar manifestações não respondidas de uma secretaria
 */
async function contarManifestacoesNaoRespondidas(prisma, secretaria) {
  try {
    // REFATORAÇÃO: Prisma → Mongoose
    const records = await Record.find({
      orgaos: { $regex: new RegExp(secretaria, 'i') }
    })
      .select('status statusDemanda dataDaConclusao dataConclusaoIso data')
      .lean();

    let naoRespondidas = 0;
    for (const record of records) {
      // Usar função isConcluido para verificar
      if (!isConcluido(record)) {
        naoRespondidas++;
      }
    }

    return naoRespondidas;
  } catch (error) {
    console.error('Erro ao contar manifestações:', error);
    return 0;
  }
}

/**
 * Calcular data de vencimento baseado na data de criação e prazo
 */
function calcularDataVencimento(dataCriacao, prazo) {
  if (!dataCriacao) return null;
  const data = new Date(dataCriacao + 'T00:00:00');
  if (isNaN(data.getTime())) return null;
  data.setDate(data.getDate() + prazo);
  return data.toISOString().slice(0, 10);
}

/**
 * Formatar data para exibição (DD/MM/YYYY)
 */
function formatarData(dataStr) {
  if (!dataStr) return 'N/A';

  try {
    const date = new Date(dataStr + 'T00:00:00');
    if (isNaN(date.getTime())) return dataStr;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch (e) {
    return dataStr;
  }
}

/**
 * Template de email para notificação de 15 dias antes do vencimento
 */
export async function getTemplate15Dias(dados, prisma = null) {
  const { secretaria, protocolos = [] } = dados;

  // Se protocolos é um array, usar; senão, criar array com um único protocolo (compatibilidade)
  const listaProtocolos = Array.isArray(protocolos) ? protocolos : [dados];

  // Contar manifestações não respondidas
  let totalNaoRespondidas = 0;
  if (prisma && secretaria) {
    totalNaoRespondidas = await contarManifestacoesNaoRespondidas(prisma, secretaria);
  }

  // Criar tabela de protocolos
  const tabelaProtocolos = listaProtocolos.map(p => {
    const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
    return `
      <tr style="border-bottom: 1px solid #e0e0e0; background: #d4edda;">
        <td style="padding: 12px; font-weight: bold; color: #155724; font-size: 16px;">${p.protocolo || 'N/A'}</td>
        <td style="padding: 12px; color: #155724;">${formatarData(p.dataVencimento)}</td>
        <td style="padding: 12px; color: #28a745; font-weight: bold;">15 dias</td>
        <td style="padding: 12px; color: #666;">${prazo} dias</td>
      </tr>
    `;
  }).join('');

  const totalProtocolos = listaProtocolos.length;

  return {
    subject: `[15 DIAS] Ouvidoria Geral - ${totalProtocolos} Protocolo(s) Vencendo em 15 Dias - ${secretaria}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #d1f2eb; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .total { font-size: 32px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; }
          .cta { background: #28a745; color: white; padding: 15px 30px; text-align: center; border-radius: 5px; margin: 20px 0; }
          .cta a { color: white; text-decoration: none; font-weight: bold; }
          .protocolos-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .protocolos-table th { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px; text-align: left; font-weight: bold; }
          .protocolos-table td { padding: 12px; }
          .protocolos-table tr:nth-child(even) { background: #d4edda; }
          .protocolos-table tr { background: #f8fff9; }
          .protocolo-destaque { font-weight: bold; color: #667eea; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🏛️ Ouvidoria Geral de Duque de Caxias</h2>
            <p>Sistema Automático de Notificações</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ ATENÇÃO:</strong> Você possui manifestações vencendo em 15 dias!
            </div>
            
            <h3>Olá, ${secretaria}!</h3>
            
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>Ouvidoria Geral informa:</strong> Você tem um total de <strong style="color: #dc3545; font-size: 24px;">${totalNaoRespondidas}</strong> manifestações cadastradas no setor em que é alocado e que <strong>não foram respondidas</strong> até o momento.
            </p>
            
            <div class="info">
              <p><strong>Secretaria Responsável:</strong> ${secretaria}</p>
              <p><strong>Total de Manifestações Não Respondidas:</strong> <strong style="color: #dc3545;">${totalNaoRespondidas}</strong></p>
              <p><strong>Protocolos Vencendo em 15 Dias:</strong> <strong style="color: #ff9800; font-size: 20px;">${totalProtocolos}</strong></p>
            </div>
            
            <h4 style="margin-top: 30px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
              📋 Protocolos com Vencimento em 15 Dias:
            </h4>
            
            <table class="protocolos-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data Vencimento</th>
                  <th>Dias Restantes</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${tabelaProtocolos}
              </tbody>
            </table>
            
            <div class="cta">
              <a href="https://gov.colab.re/" target="_blank">🔗 Acesse o Colab.gov no serviço de Ouvidoria</a>
            </div>
            
            <p style="margin-top: 20px; font-weight: bold; color: #333;">
              Fique atento e verifique suas demandas pendentes!
            </p>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
Sistema Automático de Notificações

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Olá, ${secretaria}!

Ouvidoria Geral informa: Você tem um total de ${totalNaoRespondidas} manifestações cadastradas no setor em que é alocado e que não foram respondidas até o momento.

Secretaria Responsável: ${secretaria}
Total de Manifestações Não Respondidas: ${totalNaoRespondidas}
Protocolos Vencendo em 15 Dias: ${totalProtocolos}

📋 PROTOCOLOS COM VENCIMENTO EM 15 DIAS:

${listaProtocolos.map(p => {
      const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
      return `Protocolo: ${p.protocolo || 'N/A'}
  Data Vencimento: ${formatarData(p.dataVencimento)}
  Dias Restantes: 15 dias
  Prazo: ${prazo} dias
  ──────────────────────────────────────`;
    }).join('\n\n')}

🔗 Acesse o Colab.gov no serviço de Ouvidoria: https://gov.colab.re/

Fique atento e verifique suas demandas pendentes!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
    `.trim()
  };
}

/**
 * Template de email para notificação no dia do vencimento
 */
export async function getTemplateVencimento(dados, prisma = null) {
  const { secretaria, protocolos = [] } = dados;

  // Se protocolos é um array, usar; senão, criar array com um único protocolo (compatibilidade)
  const listaProtocolos = Array.isArray(protocolos) ? protocolos : [dados];
  const totalVencidasHoje = listaProtocolos.length;

  // Criar tabela de protocolos
  const tabelaProtocolos = listaProtocolos.map(p => {
    const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
    return `
      <tr style="border-bottom: 1px solid #e0e0e0; background: #fffbf0;">
        <td style="padding: 12px; font-weight: bold; color: #856404; font-size: 16px;">${p.protocolo || 'N/A'}</td>
        <td style="padding: 12px; color: #856404; font-weight: bold;">${formatarData(p.dataVencimento)}</td>
        <td style="padding: 12px; color: #ff9800; font-weight: bold;">VENCE HOJE</td>
        <td style="padding: 12px; color: #666;">${prazo} dias</td>
      </tr>
    `;
  }).join('');

  return {
    subject: `[VENCIDO HOJE] 🚨 URGENTE - ${totalVencidasHoje} Manifestação(ões) Vencida(s) Hoje - ${secretaria}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #333; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #fffbf0; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .total { font-size: 36px; font-weight: bold; color: #ff9800; text-align: center; margin: 20px 0; }
          .cta { background: #ffc107; color: #333; padding: 15px 30px; text-align: center; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .cta a { color: #333; text-decoration: none; font-weight: bold; }
          .protocolos-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .protocolos-table th { background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #333; padding: 15px; text-align: left; font-weight: bold; }
          .protocolos-table td { padding: 12px; }
          .protocolos-table tr:nth-child(even) { background: #fffbf0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚨 Ouvidoria Geral de Duque de Caxias</h2>
            <p>ALERTA CRÍTICO - Manifestações Vencidas</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>🚨 ATENÇÃO URGENTE:</strong> Manifestações venceram hoje!
            </div>
            
            <h3>Olá, ${secretaria}!</h3>
            
            <p style="font-size: 18px; margin: 20px 0; text-align: center;">
              <strong style="color: #ff9800; font-size: 28px;">${totalVencidasHoje} manifestações venceram hoje!</strong>
            </p>
            
            <div class="info">
              <p><strong>Secretaria Responsável:</strong> ${secretaria}</p>
              <p><strong>Total de Manifestações Vencidas Hoje:</strong> <strong style="color: #ff9800; font-size: 28px;">${totalVencidasHoje}</strong></p>
            </div>
            
            <h4 style="margin-top: 30px; color: #ff9800; border-bottom: 2px solid #ffc107; padding-bottom: 10px;">
              ⚠️ Protocolos Vencidos Hoje:
            </h4>
            
            <table class="protocolos-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data Vencimento</th>
                  <th>Status</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${tabelaProtocolos}
              </tbody>
            </table>
            
            <p style="font-size: 16px; font-weight: bold; color: #856404; margin: 20px 0; padding: 15px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
              ⚠️ AÇÃO URGENTE NECESSÁRIA: Estas demandas devem ser respondidas IMEDIATAMENTE!
            </p>
            
            <div class="cta">
              <a href="https://gov.colab.re/" target="_blank">🔗 Acesse o Colab.gov no serviço de Ouvidoria</a>
            </div>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
ALERTA CRÍTICO - Manifestações Vencidas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Olá, ${secretaria}!

🚨 ATENÇÃO URGENTE: ${totalVencidasHoje} manifestações venceram hoje!

Secretaria Responsável: ${secretaria}
Total de Manifestações Vencidas Hoje: ${totalVencidasHoje}

🚨 PROTOCOLOS VENCIDOS HOJE:

${listaProtocolos.map(p => {
      const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
      return `Protocolo: ${p.protocolo || 'N/A'}
  Data Vencimento: ${formatarData(p.dataVencimento)} (HOJE)
  Status: VENCE HOJE
  Prazo: ${prazo} dias
  ──────────────────────────────────────`;
    }).join('\n\n')}

⚠️ AÇÃO URGENTE NECESSÁRIA: Estas demandas devem ser respondidas IMEDIATAMENTE!

🔗 Acesse o Colab.gov no serviço de Ouvidoria: https://gov.colab.re/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
    `.trim()
  };
}

/**
 * Template de email para notificação 60 dias após vencimento
 */
export async function getTemplate60Dias(dados, prisma = null) {
  const { secretaria, protocolos = [] } = dados;

  // Se protocolos é um array, usar; senão, criar array com um único protocolo (compatibilidade)
  const listaProtocolos = Array.isArray(protocolos) ? protocolos : [dados];
  const totalExtrapoladas = listaProtocolos.length;

  // Calcular dias vencidos para cada protocolo
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Criar tabela de protocolos
  const tabelaProtocolos = listaProtocolos.map(p => {
    const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
    const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 60;
    return `
      <tr style="border-bottom: 1px solid #e0e0e0; background: #f8d7da;">
        <td style="padding: 12px; font-weight: bold; color: #721c24; font-size: 16px;">${p.protocolo || 'N/A'}</td>
        <td style="padding: 12px; color: #721c24; font-weight: bold;">${formatarData(p.dataVencimento)}</td>
        <td style="padding: 12px; color: #8b0000; font-weight: bold;">${diasVencidos}+ dias</td>
        <td style="padding: 12px; color: #666;">${prazo} dias</td>
      </tr>
    `;
  }).join('');

  return {
    subject: `[60+ DIAS VENCIDO] ⚠️ ATENÇÃO - ${totalExtrapoladas} Manifestação(ões) Extrapolada(s) - ${secretaria}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8d7da; border-left: 4px solid #721c24; color: #333; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #f8d7da; border-left: 4px solid #721c24; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #f5c6cb; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #721c24; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .total { font-size: 36px; font-weight: bold; color: #721c24; text-align: center; margin: 20px 0; }
          .warning { background: #f8d7da; border-left: 4px solid #721c24; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .protocolos-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .protocolos-table th { background: linear-gradient(135deg, #721c24 0%, #8b0000 100%); color: white; padding: 15px; text-align: left; font-weight: bold; }
          .protocolos-table td { padding: 12px; }
          .protocolos-table tr:nth-child(even) { background: #f8d7da; }
          .protocolos-table tr { background: #fff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Ouvidoria Geral de Duque de Caxias</h2>
            <p>Notificação de Manifestações Extrapoladas</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ ATENÇÃO:</strong> Manifestações extrapolaram todos os prazos permitidos!
            </div>
            
            <h3>Olá, ${secretaria}!</h3>
            
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>Ouvidoria Geral informa, atenção:</strong> Você possui um total de <strong style="color: #721c24; font-size: 28px;">${totalExtrapoladas}</strong> manifestações <strong>sem resposta</strong> que <strong>extrapolaram todos os prazos permitidos</strong>.
            </p>
            
            <div class="warning">
              <p style="font-size: 16px; font-weight: bold; color: #721c24;">
                ⚠️ Informamos que a tratativa final da manifestação é competência do orgão responsável
              </p>
            </div>
            
            <div class="info">
              <p><strong>Secretaria Responsável:</strong> ${secretaria}</p>
              <p><strong>Total de Manifestações Extrapoladas:</strong> <strong style="color: #721c24; font-size: 28px;">${totalExtrapoladas}</strong></p>
              <p><strong>Dias Após Vencimento:</strong> Mais de 61 dias</p>
            </div>
            
            <h4 style="margin-top: 30px; color: #721c24; border-bottom: 2px solid #8b0000; padding-bottom: 10px;">
              📋 Protocolos Extrapolados (Mais de 61 dias):
            </h4>
            
            <table class="protocolos-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data Vencimento</th>
                  <th>Dias Vencidos</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${tabelaProtocolos}
              </tbody>
            </table>
            
            <p style="margin-top: 20px; font-weight: bold; color: #333;">
              Por favor, verifique e responda estas manifestações o quanto antes.
            </p>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
Notificação de Manifestações Extrapoladas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Olá, ${secretaria}!

Ouvidoria Geral informa, atenção: Você possui um total de ${totalExtrapoladas} manifestações sem resposta que extrapolaram todos os prazos permitidos.

⚠️ Informamos que a resposta é de responsabilidade do órgão respondente!

Secretaria Responsável: ${secretaria}
Total de Manifestações Extrapoladas: ${totalExtrapoladas}
Dias Após Vencimento: Mais de 61 dias

📋 PROTOCOLOS EXTRAPOLADOS (MAIS DE 61 DIAS):

${listaProtocolos.map(p => {
      const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
      const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 60;
      return `Protocolo: ${p.protocolo || 'N/A'}
  Data Vencimento: ${formatarData(p.dataVencimento)}
  Dias Vencidos: ${diasVencidos}+ dias
  Prazo: ${prazo} dias
  ──────────────────────────────────────`;
    }).join('\n\n')}

Por favor, verifique e responda estas manifestações o quanto antes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
    `.trim()
  };
}

/**
 * Template de email para notificação 30 dias após vencimento
 */
export async function getTemplate30Dias(dados, prisma = null) {
  const { secretaria, protocolos = [] } = dados;

  // Se protocolos é um array, usar; senão, criar array com um único protocolo (compatibilidade)
  const listaProtocolos = Array.isArray(protocolos) ? protocolos : [dados];
  const totalVencidas = listaProtocolos.length;

  // Calcular dias vencidos para cada protocolo
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Criar tabela de protocolos
  const tabelaProtocolos = listaProtocolos.map(p => {
    const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
    const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 30;
    return `
      <tr style="border-bottom: 1px solid #e0e0e0; background: #fff3cd;">
        <td style="padding: 12px; font-weight: bold; color: #856404; font-size: 16px;">${p.protocolo || 'N/A'}</td>
        <td style="padding: 12px; color: #856404; font-weight: bold;">${formatarData(p.dataVencimento)}</td>
        <td style="padding: 12px; color: #ff9800; font-weight: bold;">${diasVencidos} dias</td>
        <td style="padding: 12px; color: #666;">${prazo} dias</td>
      </tr>
    `;
  }).join('');

  return {
    subject: `[30 DIAS VENCIDO] ⚠️ ATENÇÃO - ${totalVencidas} Manifestação(ões) em Atraso - ${secretaria}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fff3cd; border-left: 4px solid #ff9800; color: #333; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #fff3cd; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ff9800; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .protocolos-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .protocolos-table th { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 15px; text-align: left; font-weight: bold; }
          .protocolos-table td { padding: 12px; }
          .protocolos-table tr:nth-child(even) { background: #fff3cd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Ouvidoria Geral de Duque de Caxias</h2>
            <p>Notificação de Manifestações em Atraso</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>⚠️ ATENÇÃO:</strong> Manifestações com prazos vencidos há 30 dias ou mais!
            </div>
            
            <h3>Olá, ${secretaria}!</h3>
            
            <p style="font-size: 16px; margin: 20px 0;">
              <strong>Ouvidoria Geral informa:</strong> Você possui um total de <strong style="color: #ff9800; font-size: 28px;">${totalVencidas}</strong> manifestações <strong>sem resposta</strong> que encontram-se <strong>em atraso há 30 dias ou mais</strong>.
            </p>
            
            <div class="info">
              <p><strong>Secretaria Responsável:</strong> ${secretaria}</p>
              <p><strong>Total de Manifestações em Atraso:</strong> <strong style="color: #ff9800; font-size: 28px;">${totalVencidas}</strong></p>
              <p><strong>Período:</strong> Vencidas há 30 dias ou mais</p>
            </div>
            
            <h4 style="margin-top: 30px; color: #ff9800; border-bottom: 2px solid #f57c00; padding-bottom: 10px;">
              📋 Protocolos com Pendências Urgentes:
            </h4>
            
            <table class="protocolos-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data Vencimento</th>
                  <th>Dias Vencidos</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                ${tabelaProtocolos}
              </tbody>
            </table>
            
            <p style="margin-top: 20px; font-weight: bold; color: #333;">
              Diante da criticidade, pedimos que as tratativas sejam priorizadas e que possamos receber um retorno quanto às previsões de conclusão.
            </p>
            
            <p style="margin-top: 15px; color: #666;">
              Permanecemos à disposição para quaisquer esclarecimentos.
            </p>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
Notificação de Manifestações em Atraso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Olá, ${secretaria}!

Ouvidoria Geral informa: Você possui um total de ${totalVencidas} manifestações sem resposta que encontram-se em atraso há 30 dias ou mais.

Secretaria Responsável: ${secretaria}
Total de Manifestações em Atraso: ${totalVencidas}
Período: Vencidas há 30 dias ou mais

📋 PROTOCOLOS COM PENDÊNCIAS URGENTES:

${listaProtocolos.map(p => {
      const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
      const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 30;
      return `Protocolo: ${p.protocolo || 'N/A'}
  Data Vencimento: ${formatarData(p.dataVencimento)}
  Dias Vencidos: ${diasVencidos} dias
  Prazo: ${prazo} dias
  ──────────────────────────────────────`;
    }).join('\n\n')}

Diante da criticidade, pedimos que as tratativas sejam priorizadas e que possamos receber um retorno quanto às previsões de conclusão.

Permanecemos à disposição para quaisquer esclarecimentos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
    `.trim()
  };
}

/**
 * Template de email para CONSOLIDAÇÃO GERAL - Protocolos vencidos a partir de 30 dias
 */
export async function getTemplateConsolidacaoGeral(dados, prisma = null) {
  const { secretaria, protocolos = [] } = dados;

  // Se protocolos é um array, usar; senão, criar array com um único protocolo (compatibilidade)
  const listaProtocolos = Array.isArray(protocolos) ? protocolos : [dados];
  const totalConsolidado = listaProtocolos.length;

  // Criar lista de protocolos formatada
  const listaProtocolosFormatada = listaProtocolos.map((p, index) => {
    const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 0;
    return `<li style="margin: 10px 0; padding: 10px; background: ${index % 2 === 0 ? '#f8f9fa' : '#fff'}; border-left: 3px solid #ff9800;">
      <strong>${p.protocolo || 'N/A'}</strong> - Vencido há ${diasVencidos} dias (${formatarData(p.dataVencimento)})
    </li>`;
  }).join('');

  return {
    subject: `Consolidação de Manifestações em Atraso – Prazos Vencidos a partir do dia 30 - ${secretaria}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e3f2fd; border-left: 4px solid #2196f3; color: #333; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #fff3cd; border-left: 4px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196f3; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .protocolos-list { list-style: none; padding: 0; margin: 20px 0; }
          .protocolos-list li { margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 3px solid #ff9800; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📋 Ouvidoria Geral de Duque de Caxias</h2>
            <p>Consolidação de Manifestações em Atraso</p>
          </div>
          <div class="content">
            <h3>Prezados(as),</h3>
            
            <p style="font-size: 16px; margin: 20px 0;">
              Consolidamos abaixo todas as manifestações que encontram-se em atraso, considerando os <strong>prazos vencidos a partir do dia 30</strong>. Solicitamos especial atenção, visto que tais demandas necessitam de tratamento imediato.
            </p>
            
            <div class="info">
              <p><strong>Secretaria Responsável:</strong> ${secretaria}</p>
              <p><strong>Total de Protocolos Consolidados:</strong> <strong style="color: #2196f3; font-size: 24px;">${totalConsolidado}</strong></p>
              <p><strong>Período:</strong> Prazos vencidos a partir de 30 dias</p>
            </div>
            
            <div class="alert">
              <h4 style="margin-top: 0; color: #ff9800; border-bottom: 2px solid #f57c00; padding-bottom: 10px;">
                📋 Protocolos com Pendências Urgentes:
              </h4>
              
              <ul class="protocolos-list">
                ${listaProtocolosFormatada}
              </ul>
            </div>
            
            <p style="margin-top: 20px; font-weight: bold; color: #333;">
              Diante da criticidade, pedimos que as tratativas sejam priorizadas e que possamos receber um retorno quanto às previsões de conclusão.
            </p>
            
            <p style="margin-top: 15px; color: #666;">
              Permanecemos à disposição para quaisquer esclarecimentos.
            </p>
            
            <p style="margin-top: 20px;">
              Atenciosamente,<br>
              <strong>Ouvidoria Geral de Duque de Caxias</strong>
            </p>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
Consolidação de Manifestações em Atraso

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Prezados(as),

Consolidamos abaixo todas as manifestações que encontram-se em atraso, considerando os prazos vencidos a partir do dia 30. Solicitamos especial atenção, visto que tais demandas necessitam de tratamento imediato.

Secretaria Responsável: ${secretaria}
Total de Protocolos Consolidados: ${totalConsolidado}
Período: Prazos vencidos a partir de 30 dias

📋 PROTOCOLOS COM PENDÊNCIAS URGENTES:

${listaProtocolos.map((p, index) => {
      const diasVencidos = p.diasRestantes ? Math.abs(p.diasRestantes) : 0;
      return `${index + 1}. ${p.protocolo || 'N/A'} - Vencido há ${diasVencidos} dias (${formatarData(p.dataVencimento)})`;
    }).join('\n')}

Diante da criticidade, pedimos que as tratativas sejam priorizadas e que possamos receber um retorno quanto às previsões de conclusão.

Permanecemos à disposição para quaisquer esclarecimentos.

Atenciosamente,
Ouvidoria Geral de Duque de Caxias

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Por favor, não responda.
    `.trim()
  };
}

/**
 * Template de email RESUMO para Ouvidoria Geral
 * Envia resumo de TODAS as demandas vencendo hoje, separadas por secretaria
 */
export async function getTemplateResumoOuvidoriaGeral(dadosPorSecretaria, prisma = null) {
  const hoje = new Date();
  const hojeFormatado = hoje.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Calcular totais
  let totalGeral = 0;
  const secretariasComProtocolos = [];

  for (const [secretaria, protocolos] of Object.entries(dadosPorSecretaria)) {
    if (protocolos.length > 0) {
      totalGeral += protocolos.length;
      secretariasComProtocolos.push({ secretaria, protocolos, total: protocolos.length });
    }
  }

  // Ordenar por quantidade (mais protocolos primeiro)
  secretariasComProtocolos.sort((a, b) => b.total - a.total);

  // Criar seções por secretaria
  const secoesSecretarias = secretariasComProtocolos.map(({ secretaria, protocolos, total }) => {
    const tabelaProtocolos = protocolos.map(p => {
      const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
      return `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 10px; font-weight: bold; color: #dc3545; font-size: 14px;">${p.protocolo || 'N/A'}</td>
          <td style="padding: 10px; color: #555;">${formatarData(p.dataVencimento)}</td>
          <td style="padding: 10px; color: #dc3545; font-weight: bold;">VENCE HOJE</td>
          <td style="padding: 10px; color: #666;">${prazo} dias</td>
          <td style="padding: 10px; color: #666; font-size: 12px;">${p.assunto || 'N/A'}</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="margin: 30px 0; border: 2px solid #dc3545; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 15px 20px;">
          <h3 style="margin: 0; font-size: 18px;">${secretaria}</h3>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Total: <strong>${total} protocolos vencidos hoje</strong></p>
        </div>
        <div style="padding: 20px; background: #fff;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #dc3545;">Protocolo</th>
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #dc3545;">Data Vencimento</th>
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #dc3545;">Status</th>
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #dc3545;">Prazo</th>
                <th style="padding: 12px; text-align: left; font-weight: bold; color: #333; border-bottom: 2px solid #dc3545;">Assunto</th>
              </tr>
            </thead>
            <tbody>
              ${tabelaProtocolos}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');

  return {
    subject: `[RESUMO DIÁRIO] 📊 ${totalGeral} Manifestação(ões) Vencida(s) Hoje - ${hojeFormatado}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px 20px; background: #fff; }
          .alert { background: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .info { background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          .total { font-size: 42px; font-weight: bold; color: #dc3545; text-align: center; margin: 20px 0; }
          .resumo-box { background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Ouvidoria Geral de Duque de Caxias</h2>
            <p>Resumo Diário de Manifestações Vencidas</p>
            <p style="margin-top: 10px; font-size: 16px; opacity: 0.9;">Data: ${hojeFormatado}</p>
          </div>
          <div class="content">
            <div class="alert">
              <strong>🚨 ATENÇÃO:</strong> Resumo de todas as manifestações vencidas hoje, separadas por secretaria.
            </div>
            
            <h3>Olá, Ouvidor Geral!</h3>
            
            <div class="resumo-box">
              <p style="font-size: 18px; margin: 10px 0; text-align: center;">
                <strong>Total Geral de Manifestações Vencidas Hoje:</strong>
              </p>
              <p class="total">${totalGeral}</p>
              <p style="text-align: center; color: #666; margin-top: 10px;">
                Distribuídas em <strong>${secretariasComProtocolos.length}</strong> secretaria(s)
              </p>
            </div>
            
            <h4 style="margin-top: 30px; color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 10px; font-size: 20px;">
              📋 Manifestações Vencidas Hoje por Secretaria:
            </h4>
            
            ${secoesSecretarias}
            
            <div class="info" style="margin-top: 30px;">
              <p style="font-weight: bold; color: #333; margin-bottom: 10px;">📌 Informações Importantes:</p>
              <ul style="color: #555; line-height: 1.8;">
                <li>Este resumo contém todas as manifestações que venceram hoje (${hojeFormatado})</li>
                <li>As manifestações estão organizadas por secretaria responsável</li>
                <li>Cada secretaria também recebeu um email individual com seus protocolos</li>
                <li>É importante acompanhar o andamento das respostas</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>Este é um email automático do sistema de Ouvidoria Geral de Duque de Caxias.</p>
            <p>Enviado diariamente às 8h da manhã com o resumo das manifestações vencidas.</p>
            <p>Por favor, não responda este email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Ouvidoria Geral de Duque de Caxias
Resumo Diário de Manifestações Vencidas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Data: ${hojeFormatado}

Olá, Ouvidor Geral!

🚨 ATENÇÃO: Resumo de todas as manifestações vencidas hoje, separadas por secretaria.

Total Geral de Manifestações Vencidas Hoje: ${totalGeral}
Distribuídas em ${secretariasComProtocolos.length} secretaria(s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 MANIFESTAÇÕES VENCIDAS HOJE POR SECRETARIA:

${secretariasComProtocolos.map(({ secretaria, protocolos, total }) => {
      return `
${secretaria} - ${total} protocolos vencidos hoje

${protocolos.map(p => {
        const prazo = p.tipoManifestacao?.toLowerCase().includes('sic') ? 20 : 30;
        return `  Protocolo: ${p.protocolo || 'N/A'}
  Data Vencimento: ${formatarData(p.dataVencimento)} (HOJE)
  Status: VENCE HOJE
  Prazo: ${prazo} dias
  Assunto: ${p.assunto || 'N/A'}`;
      }).join('\n\n')}

───────────────────────────────────────────
  `;
    }).join('\n')}

📌 Informações Importantes:
- Este resumo contém todas as manifestações que venceram hoje (${hojeFormatado})
- As manifestações estão organizadas por secretaria responsável
- Cada secretaria também recebeu um email individual com seus protocolos
- É importante acompanhar o andamento das respostas

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é um email automático. Enviado diariamente às 8h da manhã.
Por favor, não responda este email.
    `.trim()
  };
}
