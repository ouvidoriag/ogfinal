# Sistema de Notificações por Email

Sistema automatizado para envio de emails corporativos para secretarias sobre prazos de vencimento de demandas.

## Funcionalidades

O sistema envia notificações automáticas em 3 momentos:

1. **15 dias antes do vencimento** - Aviso preventivo
2. **No dia do vencimento** - Aviso crítico
3. **60 dias após o vencimento** - Aviso de encerramento automático

## Estrutura

```
src/services/email-notifications/
├── emailConfig.js          # Configuração de emails e templates
├── gmailService.js         # Integração com Gmail API
├── notificationService.js # Lógica de notificações
├── scheduler.js            # Agendamento automático
└── README.md              # Este arquivo
```

## Configuração

### 1. Instalar Dependências

As dependências já foram adicionadas ao `package.json`:
- `googleapis` - Cliente Gmail API
- `node-cron` - Agendamento de tarefas

Execute:
```bash
npm install
```

### 2. Configurar Credenciais do Gmail

#### Passo 1: Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a **Gmail API**:
   - Vá em "APIs & Services" > "Library"
   - Busque por "Gmail API"
   - Clique em "Enable"

#### Passo 2: Criar Credenciais OAuth 2.0

1. Vá em "APIs & Services" > "Credentials"
2. Clique em "Create Credentials" > "OAuth client ID"
3. Se solicitado, configure a tela de consentimento OAuth
4. Escolha "Desktop app" como tipo de aplicação
5. Baixe o arquivo JSON de credenciais
6. Renomeie o arquivo para `gmail-credentials.json`
7. Coloque o arquivo na raiz do projeto `NOVO/`

#### Passo 3: Autorizar o Aplicativo

1. Inicie o servidor:
```bash
npm start
```

2. Acesse o endpoint de autorização:
```
GET http://localhost:3000/api/notifications/auth/url
```

3. Copie a URL retornada e abra no navegador
4. Faça login com a conta Gmail que enviará os emails
5. Autorize o acesso
6. Copie o código de autorização da URL de retorno
7. Envie o código via POST:
```bash
POST http://localhost:3000/api/notifications/auth/callback
Content-Type: application/json

{
  "code": "CODIGO_AQUI"
}
```

O token será salvo automaticamente em `gmail-token.json`.

### 3. Configurar Emails das Secretarias

Edite o arquivo `emailConfig.js` e adicione o mapeamento de secretarias:

```javascript
export const SECRETARIAS_EMAILS = {
  'Secretaria de Saúde': 'saude@duquedecaxias.rj.gov.br',
  'Secretaria de Educação': 'educacao@duquedecaxias.rj.gov.br',
  'Secretaria de Obras': 'obras@duquedecaxias.rj.gov.br',
  // Adicione mais secretarias aqui...
};
```

### 4. Configurar Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Email do remetente (sistema)
EMAIL_REMETENTE=ouvidoria@duquedecaxias.rj.gov.br
NOME_REMETENTE=Ouvidoria Geral de Duque de Caxias

# Email padrão para secretarias sem email cadastrado
EMAIL_PADRAO_SECRETARIAS=ouvidoria@duquedecaxias.rj.gov.br
```

### 5. Atualizar Schema do Banco de Dados

Execute o Prisma para criar o modelo de notificações:

```bash
npx prisma generate
npx prisma db push
```

## Uso

### Execução Automática

O scheduler executa automaticamente **diariamente às 8h da manhã** (horário de Brasília).

### Execução Manual

#### Executar Todas as Notificações

```bash
POST http://localhost:3000/api/notifications/execute
Content-Type: application/json

{
  "tipo": "todas"
}
```

#### Executar Notificações Específicas

```bash
# 15 dias antes
POST http://localhost:3000/api/notifications/execute
Content-Type: application/json

{
  "tipo": "15_dias"
}

# No dia do vencimento
POST http://localhost:3000/api/notifications/execute
Content-Type: application/json

{
  "tipo": "vencimento"
}

# 60 dias após vencimento
POST http://localhost:3000/api/notifications/execute
Content-Type: application/json

{
  "tipo": "60_dias"
}
```

## Endpoints da API

### Autenticação

- `GET /api/notifications/auth/url` - Obter URL de autorização
- `POST /api/notifications/auth/callback` - Processar código de autorização
- `GET /api/notifications/auth/status` - Verificar status da autorização

### Execução

- `POST /api/notifications/execute` - Executar notificações manualmente
- `POST /api/notifications/scheduler/execute` - Executar verificação do scheduler

### Consulta

- `GET /api/notifications/history` - Histórico de notificações enviadas
- `GET /api/notifications/stats` - Estatísticas de notificações
- `GET /api/notifications/config` - Configuração de emails
- `GET /api/notifications/scheduler/status` - Status do scheduler

## Exemplos de Uso

### Verificar Status da Autorização

```bash
curl http://localhost:3000/api/notifications/auth/status
```

### Obter Histórico de Notificações

```bash
curl "http://localhost:3000/api/notifications/history?limit=50&offset=0"
```

### Obter Estatísticas

```bash
curl "http://localhost:3000/api/notifications/stats?periodo=30"
```

## Lógica de Prazos

O sistema calcula os prazos baseado no tipo de manifestação:

- **SIC (Serviço de Informação ao Cidadão)**: 20 dias
- **Ouvidoria** (reclamação, sugestão, denúncia, elogio): 30 dias

A data de vencimento é calculada como: `dataCriacao + prazo`.

## Rastreamento

Todas as notificações enviadas são registradas no banco de dados no modelo `NotificacaoEmail`, permitindo:

- Evitar duplicatas (não envia a mesma notificação duas vezes)
- Rastrear histórico de envios
- Identificar erros
- Gerar estatísticas

## Troubleshooting

### Erro: "Serviço não autorizado"

Execute a autorização novamente seguindo os passos da seção "Configurar Credenciais do Gmail".

### Erro: "Token expirado"

O sistema renova automaticamente o token. Se persistir, execute a autorização novamente.

### Emails não estão sendo enviados

1. Verifique se o serviço está autorizado: `GET /api/notifications/auth/status`
2. Verifique os logs do servidor
3. Verifique se as credenciais estão corretas
4. Verifique se o email da secretaria está configurado

### Scheduler não está executando

1. Verifique se o servidor está rodando
2. Verifique o status: `GET /api/notifications/scheduler/status`
3. Verifique os logs do servidor na inicialização

## Segurança

- As credenciais OAuth são armazenadas localmente
- Os tokens são armazenados de forma segura
- Não compartilhe os arquivos `gmail-credentials.json` e `gmail-token.json`
- Adicione esses arquivos ao `.gitignore`

## Próximos Passos

1. Configurar emails de todas as secretarias no `emailConfig.js`
2. Testar o envio manual de notificações
3. Verificar se o scheduler está executando corretamente
4. Monitorar o histórico de notificações

