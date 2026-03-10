import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

/**
 * Custom React Flow node for displaying a person.
 *
 * React Flow lets you define custom node types — this is one of its biggest
 * strengths over plain SVG. Each node is a regular React component, so you
 * get the full power of React (state, effects, event handlers) inside each node.
 *
 * Handles are the connection points where edges attach. We need:
 * - Top handle: connects UP to the family where this person is a child
 * - Bottom handle: connects DOWN to families where this person is a spouse/parent
 */

export type PersonNodeData = {
  label: string;
  sex: "M" | "F" | "U";
  birthDate?: string;
  deathDate?: string;
};

export type PersonNodeType = Node<PersonNodeData, "person">;

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const borderColor =
    data.sex === "M" ? "#4a90d9" : data.sex === "F" ? "#d94a8a" : "#888";

  const dates = [data.birthDate, data.deathDate].filter(Boolean).join(" – ");

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 6,
        border: `2px solid ${borderColor}`,
        background: "#fff",
        minWidth: 140,
        textAlign: "center",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600 }}>{data.label}</div>
      {dates && (
        <div style={{ color: "#666", marginTop: 2, fontSize: 10 }}>{dates}</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
