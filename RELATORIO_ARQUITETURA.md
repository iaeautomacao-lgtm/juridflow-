# JuridFlow — Relatório de Arquitetura

Documento de referência da plataforma. Descreve o que existe, o que
deliberadamente não existe, e por quê.

Última revisão: 09/09/2026

---

## 1. Escopo

O JuridFlow é um **software de gestão jurídica** que captura dados dos tribunais
pelas **APIs públicas oficiais do CNJ**.

Ele **não** acessa portal de tribunal com login, **não** guarda credencial de
tribunal, **não** guarda arquivo de certificado digital e **não** peticiona.
Essa fronteira é decisão de projeto, não pendência — a justificativa está na
seção 6.

| O JuridFlow faz | O JuridFlow não faz |
|---|---|
| capturar intimação (DJEN) | logar no PJe / e-SAJ / Projudi |
| capturar movimentação (DataJud) | baixar PDF de peça dos autos |
| calcular prazo em dias úteis | assinar petição |
| gerir processo, prazo, pessoa, financeiro | protocolar ato |
| gerar minuta de peça | acessar autos sigiloso |
| avisar de certificado vencendo | armazenar o certificado |

O advogado continua peticionando no portal do tribunal, com o certificado
digital dele, na máquina dele.

---

## 2. Arquitetura

Dois artefatos, um runtime, um banco.

```
   navegador
       |  HTTPS
       v
+---------------------------+       arquivo estatico (public_html no cPanel)
|  frontend                 |
|  React 18 + Vite 5        |
|  TypeScript + Tailwind 3  |
+------------+--------------+
             |  fetch + Authorization: Bearer <JWT>
             v
+---------------------------+       Node.js App no cPanel
|  backend                  |
|  Express 4 + TypeScript   |
|  Prisma 5                 |
+------+-------------+------+
       |             |
       v             v
+-------------+  +--------------------------------+
|  MariaDB    |  |  APIs publicas do CNJ          |
|  / MySQL    |  |  - DJEN     (comunica.pje)     |
+-------------+  |  - DataJud  (api-publica)      |
                 |  nenhuma exige credencial      |
                 +--------------------------------+
```

Não há fila, worker, Redis, navegador headless nem serviço em Python. Não são
necessários porque não há login em portal a automatizar.

---

## 3. Backend — `backend/`

Stack: Node.js + Express 4 + TypeScript 5 + Prisma 5 + MariaDB/MySQL.

### Camadas

```
server.ts               bootstrap, middlewares globais, /health, listen
  |
  +-- routes/index.ts   55 rotas sob /api
  |     |
  |     +-- middleware/auth.ts          authMiddleware + requireCargo
  |     +-- middleware/auditLogger.ts   logUserAction
  |     |
  |     +-- controllers/     regra de negocio, acesso ao Prisma
  |           |
  |           +-- services/  I/O externo e calculo puro
  |           +-- lib/       utilitarios sem estado
```

### `lib/` — utilitários

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | valida env no boot; sem segredo padrão (ver 5.2) |
| `prisma.ts` | singleton do PrismaClient |
| `cargos.ts` | enum de cargo: `socio`, `advogado`, `estagiario`, `financeiro` |
| `modulos.ts` | chaves do vínculo polimórfico (ver 4.2) |
| `tribunais.ts` | resolve tribunal e índice DataJud a partir do número CNJ |
| `feriados.ts` | parte calculável do calendário forense |
| `pagination.ts` | limite padrão 50, máximo 200 |
| `serialize.ts` | normaliza tipos do Prisma que não sobrevivem ao JSON |
| `httpError.ts` | resposta de erro uniforme; oculta stack em produção |

### `services/` — integrações e cálculo

| Arquivo | Responsabilidade |
|---|---|
| `djenService.ts` | consulta DJEN por OAB/UF, grava `Intimacao` |
| `datajudService.ts` | consulta DataJud por CNJ, grava `Processo` e `Andamento` |
| `prazoService.ts` | contagem de prazo em dias úteis (CPC/2015, art. 219 e 224) |

Os dois conectores **falham explicitamente** quando a API do CNJ não responde.
Não existe fallback que gere registro sintético — ver seção 5.1.

---

## 4. Modelo de dados

17 models em `backend/prisma/schema.prisma`. Migrations versionadas em
`backend/prisma/migrations/`.

`Tenant` `User` `Processo` `Atendimento` `ContratoHonorarios` `Pessoa`
`Andamento` `Tarefa` `Documento` `Financeiro` `Intimacao` `CapturaPush`
`FranquiaCaptura` `Feriado` `ModeloDocumento` `AuditLog` `CertificadoDigital`

### 4.1 Multi-tenancy

Coluna discriminadora `tenant_id` em toda tabela de negócio, com FK para
`Tenant` e `onDelete: Cascade`. O filtro é aplicado em cada controller a partir
de `req.tenant_id`, que vem do JWT verificado.

Não há row-level security no banco. Consequência: **um controller que esqueça o
filtro vaza dado entre tenants.** É o ponto que mais merece atenção em revisão
de código.

