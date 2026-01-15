# Sistema Automático de Vencimentos

Sistema simplificado que dispara emails automaticamente quando vencimentos estão chegando.

## 🚀 Como Funciona

O sistema executa **diariamente às 08:00** e verifica:

1. **15 dias antes do vencimento** - Aviso preventivo
2. **No dia do vencimento** - Aviso crítico  
3. **60 dias após vencimento** - Aviso de encerramento

## 📋 Fluxo Automático

```
Todo dia às 8h → Busca no banco → Envia email → Marca como notificado
```

### O que acontece:

1. ✅ Busca todas as demandas não concluídas
2. ✅ Calcula a data de vencimento (20 dias para SIC, 30 dias para Ouvidoria)
3. ✅ Verifica se precisa enviar notificação (15 dias, hoje, ou 60 dias vencido)
4. ✅ Verifica se já foi notificado (evita duplicatas)
5. ✅ Envia email usando o serviço Gmail
6. ✅ Registra no banco de dados

## 🧪 Como Testar

### 1. Testar Envio de Email

```bash
GET http://localhost:3000/api/notifications/test?email=seu_email@gmail.com
```

Isso envia um email de teste para verificar se o sistema está funcionando.

### 2. Executar Verificação Manual

Você pode executar a verificação manualmente sem esperar as 8h:

```bash
POST http://localhost:3000/api/notifications/execute
Content-Type: application/json

{
  "tipo": "todas"
}
```

Ou usar o endpoint do cron:

```javascript
import { executarVerificacaoManual } from './cron/vencimentos.cron.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
await executarVerificacaoManual(prisma);
```

## 📊 Estrutura do Código

```javascript
// src/cron/vencimentos.cron.js

// 1. Função principal que executa tudo
executarVerificacaoVencimentos()

// 2. Processa cada tipo de notificação
processarVencimentos(diasAlvo, tipoNotificacao, getTemplate)

// 3. Verifica se já foi notificado
jaFoiNotificado(protocolo, tipoNotificacao)

// 4. Registra no banco
registrarNotificacao(dados)

// 5. Cron job (executa às 8h)
iniciarCronVencimentos(prisma)
```

## 🔧 Configuração

O sistema já está configurado para:

- ✅ Executar automaticamente às 8h
- ✅ Usar o serviço Gmail existente
- ✅ Evitar duplicatas (verifica histórico)
- ✅ Registrar tudo no banco de dados

## 📧 Templates de Email

Os templates estão em `src/services/email-notifications/emailConfig.js`:

- `getTemplate15Dias()` - Email de 15 dias antes
- `getTemplateVencimento()` - Email no dia do vencimento
- `getTemplate60Dias()` - Email 60 dias após vencimento

## 🗄️ Banco de Dados

Todas as notificações são registradas na tabela `NotificacaoEmail`:

```javascript
{
  protocolo: "12345",
  secretaria: "Secretaria de Saúde",
  emailSecretaria: "saude@exemplo.com",
  tipoNotificacao: "15_dias", // ou "vencimento" ou "60_dias_vencido"
  dataVencimento: "2025-01-15",
  diasRestantes: 15,
  enviadoEm: "2025-01-01T08:00:00Z",
  status: "enviado", // ou "erro"
  messageId: "gmail_message_id"
}
```

## 🎯 Exemplo de Uso

### Verificar Status

```bash
GET http://localhost:3000/api/notifications/scheduler/status
```

### Ver Histórico

```bash
GET http://localhost:3000/api/notifications/history?limit=10
```

### Ver Estatísticas

```bash
GET http://localhost:3000/api/notifications/stats?periodo=30
```

## ⚙️ Personalização

### Mudar Horário de Execução

Edite `src/cron/vencimentos.cron.js`:

```javascript
// Executar às 9h em vez de 8h
cron.schedule('0 9 * * *', async () => {
  // ...
});
```

### Adicionar Mais Períodos

Adicione mais verificações na função `executarVerificacaoVencimentos()`:

```javascript
// Exemplo: notificar 7 dias antes também
resultados['7_dias'] = await processarVencimentos(
  7,
  '7_dias',
  getTemplate7Dias // criar template
);
```

## 🐛 Troubleshooting

### Emails não estão sendo enviados

1. Verifique se o Gmail está autorizado:
```bash
GET http://localhost:3000/api/notifications/auth/status
```

2. Teste o envio manual:
```bash
GET http://localhost:3000/api/notifications/test
```

3. Verifique os logs do servidor

### Cron não está executando

1. Verifique se o servidor está rodando
2. Verifique os logs na inicialização
3. Execute manualmente para testar

### Duplicatas sendo enviadas

O sistema verifica automaticamente se já foi notificado. Se ainda assim houver duplicatas:

1. Verifique o banco de dados `NotificacaoEmail`
2. Verifique se o `protocolo` está correto
3. Verifique se o `tipoNotificacao` está correto

## ✅ Checklist de Funcionamento

- [ ] Gmail autorizado (`/api/notifications/auth/status`)
- [ ] Email de teste funcionando (`/api/notifications/test`)
- [ ] Cron iniciado (ver logs do servidor)
- [ ] Emails das secretarias configurados (`emailConfig.js`)
- [ ] Banco de dados atualizado (`npx prisma db push`)

## 📝 Notas

- O sistema usa o mesmo serviço Gmail que você já configurou
- Todas as notificações são registradas no banco
- O sistema evita duplicatas automaticamente
- Os prazos são calculados automaticamente (20 dias SIC, 30 dias Ouvidoria)

