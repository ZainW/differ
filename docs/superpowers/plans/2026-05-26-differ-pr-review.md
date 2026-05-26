# Differ PR Review Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a terminal-driven Electron app that fetches GitHub/GitLab PRs and renders them with Pierre trees/diffs.

**Architecture:** CLI resolves PR + fetches via provider adapters → session JSON → Electron renderer with `@pierre/trees` sidebar and `@pierre/diffs` patch view.

**Tech Stack:** Electron, React, TypeScript, @pierre/diffs, @pierre/trees, gh/glab auth, vitest

---

## Status: Implemented in initial scaffold

Core tasks completed:
- Shared session types + GitHub/GitLab providers + auth chain
- CLI (`pnpm differ`) with smart PR resolution
- Electron session handoff via IPC
- React UI: header, file tree, diff panel, description panel
- Split/unified toggle with persisted preference
- Design spec at `docs/superpowers/specs/2026-05-26-differ-pr-review-design.md`

## Follow-ups (v2)
- Inline comments and review threads UI
- Worker pool for large PR syntax highlighting
- Markdown rendering for description
- Unit tests for provider normalization with mocked fetch
