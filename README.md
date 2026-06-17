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
differ                              # auto-detect PR for current branch
differ 42                           # PR number in current repo
differ https://github.com/org/repo/pull/42
differ https://gitlab.com/group/repo/-/merge_requests/42
```

The CLI fetches PR metadata and diff, then opens the Electron review UI.

On macOS, install the `.pkg` release to place `differ` on your shell `PATH`.

## Development

```bash
pnpm dev      # Electron app only (empty state)
pnpm differ   # fetches PR and launches via electron-vite dev when not built
pnpm typecheck
pnpm test
```

## Website

```bash
pnpm site:dev
pnpm build:site
pnpm site:preview
```

The landing page lives in `site/` and builds to `dist/site/`.

## Release builds

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

macOS builds notarize automatically when one supported Apple credential set is present:

- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- `APPLE_KEYCHAIN_PROFILE` with optional `APPLE_KEYCHAIN`

The macOS `.pkg` installer also requires a `Developer ID Installer` signing certificate.

## Visual regression (Playwright)

Playwright serves a dedicated visual harness (`src/renderer/visual.html`) with fixture PR sessions and compares screenshots of the renderer UI.

```bash
pnpm test:visual                 # build harness + run snapshot tests
pnpm test:visual:update          # refresh baseline snapshots
pnpm test:visual:report          # open the HTML report after a run
```

Snapshots live in `tests/visual/review.spec.ts-snapshots/`. Fixtures are in `tests/visual/fixtures/`.

The harness sets `data-visual-test` to force Pierre dark theme and waits for `data-visual-ready` after diffs render.

## Keyboard shortcuts

| Shortcut           | Action                                    |
| ------------------ | ----------------------------------------- |
| `Cmd/Ctrl+\`       | Toggle file tree sidebar                  |
| `Cmd/Ctrl+Shift+D` | Toggle split/unified diff                 |
| `/`                | Focus file tree search (via Pierre trees) |

## Architecture

- `src/cli` — terminal entry, PR resolution, session write, Electron spawn
- `src/shared/providers` — GitHub/GitLab API adapters + auth
- `src/main` — Electron main process, session IPC
- `src/renderer` — React UI with `@pierre/trees` + `@pierre/diffs`

Design spec: `docs/superpowers/specs/2026-05-26-differ-pr-review-design.md`
