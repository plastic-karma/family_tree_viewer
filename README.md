# Family Tree Viewer

A client-side GEDCOM family tree visualizer built with React, TypeScript, and React Flow.

Upload a `.ged` file and explore your family tree interactively — no backend required.

## Features

- **GEDCOM parsing** — parses individuals, families, and notes (with CONC/CONT support) entirely in the browser
- **Interactive tree** — pan, zoom, and click nodes to view details
- **Detail panel** — shows birth/death, parents, spouses, children, and notes
- **Clickable navigation** — click any name in the detail panel to fly to that person
- **Search** — find individuals by name with search-as-you-type

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
| `npm run test` | Run unit tests (vitest) |
| `npm run preview` | Preview production build |

## Tech Stack

- [React](https://react.dev) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev)
- [React Flow](https://reactflow.dev) for tree visualization
- [Vitest](https://vitest.dev) for testing

## License

MIT
