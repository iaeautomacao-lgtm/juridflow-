# JuridFlow — Documentação do Projeto

Plataforma de gestão jurídica com captura automática de intimações e
movimentações pelas APIs públicas do CNJ.

**Versão:** 1.0.0 · **Última revisão:** 10/09/2026 · **Commit:** `7613041`

| Documento | Conteúdo |
|---|---|
| **`DOCUMENTACAO.md`** (este) | visão geral, telas, tecnologias, API, operação |
| `RELATORIO_ARQUITETURA.md` | decisões de arquitetura, justificativas, fase 2 |
| `README.md` | porta de entrada: visão geral e quick start |
| `DEPLOY_CPANEL_MYSQL.md` | roteiro de publicação no cPanel |

---

## Índice

1. [O que é o JuridFlow](#1-o-que-é-o-juridflow)
2. [Escopo — a fronteira do produto](#2-escopo--a-fronteira-do-produto)
   · [2.1 Comparação com o Projuris ADV](#21-comparação-com-o-projuris-adv)
3. [Tecnologias](#3-tecnologias)
   · [3.1 Design system](#31-design-system)
4. [Arquitetura](#4-arquitetura)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Segurança](#6-segurança)
7. [Telas e abas](#7-telas-e-abas)
8. [Referência da API](#8-referência-da-api)
9. [Matriz de permissões por cargo](#9-matriz-de-permissões-por-cargo)
10. [Integrações com o CNJ](#10-integrações-com-o-cnj)
11. [Como rodar](#11-como-rodar)
12. [Deploy](#12-deploy)
13. [O que foi feito](#13-o-que-foi-feito)
14. [Gargalos — o que não vamos conseguir](#14-gargalos--o-que-não-vamos-conseguir)
15. [Pontos de atenção](#15-pontos-de-atenção)
16. [Próximos passos](#16-próximos-passos)
17. [Glossário](#17-glossário)

---

## 1. O que é o JuridFlow

Software de gestão jurídica para escritório de advocacia, com recursos
equivalentes aos de plataformas como Projuris ADV. Gerencia o ciclo completo:
atendimento pré-processual, processo, prazo, andamento, documento, pessoa e
financeiro.

O diferencial operacional é a **captura automática** de dados dos tribunais.
O sistema consulta duas APIs públicas do CNJ e traz para dentro do escritório
o que hoje exige alguém abrindo portal por portal:

- **Intimações** do Diário de Justiça Eletrônico Nacional, por OAB/UF
- **Movimentações** e metadados de processo, nos 91 tribunais do país

Nenhuma das duas exige credencial do escritório.

### Público

Escritório de advocacia contencioso, com equipe de sócio, advogado,
estagiário e financeiro. Multi-escritório (multi-tenant) desde a base do
modelo de dados.

---

## 2. Escopo — a fronteira do produto

Esta linha é decisão de projeto, não pendência. A justificativa completa está
em `RELATORIO_ARQUITETURA.md`, seção 6.

| O JuridFlow faz | O JuridFlow não faz |
|---|---|
| capturar intimação oficial pelo DJEN, por OAB/UF | entrar no PJe, e-SAJ ou Projudi com login |
| capturar movimentação e dados do processo pelo DataJud | baixar o PDF da peça de dentro dos autos |
| calcular prazo em dias úteis (CPC/2015, art. 219 e 224) | assinar petição |
| gerir processo, prazo, pessoa, atendimento e financeiro | protocolar ato no tribunal |
| gerar minuta com substituição de variáveis | acessar autos sigilosos |
| avisar antes de o certificado digital vencer | guardar arquivo de certificado ou senha de portal |

O advogado continua peticionando no portal do tribunal, com o certificado
digital dele, na máquina dele. O escritório não perde nada do fluxo atual;
o que não existe é o robô entrando no portal sozinho.

### 2.1 Comparação com o Projuris ADV

Levantamento feito em 10/09/2026 na conta real do Grupo DDM, para verificar o
que a decisão de escopo custa na prática.

**Onde ficam as credenciais no Projuris:** não há menu próprio. Fica em
Intimações → ⚙ → Configurações de intimações, num modal com cinco abas, das
quais duas interessam: **Cofre de senhas** e **Cofre de certificados**.

Estado encontrado na conta do DDM:

| Mecanismo de autenticação | Estado |
|---|---|
| Login + senha de portal | 5 credenciais ativas (TJMT, TJES, TJRJ ×2, TJMG) |
| Semente TOTP ("QR Code") | disponível, **não configurado** — 2 tribunais pendentes |
| Certificado `.pfx` + PIN | **cofre vazio** |

#### A intimação não vem do cofre

O achado central. A intimação `INT.0008965` da conta do DDM traz, no campo de
publicação:

```
Diário de Justiça Eletrônico Nacional - Estadual TJ_ES – 20260910
```

E a credencial de portal do **TJES está travada** — selo vermelho
`QR Code obrigatório`, 2FA desmarcado, cofre de certificados vazio.

Ou seja: **as intimações do TJES chegam enquanto a credencial do TJES não
funciona.** Elas vêm do DJEN, que não pede login. Demonstração empírica, na
conta do próprio escritório, de que a captura de intimação e o cofre de
credencial são caminhos independentes — e de que o JuridFlow usa exatamente o
caminho que sustenta o fluxo crítico.

#### O que o cofre serve, então

O painel de detalhe da intimação no Projuris oferece:
`Nova ação` · `Calcular Prazo` · `Arquivar` · `Excluir` · `Peticionar` ·
`Projuris IA`.

| Ação | JuridFlow | Precisa de credencial de portal? |
|---|---|---|
| Calcular prazo | tem (`prazoService`) | não |
| Arquivar | tem | não |
| Vincular a processo | tem | não |
| Assistente | tem (gaveta Flow) | não |
| **Peticionar** | **não tem** | **sim** |

Uma ação de diferença — a que foi deliberadamente deixada fora.

#### O gargalo não funciona nem onde existe

A central de ajuda do Projuris documenta 2FA para sete sistemas apenas:

```
TRF2   TRF4   TRF6   TJRS   TJSC   TJSP (eproc)   TJPR (Projudi)
```

**TJMT e TJES não estão na lista** — e são justamente os dois que o DDM
precisa. O recurso que o JuridFlow não tem também não funciona, nesses dois
tribunais, no produto que tem o cofre completo. Não há gap a fechar.

#### Custo por captura

| Item no Projuris | Situação no DDM | Preço |
|---|---|---|
| Franquia de captura | 3 de 3, esgotada | R$ 37,00 /unidade /mês |
| Intimações eletrônicas | 5 de 12 em uso | R$ 10,00 /unidade extra |

Três capturas ativas custam **R$ 111/mês (R$ 1.332/ano)**, e a cota está
esgotada — monitorar uma OAB nova custa mais R$ 37/mês.

O JuridFlow chama o DJEN direto: **sem custo por captura, sem cota, sem
franquia.** Quantas OABs o escritório quiser monitorar custa o mesmo.

> **Nota sobre o model `FranquiaCaptura`:** ele espelha o conceito de franquia
> do Projuris, com `contratadas`, `consumidas` e `valor_mensal`. O campo
> `valor_mensal` não é lido por controller nenhum e seu default já foi zerado —
> é mímica de um custo que não existe aqui. Repropor como controle interno de
> quota (mantendo `contratadas`/`consumidas`) e remover `valor_mensal`.

#### Por que o mecanismo de 2FA reforça a decisão

O "QR Code" do Projuris não é leitura de código em tempo real: o sistema
**armazena a semente TOTP** extraída da imagem do QR e passa a gerar os seis
dígitos sozinho. É o mesmo segredo que fica no Google Authenticator.

Guardar a semente no mesmo cofre da senha **desfaz o segundo fator**. 2FA
funciona porque o segundo fator é algo separado que a pessoa possui; senha e
semente no mesmo lugar deixam de ser dois fatores e passam a ser um fator
guardado duas vezes. O procedimento do tribunal ainda faz a semente passar a
existir em dois lugares, um deles servidor de fornecedor.

Isso não é defeito do Projuris — é o custo inevitável de automatizar um login
desenhado para exigir presença humana. O tribunal colocou 2FA precisamente
para impedir acesso automatizado; contorná-lo significa neutralizar o
controle.

O mesmo vale para o certificado: o formulário de upload pede o arquivo
`.pfx`/`.p12` **e o PIN**, e o aviso do próprio sistema diz que *"o arquivo e
o PIN serão armazenados no cofre de senhas do Projuris ADV"*. Quem tiver os
dois assina em nome do advogado sem ele participar.

A diferença entre aquele cofre e um cofre nosso não seria o algoritmo — seria
a infraestrutura em volta. O Projuris é fornecedor estabelecido, com HSM, time
de segurança e responsabilidade contratual para sustentar isso. Um cPanel
compartilhado, com a chave mestra num `.env` no diretório do usuário, não tem
nada disso.

#### Resumo da comparação

| | Projuris no DDM hoje | JuridFlow |
|---|---|---|
| Intimação (DJEN) | ✓ | ✓ mesma fonte |
| Calcular prazo | ✓ | ✓ |
| Arquivar, vincular, triagem | ✓ | ✓ |
| Custo de captura | R$ 111/mês, cota esgotada | zero, sem cota |
| Peticionar pelo sistema | ✓ (verificar se opera com cofre vazio) | ✗ |
| Portal TJMT / TJES | degradado — 2FA sem suporte | ✗ |
| Cofre de senha e certificado | ✓ | ✗ por decisão |

**A verificar na homologação:** o botão `Peticionar` do Projuris funciona hoje,
com o cofre de certificados vazio? Se ele recai no certificado local do
navegador, o fluxo real já passa pela máquina do advogado — e a migração para
o JuridFlow não custa nem essa ação.

---

## 3. Tecnologias

### Backend — `backend/`

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 18+ |
| Linguagem | TypeScript | 5.3 |
| Framework HTTP | Express | 4.18 |
| ORM | Prisma | 5.10 |
| Banco | MariaDB / MySQL | 11.4 / 8.0 |
| Autenticação | jsonwebtoken (HS256) | 9.0 |
| Hash de senha | bcryptjs | 2.4 |
| Validação | zod | 3.22 |
| Config | dotenv | 16.4 |
| CORS | cors | 2.8 |

### Frontend — `frontend/`

| Camada | Tecnologia | Versão |
|---|---|---|
| Biblioteca | React | 18.2 |
| Build | Vite | 5.1 |
| Linguagem | TypeScript | 5.3 |
| Estilo | Tailwind CSS | 3.4 |
| Ícones | lucide-react | 0.344 |
| CSS toolchain | PostCSS + autoprefixer | 8.4 / 10.4 |

### Desenvolvimento

| Ferramenta | Uso |
|---|---|
| ts-node-dev | reload do backend em desenvolvimento |
| Docker Compose | MariaDB 11.4 local na porta 3307 |
| Prisma Migrate | versionamento do schema |
| Prisma Studio | inspeção do banco |

### Por que TypeScript nos dois lados

Os dois artefatos são TypeScript, o que permite compartilhar os contratos de
dados entre frontend e backend. Isso **ainda não é feito** — os tipos estão
duplicados à mão, e foi essa duplicação que causou o defeito dos cinco
endpoints divergentes (seção 13). Extrair um pacote comum eliminaria a classe
de erro inteira.

Não há serviço em Python, fila, Redis nem navegador headless. Não são
necessários porque não há login em portal a automatizar.

### 3.1 Design system

A paleta vem do logo do JuridFlow: pilar cinza, fita em três azuis, seta
dourada.

| Token Tailwind | Hex | Onde no logo |
|---|---|---|
| `juridflow-800` | `#17365D` | wordmark, base do fluxo |
| `juridflow-500` | `#2E6CA4` | corpo da fita |
| `juridflow-400` | `#5BA3D9` | fita superior, corpo da seta |
| `gold-400` | `#E0A64E` | ponta da seta, elos |
| `pillar` | `#6E7B8A` | a coluna |

Rampas completas de 50 a 950 para `juridflow` e `gold` em
`frontend/tailwind.config.js`.

**Tipografia:** `font-display` → Poppins (acompanha o wordmark: geométrico,
caixa alta, pesado). `font-sans` → Inter para corpo de texto. Ambas carregadas
em `frontend/index.html`.

> ⚠️ **Os hex são provisórios.** Foram obtidos por conta-gotas num mockup JPEG
> do logo. Quando o vetor oficial (SVG/AI) ou o manual de marca estiver
> disponível, conferir e ajustar em `tailwind.config.js` — é o único lugar a
> mudar.

**Pendência: a UI ainda não usa estes tokens.** As telas carregam ~1.000
classes literais de `slate-*` e `blue-*`, herdadas da fase ACORDIO. Os tokens
existem e estão validados no build, mas a migração das classes é escopo
próprio — não entrou no commit de rename para manter o diff revisável.

`darkMode: 'class'` já está configurado, mas **não há tema escuro
implementado** — a UI é clara, com a barra lateral escura. Ligar o tema é
trabalho de token em toda a interface, junto com a migração acima.

---

## 4. Arquitetura

Dois artefatos, um runtime, um banco.

```
   navegador
       │  HTTPS
       ▼
┌───────────────────────────┐      arquivo estático (public_html no cPanel)
│  frontend                 │
│  React 18 + Vite 5        │
│  TypeScript + Tailwind 3  │
└────────────┬──────────────┘
             │  fetch + Authorization: Bearer <JWT>
             ▼
┌───────────────────────────┐      Node.js App no cPanel
│  backend                  │
│  Express 4 + TypeScript   │
│  Prisma 5                 │
└──────┬─────────────┬──────┘
       │             │
       ▼             ▼
┌─────────────┐  ┌────────────────────────────────┐
│  MariaDB    │  │  APIs públicas do CNJ          │
│  / MySQL    │  │  · DJEN     comunica.pje       │
└─────────────┘  │  · DataJud  api-publica        │
                 │  nenhuma exige credencial      │
                 └────────────────────────────────┘
```

### Camadas do backend

```
server.ts               bootstrap, middlewares globais, /health, listen
  │
  └── routes/index.ts   55 rotas sob /api
        │
        ├── middleware/auth.ts          authMiddleware + requireCargo
        ├── middleware/auditLogger.ts   logUserAction
        │
        └── controllers/   (14)  regra de negócio, acesso ao Prisma
              │
              ├── services/  (3)  I/O externo e cálculo puro
              └── lib/       (9)  utilitários sem estado
```

### `lib/` — utilitários

| Arquivo | Responsabilidade |
|---|---|
| `config.ts` | valida variáveis de ambiente no boot; sem segredo padrão |
| `prisma.ts` | singleton do PrismaClient |
| `cargos.ts` | enum de cargo e type guard |
| `modulos.ts` | chaves do vínculo polimórfico |
| `tribunais.ts` | resolve tribunal e índice DataJud pelo número CNJ |
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
Não existe fallback que gere registro sintético.

### Camadas do frontend

```
main.tsx           createRoot + ErrorBoundary
  │
  └── App.tsx      AuthProvider → Portao → Login | AreaLogada
        │
        ├── context/AuthContext.tsx      sessão, cargo, podeAcessar()
        ├── components/layout/           Sidebar, Topbar
        ├── components/ai/               FlowDrawer
        ├── components/common/           Skeleton, ApiErrorBanner
        ├── pages/                       12 telas
        ├── services/http.ts             base URL, Bearer, sessão
        ├── services/api.ts              cliente tipado por recurso
        └── types/                       contratos
```

**Não usa react-router.** `App.tsx` guarda `currentTab` em estado e renderiza
condicionalmente. Custo: sem URL por tela, sem link direto, sem botão voltar
do navegador. Trocar por `react-router` é isolado — mexe em `App.tsx` e
`Sidebar.tsx`, não nas páginas.

**Não usa state manager nem react-query.** Cada página busca o próprio dado
com `useState` + `useEffect`. Estado compartilhado desce por props.
Aceitável nesta escala.

---

## 5. Modelo de dados

17 tabelas. Schema em `backend/prisma/schema.prisma`, migrations versionadas
em `backend/prisma/migrations/`.

| Tabela | Papel |
|---|---|
| `Tenant` | escritório; raiz de todo dado |
| `User` | usuário com cargo e OAB |
| `Processo` | processo judicial |
| `Atendimento` | CRM pré-processual (lead) |
| `ContratoHonorarios` | contrato de honorários |
| `Pessoa` | cliente, parte contrária, perito |
| `Andamento` | movimentação processual |
| `Tarefa` | tarefa e prazo (Kanban) |
| `Documento` | arquivo vinculado |
| `Financeiro` | receita e despesa |
| `Intimacao` | intimação capturada do DJEN |
| `CapturaPush` | monitoramento ativo por processo |
| `FranquiaCaptura` | franquia contratada de captura por OAB |
| `Feriado` | feriado forense cadastrado |
| `ModeloDocumento` | modelo de peça com variáveis |
| `AuditLog` | trilha de auditoria LGPD |
| `CertificadoDigital` | controle de validade de certificado |

### Multi-tenancy

Coluna discriminadora `tenant_id` em toda tabela de negócio, com chave
estrangeira para `Tenant` e `onDelete: Cascade`. O filtro é aplicado em cada
controller a partir de `req.tenant_id`, que vem do JWT verificado.

Não há row-level security no banco. **Consequência: um controller que esqueça
o filtro vaza dado entre escritórios.** É o ponto que mais merece atenção em
revisão de código.

### Vínculo polimórfico

Recursos transversais — `Andamento`, `Tarefa`, `Documento`, `Financeiro` —
não têm chave estrangeira para uma entidade específica. Eles se penduram em
qualquer entidade de negócio por um par de colunas:

- `chave_modulo` → `processo` | `atendimento` | `contrato` | `pessoa`
- `codigo_registro_vinculo` → id do registro dono

**Custo:** perde-se integridade referencial nesses quatro models.
**Ganho:** adicionar módulo novo não exige coluna nem migration neles.

---

## 6. Segurança

### Autenticação

JWT assinado em HS256, validade padrão de 12 horas. O token carrega `id`,
`tenant_id`, `nome`, `email` e `cargo`.

`authMiddleware` **não tem caminho alternativo**: token ausente, malformado,
expirado ou com assinatura inválida devolve `401`. O payload é validado campo
por campo antes de virar `req.user` — um token com formato inesperado também
é rejeitado.

Senha de usuário é armazenada com bcrypt.

### Autorização

`requireCargo(...)` restringe rota por cargo. Quatro cargos:
`socio`, `advogado`, `estagiario`, `financeiro`. Matriz completa na seção 9.

O frontend esconde o que o backend recusaria (`CARGOS_POR_ABA` em `App.tsx` e
o filtro de menu no `Sidebar.tsx`), mas **a checagem que vale é a do
servidor** — o frontend só evita que o usuário bata num `403`.

### Segredos

`lib/config.ts` valida no boot e **derruba o processo** se algo faltar:

| Variável | Regra |
|---|---|
| `JWT_SECRET` | obrigatória, mínimo 32 caracteres, sem valor padrão |
| `DATABASE_URL` | obrigatória |
| `CORS_ORIGINS` | obrigatória quando `NODE_ENV=production` |

Há uma lista de bloqueio: se `JWT_SECRET` for um dos valores que já foram
versionados no repositório, o processo recusa subir com mensagem explícita.

`.env` está no `.gitignore`. `.env.example` documenta cada variável, inclusive
o comando para gerar um segredo novo.

### Auditoria LGPD

`logUserAction(acao, entidade)` grava em `AuditLog` após a resposta, para não
atrasar a requisição. Registra usuário, cargo, ação, entidade, método, rota,
corpo da requisição, IP e user-agent.

Está aplicado em **toda rota de escrita** e nas leituras de dado sensível
(certificados, trilha de auditoria). A leitura da própria trilha é restrita ao
sócio.

### Superfície de rede

- CORS por lista de origens, obrigatória em produção
- Paginação com limite máximo de 200 registros, impedindo consulta ilimitada
- `httpError.ts` oculta stack trace em produção
- Entrada validada com zod nos controllers de escrita

### O que deliberadamente não existe

**Não há cofre de credencial de tribunal, e não há armazenamento de
certificado digital.**

O módulo de criptografia do commit inicial (`cryptoVault.ts`) implementava
AES-256-GCM corretamente, mas nunca foi importado por arquivo nenhum, e sua
chave derivava de um texto publicado no repositório. Foi removido em vez de
ligado, porque guardar senha de PJe e arquivo `.pfx` de forma defensável
exigiria:

- chave mestra fora do banco e fora do repositório, sem valor padrão
- função de derivação de chave real (scrypt/Argon2id), não `sha256` de string curta
- AAD no AES-GCM, amarrando o ciphertext a `tenant_id` + `credencial_id`
- `key_id` por registro, para permitir rotação de chave
- decifragem isolada em processo que não atende requisição da internet
- auditoria de cada decifragem
- **servidor dedicado** — não hospedagem compartilhada

O destino do deploy é cPanel compartilhado. Nesse terreno um cofre é pior que
a ausência de cofre, porque o escritório passa a confiar nele e cadastra a
senha real. A tela de Certificados avisa explicitamente para **não cadastrar
senha de PJe ou e-SAJ em nenhum campo do sistema**.

Certificado **A3** fica em token físico ou smartcard e não pode ser usado por
servidor em nenhuma arquitetura. Somente A1 seria copiável.

---

## 7. Telas e abas

### Estrutura de navegação

Barra lateral fixa com sete grupos. Grupo com subitens abre no primeiro
subitem ao ser clicado.

| # | Grupo | Subitens | Restrição |
|---|---|---|---|
| 1 | **Painel de Controle** | — | — |
| 2 | **Atividades & Kanban** | — | — |
| 3 | **Contencioso** | Processos · Intimações DJEN · Central de Captura / Push · Andamentos Processuais | — |
| 4 | **Gestão & CRM** | Pessoas & Clientes · Atendimento CRM | — |
| 5 | **Financeiro** | Receitas & Despesas · Contratos de Honorários | `socio`, `financeiro` |
| 6 | **Documentos & Modelos** | Gerenciador de Arquivos · Gerador de Peças | — |
| 7 | **Configurações** | Painel Geral · Certificados & Auditoria | — |

Fora da lista: botão **Flow** no topo da lateral (abre gaveta lateral) e
cartão de rodapé com escritório, nome, cargo e botão de saída.

A barra superior tem busca global, ações rápidas (nova tarefa, novo processo,
captura) e alternador entre visão **escritório** e **pessoal**.

### Telas em detalhe

#### Login

Tela de entrada por e-mail e senha. Enquanto o token guardado é revalidado
contra `/auth/me`, mostra estado de carregamento em vez de piscar o formulário
para quem já está logado.

#### Painel de Controle

KPIs do escritório e agenda. Alternador de período: **mês · semana · dia**.
Navega para as outras telas e abre o Flow.

#### Atividades & Kanban

Dois modos: **kanban** e **lista**.

Quadro com quatro colunas: `A Fazer` · `Em Andamento` · `Aguardando` ·
`Concluído`. Cartão muda de coluna pelo menu de status. Exclusão restrita a
sócio e advogado.

#### Processos

Lista de processos e ficha detalhada. A ficha tem quatro abas:

| Aba | Conteúdo |
|---|---|
| **Capa** | dados do processo, partes, valor da causa, prognóstico |
| **Andamentos** | linha do tempo de movimentações |
| **Tarefas** | prazos e tarefas vinculadas |
| **Documentos** | arquivos dos autos |

Cadastro de processo novo aceita **auto-preenchimento por consulta ao
DataJud**: informa o número CNJ e o sistema busca vara, tribunal, classe e
partes.

#### Intimações DJEN

Três abas:

| Aba | Conteúdo |
|---|---|
| **Pendentes** | intimações capturadas aguardando triagem |
| **Descartadas** | intimações arquivadas |
| **Captura** | disparo manual da sincronização DJEN |

Ações: vincular intimação a processo cadastrado, arquivar, e gerar tarefa de
prazo a partir da intimação.

#### Central de Captura / Push

Configuração do monitoramento: OAB/UF cadastrada, processos monitorados,
cadastro automático de processo novo, e botão de disparo imediato da captura.
Mostra o estado da franquia de captura contratada.

#### Andamentos Processuais

Lista consolidada de movimentações de todos os processos, com marcação de
lido/não lido.

#### Pessoas & Clientes

Cadastro unificado de cliente, parte contrária, terceiro e perito, com
CPF/CNPJ, contato e endereço.

#### Atendimento CRM

Funil de atendimento pré-processual em quatro fases, como colunas:

`Primeiro Contato` → `Análise de Viabilidade` → `Proposta Enviada` →
`Contrato Assinado`

O lead avança de fase pelo cartão. Um atendimento pode ser **convertido em
processo** — ação restrita a sócio e advogado.

#### Financeiro

Restrito a **sócio** e **financeiro**. Duas abas:

| Aba | Conteúdo |
|---|---|
| **Extrato** | receitas e despesas, com baixa de lançamento |
| **Contratos** | contratos de honorários |

Lançamento novo escolhe entre **Receita** e **Despesa**.

#### Documentos & Modelos

Duas abas:

| Aba | Conteúdo |
|---|---|
| **Arquivos** | gerenciador de documentos dos autos |
| **Modelos** | gerador de peças a partir de modelo com variáveis |

O gerador substitui tags pelos dados do processo. Aceita `{tag}` e `{{tag}}`.
Tags reconhecidas:

```
nome_cliente      numero_processo   vara            comarca
orgao             valor_causa       data_hoje       advogado_nome
advogado_oab      escritorio_nome
```

Tag desconhecida **não é apagada em silêncio** — volta na lista
`tags_nao_reconhecidas` da resposta, para o usuário ver que sobrou variável
sem preencher.

#### Configurações

Quatro abas:

| Aba | Conteúdo | Restrição |
|---|---|---|
| **Certificados** | titular, OAB e vencimento, para aviso de expiração | — |
| **Auditoria** | trilha de logs LGPD | `socio` |
| **Franquias** | franquia de captura contratada | `socio` para editar |
| **Usuários** | perfis e permissões da equipe | `socio` |

A aba Certificados traz um aviso destacado do que o módulo **não** faz:
não armazena arquivo `.pfx` nem senha de portal.

#### Flow (gaveta lateral)

Assistente acessível de qualquer tela. Responde sobre prazo, jurisprudência e
minuta, e tem calculadora de prazo em dias úteis integrada. Pode criar tarefa
e navegar para outras telas.

**Importante:** o assistente não usa modelo de IA. Ver seção 14.

---

## 8. Referência da API

Base: `/api`. Todas as rotas exigem `Authorization: Bearer <token>`, exceto
`POST /auth/login`.

### Autenticação

| Método | Rota | Cargo |
|---|---|---|
| `POST` | `/auth/login` | público |
| `GET` | `/auth/me` | autenticado |

### Painel

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/dashboard/kpis` | autenticado |
| `GET` | `/dashboard/agenda` | autenticado |

### Processos

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/processos` | autenticado |
| `POST` | `/processos` | sócio, advogado |
| `GET` | `/processos/consultar-cnj` | autenticado |
| `GET` | `/processos/:id` | autenticado |
| `GET` | `/processos/:id/linha-do-tempo` | autenticado |

### Intimações

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/intimacoes` | autenticado |
| `GET` | `/intimacoes/franquia` | autenticado |
| `POST` | `/intimacoes/:id/vincular` | sócio, advogado, estagiário |
| `PATCH` | `/intimacoes/:id/arquivar` | sócio, advogado |

### Captura

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/captura` | autenticado |
| `GET` | `/captura/status` | autenticado |
| `POST` | `/captura` | sócio, advogado |
| `POST` | `/captura/sincronizar-djen` | sócio, advogado, estagiário |
| `POST` | `/captura/sincronizar-cnj` | sócio, advogado, estagiário |
| `PUT` | `/captura/franquia` | sócio |

### Andamentos

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/andamentos` | autenticado |
| `POST` | `/andamentos` | sócio, advogado, estagiário |
| `PATCH` | `/andamentos/:id/lido` | autenticado |

### Atividades

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/atividades` | autenticado |
| `POST` | `/atividades` | autenticado |
| `PATCH` | `/atividades/:id/status` | autenticado |
| `DELETE` | `/atividades/:id` | sócio, advogado |

### Pessoas

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/pessoas` | autenticado |
| `POST` | `/pessoas` | autenticado |
| `GET` | `/pessoas/:id` | autenticado |

### CRM / Atendimentos

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/crm` | autenticado |
| `POST` | `/crm` | autenticado |
| `PATCH` | `/crm/:id/fase` | autenticado |
| `POST` | `/crm/:id/converter-processo` | sócio, advogado |

### Financeiro

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/financeiro/transacoes` | sócio, financeiro |
| `POST` | `/financeiro/transacoes` | sócio, financeiro |
| `PATCH` | `/financeiro/transacoes/:id/baixa` | sócio, financeiro |
| `GET` | `/financeiro/resumo` | sócio, financeiro |
| `GET` | `/financeiro/contratos` | sócio, financeiro |
| `POST` | `/financeiro/contratos` | sócio, financeiro |

### Documentos

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/documentos` | autenticado |
| `POST` | `/documentos` | autenticado |
| `GET` | `/documentos/modelos` | autenticado |
| `POST` | `/documentos/gerar-peca` | sócio, advogado, estagiário |

### Flow

| Método | Rota | Cargo |
|---|---|---|
| `POST` | `/assistente/chat` | autenticado |
| `POST` | `/assistente/calcular-prazo` | autenticado |

### Calendário forense

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/feriados` | autenticado |
| `GET` | `/feriados/verificar-dia` | autenticado |
| `POST` | `/feriados` | sócio, advogado |
| `DELETE` | `/feriados/:id` | sócio, advogado |

### Configurações

| Método | Rota | Cargo |
|---|---|---|
| `GET` | `/configuracoes/certificados` | autenticado |
| `POST` | `/configuracoes/certificados` | sócio, advogado |
| `GET` | `/configuracoes/audit-logs` | sócio |
| `GET` | `/configuracoes/usuarios` | sócio |
| `POST` | `/configuracoes/usuarios` | sócio |
| `PATCH` | `/configuracoes/usuarios/:id/ativo` | sócio |

### Fora de `/api`

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/health` | healthcheck, sem autenticação |

---

## 9. Matriz de permissões por cargo

| Operação | Sócio | Advogado | Estagiário | Financeiro |
|---|:--:|:--:|:--:|:--:|
| Ver processo, intimação, andamento, pessoa | ✓ | ✓ | ✓ | ✓ |
| Criar processo | ✓ | ✓ | — | — |
| Vincular intimação a processo | ✓ | ✓ | ✓ | — |
| Arquivar intimação | ✓ | ✓ | — | — |
| Disparar captura DJEN / DataJud | ✓ | ✓ | ✓ | — |
| Configurar monitoramento (push) | ✓ | ✓ | — | — |
| Editar franquia de captura | ✓ | — | — | — |
| Criar andamento | ✓ | ✓ | ✓ | — |
| Criar / mover tarefa | ✓ | ✓ | ✓ | ✓ |
| Excluir tarefa | ✓ | ✓ | — | — |
| Criar pessoa e atendimento | ✓ | ✓ | ✓ | ✓ |
| Converter atendimento em processo | ✓ | ✓ | — | — |
| Ver e lançar financeiro | ✓ | — | — | ✓ |
| Gerar peça | ✓ | ✓ | ✓ | — |
| Cadastrar feriado forense | ✓ | ✓ | — | — |
| Cadastrar certificado | ✓ | ✓ | — | — |
| Ver trilha de auditoria | ✓ | — | — | — |
| Gerir usuários da equipe | ✓ | — | — | — |

**Ponto a revisar na homologação:** o cargo `financeiro` pode criar tarefa,
pessoa e atendimento, porque essas rotas não têm `requireCargo`. Se o
escritório quiser o perfil financeiro restrito apenas ao módulo financeiro,
essas quatro rotas precisam de restrição explícita.

---

## 10. Integrações com o CNJ

Duas fontes, ambas públicas, nenhuma exige credencial do escritório.

### DJEN — Diário de Justiça Eletrônico Nacional

`https://comunica.pje.jus.br/api/v1/comunicacao`

Consulta por número de OAB e UF. Traz as intimações publicadas. **É o canal
oficial de intimação** — o que dispara prazo e o que gera responsabilidade
profissional se passar. A fonte mais confiável do sistema.

Cobre os tribunais que alimentam o Diário Nacional.

### DataJud

`https://api-publica.datajud.cnj.jus.br/api_publica_<alias>/_search`

Consulta por número CNJ, com chave pública distribuída pelo CNJ. Traz classe,
sistema, tribunal, órgão julgador, data de ajuizamento e lista de
movimentações.

O `alias` do índice é resolvido a partir do próprio número do processo por
`lib/tribunais.ts`, conforme a Resolução CNJ 65/2008:

```
NNNNNNN-DD.AAAA.J.TR.OOOO
                  │  │
                  │  └── TR  tribunal dentro do segmento (2 dígitos)
                  └───── J   segmento do Judiciário (1 dígito)

exemplo:  1002345-89.2024.8.26.0100  →  segmento 8, tribunal 26  →  tjsp
```

Isso cobre os 91 tribunais. A versão inicial apontava fixo para
`api_publica_tjsp`.

### Comportamento em falha

Nenhum dos dois conectores fabrica dado quando a API não responde. A falha
propaga erro e aparece na tela. Ver seção 13.

---

## 11. Como rodar

### Pré-requisitos

- **Node.js 18+**
- **MariaDB** ou MySQL — nativo (recomendado) ou via Docker

### Banco de desenvolvimento

Dois caminhos. Escolha um.

#### Opção A — MariaDB nativo (recomendado)

É o mesmo motor do cPanel, roda como serviço do sistema e não exige
virtualização. Baixe em [mariadb.org/download](https://mariadb.org/download/)
e, na instalação, defina a senha de `root` e marque a opção que adiciona o
cliente ao `PATH`.

Porta padrão: **3306**.

#### Opção B — Docker

```bash
docker compose up -d
```

Sobe MariaDB 11.4 na porta **3307** do host, para não conflitar com um MariaDB
nativo já instalado na 3306.

### Backend

```bash
cd backend
npm install
cp .env.example .env
```

No `.env`, gerar e colar o segredo do JWT:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Preencher também `SEED_ADMIN_PASSWORD` (mínimo 10 caracteres) e a senha
dentro de `DATABASE_URL`.

> **Senha com caractere reservado de URL** (`@ / ? # [ ]`) precisa de
> percent-encoding na `DATABASE_URL` — `@` vira `%40`, `#` vira `%23`. Sem
> isso o Prisma lê a senha cortada e a conexão falha com *access denied* sem
> explicar o motivo. O script do passo seguinte avisa se detectar o caso.

Criar o banco e o usuário da aplicação:

```bash
npm run banco:preparar | mysql -u root -p
```

O script lê a `DATABASE_URL` do `.env` e gera o SQL — `CREATE DATABASE` em
`utf8mb4`, `CREATE USER` e `GRANT` restrito a esse banco. A senha da aplicação
sai por *pipe*, então não aparece na tela nem em arquivo. Para revisar antes,
sem revelar a senha: `npm run banco:preparar -- --mascarado`.

Na Opção B (Docker) esse passo não é necessário — o container já cria banco e
usuário.

Então:

```bash
npm run migrate:deploy    # cria as tabelas a partir das migrations
npm run seed              # popula dados iniciais
npm run dev               # http://localhost:3001
```

Use `migrate:dev` em vez de `migrate:deploy` apenas quando estiver alterando o
`schema.prisma` e precisar gerar uma migration nova.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

Em desenvolvimento, `VITE_API_URL="/api"` usa o proxy do Vite, que encaminha
para `localhost:3001`.

### Verificação

```bash
cd backend
npm run typecheck        # tsc --noEmit
npm run verificar        # calendário forense + autenticação
npm run studio           # Prisma Studio, inspeção do banco

cd frontend
npx tsc --noEmit
```

### Scripts disponíveis

**Backend:**

| Script | Ação |
|---|---|
| `dev` | reload automático |
| `build` | `prisma generate && tsc` |
| `start` | roda o build |
| `typecheck` | checagem de tipos sem emitir |
| `migrate:dev` | cria e aplica migration |
| `migrate:deploy` | aplica migrations (produção) |
| `migrate:status` | estado das migrations |
| `seed` | popula dados iniciais |
| `studio` | abre Prisma Studio |
| `verificar` | scripts de verificação |

**Frontend:** `dev` · `build` · `preview` · `lint`

---

## 12. Deploy

Roteiro completo em `DEPLOY_CPANEL_MYSQL.md`. Resumo:

1. **Banco** — criar MariaDB e usuário no assistente do cPanel
2. **Backend** — subir para a aplicação Node do cPanel, `npm install --production`, `npm run migrate:deploy`
3. **Frontend** — `npm run build` com `VITE_API_URL` apontando para o domínio real, subir `dist/` para `public_html`
4. **Cron** — agendar a sincronização do DJEN (ver abaixo)

### Variáveis obrigatórias em produção

Validadas no boot por `lib/config.ts` — sem elas o processo não sobe.

| Variável | Onde | Regra |
|---|---|---|
| `JWT_SECRET` | backend | mínimo 32 caracteres, gerado para produção |
| `DATABASE_URL` | backend | credencial do MariaDB do cPanel |
| `CORS_ORIGINS` | backend | domínio do frontend, separado por vírgula |
| `VITE_API_URL` | build do frontend | domínio real da API |

### Cron da captura

A aplicação Node no cPanel hiberna quando ociosa. Sem um cron chamando o
endpoint de sincronização, a captura só roda quando alguém clica no botão.

Sugestão: duas vezes ao dia, manhã e fim de tarde, para pegar a publicação
do dia.

---

## 13. O que foi feito

Auditoria do commit inicial (`445a77d`) encontrou cinco defeitos estruturais.
Todos corrigidos em `7613041`. Ficam registrados porque são o tipo de defeito
que volta.

### Crítico — a autenticação não rejeitava ninguém

Ao falhar a verificação do token, o middleware buscava o primeiro `Tenant` e o
primeiro `User` do banco e seguia com `next()`. Efeito: toda rota
"autenticada" respondia sem credencial nenhuma, com os dados do primeiro
usuário cadastrado.

**Agora:** `401` sem caminho alternativo, mais `requireCargo()` para
autorização por perfil.

### Crítico — a captura fabricava intimação falsa

Quando a chamada ao CNJ falhava, `djenService` e `datajudService` montavam
intimação e movimentação fictícias e as gravavam via
`prisma.intimacao.create` / `andamento.create`, indistinguíveis das reais.

Num sistema cuja função é avisar de prazo, é o pior defeito possível: o
escritório confia num prazo que não existe, ou deixa de ver um que existe.

**Agora:** a falha propaga erro. Nenhum registro sintético entra no banco.
O `datajudService` também passou a resolver o tribunal pelo número CNJ em vez
de apontar fixo para `api_publica_tjsp`.

### Alto — segredo de assinatura versionado no código

`JWT_SECRET` tinha valor padrão embutido no fonte, já publicado. Qualquer
pessoa com acesso ao repositório conseguiria assinar um token válido de
produção.

**Agora:** validado no boot, mínimo 32 caracteres, com lista de bloqueio dos
valores que vazaram. `CORS_ORIGINS` passou a ser obrigatório em produção.

### Alto — o banco estava definido em dois lugares

`server.ts` executava 14 `CREATE TABLE IF NOT EXISTS` via
`prisma.$executeRawUnsafe` — segunda definição do banco, paralela ao
`schema.prisma`, em sintaxe SQLite que o MariaDB rejeita. Era o bloqueador
real do deploy no cPanel: trocar o provider não resolveria.

**Agora:** removido. Uma definição só, provider `mysql`, migrations
versionadas.

### Médio — cinco telas buscavam endereços que não existiam

O frontend chamava `POST /atividades`, `/crm`, `/financeiro/transacoes`,
`/financeiro/contratos` e `/captura/status`, nenhum implementado no backend.
O `catch` do cliente devolvia lista vazia e escondia o erro — a tela
renderizava em branco sem aviso.

A URL da API também estava fixa em `http://localhost:3001/api`, o que em
produção faria o navegador do usuário chamar a própria máquina dele.

**Agora:** endpoints implementados; `services/http.ts` lê `VITE_API_URL` e
envia `Authorization: Bearer`; erro de API aparece na tela via
`ApiErrorBanner`.

### Escopo — o cofre foi removido, não consertado

Detalhado na seção 6.

### Módulos adicionados na mesma rodada

- **Atendimento** — CRM pré-processual com funil de quatro fases
- **Contrato de honorários**
- **Calendário forense** — cálculo de prazo em dias úteis, com cadastro de feriado
- **Login e sessão** — tela de entrada, `AuthContext`, revalidação de token
- **Auditoria ligada** — `logUserAction` em toda rota de escrita
- **Paginação** — limite padrão 50, máximo 200

---

## 14. Gargalos — o que não vamos conseguir

Agrupado pela causa, porque a causa determina se algum dia muda.

### Porque exige login em portal de tribunal

Só se resolve guardando credencial e certificado num servidor — descartado
enquanto o destino for hospedagem compartilhada.

| Gargalo | Situação |
|---|---|
| **PDF das peças dos autos** — petição, contestação, decisão na íntegra. O sistema mostra que o documento foi juntado, mas não traz o arquivo. | condicionado à fase 2 |
| **Peticionamento pelo sistema** — a minuta sai pronta do JuridFlow; o protocolo é feito no portal. | condicionado à fase 2 |
| **Autos sigilosos** — nenhuma API pública expõe processo sob sigilo. | permanente |

### Porque a fonte de dados não tem o que se pede

Limite do CNJ, não do nosso código. Nenhuma arquitetura resolve.

| Gargalo | Situação |
|---|---|
| **Movimentação em tempo real** — o DataJud é repositório alimentado em lote pelos tribunais, não consulta ao vivo. Há atraso, que varia por tribunal. | permanente |
| **Conteúdo de documento** — chega `"Juntada de Petição de Contestação"` como texto de movimentação, nunca o arquivo. | permanente |

### Porque o terreno do deploy não permite

Consequência de hospedar em cPanel compartilhado. Muda se migrar para
servidor dedicado.

| Gargalo | Situação |
|---|---|
| **Cofre de credencial de tribunal** — requisitos na seção 6. | condicionado à fase 2 |
| **Certificado A3 no servidor** — vive em token USB ou smartcard físico. Não existe arquitetura em que um servidor o use. | permanente |
| **Captura contínua sem cron** — a aplicação Node no cPanel hiberna quando ociosa. | a configurar no deploy |

### Porque ainda não foi construído

| Gargalo | Situação |
|---|---|
| **O Flow não usa IA** — hoje são regras sobre o texto digitado, com resposta pronta por palavra-chave, e o rótulo `"JuridFlow Legal LLM v4.2 (RAG Enabled)"` na resposta não corresponde a modelo algum. O que é real e correto ali é a calculadora de prazo em dias úteis. | troca localizada, um arquivo |

### O que dizer ao escritório

A parte crítica está coberta. **Intimação é o que dispara prazo** e o que gera
responsabilidade profissional se passar — e ela vem do DJEN, canal oficial,
sem credencial, sem certificado, sem robô.

Os gargalos acima são conveniência: abrir o portal para ler a peça, em vez de
o sistema baixar.

Há evidência disso na conta que o escritório usa hoje: as intimações do TJES
chegam pelo DJEN enquanto a credencial de portal do TJES está travada por 2FA
sem suporte. Ver seção 2.1. Nos dois tribunais que o DDM mais precisa — TJMT e
TJES — o acesso a portal não funciona nem no Projuris, que tem o cofre
completo.

### Fase 2 — se algum dia

Depende de **duas** condições simultâneas: sair da hospedagem compartilhada,
**e** o escritório sentir falta do download automático de documento. Se a
segunda não acontecer, a fase 2 não precisa existir.

O caminho recomendado **não** é construir o cofre da seção 6. É **certificado
A3 em nuvem com API de assinatura remota**: o certificado fica no HSM da
certificadora, o JuridFlow pede a operação, e o advogado autoriza pelo celular,
uma por vez. O sistema nunca tem cópia de nada e nenhuma assinatura ocorre sem
aprovação humana.

Confirmar disponibilidade e custo dessa API com a certificadora antes de
contar com o recurso.

Custo de adiar: **baixo.** Seria tabela nova (`CredencialTribunal`) com
colunas próprias de blob cifrado, IV, tag e `key_id`. Nada destrutivo, nenhum
controller reescrito, nenhum dado a migrar.

---

## 15. Pontos de atenção

Conhecidos e aceitos. Registrados para não serem redescobertos como surpresa.

| # | Ponto | Risco | Quando tratar |
|---|---|---|---|
| 1 | Atraso do DataJud não medido | prazo calculado sobre dado velho | **na homologação** |
| 2 | Escritório filtrado no controller, sem trava no banco | uma rota que esqueça o filtro vaza dado entre escritórios | revisão de toda rota nova |
| 3 | Vínculo polimórfico sem integridade referencial | registro órfão em andamento, tarefa, documento e financeiro | rotina de verificação |
| 4 | Tipos duplicados entre frontend e backend | divergência silenciosa de contrato — foi a causa do defeito médio | ao extrair pacote comum |
| 5 | Sem roteador no frontend | sem link direto para tela, sem botão voltar | quando alguém pedir |
| 6 | Flow sem modelo de IA | expectativa acima da entrega | ao ligar um modelo |
| 7 | Sem teste automatizado | regressão silenciosa a cada mudança | antes do 2º escritório |
| 8 | Cargo `financeiro` cria tarefa, pessoa e atendimento | perfil menos restrito do que o esperado | homologação dos perfis |

O item 1 é o mais urgente: ele afeta prazo, e prazo é responsabilidade
profissional.

---

## 16. Próximos passos

Nesta ordem — cada passo depende do anterior estar fechado.

### 1. Resolver a divergência do repositório

Dois commits feitos pelo GitHub apagaram `DEPLOY_CPANEL_MYSQL.md` e a pasta
`PRINTS/`. O local está 1 commit à frente e 2 atrás.

**Decisão pendente:** a exclusão do guia de deploy foi intencional? Ele é o
roteiro do passo 3 e é referenciado por este documento.

### 2. Revisar o diff e empurrar para o GitHub

Commit `7613041` montado localmente: 60 arquivos, +8.306 / −3.266. Nenhum
`.env`, `dist` ou `node_modules` entrou. Marcado `BREAKING CHANGE` — as
variáveis de ambiente passaram a ser obrigatórias.

### 3. Subir no cPanel

Ver seção 12 e `DEPLOY_CPANEL_MYSQL.md`.

### 4. Configurar o cron da captura

Sem ele a captura só roda quando alguém clica.

### 5. Homologar com a OAB real — e medir o atraso do DataJud

Cadastrar a OAB oficial do escritório, disparar a captura e comparar o que
chegou com o que está no portal.

**Medir quantos dias o DataJud está atrasado** em cada tribunal que o
escritório usa. Enquanto esse número não for conhecido, ninguém sabe se um
prazo foi calculado sobre dado velho. É o único item da lista que envolve
responsabilidade profissional — não adiar.

### 6. Cadastrar a equipe com os perfis

Conferir se a matriz da seção 9 corresponde ao que o escritório espera, em
especial quem vê o financeiro e o ponto de atenção nº 8.

### Depois, em ordem de valor

1. **Extrair pacote de tipos compartilhado** — elimina a classe de erro do item 4
2. **Ligar um modelo de IA no Flow** — troca localizada num controller
3. **Teste automatizado** — começando pelos conectores CNJ e pelo cálculo de prazo
4. **`react-router`** — se alguém pedir link direto para tela

---

## 17. Glossário

| Termo | Significado |
|---|---|
| **CNJ** | Conselho Nacional de Justiça |
| **Número CNJ** | numeração única do processo, `NNNNNNN-DD.AAAA.J.TR.OOOO` |
| **DJEN** | Diário de Justiça Eletrônico Nacional; canal oficial de intimação |
| **DataJud** | base pública do CNJ com metadados e movimentações processuais |
| **PJe** | Processo Judicial eletrônico; sistema de tramitação de vários tribunais |
| **e-SAJ** | portal de tramitação da Softplan, usado pelo TJSP entre outros |
| **Projudi** | outro sistema de tramitação processual |
| **Intimação** | comunicação oficial que dispara prazo |
| **Andamento** | movimentação registrada nos autos |
| **Autos** | o processo em si, com todas as peças |
| **Peça** | documento processual (petição, contestação, recurso) |
| **Dias úteis** | forma de contagem de prazo no processo civil (CPC/2015, art. 219) |
| **OAB/UF** | inscrição do advogado na Ordem, com a seccional |
| **Certificado A1** | certificado digital em arquivo `.pfx`, validade de 1 ano |
| **Certificado A3** | certificado digital em token USB ou smartcard, 1 a 3 anos |
| **Sucumbência** | honorários pagos pela parte vencida |
| **Tenant** | escritório, no modelo multi-inquilino |
| **LGPD** | Lei Geral de Proteção de Dados (Lei 13.709/2018) |

---

*Documentação mantida junto ao código. Ao alterar rota, tela ou permissão,
atualizar as seções 7, 8 e 9.*
