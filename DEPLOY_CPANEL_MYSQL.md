# Guia de Implantação: JuridFlow no cPanel (Node.js + MariaDB / MySQL)

Este documento instrui passo a passo como publicar o **JuridFlow** em uma hospedagem **cPanel** padrão utilizando banco de dados **MariaDB ou MySQL**.

---

## 1. Criar o Banco de Dados MariaDB/MySQL no cPanel

1. Acesse o **cPanel** da sua hospedagem.
2. Vá em **Bancos de dados MySQL®** ou **Assistente de Banco de Dados MySQL**.
3. Crie um novo banco de dados (exemplo: `seuusuario_juridflow_db`).
4. Crie um novo usuário MySQL (exemplo: `seuusuario_juridflow_user`) e defina uma senha forte.
5. Adicione o usuário ao banco de dados concedendo **TODOS OS PRIVILÉGIOS**.

---

## 2. Configurar a String de Conexão no Backend (`.env`)

No arquivo `backend/.env`, configure a variável `DATABASE_URL` para o formato MySQL/MariaDB:

```env
PORT=3001
DATABASE_URL="mysql://seuusuario_juridflow_user:SuaSenhaForte123@localhost:3306/seuusuario_juridflow_db"
JWT_SECRET="juridflow-secret-key-2026-juridico-multitenant"
CREDENTIALS_ENCRYPTION_KEY="sua-chave-criptografia-aes256-presto"
NODE_ENV="production"
```

---

## 3. Alterar o Provider do Prisma para MySQL

No arquivo `backend/prisma/schema.prisma`, altere a linha `datasource db`:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

Em seguida, no terminal da sua máquina local ou via SSH no cPanel:
```bash
cd backend
npx prisma db push
npx ts-node src/seed.ts
```
> *(Isso criará automaticamente todas as tabelas e o seed de dados no MariaDB/MySQL).*

---

## 4. Subir a Aplicação Node.js no cPanel

1. No cPanel, vá em **Setup Node.js App** (ou **Criar Aplicação Node.js**).
2. Clique em **Create Application**.
3. Defina:
   - **Node.js version**: `18.x` ou `20.x`
   - **Application mode**: `Production`
   - **Application root**: `juridflow-backend`
   - **Application URL**: `api.seudominio.com.br` ou `seudominio.com.br/api`
   - **Application startup file**: `dist/server.js`
4. Faça upload dos arquivos compilados da pasta `backend/dist` e `package.json`.
5. Clique em **Run NPM Install** no painel do cPanel.
6. Clique em **Restart Application**.

---

## 5. Publicar o Frontend React no cPanel

1. Na sua máquina local, gere a pasta de distribuição do frontend:
   ```bash
   cd frontend
   npm run build
   ```
2. A pasta `frontend/dist` será gerada com os arquivos estáticos compilados.
3. No cPanel, abra o **Gerenciador de Arquivos**.
4. Vá até a pasta `public_html` (ou no subdomínio desejado).
5. Envie todo o conteúdo interno da pasta `frontend/dist` para dentro da `public_html`.
6. Crie um arquivo `.htaccess` na raiz da `public_html` para suportar roteamento SPA do React:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-i
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

PRONTO! A aplicação **JuridFlow** estará no ar no cPanel utilizando o banco de dados MariaDB/MySQL com suporte total a auditoria LGPD e cofre de credenciais Presto!
