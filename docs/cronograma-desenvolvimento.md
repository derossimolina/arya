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
| Etapa 1 — MVP core | 🟡 Em andamento (3 de 6 fatias concluídas) |
| Etapa 2 — Monetização (Hugo + sync mobile) | ⚪ Não iniciada |
| Etapa 3+ — Marketplace/plugins/temas | ⚪ Não iniciada (backlog, sem escopo definido) |

---

## Etapa 1 — MVP core (grátis, standalone, zero servidor)

| # | Fatia | Status | Depende de |
|---|---|---|---|
| 1 | Arquivos + árvore de cadernos | ✅ Concluída | — |
| 2 | Sistema de tipos/schemas | ✅ Concluída | Fatia 1 |
| 3 | Índice SQLite + views (tabela/kanban) | ✅ Concluída | Fatia 2 |
| 4 | Modo outline/tasks (estilo Logseq) | ⬜ A fazer | Fatia 1 |
| 5 | Grafo de wikilinks + backlinks | ⬜ A fazer | Fatia 3 |
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

### ⬜ Fatia 4 — Modo outline/tasks
Segunda visualização do mesmo arquivo em modo bullet/outline (estilo Logseq), com tasks
(`- [ ]` / `- [x]`) extraídas e navegáveis a partir da AST do markdown.

### ⬜ Fatia 5 — Grafo de wikilinks
Sintaxe `[[nota]]` para linkar notas, backlinks automáticos, visualização de grafo. Depende do
índice (Fatia 3) para consultas eficientes de backlinks.

### ⬜ Fatia 6 — Sync via git
Sync opcional via git puro — o usuário gerencia o próprio repositório remoto, sem infraestrutura
nossa. Menor risco técnico das fatias restantes.

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

---

## Etapa 3+ (backlog, sem escopo definido)

Candidatos: marketplace de tipos/templates compartilháveis pela comunidade, plugins de terceiros
sobre o `KindRegistry`, temas visuais.

---

## Notas para montar o cronograma no Notion

- Sugestão de propriedades por fatia, se virar um banco de dados no Notion: **Status** (A
  fazer/Em andamento/Concluída), **Responsável**, **Data de início**, **Data de entrega**,
  **Prioridade**, **Depende de** (relação com outra fatia).
- As fatias da Etapa 1 têm dependência majoritariamente sequencial (1→2→3→5), exceto 4 e 6, que só
  dependem da Fatia 1 e podem ser reordenadas ou paralelizadas se necessário.
- Nenhuma data está estimada aqui — não há histórico de velocidade suficiente ainda (só 2 fatias
  concluídas) para projetar prazo com confiança.
