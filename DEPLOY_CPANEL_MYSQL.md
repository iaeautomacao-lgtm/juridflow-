# Implantação do JuridFlow no cPanel

Publicação em hospedagem cPanel com MariaDB/MySQL.

> **Este guia foi reescrito em 10/09/2026.** A versão anterior era da fase
> ACORDIO e prescrevia um `JWT_SECRET` literal, omitia `CORS_ORIGINS` (hoje
> obrigatório) e mandava usar `prisma db push` em vez das migrations. Se você
> seguiu a versão antiga, releia a seção 3.

---

## 0. Antes de comprar domínio — verifique isto

Duas checagens que decidem se o deploy é possível. Faça as duas **antes** de
gastar dinheiro.

### O plano tem aplicação Node.js?

No cPanel, procure **Setup Node.js App** (ou *Criar Aplicação Node.js*).

- **Existe** → segue o guia.
- **Não existe** → o backend não roda nessa hospedagem. Planos cPanel só com
  PHP não executam Node. Alternativas: pedir upgrade ao provedor, ou hospedar
  o backend num VPS e deixar só o frontend no cPanel.

### Você precisa de domínio novo?

Não necessariamente. Um **subdomínio** de domínio que o Grupo DDM já tem
resolve, é gratuito e sai no ar em minutos.

**Prefira um subdomínio só**, com a API em `/api` do mesmo endereço:

```
juridflow.grupoddm.com.br         frontend
juridflow.grupoddm.com.br/api     backend (Application URL do Node.js App)
```

| | Dois subdomínios | Um subdomínio |
|---|---|---|
| Certificado SSL | dois | **um** |
| CORS | configurar e acertar | **não existe** — mesma origem |
| `VITE_API_URL` | URL completa | **`/api`**, o padrão do `.env.example` |

Mesma origem significa que o navegador nem consulta CORS. Uma classe de erro
a menos. O resto deste guia assume esse arranjo.

Domínio novo só se quiser identidade própria para o produto.

> Se o DNS do domínio estiver apontado para outro provedor, o subdomínio não
> resolve sozinho: crie um registro **A** para `juridflow` apontando para o IP
> do servidor cPanel, na zona DNS de quem hospeda o domínio.

> **Isso não tem relação com o ambiente local.** MariaDB no seu Windows roda em
> `localhost:3306`, sem domínio, sem cPanel e sem internet. Os dois ambientes
> são independentes — veja a seção 8.

---

## 1. Criar o banco no cPanel

1. **Bancos de dados MySQL®** → criar banco: `usuario_juridflow`
2. Criar usuário: `usuario_juridflow_app`, com **senha forte gerada pelo
   painel**
3. Adicionar o usuário ao banco com **todos os privilégios**
4. Anote banco, usuário e senha — vão para a `DATABASE_URL`

O cPanel prefixa tudo com o nome da sua conta. O nome final é o que o painel
mostrar, não o que você digitou.

---

## 2. Preparar os arquivos localmente

O cPanel não compila TypeScript. O build sai da sua máquina.

```bash
# backend
cd backend
npm ci
npm run build          # gera backend/dist

# frontend
cd ../frontend
```

O frontend precisa saber onde está a API **no momento do build** — depois não
dá para mudar sem rebuildar. Edite `frontend/.env`:

```env
# Mesma origem (API em /api do mesmo subdomínio) — nao precisa de URL completa:
VITE_API_URL="/api"

# Só use URL completa se a API ficar em outro domínio:
# VITE_API_URL="https://api.juridflow.grupoddm.com.br/api"
```

```bash
npm run build          # gera frontend/dist
```

---

## 3. Variáveis de ambiente do backend

`lib/config.ts` valida no boot e **derruba o processo** se algo faltar. Isso é
intencional: melhor não subir do que subir insegura.

| Variável | Regra |
|---|---|
| `DATABASE_URL` | credencial da seção 1 |
| `JWT_SECRET` | **mínimo 32 caracteres, gerado agora, só para produção** |
| `CORS_ORIGINS` | **obrigatória em produção** — domínio do frontend |
| `NODE_ENV` | `production` |
| `DATAJUD_API_KEY` | chave pública do CNJ |
| `SEED_ADMIN_PASSWORD` | só se for rodar o seed — veja a seção 6 |

