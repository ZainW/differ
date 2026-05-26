# differ

Review GitHub and GitLab pull requests from your terminal.

## Setup

```bash
pnpm install
pnpm approve-builds   # allow electron/esbuild native builds if prompted
pnpm build          # production build (optional for dev)
```

Authenticate with your forge:

```bash
gh auth login       # GitHub
glab auth login     # GitLab
```

Or set `GITHUB_TOKEN` / `GITLAB_TOKEN` in your environment.

## Usage

```bash
pnpm differ                              # auto-detect PR for current branch
pnpm differ 42                           # PR number in current repo
pnpm differ https://github.com/org/repo/pull/42
pnpm differ https://gitlab.com/group/repo/-/merge_requests/42
```

The CLI fetches PR metadata and diff, then opens the Electron review UI.

## Development

```bash
pnpm dev      # Electron app only (empty state)
pnpm differ   # fetches PR and launches via electron-vite dev when not built
pnpm typecheck
pnpm test
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+\` | Toggle file tree sidebar |
| `Cmd/Ctrl+Shift+D` | Toggle split/unified diff |
| `/` | Focus file tree search (via Pierre trees) |

## Architecture

- `src/cli` — terminal entry, PR resolution, session write, Electron spawn
- `src/shared/providers` — GitHub/GitLab API adapters + auth
- `src/main` — Electron main process, session IPC
- `src/renderer` — React UI with `@pierre/trees` + `@pierre/diffs`

Design spec: `docs/superpowers/specs/2026-05-26-differ-pr-review-design.md`
