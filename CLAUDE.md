# CLAUDE.md — Arya

Módulo Go: `github.com/derossimolina/arya`
Repositório: `github.com/derossimolina/arya`

## Visão geral

**Arya** é uma aplicação de notas desktop, offline-first, multiplataforma (foco inicial: Windows 10),
que combina conceitos de quatro ferramentas:

- **Evernote** → cadernos (organização hierárquica por pastas/notebooks)
- **AnyType** → objetos tipados, propriedades customizáveis, múltiplas visualizações (tabela, kanban)
- **Obsidian** → markdown puro em disco como fonte da verdade, frontmatter YAML, wikilinks, offline-first real
- **Logseq** → modo bullet/outline, tasks embutidas no texto (`- [ ] tarefa`)

**Destinatário do produto: qualquer usuário, não só o autor.** Isso significa que o sistema de
tipos (schemas) NÃO pode ser hardcoded no código — precisa ser inteiramente definido por dados
(YAML) que o próprio usuário cria e edita pela interface, sem tocar em código.

## Stack técnica (decisão final: Go, não Rust)

| Camada | Tecnologia | Motivo |
|---|---|---|
| Shell da app | **Wails v2** (não v3, ainda alpha) | Equivalente ao Tauri, mas com backend em Go em vez de Rust — usuário já domina Go |
| Frontend | **React + TypeScript** | Bindings Go→TS automáticos gerados pelo Wails |
| Editor de texto longo | **CodeMirror 6** | Mesmo editor usado pelo Obsidian em modo source |
| Editor de blocos (modo Logseq) | **BlockNote** (decidido, não TipTap) | Único editor com menu "/" e drag handles prontos; TipTap exigiria construir isso do zero |
| Parsing markdown | **yuin/goldmark** (+ `yuin/goldmark-meta` para frontmatter) | Parser usado pelo Hugo desde 0.60; CommonMark compliant, AST extensível |
| Frontmatter/YAML | `gopkg.in/yaml.v3` | Parse do YAML de propriedades e de schemas de tipo |
| Índice/queries | **modernc.org/sqlite** | Pure-Go, sem CGO — evita exigir compilador C no ambiente Windows do usuário |
| Watch de arquivos | `fsnotify/fsnotify` | Detecta mudanças externas (ex: edição fora do app, sync via git) |
| Renderização nativa | WebView2 (Windows) via Wails | Sem bundle de Chromium — binário leve |

