# Cronograma de Desenvolvimento — Arya

## Sobre o produto

Arya é uma aplicação de notas desktop, offline-first, que combina ideias do Evernote (cadernos),
AnyType (tipos de objeto customizáveis), Obsidian (markdown + frontmatter em disco como fonte da
verdade) e Logseq (modo outline/tasks). Stack: Wails v2 (Go + React/TypeScript), sem backend
próprio na Etapa 1.

O desenvolvimento é fatiado em **entregas sequenciais e validadas** dentro da Etapa 1 (MVP core,
grátis, sem servidor), e depois em duas etapas de monetização. Datas não estão preenchidas abaixo
— é o ponto de partida para o cronograma real no Notion.

---

## Status geral

| Etapa | Status |
|---|---|
| Etapa 1 — MVP core | 🟡 Em andamento (3 de 6 fatias concluídas, 2 parciais — 4 e 5) |
| Etapa 2 — Monetização (Hugo + sync mobile) | ⚪ Não iniciada |
| Etapa 3+ — Marketplace/plugins/temas | ⚪ Não iniciada (backlog, sem escopo definido) |

Além das fatias, duas frentes novas (fora da numeração original) foram entregues nesta sessão:
**busca global** (full-text, FTS5) e uma **reforma visual completa** do app (ver seção própria
abaixo).

---

## Etapa 1 — MVP core (grátis, standalone, zero servidor)

| # | Fatia | Status | Depende de |
|---|---|---|---|
| 1 | Arquivos + árvore de cadernos | ✅ Concluída | — |
| 2 | Sistema de tipos/schemas | ✅ Concluída | Fatia 1 |
| 3 | Índice SQLite + views (tabela/kanban) | ✅ Concluída | Fatia 2 |
| 4 | Modo bloco (estilo Notion) + tasks | 🟡 Parcial | Fatia 1 |
| 5 | Wikilinks + backlinks + grafo | 🟡 Parcial | Fatia 3 |
| 6 | Sync via git puro | ⬜ A fazer | Fatia 1 |

### ✅ Fatia 1 — Arquivos + árvore de cadernos
**Entregue.** Leitura/escrita de notas `.md` com frontmatter YAML, árvore de pastas (cadernos),
escolha de vault no primeiro uso (diálogo nativo), editor CodeMirror 6 com autosave.

### ✅ Fatia 2 — Sistema de tipos/schemas
**Entregue.** Tipos de objeto definidos 100% por dados (YAML em `_schemas/*.yaml`, nunca código),
com herança (`extends`), 4 tipos de exemplo semeados automaticamente (editáveis/deletáveis como
qualquer outro), editor de propriedades gerado dinamicamente por `kind` (texto, número, data,
seleção única/múltipla, checkbox, relação, arquivo, URL), formulário de criação de tipo pela UI,
criação de tipo a partir do frontmatter de uma nota existente, e alternância visual/YAML na edição
de propriedades (estilo Obsidian).

### ✅ Fatia 3 — Índice SQLite + views
**Entregue.** Índice reconstruído inteiro em memória (`modernc.org/sqlite`, `:memory:`) a cada
consulta — nunca persistido, sempre um espelho fiel do vault no disco. `IndexService.QueryByType`
varre o vault e retorna os objetos de um tipo com suas properties. Views de tabela e kanban agora
têm um editor no `SchemaEditorPanel` e um `ViewRenderer` navegável (tabela ou kanban, clique abre
a nota). Picker de "relação" de verdade sobre este índice fica para uma fatia futura — por ora
`RelationField` continua um campo de texto manual.

