# JuridFlow

Plataforma de gestão jurídica com captura automática de intimações e
movimentações pelas APIs públicas do CNJ.

## Visão geral

Software de gestão para escritório de advocacia contencioso: atendimento
pré-processual, processo, prazo, andamento, documento, pessoa e financeiro,
com multi-escritório desde a base do modelo de dados.

O diferencial é a captura automática. O sistema consulta duas APIs públicas do
CNJ — **nenhuma exige credencial do escritório**:

- **DJEN** — intimações oficiais por OAB/UF. É o canal que dispara prazo.
- **DataJud** — movimentações e metadados de processo, nos 91 tribunais.

O JuridFlow **não** acessa portal de tribunal com login, **não** guarda senha
nem certificado digital, e **não** peticiona. Essa fronteira é decisão de
projeto — a justificativa está em [`RELATORIO_ARQUITETURA.md`](RELATORIO_ARQUITETURA.md),
seção 6.

## Arquitetura

```
   navegador
       │  HTTPS
       ▼
┌───────────────────────────┐      arquivo estático (public_html no cPanel)
│  frontend                 │
│  React 18 + Vite 5        │
└────────────┬──────────────┘
             │  fetch + Authorization: Bearer <JWT>
             ▼
┌───────────────────────────┐      Node.js App no cPanel
│  backend                  │
│  Express 4 + Prisma 5     │
└──────┬─────────────┬──────┘
       ▼             ▼
┌─────────────┐  ┌────────────────────────────┐
│  MariaDB    │  │  APIs públicas do CNJ      │
│  / MySQL    │  │  DJEN · DataJud            │
└─────────────┘  └────────────────────────────┘
```

Um runtime, um banco. Sem fila, worker, Redis ou navegador headless — não são
necessários porque não há login em portal a automatizar.

## Tecnologias

| | |
|---|---|
| **Backend** | Node.js 18+ · TypeScript 5.3 · Express 4.18 · Prisma 5.10 · MariaDB/MySQL |
| **Frontend** | React 18.2 · Vite 5.1 · TypeScript 5.3 · Tailwind 3.4 · lucide-react |
| **Segurança** | JWT HS256 · bcryptjs · zod |
| **Dev** | MariaDB nativo (ou Docker Compose) · ts-node-dev · Prisma Migrate |

## Instalação

Requer **Node.js 18+** e **MariaDB** (ou MySQL).