### Gere o JWT_SECRET — não copie de lugar nenhum

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> ⚠️ **Nunca use um segredo que esteja escrito em documentação, exemplo ou
> repositório.** Segredo publicado é segredo comprometido — qualquer pessoa com
> acesso ao código assina um token válido de produção e entra como qualquer
> usuário.
>
> `lib/config.ts` mantém uma lista de bloqueio dos valores que já vazaram e
> recusa subir com eles. A lista não é proteção suficiente: ela pega o que já se
> sabe ter vazado, não o que você inventar agora.

O `.env` de produção é criado **no servidor**, pelo painel ou por SSH. Nunca
suba um `.env` preenchido — o `.gitignore` bloqueia, e é para continuar assim.

Modelo (substitua todos os valores):

```env
PORT=3001
NODE_ENV=production

DATABASE_URL="mysql://usuario_juridflow_app:SENHA@localhost:3306/usuario_juridflow"

JWT_SECRET="<cole aqui o valor gerado pelo comando acima>"
JWT_EXPIRES_IN="12h"

CORS_ORIGINS="https://juridflow.grupoddm.com.br"

DATAJUD_API_KEY="<chave pública do CNJ>"
DATAJUD_TIMEOUT_MS=20000
DJEN_API_URL="https://comunica.pje.jus.br/api/v1/comunicacao"
DJEN_TIMEOUT_MS=20000
```

Se a senha do banco tiver caractere reservado de URL (`@ / ? # [ ]`), aplique
percent-encoding: `@` vira `%40`, `#` vira `%23`. Sem isso o Prisma lê a senha
cortada e falha com *access denied* sem explicar o motivo.

`CREDENTIALS_ENCRYPTION_KEY` **não existe mais** — o cofre de credenciais foi
removido do projeto. Se a viu num guia antigo, ignore.

---

## 4. Subir o backend

1. **Setup Node.js App** → *Create Application*
   - **Node.js version**: 18.x ou 20.x
   - **Application mode**: `Production`
   - **Application root**: `juridflow-api`
   - **Application URL**: `juridflow.grupoddm.com.br` + caminho `api`
   - **Application startup file**: `dist/server.js`

2. Enviar para a pasta `juridflow-api`:

```
dist/                 build do backend
prisma/               schema.prisma + migrations/  (necessário para o migrate)
package.json
package-lock.json
.env                  criado no servidor, nunca enviado
```

3. **Run NPM Install** no painel

4. Criar as tabelas — no terminal da aplicação (o painel oferece um, ou use
   SSH):

```bash
npx prisma migrate deploy
```

> Use `migrate deploy`, **não** `prisma db push`. O `push` sincroniza o schema
> ignorando o histórico de migrations e pode apagar coluna sem avisar. Em
> produção, `deploy` aplica só as migrations pendentes, na ordem, e falha em
> vez de improvisar.

5. **Restart Application**

6. Conferir:

```bash
curl https://juridflow.grupoddm.com.br/api/health
```

Deve responder `{"status":"OK",...}`. Se não subir, veja o log da aplicação no
painel — `config.ts` diz exatamente qual variável faltou.

---

## 5. Subir o frontend

1. cPanel → **Gerenciador de Arquivos**
2. Ir na pasta do subdomínio (ou `public_html`)
3. Enviar **o conteúdo de dentro** de `frontend/dist` — não a pasta `dist` em
   si
4. Criar `.htaccess` na raiz, para o roteamento da aplicação:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Deixa /api para o Passenger (a API Node). Sem esta linha, o roteamento
  # da SPA abaixo engole as chamadas da API e elas voltam como index.html.
  RewriteRule ^api(/|$) - [L]

  # Arquivo ou diretório existente é servido direto.
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Qualquer outra rota cai no index.html, que a aplicação resolve.
  RewriteRule . /index.html [L]
</IfModule>

