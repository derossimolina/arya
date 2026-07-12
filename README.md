# Arya

Aplicação de notas desktop, offline-first, que combina ideias do **Evernote** (cadernos),
**AnyType** (tipos de objeto customizáveis, definidos 100% por dados YAML, não código),
**Obsidian** (markdown + frontmatter em disco como única fonte da verdade, wikilinks) e um
editor de blocos estilo **Notion** (menu "/" para tabela, criação de página, etc. — substituiu o
plano original de modo outline "estilo Logseq").

## Destaques

- **Busca global** (`Ctrl+K`) — full-text sobre título e corpo de toda nota, via FTS5.
- **Editor de blocos com menu "/"** (BlockNote) — tabela, criação de página inline, e mais itens
  chegando (kanban/cronograma/tarefa embutidos).
- **Wikilinks** (`[[título]]`) com autocomplete ao digitar `[[`, funcionando em qualquer lugar do
  texto (nível de nota; transclusão em nível de bloco ainda não existe).
- **Tipos de objeto 100% definidos por dados** (YAML em `_schemas/`, nunca hardcoded) — tabela e
  kanban por tipo, herança entre tipos, editor de propriedades gerado automaticamente.
- Visual baseado no "Sheepdog Design System" (importado via Claude Design) com uma camada de
  layout inspirada no Notion por cima — sem emoji na UI, ícones SVG desenhados à mão.

Stack: [Wails v2](https://wails.io) (Go + React/TypeScript), sem backend/servidor na Etapa 1.
Detalhes de arquitetura e decisões de produto em [CLAUDE.md](CLAUDE.md); status das entregas em
[docs/cronograma-desenvolvimento.md](docs/cronograma-desenvolvimento.md).

## Desenvolvimento

- `wails dev` — modo dev com hot reload (Go + Vite); também expõe um dev server em
  `http://localhost:34115` para chamar os métodos Go bindados a partir do devtools do navegador.
- `wails build` — gera o binário de produção em `build/bin/`.
- `wails generate module` — regenera só os bindings TS depois de mudar a assinatura de um
  método bindado, sem rodar o app inteiro.
- `go test ./...` — suíte de testes do backend.

Ambiente esperado: Windows 10+, Go e Node.js instalados, WebView2 Runtime (geralmente
pré-instalado). CLI do Wails: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`.
