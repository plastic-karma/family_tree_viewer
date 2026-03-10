import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PersonNode } from "./PersonNode";

/**
 * The main tree visualization component.
 *
 * React Flow requires:
 * 1. A container with explicit dimensions (we use 100vh here)
 * 2. The @xyflow/react/dist/style.css import for default styling
 * 3. Node types registered via the nodeTypes prop
 *
 * IMPORTANT: nodeTypes must be defined OUTSIDE the component (or memoized).
 * If you define it inline like nodeTypes={{ person: PersonNode }}, React Flow
 * will re-register the node type on every render, causing the entire canvas
 * to re-mount. This is a common gotcha — it's documented but easy to miss.
 *
 * fitView automatically zooms/pans so all nodes are visible on mount.
 */

// Defined outside component to maintain referential stability
const nodeTypes = { person: PersonNode };

interface TreeViewerProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: NodeMouseHandler;
}

export function TreeViewer({ nodes, edges, onNodeClick }: TreeViewerProps) {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.01}
        maxZoom={2}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
