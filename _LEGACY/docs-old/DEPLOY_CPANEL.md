# 🚀 Guia Oficial de Deploy no cPanel (Node.js)

Seguindo as regras de ouro para deploy seguro e eficiente.

---

## ✅ Opção 1: FTP / ZIP (Recomendada para Upload Manual)
Esta abordagem sobe apenas o código necessário, sem lixo.

### 1. Preparação (Local)
No seu computador, rode:
```bash
npm run build
node scripts/build/prepare-prod-bundle.js
```
Isso vai criar o arquivo: **`prod-bundle.zip`** na raiz.

### 2. Conectar
Assim que você salvar, rode este comando no seu terminal aqui do VS Code:
```bash
ssh -i ogm-access -p 22022 ogmanalytics@162.215.14.23
```

*(Se ele perguntar "Are you sure you want to continue connecting?", digite `yes` e dê Enter).*

### 3. O que tem dentro do ZIP?
O script já filtrou tudo automaticamente conforme as regras:
- [x] `src/` (Código backend)
- [x] `public/` (Frontend buildado)
- [x] `config/`
- [x] `scripts/`
- [x] `package.json`
- [x] `package-lock.json` (Essencial para travar versões)

### 3. O que foi EXCLUÍDO (Automaticamente)?
- ❌ `node_modules/` (Será instalado pelo cPanel)
- ❌ `.env` (Configurado direto no painel do cPanel)
- ❌ `.git/`
- ❌ `logs/`
- ❌ `tests/`
- ❌ `Dockerfile` (Não usado no cPanel)

### 4. No cPanel
1.  Vá em **Gerenciador de Arquivos**.
2.  Crie a pasta do projeto (ex: `ouvidoria`).
3.  Faça upload do `prod-bundle.zip`.
4.  Extraia lá dentro.
5.  Vá no menu principal do cPanel em **"Setup Node.js App"**.
    - **Ouro Institucional**: Como o Node não está no seu `jailshell` (Bash), este é o único caminho oficial.
    - Application Root: `ouvidoria`
    - Application Startup File: `src/server.js`
    - Clique em **Install NPM Packages** (Isso roda o `npm install` internamente no servidor).
    - **Credenciais Google**: Certifique-se de que o arquivo `config/google-credentials.json` existe (necessário para o Google Sheets).
    - Defina as Variáveis de Ambiente no botão "Environment Variables".
    - Clique em **START**.

---

## 🚫 Coisas Proibidas (Checklist)
> Se você subir essas coisas, vai dar erro ou conflito.

- ❌ **Subir node_modules via FTP**: Destrói a aplicação porque os binários do Windows não rodam no Linux do cPanel.
- ❌ **Subir .env**: Arriscado. Configure as chaves nas variáveis do cPanel.
- ❌ **Fixar porta**: O código já usa `process.env.PORT` e `0.0.0.0` (correto).
- ❌ **Usar PM2**: O cPanel já gerencia o processo (Passenger).

---

## ✅ Opção 2: Git / SSH (Avançado)
Se tiver acesso SSH ao servidor:

1. `cd ~/repositories`
2. `git clone https://github.com/ouvidoriag/ogdash.git`
3. Vá no "Setup Node.js App", aponte para a pasta.
4. Clique em "Run NPM Install".
5. Clique em Restart.

---

## Arquivo de Bundle
Use sempre o arquivo **`prod-bundle.zip`**. Ele é a garantia de um deploy limpo, auditável e seguro.
