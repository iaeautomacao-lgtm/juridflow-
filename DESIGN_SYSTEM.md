# Design System — JuridFlow

Direção visual: **software jurídico corporativo / legal operations**. Densidade de
informação, leitura rápida e sobriedade. Não é app bancário nem startup de IA.

A interface anterior era herança do ACORDIO: roxo/neon, gradientes, pílulas grandes,
cinco azuis diferentes para a mesma função. Esta é a substituição.

---

## 1. Decisões

| # | Decisão | Alternativa descartada |
|---|---|---|
| A | Paleta do **logo JuridFlow** (`#17365D` / `#2E6CA4`), navy `#0B1324` só na sidebar | Hex genéricos do Tailwind (`#2563eb`) |
| B | **Inter 600/700** nos títulos | Georgia serif — envelhece e briga com densidade |
| C | Slots prontos para dado que o backend ainda não tem | Inventar o dado ou cortar o slot |
| D | Tema escuro na fase 4, arquitetura pronta desde a fase 0 | Deixar para depois e reescrever |
| E | Migração por fases, validando na fase 2 | Reescrever as 22 telas de uma vez |

---

## 2. Tokens

Fonte única: [`frontend/src/index.css`](frontend/src/index.css).
O [`tailwind.config.js`](frontend/tailwind.config.js) apenas expõe como classe.

### Por que custom property e não a paleta do Tailwind

Tema escuro. Com variável, o tema é uma classe no `<html>` e os valores trocam
embaixo dos mesmos nomes. Com classe literal (`bg-slate-900`), seria preciso escrever
`dark:bg-...` em cada um dos ~1.200 pontos de cor da interface.

### Superfície e texto

| Token | Classe | Claro | Papel |
|---|---|---|---|
| `--superficie` | `bg-superficie` | `#F6F8FB` | fundo da aplicação |
| `--superficie-alta` | `bg-superficie-alta` | `#FFFFFF` | cartão, painel |
| `--superficie-sutil` | `bg-superficie-sutil` | `#F4F7FB` | campo, preenchimento discreto |
| `--borda` | `border-borda` | `#E2E8F0` | divisória 1px |
| `--borda-forte` | `border-borda-forte` | `#CBD5E1` | divisória em destaque |
| `--texto` | `text-texto` | `#172033` | corpo |
| `--texto-suave` | `text-texto-suave` | `#64748B` | apoio |
| `--texto-fraco` | `text-texto-fraco` | `#94A3B8` | marca d'água, ícone inativo |

Três níveis de texto e nada além. Mais que três vira ruído.

### Marca

| Token | Classe | Claro | Papel |
|---|---|---|---|
| `--marca` | `bg-marca` / `text-marca` | `#2E6CA4` | **única cor de ação** da interface |
| `--marca-escura` | `bg-marca-escura` | `#17365D` | hover do primário, avatar |
| `--marca-clara` | `text-marca-clara` | `#5BA3D9` | indicador ativo na sidebar |
| `--marca-fundo` | `bg-marca-fundo` | `#F0F4F9` | fundo de badge, linha não lida |
| `--ouro` | `text-ouro` | `#E0A64E` | acento de marca — **nunca estado** |

### Navegação

`--nav` `#0B1324` · `--nav-alta` `#131F36` · `--nav-texto` `#B6C2D6` · `--nav-texto-fraco` `#7283A1`

Mais escura que o navy do wordmark de propósito: a sidebar recua, o conteúdo avança.

### Estado — e só estado

| Token | Claro | Significa |
|---|---|---|
| `--ok` / `--ok-fundo` | `#047857` / `#D1FAE5` | concluído, pago, válido |
| `--atencao` / `--atencao-fundo` | `#B45309` / `#FEF3C7` | prazo, vencendo, pendente |
| `--erro` / `--erro-fundo` | `#B91C1C` / `#FEE2E2` | falha, atraso, exclusão |

