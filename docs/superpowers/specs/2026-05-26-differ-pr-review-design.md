# Differ PR Review Tool — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Summary

Terminal-first PR review app: run `differ` from any git repo to open an Electron window showing GitHub or GitLab pull/merge request metadata and diffs, rendered with `@pierre/trees` and `@pierre/diffs`.

## Requirements

| Area            | Decision                                                                    |
| --------------- | --------------------------------------------------------------------------- |
| Invocation      | Smart resolution: URL → PR number → auto-detect current branch PR           |
| Auth            | CLI auth first (`gh` / `glab`), fallback to `GITHUB_TOKEN` / `GITLAB_TOKEN` |
| PR surface (v1) | Title, description, labels, reviewers, CI checks, file tree, diff           |
| Future (v2)     | Inline comments, review threads, activity timeline (typed stubs in v1)      |
| Platforms       | GitHub + GitLab from day one via provider adapters                          |
| Diff layout     | Split default; toggle unified; persist preference                           |

## Architecture

Split **CLI** (resolve, fetch, spawn) and **Electron app** (display), connected via session JSON file.

```
differ CLI → PR Resolver → Auth Chain → Provider (GitHub|GitLab) → Session JSON → Electron → React UI
```

### Session handoff

CLI writes `/tmp/differ-<uuid>.json`, spawns Electron with `--session=<path>`. Main process reads session, passes to renderer via IPC. Session deleted on quit.

### Provider interface

```typescript
interface PullRequestProvider {
  name: 'github' | 'gitlab'
  resolveAuth(): Promise<string>
  fetchPullRequest(ctx: RepoContext, number: number): Promise<PullRequestSession>
}
```

Normalized `PullRequestSession` includes empty `comments[]` and `timeline[]` for v2.

## UI Layout

Three-region layout:

1. **Header** — PR title, number, state, author, base←head, labels, check summary, reviewer avatars
2. **Sidebar** — `@pierre/trees` file tree with git status badges and search
3. **Main** — `@pierre/diffs` with split/unified toggle; single-file focus on tree selection
4. **Footer panel** — collapsible markdown description

### Emil design principles applied

- No layout shift: fixed sidebar, tabular-nums for stats, color-only selection states
- Touch-first: 44px targets; hover via `@media (hover: hover)`
- Keyboard: `/` search, `j/k` file nav, `Cmd+\` sidebar, `Cmd+Shift+D` layout toggle
- Motion: 150–200ms ease-out; `prefers-reduced-motion` respected
- Theme: system → Pierre Light / Pierre Dark

## Project structure

```
src/
  cli/              # bin entry
  main/             # Electron main
  preload/
  renderer/         # React UI
  shared/
    types/
    providers/      # github, gitlab, auth, resolver
```

## Error handling

- Not a git repo (number/auto): exit 1 with message
- No PR for branch: suggest `differ <url>`
- Auth failure: `gh auth login` / token env hints
- Rate limit: retry-after in terminal + in-app banner

## v1 scope boundary

**In:** invoke modes, dual auth, both platforms, header, tree, diff, description, checks/labels/reviewers  
**Out:** comments UI, posting reviews, multi-PR tabs, local non-PR diff

## Testing

- Unit: resolver, auth chain, provider normalization (mocked HTTP)
- Fixture: session → patch parsing
- Manual smoke on real PRs