### 4.2 Vínculo polimórfico

Recursos transversais — `Andamento`, `Tarefa`, `Documento`, `Financeiro` — não
têm FK para uma entidade específica. Eles se penduram em qualquer entidade de
negócio pelo par:

- `chave_modulo` → `processo` | `atendimento` | `contrato` | `pessoa`
- `codigo_registro_vinculo` → id do registro dono

**Custo:** perde-se integridade referencial por FK nesses quatro models.
**Ganho:** adicionar módulo novo não exige coluna nem migration neles.

---

## 5. Correções estruturais aplicadas

Cinco problemas encontrados na auditoria do commit inicial (`445a77d`) e
corrigidos. Ficam registrados porque são o tipo de defeito que volta.

### 5.1 Captura fabricava dados falsos

`djenService` e `datajudService` tinham bloco de fallback que, quando a chamada
ao CNJ falhava, montava intimação e movimentação fictícias e as gravava via
`prisma.intimacao.create` / `andamento.create` — indistinguíveis das reais.

Num sistema cuja função é avisar de prazo, isso é o pior defeito possível: o
escritório confia num prazo que não existe, ou deixa de ver um que existe.

**Hoje:** falha da API propaga erro. Nenhum registro sintético.

### 5.2 Autenticação não rejeitava

`authMiddleware` capturava a exceção de token inválido, buscava o primeiro
`Tenant` e o primeiro `User` do banco, e seguia com `next()`. Efeito: toda rota
"autenticada" respondia sem credencial, com os dados do primeiro usuário.

`JWT_SECRET` também tinha fallback literal no código-fonte, já versionado.

**Hoje:** token ausente, malformado, expirado ou mal assinado devolve 401, sem
caminho alternativo. `config.ts` exige `JWT_SECRET` com no mínimo 32 caracteres
no boot e **recusa subir** se o valor for um dos que já vazaram no repositório.

### 5.3 Autorização não existia

Toda rota tratava sócio, estagiário e financeiro igual.

**Hoje:** `requireCargo(...)` restringe as rotas de financeiro, de exclusão e de
administração. Continua valendo revisar rota nova contra a matriz de cargo.

### 5.4 URL da API fixa no código

`frontend/src/services/api.ts` tinha `const API_BASE_URL = 'http://localhost:3001/api'`.
Em produção o navegador do usuário tentaria o próprio localhost.

**Hoje:** `services/http.ts` lê `VITE_API_URL`, com `/api` como padrão de
desenvolvimento (usa o proxy do Vite). Toda requisição envia
`Authorization: Bearer`.

### 5.5 Schema duplicado em DDL cru

`server.ts` executava 14 `CREATE TABLE IF NOT EXISTS` via
`prisma.$executeRawUnsafe` — segunda definição do banco, paralela ao
`schema.prisma`, em sintaxe SQLite que MariaDB rejeita.

**Hoje:** removido. O banco é criado por `prisma migrate deploy`. Provider é
`mysql`.

---

## 6. Por que não há cofre de credencial

O que credencial de tribunal compra é uma coisa só: login no portal para baixar
documento de dentro dos autos e peticionar. O dado crítico do escritório —
**intimação, que é o que dispara prazo** — vem do DJEN sem credencial nenhuma.

Guardar senha de PJe e arquivo `.pfx` exigiria, para ser feito de forma
defensável:

- chave mestra fora do banco e fora do repositório, sem valor padrão
- KDF de verdade (scrypt/Argon2id), não `sha256` de string curta
- AAD no AES-GCM, amarrando o ciphertext a `tenant_id` + `credencial_id`
- `key_id` por registro, para permitir rotação
- decifragem isolada num processo que não atende requisição da internet
- auditoria de cada decifragem
- **servidor dedicado** — não hospedagem compartilhada

O destino do deploy é cPanel compartilhado: outros clientes na mesma máquina,
sem isolamento, `.env` no home dir, sem separação de processo. Nesse terreno, um
cofre é pior que a ausência de cofre, porque o escritório passa a confiar nele e
cadastra a senha real.

O `cryptoVault.ts` do commit inicial implementava AES-256-GCM corretamente, mas
nunca foi importado por arquivo nenhum, e sua chave derivava de uma string
literal versionada. Foi removido em vez de ligado.

**Certificado A3** fica em token físico ou smartcard e não pode ser usado por
servidor em nenhuma arquitetura. Somente A1 seria copiável.

### Fase 2 — se algum dia

A fase 2 depende de **duas** condições simultâneas: sair da hospedagem
compartilhada, **e** o escritório sentir falta do download automático de
documento. Se a segunda não acontecer, a fase 2 não precisa existir.

O caminho recomendado **não** é construir o cofre acima. É **certificado A3 em
nuvem com API de assinatura remota**: o certificado fica no HSM da
certificadora, o JuridFlow pede a operação, e o advogado autoriza pelo celular,
uma por vez. O sistema nunca tem cópia de nada e nenhuma assinatura ocorre sem
aprovação humana. Confirmar disponibilidade e custo da API com a certificadora
antes de contar com o recurso.