### 🟡 Fatia 4 — Modo bloco + tasks
**Parcial.** Segunda visualização do mesmo arquivo virou um editor de blocos de verdade
(BlockNote, não outline bullet — decisão mudou de rumo em relação ao esboço original de "estilo
Logseq"), com menu "/" estilo Notion. Entregue: tabela (nativa do BlockNote) e "Criar página"
(cria nota nova e insere link). **Falta:** blocos de kanban/cronograma embutindo uma `view`
salva do schema, bloco de tarefa inline com `kind: datetime`, e o parsing de tasks (`- [ ]`/
`- [x]`) sobre a AST do goldmark para um índice de tasks vault-wide.

### 🟡 Fatia 5 — Wikilinks + backlinks
**Parcial.** Sintaxe `[[título]]` funcionando de verdade: autocomplete ao digitar `[[`, link
clicável em qualquer lugar do texto (não só numa linha isolada), resolve via
`IndexService.ResolveNoteTitle` e sobrevive a salvar/reabrir a nota. **Mas só em nível de
nota** — a opção que tinha sido escolhida antes para esta fatia (referência/transclusão em nível
de **bloco**, estilo Logseq, com IDs de bloco e índice de backlinks) não foi implementada.
Backlinks e visualização de grafo continuam pendentes.

### ⬜ Fatia 6 — Sync via git
Sync opcional via git puro — o usuário gerencia o próprio repositório remoto, sem infraestrutura
nossa. Menor risco técnico das fatias restantes.

---

## Busca global + reforma visual (net-new, fora da numeração de fatias)

Entregue nesta sessão, junto com o trabalho de Fatia 4/5 acima:

- **Busca global**: índice FTS5 (`internal/index/search.go`, tokenizer `trigram`) cobrindo toda
  nota do vault, tipada ou não — o problema original era que não existia NENHUM jeito de buscar
  no app (só dava pra navegar por `Tipos → Ver: <view>`, que exige já saber o tipo). Acessível
  via `Ctrl+K` ou botão "Buscar notas…" na sidebar (`CommandPalette.tsx`).
- **Reforma visual**, em duas iterações:
  1. Um design system próprio (paleta escura/violeta, inventada) — a primeira tentativa.
  2. Substituída pelo **"Sheepdog Design System"**, importado de um projeto real do Claude
     Design (`DesignSync`, projectId `b7d16433-df8f-40fe-b5d3-250361750b1c`): paleta monocromática
     de cinza quente, tipografia serifada, raios quase retos — só que isso sozinho ainda pareceu
     "cru"/"infantil" pro usuário, então por cima entrou uma camada de layout **inspirada no
     Notion** (título grande e editável, coluna de conteúdo centralizada, sidebar sem bordas
     pesadas, ícones SVG outline no lugar de emoji — o design system importado proíbe emoji
     explicitamente).
- Efeito colateral: o body editor de toda nota (tipada ou não) trocou de CodeMirror puro para um
  editor de blocos (BlockNote) com menu "/", o que efetivamente puxou boa parte da Fatia 4 para
  frente (ver acima).

---

## Etapa 2 — Primeira camada monetizável

Só começa depois da Etapa 1 validada com usuários reais. Duas features com perfis de custo
diferentes, cobradas separadamente:

### 2a. Integração com Hugo (publicação estilo Obsidian Publish)
- **Modelo:** licença única ("Pro") — sem custo operacional recorrente (geração de site estático
  100% local).
- Notas marcadas com `publish: true` no frontmatter são exportadas para uma estrutura de
  conteúdo Hugo; o usuário publica onde quiser (fora do escopo de infra do produto).
- Desbloqueio via licenciamento offline (token assinado, validado sem internet).

### 2b. Sincronização mobile (React Native + backend próprio)
- **Modelo:** assinatura mensal — custo recorrente real (servidor no ar).
- App React Native (reaproveita tipos TS do desktop) + backend em Go + Postgres.
- Protocolo de sync inicial: last-write-wins por arquivo, com timestamp (CRDT só se conflitos
  concorrentes virarem problema real).

### 2c. Agente de IA plugável (backlog levantado 2026-07-12, ainda sem desenho técnico)
- Ideia: um serviço que aceita uma API key de um provedor à escolha do usuário (Claude Code,
  Cursor, OpenAI, ou modelos abertos estilo Hermes) e usa esse agente para capturar, escrever e
  salvar notas dentro do vault — presumivelmente reaproveitando `NotesService.CreateNote`/
  `SaveNoteStructured` como o ponto de entrada no disco, já que essas são as únicas operações de
  escrita que preservam as garantias do vault (slug seguro, guarda contra path traversal, etc.).
  Depende de decidir: onde a chave de API fica armazenada (nunca no arquivo `.md`), se roda
  local via CLI de terceiros ou via chamada HTTP direta ao provedor, e qual o gatilho (comando
  manual do usuário vs. algo automático). Nenhuma dessas perguntas foi respondida ainda — é só
  uma intenção registrada para não se perder, não um desenho pronto para implementar.

---

## Etapa 3+ (backlog, sem escopo definido)

Candidatos: marketplace de tipos/templates compartilháveis pela comunidade, plugins de terceiros
sobre o `KindRegistry`, temas visuais.

**Banco de dados estilo Notion (levantado 2026-07-12):** múltiplas visualizações de uma mesma
coleção de notas (inline dentro de uma página e/ou página inteira dedicada), à la Notion database.
Arya já tem um pedaço disso — schemas tipados com `views[]` (tabela/kanban, e cronograma a partir
da Fatia 4) — mas um "banco de dados" completo à la Notion também implica filtros/ordenação ad hoc
pela UI (não só a view salva no schema) e, possivelmente, embutir a view dentro do corpo de outra
nota como um bloco (o que já teria uma base pronta nos blocos `arya-view` da Fatia 4). Fica
explicitamente para a Etapa 3 — não tem desenho técnico ainda, só a intenção registrada.

---

## Notas para montar o cronograma no Notion

- Sugestão de propriedades por fatia, se virar um banco de dados no Notion: **Status** (A
  fazer/Em andamento/Concluída), **Responsável**, **Data de início**, **Data de entrega**,
  **Prioridade**, **Depende de** (relação com outra fatia).
- As fatias da Etapa 1 têm dependência majoritariamente sequencial (1→2→3→5), exceto 4 e 6, que só
  dependem da Fatia 1 e podem ser reordenadas ou paralelizadas se necessário.
- Nenhuma data está estimada aqui — não há histórico de velocidade suficiente ainda (só 2 fatias
  concluídas) para projetar prazo com confiança.