# Cache longo para os assets com hash no nome; nunca para o index.html.
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|woff2?|svg|png|jpg|jpeg|webp)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\.html$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
</IfModule>
```

### SSL

cPanel → **SSL/TLS Status** → *Run AutoSSL* no subdomínio.

HTTPS não é opcional: sem ele, a senha do usuário e o token JWT trafegam em
texto claro. E `CORS_ORIGINS` aponta para `https://` — em `http://` o navegador
bloqueia as chamadas.

---

## 6. Primeiro acesso

**Não rode `npm run seed` em produção.** Ele cria quatro usuários com e-mail
`@juridflow.local`, um domínio inexistente, com a mesma senha para todos. É
dado de desenvolvimento.

Em produção, o caminho é:

1. Rodar o seed **uma vez**, só para criar o escritório e o usuário sócio,
   com variáveis reais:

```bash
SEED_TENANT_NOME="Grupo DDM" \
SEED_EMAIL_DOMINIO="grupoddm.com.br" \
SEED_ADMIN_PASSWORD="<senha forte, temporária>" \
npx ts-node src/seed.ts
```

2. Entrar como `socio@grupoddm.com.br`
3. **Trocar a senha no primeiro acesso**
4. Cadastrar a equipe real em **Configurações → Perfis & Permissões**, com o
   cargo de cada um

---

## 7. Cron da captura

A aplicação Node no cPanel **hiberna quando fica ociosa**. Sem um cron
chamando o endpoint, a captura do DJEN só roda quando alguém clica no botão.

cPanel → **Cron Jobs**. Duas vezes ao dia, manhã e fim de tarde, para pegar a
publicação do dia:

```
0 8,18 * * *   curl -s -X POST https://juridflow.grupoddm.com.br/api/captura/sincronizar-djen -H "Authorization: Bearer <token>" > /dev/null
```

O endpoint exige autenticação. Duas opções, nenhuma perfeita:

- **Token de longa duração** para um usuário de serviço. Simples, mas o token
  fica escrito no cron.
- **Endpoint interno** com segredo próprio em variável de ambiente, aceitando
  só chamada local. Mais seguro, mas exige código novo.

Hoje nenhuma das duas está implementada. Enquanto isso, a captura é manual
pelo botão. Pendência registrada em `DOCUMENTACAO.md`, seção 16.

---

## 8. Ambiente local x produção

Confusão comum, então explícito:

| | Local | Produção |
|---|---|---|
| Onde roda | seu Windows | cPanel |
| Banco | MariaDB em `localhost:3306` | MariaDB do cPanel |
| Domínio | nenhum — `localhost:5173` | `juridflow.grupoddm.com.br` |
| Precisa de internet | não | sim |
| Dados | seed de teste | dados reais do escritório |
| Para que serve | desenvolver e testar antes de publicar | o escritório usar |

**Você precisa dos dois.** Sem ambiente local, cada mudança tem que ser
enviada ao servidor para ser testada, e o bug aparece com o escritório usando.
Instalar o MariaDB local não exige domínio nem cPanel — instruções no
`README.md`.

---

## 9. Verificação pós-deploy

| # | Verificar | Esperado |
|---|---|---|
| 1 | `GET /health` na API | `{"status":"OK"}` |
| 2 | Frontend abre no domínio | tela de Login |
| 3 | Login com o sócio | entra no painel |
| 4 | Recarregar numa tela interna | não dá 404 (`.htaccess` funcionando) |
| 5 | Cadeado HTTPS nos dois domínios | válido |
| 6 | `GET /api/processos` sem token | `401` |
| 7 | Login como financeiro → aba Financeiro | acessa |
| 8 | Login como advogado → aba Financeiro | escondida, e `403` se forçar |
| 9 | Disparar captura DJEN com a OAB real | intimações chegam |
| 10 | Consultar um CNJ real no DataJud | dados retornam |
| 11 | Trilha de auditoria como sócio | registros aparecem |
| 12 | Trilha de auditoria como advogado | `403` |

O item 6 é o mais importante: confirma que a autenticação está de fato
recusando. Era exatamente o defeito da primeira versão do projeto.

E **meça o atraso do DataJud** (item 10) comparando com o portal do tribunal.
Enquanto esse número não for conhecido, ninguém sabe se um prazo foi calculado
sobre dado velho. É o único item que envolve responsabilidade profissional.
