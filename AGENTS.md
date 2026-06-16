# Differ

Electron + React 19 app for reviewing GitHub/GitLab PRs from the terminal.

## Quick commands

| Command                   | What                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm dev`                | Electron-only dev (empty state, no PR)                                                          |
| `pnpm differ`             | Fetches a PR and launches via `electron-vite dev`                                               |
| `pnpm typecheck`          | Runs `tsgo --noEmit` for both `tsconfig.node.json` and `tsconfig.web.json` (TypeScript Go port) |
| `pnpm test`               | Unit tests via vitest                                                                           |
| `pnpm test:visual`        | Builds visual harness + runs Playwright snapshot tests                                          |
| `pnpm test:visual:update` | Refresh baseline snapshots                                                                      |
| `pnpm lint`               | Oxlint with type-aware linting                                                                  |
| `pnpm lint:fix`           | Oxlint with auto-fix                                                                            |
| `pnpm format`             | Oxfmt write                                                                                     |
| `pnpm format:check`       | Oxfmt check (CI)                                                                                |
| `pnpm build`              | `typecheck -> electron-vite build -> esbuild CLI`                                               |

## Code style & config

- Oxfmt: `.oxfmtrc.json` — `singleQuote`, `noSemi`, `printWidth 100`, `trailingComma: none`
- EditorConfig: 2-space indent, LF, final newline, trim trailing whitespace
- Oxlint: `.oxlintrc.json` — TypeScript + React + Unicorn plugins, type-aware linting (via tsgolint)
- No comments in code (existing convention)

## Architecture

- `src/cli/index.ts` — Node entrypoint. Parses args with `commander`, resolves PR ref, fetches session from GitHub/GitLab API, writes JSON to `~/.cache/differ/sessions/`, spawns Electron.
- `src/main/index.ts` — Electron main process. Reads session from `--session=` CLI arg or `DIFFER_SESSION` env var, sends it to renderer via IPC. Auto-deletes session JSON on quit (unless `DIFFER_KEEP_SESSION=1` or `DIFFER_VISUAL_TEST=1`).
- `src/preload/index.ts` — Preload bridge.
- `src/renderer/src/` — React UI. Uses `@pierre/diffs` and `@pierre/trees` (both need `optimizeDeps.include` in vite config).
- `src/shared/` — Types, session I/O, Git helpers, provider fetch/resolver/auth. Both Node and renderer code import from here.

## Path aliases (renderer only)

```
@renderer -> src/renderer/src
@shared   -> src/shared
```

## Build quirks

- The CLI is a plain esbuild bundle (`src/cli/index.ts -> out/cli/index.js`), **not** part of the electron-vite build. Must run `pnpm build:cli` separately.
- `scripts/run-differ.mjs` auto-builds the CLI if `out/cli/index.js` is missing, so `pnpm differ` works without a prior build.
- `pnpm build` runs `typecheck -> electron-vite build -> build:cli` sequentially.
- Visual test harness uses a **separate** Vite config (`vite.visual.config.ts`) that builds `src/renderer/visual.html -> out/visual/`.
- Visual test Playwright server runs `vite preview` of that harness (not the Electron app).
- `shamefullyHoist: true` in `pnpm-workspace.yaml`.
- `postinstall` runs `electron-builder install-app-deps` for development installs and skips production-only installs.

## Typecheck split

- `tsconfig.node.json` covers: main, preload, shared, cli, electron.vite.config, playwright.config.
- `tsconfig.web.json` covers: renderer, preload types, shared types, visual test fixtures.
- Root `tsconfig.json` is just a project reference bridge.

## Testing

- **Unit**: `tests/resolver.test.ts` — vitest, `pnpm test`.
- **Visual**: `tests/visual/review.spec.ts` — Playwright with `toHaveScreenshot`. Snapshots live in `review.spec.ts-snapshots/`. Fixtures in `tests/visual/fixtures/`. Single worker, `CI` enables 1 retry.
- Visual tests set `document.documentElement.dataset.visualTest` (forces Pierre dark theme) and wait for `data-visual-ready` before capturing.

## Auth

- GitHub: `gh auth token` → `GITHUB_TOKEN` env var → error with hints.
- GitLab: `glab auth status` + `glab config get token` → `GITLAB_TOKEN` or `GLAB_TOKEN` env var → error.
- No OAuth app flow; CLI tools or env vars only.

## Keyboard shortcuts

| Shortcut     | Action                   |
| ------------ | ------------------------ |
| `Cmd/Ctrl+\` | Toggle file tree sidebar |
| (future)     | Split/unified toggle     |
