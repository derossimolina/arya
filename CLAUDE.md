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
| Editor de blocos (modo Logseq) | avaliar **BlockNote** ou **TipTap** | Segunda visualização do mesmo arquivo como outline |
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
também têm um toggle "Ver YAML"/"Ver formulário" que troca entre esses widgets e o bloco de
frontmatter como texto puro (estilo Obsidian), e uma nota cujo `type` no frontmatter ainda não
tem schema oferece "Criar tipo agora", pré-preenchendo o formulário com propriedades inferidas
dos valores já presentes no frontmatter.

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
4. ⏳ Pendente — Modo bloco/outline (estilo Logseq) + parsing de tasks (`- [ ]` / `- [x]`) sobre a
   AST do goldmark
5. ⏳ Pendente — Grafo: wikilinks (`[[nota]]`) + backlinks + visualização de grafo
6. ⏳ Pendente — Sync opcional via git puro (usuário gerencia sozinho, sem infra nossa)

Cada item deve ser entregue com testes, priorizando parsing e I/O de arquivos como área de maior
risco de bugs sutis (encoding, YAML malformado, edge cases de wikilinks). Esta etapa é a "isca"
que valida a proposta de valor antes de investir em infraestrutura paga.

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

### Etapa 3+ (não detalhado ainda)

Candidatos naturais: marketplace de tipos/templates compartilháveis pela comunidade, plugins de
terceiros usando o `KindRegistry` como ponto de extensão, temas visuais.

## Modelo de monetização (resumo)

| Feature | Custo operacional pra nós | Modelo de cobrança |
|---|---|---|
| Core desktop (Etapa 1) | Nenhum | Grátis |
| Publicação via Hugo | Nenhum (local) | Licença única ("Pro") |
| Sync mobile | Recorrente (servidor) | Assinatura mensal |

Não empacotar Hugo e sync na mesma cobrança — evita subsidiar custo de servidor com receita de
um recurso que não gera custo nenhum, e permite ao usuário pagar só pelo que usa.

## Estado atual da implementação (fatias 1-3 de Etapa 1 concluídas)

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

**Serviços Wails bindados** (`main` package, recarregam config/vault a cada chamada, sem cache
entre chamadas — mesmo padrão em todos):
- `ConfigService`: `GetVaultPath`, `ChooseVaultPath` (diálogo nativo de escolha de pasta).
- `NotesService`: `Tree`, `ReadNote`, `SaveNote`, `SaveNoteStructured`, `CreateFolder`,
  `CreateNote(parentPath, title, typeID)`.
- `SchemaService`: `ListSchemas`, `GetSchema`, `ResolveSchema`, `SaveSchema`, `DeleteSchema`,
  `ListKinds`.
- `IndexService`: `QueryByType(typeID)` — reconstrói um índice SQLite `:memory:` a partir do
  vault a cada chamada (nunca persiste em disco; ver `internal/index`) e retorna os objetos
  daquele tipo com suas properties.

**Frontend (`frontend/src/`)**
- First-run (escolher vault) → `MainLayout` (árvore de cadernos + editor).
- `NoteEditor` — CodeMirror 6 raw (arquivo inteiro, frontmatter+corpo juntos); usado quando a
  nota não tem `type` no frontmatter.
- `TypedNoteView` — painel de propriedades gerado por schema + corpo em CodeMirror separado;
  usado quando `type` resolve a um schema válido. Toggle "Ver YAML"/"Ver formulário".
- Se `type` não corresponde a nenhum schema existente, botão "Criar tipo agora" com formulário
  pré-preenchido a partir do frontmatter da nota.
- `SchemaManagerModal`/`SchemaEditorPanel` — CRUD de tipos pela UI ("+ Novo Tipo"), incluindo
  agora um editor de `views[]` (nome/tipo/group_by/columns) por schema.
- `Views/ViewRenderer` — renderiza uma view salva de um schema como tabela ou kanban, consultando
  `IndexService.QueryByType`; acessível pelos botões "Ver: <nome>" no `SchemaManagerModal`.

**Ainda não implementado** (fatias 4-6 da Etapa 1): modo outline/tasks, grafo de
wikilinks/backlinks, sync git. `RelationField`/`FileField` continuam placeholders de texto —
um picker real sobre o índice fica para quando essas fatias tocarem relações entre notas.

Dependências já adicionadas: `goldmark`, `goldmark-meta`, `gopkg.in/yaml.v3`, `modernc.org/sqlite`
(Go); `@uiw/react-codemirror` + `@codemirror/{state,view,lang-markdown,lang-yaml,commands,theme-one-dark}`
(frontend). **Ainda não adicionadas** (stack-alvo de fatias futuras, não assumir presentes):
`fsnotify`, `BlockNote`/`TipTap`.

Há suíte de testes Go de verdade (`go test ./...`, cobrindo `internal/vault`, `internal/schema` e
`internal/index`)
— a frase antiga "nenhum teste configurado" só vale pro frontend, que segue sem test runner.

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