Ambiente do usuário: Windows 10, já com Go e Node.js instalados. WebView2 Runtime necessário
(geralmente pré-instalado). CLI: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`,
verificar com `wails doctor`.

## Princípio arquitetural central

> **Tipos são dados, não código.**

- O que é **fechado/conhecido no código**: o registro de **kinds** (tipos de propriedade —
  text, number, date, select, multi_select, checkbox, relation, file, url). Isso é a "gramática"
  do sistema e vive em Go como um registro extensível (`KindRegistry`), pensado para no futuro
  aceitar plugins de terceiros que registrem novos kinds em runtime.
- O que é **100% dado, definido pelo usuário**: os **tipos de objeto** (ex: "Paper", "Receita",
  "Contato", "Livro"). Cada um é um arquivo YAML em `_schemas/*.yaml`, criável e editável pela
  própria UI (formulário "Novo Tipo" gera o YAML por baixo dos panos).
- Tipos enviados junto com o app (`nota`, `tarefa`, `pessoa`, `contato`) são apenas **exemplos de
  partida** — devem ser editáveis/deletáveis como qualquer tipo criado pelo usuário. Nunca dar
  a eles privilégios especiais no código; isso quebraria o espírito "AnyType-like" do produto.

## Formato do arquivo de schema de tipo (YAML flexível)

```yaml
# _schemas/paper.yaml
id: paper
name: "Artigo Acadêmico"
icon: "📄"
color: "#4A90D9"
extends: null              # opcional: herda propriedades de outro tipo
properties:
  - key: status
    label: "Status"
    kind: select
    required: true
    options: ["rascunho", "submetido", "aceito", "publicado"]
    default: "rascunho"
  - key: autores
    label: "Autores"
    kind: relation
    relation_type: pessoa
    multiple: true
  - key: revisado
    label: "Revisado"
    kind: checkbox
    default: false
views:
  - name: "Por Status"
    type: kanban
    group_by: status
  - name: "Tabela Geral"
    type: table
    columns: [status, venue, data_submissao]
template: |
  # {{title}}
  ## Resumo
  ## Notas
```

Suporte a `extends` para herança entre tipos (merge de propriedades, filho sobrescreve pai).

## Modelo de dados

### Fonte da verdade: arquivos em disco
Cada nota = um arquivo `.md` com frontmatter YAML no topo (propriedades) + corpo em markdown.
Cadernos = pastas no sistema de arquivos (estilo Evernote).

### Índice local: SQLite (cache reconstruível, NUNCA fonte da verdade)

```sql
CREATE TABLE objects (
    id TEXT PRIMARY KEY,       -- path relativo do arquivo
    type TEXT,                  -- referencia o id do schema (ex: "paper")
    title TEXT,
    caderno TEXT,                -- pasta/notebook
    updated_at TEXT
);

CREATE TABLE properties (        -- EAV: permite qualquer schema sem alterar o banco
    object_id TEXT,
    key TEXT,
    value TEXT,
    FOREIGN KEY(object_id) REFERENCES objects(id)
);

CREATE TABLE links (              -- wikilinks / backlinks
    source TEXT,
    target TEXT
);

CREATE TABLE tasks (               -- tasks extraídas do corpo markdown
    object_id TEXT,
    line_number INTEGER,
    content TEXT,
    done BOOLEAN
);

CREATE TABLE schemas (              -- cache dos YAMLs de tipo (fonte real = arquivo em disco)
    type_id TEXT PRIMARY KEY,
    definition_yaml TEXT,
    updated_at TEXT
);
```

O uso de `properties` como tabela EAV é o que permite que cada tipo definido pelo usuário tenha
propriedades arbitrárias sem qualquer migração de schema do banco.

## Bindings Go → TypeScript (via Wails)

Serviços Go expostos diretamente ao frontend, com tipos TS gerados automaticamente. Este era o
esboço original da visão — os métodos reais implementados hoje (fatias 1-2) estão listados na
seção "Estado atual da implementação"; a ideia abaixo ainda vale como exemplo do padrão geral
(query por tipo, backlinks) para quando o índice SQLite existir:

```go
type NotesService struct{ db *sql.DB }
func (s *NotesService) QueryByType(t string) ([]Object, error)
func (s *NotesService) GetBacklinks(id string) ([]string, error)
```

No frontend, chamada tipada direta sem serialização manual:
```typescript
import { SaveNote } from '../wailsjs/go/main/NotesService'
await SaveNote("caderno/nota.md", conteudo)
```

## UI dirigida por schema (genérica, não hardcoded)

O frontend não conhece tipos específicos de antemão. Um componente genérico decide o widget de
renderização a partir do `kind` de cada propriedade:

```tsx
<PropertyField kind={prop.kind} value={...} onChange={...} />
```

Isso é o que permite que qualquer tipo criado pelo usuário — sem nenhum tipo "especial" — ganhe
uma UI de edição funcional automaticamente. Implementado em
`frontend/src/components/Properties/PropertyField.tsx` (um widget por `kind`); notas tipadas
têm um único toggle "Ver Markdown" que troca entre o formulário de propriedades + editor de
blocos e o arquivo inteiro (frontmatter + corpo juntos) como texto puro (estilo Obsidian source
mode) — não existe mais um modo "só YAML" separado, foi unificado a pedido do usuário porque a
divisão em dois toggles independentes (form/YAML × blocos/markdown) confundia mais do que ajudava.
Uma nota cujo `type` no frontmatter ainda não tem schema oferece "Criar tipo agora",
pré-preenchendo o formulário com propriedades inferidas dos valores já presentes no frontmatter.

## Etapas de lançamento (releases, não só fases de dev interno)

A ideia é fatiar por **versões lançáveis**, reservando features com custo operacional recorrente
(servidor, sync) para depois de validar o core gratuito com usuários reais.

### Etapa 1 — MVP core (grátis, standalone, zero servidor)

Sem nenhuma dependência de rede. Corresponde às fases de fundação. Sendo entregue em fatias
sequenciais e validadas (ver "Estado atual da implementação" abaixo para o que já existe de fato):

1. ✅ **Concluído** — Leitura/escrita de `.md` + goldmark/frontmatter + árvore de pastas (cadernos)
2. ✅ **Concluído** — Sistema de tipos: parser genérico de schemas YAML + editor de propriedades
   gerado dinamicamente a partir do schema (sem structs fixas por tipo)
3. ✅ **Concluído** — Índice: modernc.org/sqlite (reconstruído em memória sob demanda) + views de
   tabela/kanban sobre um tipo
4. 🟡 **Parcial** — Modo bloco (estilo Notion, via BlockNote) com menu "/" entregue (tabela nativa,
   criação de página); ainda faltam os blocos de kanban/cronograma embutindo uma view salva do
   schema, o bloco de tarefa inline com `kind: datetime`, e o parsing de tasks (`- [ ]`/`- [x]`)
   sobre a AST do goldmark para um índice de tasks vault-wide
5. 🟡 **Parcial** — Wikilinks **em nível de nota** funcionando (`[[título]]`, autocomplete ao
   digitar `[[`, resolve e navega para a nota via `IndexService.ResolveNoteTitle`); a opção
   "funda" que tinha sido escolhida para esta fatia — referência/transclusão em **nível de
   bloco** (estilo Logseq, com IDs de bloco e índice de backlinks) — **não foi implementada**,
   ficou só o nível de nota mesmo. Backlinks e visualização de grafo também continuam pendentes
6. ⏳ Pendente — Sync opcional via git puro (usuário gerencia sozinho, sem infra nossa)

Cada item deve ser entregue com testes, priorizando parsing e I/O de arquivos como área de maior
risco de bugs sutis (encoding, YAML malformado, edge cases de wikilinks). Esta etapa é a "isca"
que valida a proposta de valor antes de investir em infraestrutura paga.

Além das fatias acima (que já existiam antes desta rodada), duas frentes novas foram entregues
que não faziam parte da numeração original: **busca global** (full-text, via FTS5) e uma
**reforma visual completa** (ver "Estado atual da implementação" abaixo para os dois).

### Etapa 2 — primeira camada monetizável

Duas features com perfis de custo diferentes → **dois produtos, dois modelos de cobrança**:

**2a. Integração com Hugo (publicação estilo Obsidian Publish) — licença única ("Pro")**
- Sem custo operacional recorrente (é geração de site estático 100% local).
- Notas marcadas com uma propriedade (`publish: true` no frontmatter) são exportadas para uma
  estrutura de conteúdo Hugo; o app roda `hugo build` (ou expõe o comando) e o usuário publica onde
  quiser (Netlify, GitHub Pages, etc. — fora do nosso escopo de infra).
- Desbloqueio via **serviço de licenciamento offline**: chave pública embutida no binário, valida
  um token assinado pela nossa autoridade — não exige internet para checar a licença.
- `LicenseService` (Go): `Validate(token string) (bool, error)`, `IsFeatureUnlocked(feature string) bool`.

**2b. Sincronização mobile (app nativo React Native + backend próprio) — assinatura**
- Custo recorrente real (servidor no ar) → modelo de assinatura, não licença única.
- Decisão: **React Native** para o mobile (não Flutter), para reaproveitar tipos TypeScript e,
  potencialmente, a lógica de renderização de `PropertyField` entre desktop e mobile.
- Requer um **backend próprio**, separado do binário desktop:
  - API em Go (mantém a stack única do projeto) expondo endpoints de sync.
  - Storage: Postgres (metadados/usuários/assinaturas) + blob storage para os arquivos `.md`
    sincronizados (ou sync incremental por diff, a definir na fase de design do protocolo).
  - Protocolo de sync: começar simples (last-write-wins por arquivo, com timestamp), CRDT fica
    para uma fase bem posterior caso conflitos concorrentes se tornem um problema real.
  - Autenticação: token de assinatura ativa validado pelo backend a cada sync (diferente da
    licença offline do Hugo — aqui precisa ser online, pois o modelo é recorrente).

**2c. Agente de IA plugável (backlog levantado 2026-07-12, sem desenho técnico ainda)** — usuário
pluga uma API key de um provedor à escolha (Claude Code, Cursor, OpenAI, modelos abertos estilo
Hermes) e o agente captura/escreve/salva notas dentro do vault, presumivelmente sobre
`NotesService.CreateNote`/`SaveNoteStructured`. Sem decisão ainda sobre onde a key fica
armazenada, se roda local via CLI de terceiros ou HTTP direto ao provedor, nem qual o gatilho.
Só a intenção registrada — ver `docs/cronograma-desenvolvimento.md` para o mesmo texto.

### Etapa 3+ (não detalhado ainda)

Candidatos naturais: marketplace de tipos/templates compartilháveis pela comunidade, plugins de
terceiros usando o `KindRegistry` como ponto de extensão, temas visuais, e um **banco de dados
estilo Notion** (múltiplas visualizações — inline num bloco de outra nota e/ou página inteira —
sobre a mesma coleção, com filtro/ordenação ad hoc pela UI, não só a view fixa salva no schema;
backlog levantado 2026-07-12, sem desenho técnico).

## Modelo de monetização (resumo)

| Feature | Custo operacional pra nós | Modelo de cobrança |
|---|---|---|
| Core desktop (Etapa 1) | Nenhum | Grátis |
| Publicação via Hugo | Nenhum (local) | Licença única ("Pro") |
| Sync mobile | Recorrente (servidor) | Assinatura mensal |

Não empacotar Hugo e sync na mesma cobrança — evita subsidiar custo de servidor com receita de
um recurso que não gera custo nenhum, e permite ao usuário pagar só pelo que usa.

## Estado atual da implementação (fatias 1-3 concluídas, 4-5 parciais, busca+visual novos)

O código já vai bem além do scaffold padrão do Wails. Resumo do que existe hoje — antes de
assumir uma assinatura ou arquivo, confira o código real, este texto é um resumo e pode ficar
desatualizado:

**Backend (`internal/`)**
- `internal/config` — persiste o caminho do vault escolhido pelo usuário
  (`%AppData%\arya\config.json`).
- `internal/vault` — toda a lógica de arquivo: árvore de cadernos/notas (`Tree`), leitura/escrita
  raw de nota inteira (`ReadNote`/`SaveNote`), leitura/escrita estruturada de frontmatter+corpo
  separados (`SaveNoteStructured`/`ComposeNote`/`SplitFrontmatter`/`FrontmatterInner`), criação de
  pasta/nota (`CreateFolder`/`CreateNote`/`CreateNoteWithContent`), slug seguro para títulos
  acentuados, guarda contra path traversal, `_schemas/` oculta da árvore de notas.
- `internal/schema` — sistema de tipos: `Kind`/`Registry` (os 9 kinds fechados listados acima),
  parse/serialize de schema via `yaml.v3`, merge de `extends` (com detecção de ciclo), `Manager`
  sobre `<vault>/_schemas/` (list/get/resolve/save/delete + seed automático dos 4 tipos de
  exemplo na primeira vez que a pasta não existe).
- `internal/index` — `BuildFromVault` (índice SQLite `:memory:` de notas tipadas, cache
  reconstruído por chamada) + `WalkNotes` (helper de varredura compartilhado) +
  `BuildSearchIndex`/`Search` (`search.go`, índice FTS5 com tokenizer `trigram` cobrindo **toda**
  nota, tipada ou não — confirmado disponível em `modernc.org/sqlite@v1.53.0` mesmo sem CGO).

**Serviços Wails bindados** (`main` package, recarregam config/vault a cada chamada, sem cache
entre chamadas — mesmo padrão em todos):
- `ConfigService`: `GetVaultPath`, `ChooseVaultPath` (diálogo nativo de escolha de pasta).
- `NotesService`: `Tree`, `ReadNote`, `SaveNote`, `SaveNoteStructured`, `CreateFolder`,
  `CreateNote(parentPath, title, typeID)`.
- `SchemaService`: `ListSchemas`, `GetSchema`, `ResolveSchema`, `SaveSchema`, `DeleteSchema`,
  `ListKinds`.
- `IndexService`: `QueryByType(typeID)`; `ResolveNoteTitle(title)` — varre o vault procurando uma
  nota cujo frontmatter `title` bata (case-insensitive), usado para resolver `[[título]]` de
  volta a um link clicável quando uma nota é carregada no editor de blocos.
- `SearchService`: `Search(query)` — busca full-text (FTS5) em título+corpo de toda nota.

**Frontend (`frontend/src/`)**
- First-run (escolher vault) → `MainLayout` (árvore de cadernos + editor), agora com sidebar
  recolhível (`sidebar-rail` + ícone de colapsar) e busca global em destaque (`Ctrl+K` ou botão
  "Buscar notas…") via `Search/CommandPalette.tsx`.
- **Editor de blocos (BlockNote)** — `Editor/BlockEditor.tsx` substitui o corpo em CodeMirror por
  um editor de blocos estilo Notion com menu "/" (`SuggestionMenuController`). Blocos nativos
  (tabela, heading, lista) saem de graça do BlockNote; bloco customizado `pageLink`
  (`Editor/blocks/pageLinkBlock.tsx`) cobre "/Criar página" (chama `CreateNote` de verdade e
  avisa `MainLayout` para recarregar a árvore via `onNoteCreated`). Serialização
  markdown↔blocos em `Editor/blockMarkdown.ts`: um registro de serializadores customizados por
  tipo de bloco, com fallback para o exportador padrão do BlockNote.
- **Wikilinks inline** — digitar `[[` abre autocomplete (via `SearchService.Search`); ao
  selecionar, insere um `wikilink` inline content (`Editor/blocks/wikilinkInlineContent.tsx`)
  clicável em qualquer lugar do texto, não só numa linha isolada. Serializa para `[[título]]` em
  disco; ao reabrir, `blockMarkdown.ts` resolve cada ocorrência via `IndexService.ResolveNoteTitle`
  — se o token ocupava sozinho um parágrafo inteiro (caso do bloco `pageLink`), vira de volta o
  bloco com cara de card; caso contrário vira o link inline sublinhado. **Só nível de nota** — não
  há IDs de bloco nem índice de backlinks (a opção "funda" de referência em nível de bloco,
  escolhida antes para a fatia 5, não foi implementada).
- `NoteEditor`/`TypedNoteView` — toggle único "Ver Markdown" (não mais dois toggles separados de
  YAML e de blocos/markdown): alterna entre o editor de blocos (+ formulário de propriedades, no
  caso de `TypedNoteView`) e o arquivo inteiro cru em CodeMirror. Nota tipada tem título grande
  editável no topo (`note-page-title`) e lista compacta de propriedades, dentro de uma coluna
  centralizada (`note-page`, inspirada no layout do Notion).
- Se `type` não corresponde a nenhum schema existente, botão "Criar tipo agora" com formulário
  pré-preenchido a partir do frontmatter da nota.
- `SchemaManagerModal`/`SchemaEditorPanel` — CRUD de tipos pela UI ("+ Novo Tipo"), incluindo
  agora um editor de `views[]` (nome/tipo/group_by/columns) por schema.
- `Views/ViewRenderer` — renderiza uma view salva de um schema como tabela ou kanban, consultando
  `IndexService.QueryByType`; acessível pelos botões "Ver: <nome>" no `SchemaManagerModal`. Ainda
  não tem um bloco `/` que a embuta dentro do editor (isso é o que falta da fatia 4).
- **Design visual** — `styles/tokens.css` importa a paleta/tipografia/espaçamento do projeto
  "Sheepdog Design System" (importado via Claude Design/`DesignSync`, projectId
  `b7d16433-df8f-40fe-b5d3-250361750b1c`): monocromático, cinza quente, serifado (Playfair
  Display/Lora, com fallback pra Georgia/Consolas — sem CDN do Google Fonts, pra não quebrar
  offline-first), raios quase retos, sombras suaves. Camada de layout por cima inspirada no
  Notion (título grande + coluna centralizada + sidebar sem bordas pesadas), a pedido do usuário
  depois de achar o resultado do design system puro "cru"/"infantil" — ver commits desta sessão
  para o histórico das duas iterações. Ícones são SVG outline desenhados à mão
  (`components/icons/Icons.tsx`), nunca emoji (regra explícita do design system: "No emoji.
  Ever."). Tema do BlockNote setado como `light`, coerente com o fundo claro.

**Ainda não implementado**:
- Blocos de kanban/cronograma embutindo uma `view` salva do schema (resto da fatia 4).
- Bloco de tarefa inline + `kind: datetime` + índice de tasks vault-wide (resto da fatia 4).
- Referência/transclusão de bloco (IDs de bloco, índice de backlinks, grafo) — resto da fatia 5,
  opção "funda" ainda não implementada, só o nível de nota.
- Sync via git (fatia 6).
- `RelationField`/`FileField` continuam placeholders de texto — um picker real sobre o índice
  fica para quando alguma dessas fatias tocar relações entre notas.

Dependências já adicionadas: `goldmark`, `goldmark-meta`, `gopkg.in/yaml.v3`, `modernc.org/sqlite`
(Go); `@uiw/react-codemirror` + `@codemirror/{state,view,lang-markdown,commands,theme-one-dark}`,
`@blocknote/{core,react,ariakit}` (frontend — `@codemirror/lang-yaml` foi removido junto com o
YAML-only mode). **Ainda não adicionadas**: `fsnotify`. `tsconfig.json` usa
`moduleResolution: "Bundler"` (não `"Node"`) — necessário para os subpaths de export do BlockNote
(`@blocknote/core/extensions`); não reverter sem checar se isso ainda é preciso.

Há suíte de testes Go de verdade (`go test ./...`, cobrindo `internal/vault`, `internal/schema` e
`internal/index`, incluindo `internal/index/search_test.go` que exercita o FTS5 de ponta a
ponta, não só compila) — a frase antiga "nenhum teste configurado" só vale pro frontend, que
segue sem test runner.

## Comandos

Rodar a partir deste diretório (`arya/arya`):

- `wails dev` — desenvolvimento com hot reload (Go + Vite); expõe também um dev server em
  `http://localhost:34115` para chamar métodos Go bindados a partir do devtools do navegador.
- `wails build` — gera o binário de produção.
- `wails generate module` — regenera só os bindings TS (`frontend/wailsjs/`) depois de mudar a
  assinatura de um método bindado, sem rodar o app inteiro.
- `go build ./...` — compila só o backend Go.
- `go vet ./...` — checagem estática do Go.
- `go test ./...` — roda a suíte de testes do backend (`internal/vault`, `internal/schema`).

Frontend (normalmente disparado pela CLI do `wails` via `wails.json`, raramente direto):
- `npm install` / `npm run dev` / `npm run build` (roda `tsc` + `vite build`, saída em
  `frontend/dist`, embutida no binário por `main.go`) / `npm run preview`.

Ainda não há test runner nem lint configurados no frontend.

## Convenções de código

- Go: `gofmt` padrão, sem exceções.
- TypeScript: strict mode habilitado.
- Nomenclatura de arquivos de schema: `_schemas/<type_id>.yaml`, minúsculo, sem espaços.
- Nunca escrever lógica que assuma um `type_id` específico fora de dados de exemplo/seed —
  qualquer comportamento condicionado a tipo deve vir do schema, não de `if type == "paper"`.

## Decisões já tomadas (não reabrir sem motivo novo)

- Wails v2 (não v3 alpha, não Tauri/Rust, não Electron puro).
- modernc.org/sqlite (não mattn/go-sqlite3 — evitar CGO).
- goldmark (não remark/unified — esse era o plano original em TS, descartado com a mudança para Go).
- Tipos de objeto são dados (YAML), nunca structs Go fixas.
- SQLite é cache/índice; arquivos `.md` e `.yaml` em disco são a única fonte da verdade.
- Lançamento faseado: Etapa 1 é 100% grátis e sem servidor; monetização só entra na Etapa 2.
- Hugo (publicação) = licença única, sem custo de servidor. Sync mobile = assinatura, com backend
  próprio. Não misturar os dois modelos de cobrança numa única oferta.
- Mobile: React Native (não Flutter) — decisão tomada para reaproveitar tipos TS com o desktop.
- Serviços Wails recarregam config/vault a cada chamada, sem cache — evita estado obsoleto se o
  usuário trocar de vault ou editar um schema no meio da sessão. Manter esse padrão em novos
  serviços das próximas fatias.
- Duas formas de salvar nota coexistem de propósito: `SaveNote` (raw, string opaca, preserva
  bytes) para notas sem tipo, e `SaveNoteStructured` (frontmatter map + corpo, reserializa YAML
  via `yaml.v3`) para notas tipadas. A segunda canonicaliza formatação (ordem de chaves, aspas) —
  trade-off aceito, não é bug.
- `_schemas/` é uma pasta reservada do app (nome em `internal/vault/tree.go`), nunca aparece na
  árvore de cadernos — qualquer nova pasta interna do app deve seguir o mesmo tratamento.
- BlockNote (não TipTap) para o editor de blocos — decisão fechada, ver tabela de stack técnica.
- FTS5 e o tokenizer `trigram` estão de fato disponíveis em `modernc.org/sqlite@v1.53.0` sem CGO
  (confirmado rodando teste real, não só checando símbolos) — não presumir que precisa de scan
  manual em Go para busca full-text.
- Design visual: paleta/tipografia vêm do "Sheepdog Design System" (Claude Design, projectId
  `b7d16433-df8f-40fe-b5d3-250361750b1c`), mas o layout/interação segue inspiração do Notion
  (título grande, coluna centralizada, sidebar sem bordas pesadas) — não são a mesma coisa, não
  reverter o layout achando que "foge do design system" importado.
- Nunca usar emoji na UI do app (regra explícita do design system importado) — ícones são SVG
  outline hand-authored em `components/icons/Icons.tsx`, sem depender de CDN (offline-first).
- Wikilinks (`[[título]]`) resolvem em nível de **nota** (por `title` do frontmatter), não em
  nível de bloco — não presumir que existe transclusão de bloco estilo Logseq só porque
  `[[...]]` funciona; essa fatia (5) continua parcial.