Custo de adiar: **baixo.** Seria model novo (`CredencialTribunal`) com colunas
próprias de blob cifrado, IV, tag e `key_id`. Nada destrutivo, nenhum controller
reescrito, nenhum dado a migrar.

---

## 7. Limites das fontes de dados

A dizer ao escritório, para não prometer errado.

**DJEN** — canal oficial de intimação, por OAB/UF, sem credencial. É a fonte
que dispara prazo e a mais confiável do sistema. Cobre os tribunais que
alimentam o Diário Eletrônico Nacional.

**DataJud** — repositório que os tribunais alimentam **em lote**, não consulta
ao vivo no sistema do tribunal. Há atraso, que varia por tribunal e deve ser
medido na homologação. Serve para manter a ficha e o histórico atualizados; não
serve para "saber agora o que aconteceu hoje".

**Nenhuma das duas traz conteúdo de documento.** Chega
`"Juntada de Petição de Contestação"` como texto de movimentação, não o PDF.
Para ler a peça, o advogado abre o portal.

**O módulo Certificados é controle de validade**, não cofre. Guarda titular,
OAB e vencimento, para avisar antes de expirar — certificado vencido no meio de
um prazo trava o peticionamento.

---

## 8. Frontend — `frontend/`

Stack: React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + lucide-react.

```
main.tsx           createRoot + ErrorBoundary
  |
  +-- App.tsx      useState<string> currentTab  <- roteamento
        |
        +-- components/layout/    Sidebar, Topbar
        +-- components/ai/        FlowDrawer
        +-- components/common/    Skeleton
        +-- pages/                telas
        +-- services/http.ts      base URL, Bearer, sessao
        +-- services/api.ts       cliente tipado por recurso
        +-- types/                contratos
```

**Não usa react-router.** `App.tsx` guarda `currentTab` em estado e renderiza
condicionalmente. Custo: sem URL por tela, sem deep link, sem botão voltar do
navegador. Trocar por `react-router` é isolado — mexe em `App.tsx` e
`Sidebar.tsx`, não nas páginas.

**Não usa state manager nem react-query.** Cada página busca o próprio dado com
`useState` + `useEffect`. Estado compartilhado desce por props de `App.tsx`.
Aceitável nesta escala; se o número de telas dobrar, reavaliar.

**Os tipos são duplicados à mão** em `frontend/src/types/`, sem
compartilhamento com o backend. Foi daí que vieram os endpoints divergentes
corrigidos em 5.4. Um pacote de tipos compartilhado eliminaria a classe de erro
— ambos os lados são TypeScript.

### Flow

O assistente em `controllers/assistenteController.ts` **não chama LLM alguma.**
São regras locais sobre o texto do prompt, mais a calculadora de prazo em dias
úteis do `prazoService`, que é cálculo determinístico e correto.

O cálculo de prazo é o valor real do módulo. O chat é apresentação. Ligar um
modelo de verdade é troca localizada, num controller só.

---

## 9. Operação

### Desenvolvimento

```bash
docker compose up -d                    # MariaDB local na porta 3307
cd backend && npm install
cp .env.example .env                    # preencher JWT_SECRET
npm run migrate:dev && npm run seed
npm run dev                             # :3001

cd frontend && npm install
cp .env.example .env
npm run dev                             # :5173, proxy /api -> :3001
```

### Verificação

```bash
cd backend
npm run typecheck                       # tsc --noEmit
npm run verificar                       # calendario forense + auth
```

### Deploy cPanel

Ver `DEPLOY_CPANEL_MYSQL.md`.

Obrigatório em produção, validado no boot por `lib/config.ts`:

| Variável | Regra |
|---|---|
| `JWT_SECRET` | mínimo 32 caracteres, gerado por ambiente, nunca versionado |
| `DATABASE_URL` | credencial do MariaDB do cPanel |
| `CORS_ORIGINS` | obrigatório em produção; lista as origens do frontend |
| `VITE_API_URL` | no build do frontend; domínio real da API |

---

## 10. Pontos de atenção

Conhecidos e aceitos. Registrados para não serem redescobertos como surpresa.

| # | Ponto | Risco | Quando tratar |
|---|---|---|---|
| 1 | tenant filtrado no controller, sem RLS | vazamento entre tenants se um controller esquecer | revisão de toda rota nova |
| 2 | vínculo polimórfico sem FK | órfão em `Andamento`, `Tarefa`, `Documento`, `Financeiro` | rotina de verificação de integridade |
| 3 | tipos duplicados front/back | divergência silenciosa de contrato | ao extrair pacote compartilhado |
| 4 | sem roteador no frontend | sem deep link nem histórico | quando alguém pedir link de tela |
| 5 | Flow sem LLM | expectativa acima da entrega | ao ligar modelo de verdade |
| 6 | atraso do DataJud não medido | prazo calculado sobre dado velho | **na homologação, antes do uso real** |
| 7 | sem teste automatizado | regressão silenciosa | antes do segundo escritório usar |

O item 6 é o mais urgente: ele afeta prazo, e prazo é responsabilidade
profissional.
