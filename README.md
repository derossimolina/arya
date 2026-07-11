# Arya

Aplicação de notas desktop, offline-first, que combina ideias do **Evernote** (cadernos),
**AnyType** (tipos de objeto customizáveis, definidos 100% por dados YAML, não código),
**Obsidian** (markdown + frontmatter em disco como única fonte da verdade) e **Logseq**
(modo outline/tasks, ainda não implementado).

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
