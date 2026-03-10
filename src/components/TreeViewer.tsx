import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PersonNode } from "./PersonNode";
import { PERSON_NODE_TYPE } from "../layout";

/**
 * The main tree visualization component.
 *
 * IMPORTANT: nodeTypes must be defined OUTSIDE the component (or memoized).
 * If you define it inline like nodeTypes={{ person: PersonNode }}, React Flow
 * will re-register the node type on every render, causing the entire canvas
 * to re-mount. This is a common gotcha.
 *
 * fitView automatically zooms/pans so all nodes are visible on mount.
 */

const nodeTypes = { [PERSON_NODE_TYPE]: PersonNode };

interface TreeViewerProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: NodeMouseHandler;
  focusNodeId?: string | null;
  focusKey?: number;
}

export function TreeViewer({
  nodes,
  edges,
  onNodeClick,
  focusNodeId,
  focusKey,
}: TreeViewerProps) {
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
        <FocusHandler focusNodeId={focusNodeId} focusKey={focusKey} />
      </ReactFlow>
    </div>
  );
}

/**
 * Inner component that handles "fly to node" behavior.
 *
 * This must be a child of <ReactFlow> because useReactFlow() only works
 * inside the React Flow provider. This is a common React pattern:
 * when a hook requires a specific context, you extract the hook usage
 * into a child component rather than restructuring the parent.
 *
 * We depend on focusKey (a counter) rather than focusNodeId so that
 * navigating back to the same person still triggers the animation.
 */
function FocusHandler({
  focusNodeId,
  focusKey,
}: {
  focusNodeId?: string | null;
  focusKey?: number;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!focusNodeId) return;

    // Small delay to let React Flow process any state updates first.
    // Without this, fitView may run before the node positions are settled.
    const timeout = setTimeout(() => {
      fitView({
        nodes: [{ id: focusNodeId }],
        duration: 500,
        maxZoom: 1,
      });
    }, 50);

    return () => clearTimeout(timeout);
  }, [focusKey, focusNodeId, fitView]);

  return null;
}
