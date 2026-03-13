# Family Tree Viewer

A client-side GEDCOM family tree visualizer built with React, TypeScript, and React Flow.

Upload a `.ged` file and explore your family tree interactively — no backend required.

## Features

- **GEDCOM parsing** — parses individuals, families, and notes (with CONC/CONT support) entirely in the browser
- **Interactive tree** — pan, zoom, and click nodes to view details
- **Detail panel** — shows birth/death, parents, siblings, spouses, children, and notes
- **Clickable navigation** — click any name in the detail panel to fly to that person
- **Search** — find individuals by name with search-as-you-type
- **Drag-and-drop upload** — drop a `.ged` file onto the page or use the file picker

## Getting Started

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` and drop in a `.ged` file.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
├── components/
│   ├── DetailPanel.tsx     # Right sidebar showing selected person's details
│   ├── FileUpload.tsx      # Drag-and-drop GEDCOM file upload
│   ├── PersonNode.tsx      # Custom React Flow node (color-coded by sex)
│   ├── SearchBox.tsx       # Search-as-you-type with dropdown results
│   └── TreeViewer.tsx      # React Flow canvas with focus/zoom animation
├── parser/
│   ├── gedcom.ts           # GEDCOM file parser (two-pass, handles notes)
│   ├── gedcom.test.ts      # Parser test suite (27 cases)
│   └── types.ts            # TypeScript interfaces (Individual, Family, GedcomData)
├── App.tsx                 # Main app component and state management
├── layout.ts               # BFS-based tree layout algorithm
├── main.tsx                # React entry point
└── index.css               # Global styles
```

## Architecture

### Parser (`src/parser/`)

A two-pass state machine that processes GEDCOM line-by-line:

1. **Pass 1** — parses hierarchical records (INDI, FAM, NOTE) tracking context via level numbers
2. **Pass 2** — resolves note references, since NOTE definitions can appear after the individuals that reference them

### Layout (`src/layout.ts`)

Converts parsed GEDCOM data into React Flow nodes and edges:

- Assigns generations via BFS starting from root individuals (those with no parents)
- Positions nodes on a grid with family junction nodes connecting parents to children
- Uses `smoothstep` edges for curved connector lines

### Components (`src/components/`)

- **PersonNode** — colored border by sex (blue/pink/gray), shows name and dates
- **TreeViewer** — wraps React Flow with a `FocusHandler` that animates to selected nodes
- **DetailPanel** — displays all known info for the selected person with clickable navigation
- **SearchBox** — case-insensitive substring search, shows up to 10 results

## Tech Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev)
- [React Flow](https://reactflow.dev) (`@xyflow/react`) for tree visualization
- [Vitest](https://vitest.dev) for testing
- [ESLint 9](https://eslint.org) with flat config

## License

MIT