Instale o MariaDB nativo de [mariadb.org/download](https://mariadb.org/download/)
— é o mesmo motor do cPanel e roda como serviço, na porta 3306. Alternativa
via Docker: `docker compose up -d` sobe MariaDB 11.4 na porta 3307.

```bash
cd backend
npm install
cp .env.example .env
```

No `.env`, gerar e colar o segredo do JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Preencher também `SEED_ADMIN_PASSWORD` (mínimo 10 caracteres) e a senha dentro
de `DATABASE_URL`. Caractere reservado de URL na senha (`@ / ? # [ ]`) precisa
de percent-encoding, senão o Prisma lê a senha cortada.

Criar banco e usuário, aplicar o schema e popular:

```bash
npm run banco:preparar | mysql -u root -p    # pule se usar Docker
npm run migrate:deploy
npm run seed

cd ../frontend
npm install
cp .env.example .env
```

## Execução

```bash
cd backend  && npm run dev     # http://localhost:3001
cd frontend && npm run dev     # http://localhost:5173
```

Verificação:

```bash
cd backend
npm run typecheck              # tsc --noEmit
npm run verificar              # calendário forense + autenticação
npm run studio                 # Prisma Studio

cd frontend
npm run build                  # tsc --noEmit && vite build
```

## Estrutura do projeto

```
├── backend/
│   ├── prisma/                schema (17 tabelas) + migrations
│   └── src/
│       ├── routes/            55 rotas sob /api
│       ├── controllers/       regra de negócio (14)
│       ├── services/          DJEN, DataJud, cálculo de prazo
│       ├── middleware/        auth (JWT + cargo), auditoria LGPD
│       ├── lib/               config, tribunais, feriados, paginação
│       └── scripts/           preparar-banco, verificações
├── frontend/
│   └── src/
│       ├── pages/             12 telas
│       ├── components/        layout, assistente Flow, comuns
│       ├── context/           AuthContext
│       └── services/          http (Bearer, base URL) + api tipada
├── docker-compose.yml         MariaDB local (opcional, alternativa ao nativo)
├── DOCUMENTACAO.md            documentação completa
├── RELATORIO_ARQUITETURA.md   decisões e justificativas
└── DEPLOY_CPANEL_MYSQL.md     roteiro de publicação
```

## Considerações de segurança

**Autenticação.** JWT HS256, 12h. `authMiddleware` não tem caminho
alternativo: token ausente, malformado, expirado ou mal assinado devolve
`401`. O payload é validado campo por campo. Senha com bcrypt.

**Autorização.** `requireCargo(...)` por rota. Quatro cargos: `socio`,
`advogado`, `estagiario`, `financeiro`. O frontend esconde o que o backend
recusaria, mas **a checagem que vale é a do servidor**.

**Segredos.** `lib/config.ts` valida no boot e derruba o processo se
`JWT_SECRET` (mínimo 32 caracteres), `DATABASE_URL` ou — em produção —
`CORS_ORIGINS` faltarem. Há lista de bloqueio: segredos que já vazaram no
repositório são recusados explicitamente. `.env` está no `.gitignore`.

> A lista `SEGREDOS_PROIBIDOS` em `lib/config.ts` guarda strings com o nome
> antigo do produto. **Não renomeie** — são os valores que efetivamente
> vazaram, e trocá-los liberaria de volta segredos comprometidos.

**Nenhuma chave no frontend.** A única variável exposta no bundle é
`VITE_API_URL`, que é uma URL. `DATAJUD_API_KEY` fica só no backend.

**Auditoria LGPD.** `logUserAction` grava em `AuditLog` após a resposta:
usuário, cargo, ação, rota, IP e user-agent. Aplicado em toda rota de escrita
e nas leituras de dado sensível. A trilha só é legível pelo sócio.

**Superfície de rede.** CORS por lista de origens (obrigatória em produção),
paginação com teto de 200 registros, entrada validada com zod, stack trace
oculto em produção.

**O que deliberadamente não existe.** Não há cofre de credencial de tribunal
nem armazenamento de certificado digital. Fazer isso de forma defensável
exigiria chave mestra fora do banco, KDF real, AAD, rotação de chave,
decifragem em processo isolado e **servidor dedicado** — não hospedagem
compartilhada. Detalhes em [`RELATORIO_ARQUITETURA.md`](RELATORIO_ARQUITETURA.md),
seção 6.

**Ponto de atenção conhecido.** O escritório é filtrado no controller a partir
de `req.tenant_id`, sem row-level security no banco. Um controller que esqueça
o filtro vaza dado entre escritórios — é o item que mais merece atenção em
revisão de rota nova.

## Melhorias futuras

| Prioridade | Item |
|---|---|
| **alta** | Medir o atraso do DataJud por tribunal — afeta cálculo de prazo |
| **alta** | Extrair pacote de tipos compartilhado entre frontend e backend |
| **alta** | Teste automatizado, começando pelos conectores CNJ e cálculo de prazo |
| média | Migrar a UI para os tokens do design system e ligar o tema escuro |
| média | Ligar um modelo de IA no assistente Flow (hoje são regras locais) |
| média | Trava de isolamento entre escritórios no banco, não só no controller |
| baixa | `react-router`, para link direto por tela |

Lista completa com riscos e prazos em [`DOCUMENTACAO.md`](DOCUMENTACAO.md),
seções 15 e 16.

---

Documentação completa: [`DOCUMENTACAO.md`](DOCUMENTACAO.md) ·
Decisões de arquitetura: [`RELATORIO_ARQUITETURA.md`](RELATORIO_ARQUITETURA.md) ·
Deploy: [`DEPLOY_CPANEL_MYSQL.md`](DEPLOY_CPANEL_MYSQL.md)