> **Regra dura.** Verde, âmbar e vermelho não decoram nada nesta interface.
> Se aparecem, comunicam alguma coisa. O ícone do escritório na sidebar era
> `bg-emerald-500/20` e não significava estado nenhum — saiu.

### Tema escuro

O bloco `.dark` fica **fora do `@layer base`**, de propósito.

O Tailwind faz tree-shaking de seletor de classe não usado dentro de `@layer`. Como
nenhum elemento tem `class="dark"` ainda, o tema escuro inteiro sumia do CSS
compilado — e sumiria de novo a cada build. Seletor de elemento (`:root`, `html`,
`body`) não sofre isso, por isso o bloco claro sobrevivia e o escuro não.

Não é inversão: os papéis se mantêm, os valores mudam. O azul `#2E6CA4` não tem
contraste suficiente sobre `#0F1623`, então no escuro o papel "marca" passa a ser
ocupado pelo azul claro do logo.

---

## 3. Forma

| Propriedade | Valor | Observação |
|---|---|---|
| Raio — controle | `rounded-lg` → **8px** | botão, campo, badge |
| Raio — cartão | `rounded-xl` → **10px** | |
| Raio — bloco/modal | `rounded-2xl` → **12px** | |
| Sombra | `shadow-card` | `0 1px 2px /.04` — quase imperceptível |
| Divisória | 1px `--borda` | a hierarquia vem do espaço, não da linha |
| Largura útil | `max-w-[1440px]` centrado | definida no `App.tsx`, não em cada página |
| Espaçamento de página | `34px` horizontal, `28px` vertical | idem |
| Corpo | 13px | |
| Rótulo | 11px maiúsculo, `letter-spacing .04em` | classe `text-rotulo` |
| Título de página | 25px Inter 700 | |
| Números | `.tabular` | CNJ, valor e data alinham em coluna |

Os degraus de raio foram **redefinidos**, não acrescentados. Isso tira a aparência de
pílula também das telas que ainda não foram migradas, sem tocar no JSX delas.

### Tipografia

- **Inter** — corpo e títulos
- **Poppins** (`font-display`) — apenas o wordmark do logo, acompanhando a marca
- **mono** — número CNJ e identificadores

---

## 4. Primitivos

`frontend/src/components/ui/` — importar pelo barril: `import { ... } from '../../components/ui'`

| Componente | Uso |
|---|---|
| `PageHeader` | trilha + título + descrição + ações |
| `Card` | bloco de conteúdo |
| `Botao` | `primario` \| `secundario` \| `sutil` \| `perigo`; `sm` \| `md` |
| `Badge` | `marca` \| `novo` \| `prazo` \| `ok` \| `erro` \| `neutro` |
| `EmptyState` | vazio, compacto e centrado |
| `ErrorState` | **falha de carregamento — desenho diferente do vazio** |
| `FilterBar` + `CampoBusca` + `Seletor` | filtros |
| `StatCard` + `StatGrid` | faixa de indicadores |
| `Painel` + `PainelCabecalho` + `GrupoData` + `LinhaLista` | lista agrupada por data |
| `cx` | junta classes condicionais |

### Nem tudo é cartão

Borda, fundo, raio e sombra dizem "objeto separado". Quando todos os blocos da tela
recebem os quatro, a hierarquia some. Para agrupar sem separar, basta espaço.

### A cor do botão diz o peso, não o assunto

A interface anterior tinha botão azul, índigo, ardósia, esmeralda e âmbar escolhidos
pelo tema do botão. O resultado era que tudo parecia igualmente urgente.

### `EmptyState` ≠ `ErrorState`

"Nenhum andamento encontrado" e "a API não respondeu" são fatos distintos. A camada
HTTP foi corrigida justamente para parar de transformar falha em lista vazia;
renderizar os dois com o mesmo desenho desfaria a correção na interface, e o usuário
concluiria que não há processo em andamento quando o servidor está fora.

---

## 5. Verificação

```bash
cd frontend
npm run verificar          # typecheck + tokens
npm run verificar:tokens   # só tokens
```

