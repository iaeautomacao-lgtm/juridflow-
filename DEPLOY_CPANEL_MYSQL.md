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
juridflow.grupoddm.ia.br         frontend
juridflow.grupoddm.ia.br/api     backend (Application URL do Node.js App)
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

## 2. Trazer o código com o Git Version Control

cPanel → **Controle de Versão do Git** → **Criar**, apontando para o
repositório. O clone fica em `/home/USUARIO/repositories/juridflow-`.

Isso substitui upload por FTP: para publicar uma versão nova, basta `git pull`
no servidor.

### Onde o build acontece

`frontend/dist` e `backend/dist` estão no `.gitignore` — build não entra em
repositório. Então o clone traz só o código-fonte, e a compilação roda **no
servidor**, no terminal da aplicação Node (é ele que carrega o PATH do Node).

O repositório traz dois arquivos para isso:

| Arquivo | Papel |
|---|---|
| `scripts/deploy-cpanel.sh` | sequência completa: pull, dependências, build, migrations, publicação |
| `.cpanel.yml` | tarefas do botão *Deploy HEAD Commit* — só copia o `dist` já compilado |

**Ajuste `DEPLOYPATH` nos dois** para o Document Root do seu subdomínio, visto
em cPanel → Domains.

### O caminho recomendado

No terminal da aplicação Node:

```bash
cd ~/repositories/juridflow-
bash scripts/deploy-cpanel.sh
```

O script para com mensagem clara se algo faltar — `.env` ausente, `node` fora
do PATH, build que não gerou arquivo. Ele **não** reinicia a aplicação: o
comando de restart do Passenger varia por provedor, e um restart errado deixa
a API fora do ar sem aviso. Reinicie pelo painel.

### Se preferir compilar na sua máquina

Funciona, e é mais rápido se a hospedagem tiver pouca memória — `vite build` e
`tsc` consomem RAM, e shared hosting às vezes mata o processo:

```bash
cd backend  && npm run build
cd ../frontend && npm run build
```

Depois envie `backend/dist`, `backend/prisma`, `package.json` e
`package-lock.json` para a pasta da aplicação, e o **conteúdo** de
`frontend/dist` para o Document Root.

### `VITE_API_URL`

O frontend precisa saber onde está a API **no momento do build** — depois não
dá para mudar sem recompilar. Com a API em `/api` do mesmo subdomínio, o
padrão do `.env.example` já serve:

```env
VITE_API_URL="/api"
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

CORS_ORIGINS="https://juridflow.grupoddm.ia.br"

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
   - **Application URL**: `juridflow.grupoddm.ia.br` + caminho `api`
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

> ### ⚠️ Engine das tabelas: InnoDB, não MyISAM
>
> O Prisma **não emite cláusula de engine** — herda o default do servidor. Se
> o default for MyISAM, duas coisas quebram:
>
> 1. **Limite de índice de 1000 bytes.** Os índices compostos do schema somam
>    1528 bytes (duas colunas `VARCHAR(191)` em `utf8mb4`), e a migration falha
>    com `Specified key was too long` (erro 1071).
> 2. **MyISAM não suporta chave estrangeira.** Aceita a sintaxe e ignora em
>    silêncio. As 19 FKs com `ON DELETE CASCADE` a partir de `Tenant` deixam de
>    existir — apagar um escritório deixa registro órfão em 16 tabelas, sem
>    erro. O isolamento multi-tenant depende desse cascade.
>
> O item 2 é o grave: perde-se integridade referencial sem aviso.
>
> A migration inicial já declara `ENGINE = InnoDB ROW_FORMAT = DYNAMIC`.
> **Migration nova gerada pelo Prisma vem sem isso** — confira antes de
> aplicar. O `deploy-cpanel.sh` verifica o engine depois do migrate e alerta.

> Use `migrate deploy`, **não** `prisma db push`. O `push` sincroniza o schema
> ignorando o histórico de migrations e pode apagar coluna sem avisar. Em
> produção, `deploy` aplica só as migrations pendentes, na ordem, e falha em
> vez de improvisar.

5. **Restart Application**

6. Conferir:

```bash
curl https://juridflow.grupoddm.ia.br/api/health
```

Deve responder `{"status":"OK",...}`. Se não subir, veja o log da aplicação no
painel — `config.ts` diz exatamente qual variável faltou.

---

## 5. Publicar o frontend

Se usou `deploy-cpanel.sh`, já está feito — pule para o SSL.

Manualmente: envie o **conteúdo de dentro** de `frontend/dist` para o Document
Root do subdomínio, não a pasta `dist` em si.

### O `.htaccess` vem do build

Ele vive em `frontend/public/.htaccess` e o Vite o copia para `dist/` em todo
build. Fica versionado com o código, em vez de ser criado à mão no Gerenciador
de Arquivos e esquecido no deploy seguinte.

Ao copiar, use `cp -R dist/. destino/` — com **ponto**, não `dist/*`. O
asterisco não pega dotfiles, o `.htaccess` fica de fora, e o sintoma é que
recarregar qualquer tela interna devolve 404.

O arquivo faz quatro coisas:

| Regra | Efeito |
|---|---|
| exceção do `/api` antes do catch-all | deixa `/api` para o Passenger — **sem ela a API devolve HTML** |
| catch-all para `index.html` | roteamento da aplicação funciona ao recarregar |
| `Cache-Control` por tipo | assets com hash em cache eterno, `index.html` nunca |
| `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | cabeçalhos de segurança |

O `Strict-Transport-Security` está comentado de propósito: ative depois de
confirmar que o AutoSSL emitiu o certificado. Com HTTPS quebrado e HSTS
ligado, o site fica inacessível pelo período do `max-age`.

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
SEED_EMAIL_DOMINIO="grupoddm.ia.br" \
SEED_ADMIN_PASSWORD="<senha forte, temporária>" \
npx ts-node src/seed.ts
```

2. Entrar como `socio@grupoddm.ia.br`
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
0 8,18 * * *   curl -s -X POST https://juridflow.grupoddm.ia.br/api/captura/sincronizar-djen -H "Authorization: Bearer <token>" > /dev/null
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
| Domínio | nenhum — `localhost:5173` | `juridflow.grupoddm.ia.br` |
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
