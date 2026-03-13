# CLAUDE.md

Project context for Claude Code.

## Overview

Family Tree Viewer — a client-side GEDCOM visualizer. React + TypeScript + Vite. No backend.

## Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Type-check (tsc -b) then Vite build
npm run lint      # ESLint (flat config)
npm run test      # Vitest (runs in watch mode; use `npx vitest run` for single run)
```

## Project Layout

- `src/parser/` — GEDCOM parser and types. Two-pass: parse records, then resolve note refs.
- `src/layout.ts` — BFS tree layout converting parsed data into React Flow nodes/edges.
- `src/components/` — React components (TreeViewer, DetailPanel, SearchBox, FileUpload, PersonNode).
- `src/App.tsx` — Root component, manages state (gedcom data, selected person, focus key).

## Key Patterns

- Data structures use `Map<string, Individual>` and `Map<string, Family>` for O(1) lookups by ID.
- The GEDCOM parser is a line-by-line state machine tracking context via level numbers and `level1Tag`.
- Layout uses BFS from root individuals (no `familyAsChild`) to assign generations, then positions nodes on a grid.
- `TreeViewer` uses a `FocusHandler` inner component that calls `fitView()` to animate to selected nodes.
- All navigation between people flows through `App.tsx` via `onSelect` callbacks.

## Types

Core types are in `src/parser/types.ts`:
- `Individual` — id, name, sex ("M"/"F"/"U"), birth/death events, family refs, notes
- `Family` — id, husbandId, wifeId, childrenIds, marriage event
- `GedcomData` — `{ individuals: Map<string, Individual>, families: Map<string, Family> }`

## Testing

Tests live next to source: `src/parser/gedcom.test.ts` (27 test cases covering the parser).
Run with `npm test` or `npx vitest run` for a single pass.

## Style / Conventions

- Strict TypeScript (`noUnusedLocals`, `noUnusedParameters`).
- ESLint 9 flat config with `react-hooks` and `react-refresh` plugins.
- React 19 with automatic JSX runtime (no `import React` needed).
- Functional components only, hooks for state management (`useState`, `useMemo`, `useCallback`).