O script [`frontend/scripts/verificar-tokens.mjs`](frontend/scripts/verificar-tokens.mjs)
acusa três coisas em arquivo já migrado:

1. cor literal da paleta Tailwind (`slate-900`, `blue-600`, `indigo-500`)
2. `bg-white` / `border-white` opaco (a forma translúcida `bg-white/[0.05]` é legítima sobre a barra escura)
3. hex escrito no componente

Comentários são ignorados — este projeto documenta o que foi trocado citando a classe
antiga, e sem isso documentar a correção acusaria o arquivo corrigido.

**Ao migrar uma tela, acrescente o caminho a `MIGRADOS` no mesmo commit.**

---

## 6. Estado da migração

### Migrado (fases 0–2)

```
src/App.tsx
src/components/ui/            (11 arquivos)
src/components/layout/Sidebar.tsx
src/components/layout/Topbar.tsx
src/components/common/Skeleton.tsx
src/pages/Contencioso/Andamentos.tsx
```

### Pendente (fase 3) — 755 linhas em 17 arquivos

```
106  src/pages/Contencioso/Processos.tsx
 85  src/pages/Dashboard.tsx
 65  src/pages/Atividades/Atividades.tsx
 65  src/pages/Contencioso/Intimacoes.tsx
 64  src/pages/Configuracoes/Configuracoes.tsx
 62  src/pages/Financeiro/Financeiro.tsx
 49  src/pages/Configuracoes/GestaoUsuarios.tsx
 47  src/pages/Documentos/Documentos.tsx
 41  src/pages/Gestao/Pessoas.tsx
 39  src/components/ai/FlowDrawer.tsx
 36  src/pages/Contencioso/CentralCaptura.tsx
 27  src/pages/TrocarSenha.tsx
 22  src/pages/MinhaConta.tsx
 18  src/pages/Login.tsx
 17  src/pages/Gestao/AtendimentoCRM.tsx
  9  src/main.tsx
  3  src/components/common/ApiErrorBanner.tsx
```

### Fase 4 — tema escuro

Falta apenas o controle: alternar `class="dark"` no `<html>`, persistir a escolha e
respeitar `prefers-color-scheme` na primeira visita. Os valores já existem.

---

## 7. Como migrar uma tela

1. Trocar o cabeçalho manual por `PageHeader`
2. Trocar a barra de filtro manual por `FilterBar` + `CampoBusca` + `Seletor`
3. Trocar `bg-white p-4 rounded-2xl border ...` por `Card` ou `Painel`
4. Trocar botão manual por `Botao`, escolhendo a variante pelo **peso da ação**
5. Trocar o retângulo de vazio por `EmptyState`, e acrescentar `ErrorState` se a tela carrega da API
6. Substituir o que restar de cor literal pelo token de papel equivalente
7. Acrescentar o caminho a `MIGRADOS` em `verificar-tokens.mjs`
8. `npm run verificar`

---

## 8. Pendências conhecidas

| Item | Situação |
|---|---|
| **SVG oficial do logo** | Os hex de marca foram obtidos a conta-gotas de um JPEG. Ao receber o vetor, conferir em dois lugares: rampas `juridflow`/`gold` no config e `--marca-*` no `index.css` |
| **Badge "Prazo"** | O slot existe em `Andamentos.tsx`. Falta vínculo `Andamento` ↔ `Tarefa` no schema para saber se a movimentação abriu prazo |
| **"Ver processo →"** | Exige que `Processos.tsx` aceite seleção inicial por CNJ. Não foi incluído: um link que leva à lista genérica não é "ver processo" |
| **KPI "Última sincronização"** | Não há log de captura com timestamp no backend |
| **Alternador Escritório / Pessoal** | Controle existe e não filtra nada. Depende de responsável por processo, que o backend não expõe |
| **Marcar todos como lidos** | São N requisições (não há rota de lote). Por isso age só sobre o filtro visível, e o rótulo diz a quantidade |
| **Sidebar colapsada** | Abaixo de 860px o submenu some; clicar no módulo leva ao primeiro sub-item |
