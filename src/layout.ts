import type { Node, Edge } from "@xyflow/react";
import type { GedcomData } from "./parser/types";
import type { PersonNodeData } from "./components/PersonNode";

export const PERSON_NODE_TYPE = "person";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const H_GAP = 40; // horizontal gap between nodes
const V_GAP = 120; // vertical gap between generations
const FAMILY_NODE_SIZE = 8; // small junction dot

export function buildFlowElements(data: GedcomData): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Step 1: Assign generations via BFS.
  const generationMap = new Map<string, number>();

  const roots: string[] = [];
  for (const [id, indi] of data.individuals) {
    if (!indi.familyAsChild) {
      roots.push(id);
    }
  }

  // BFS using an index pointer instead of Array.shift().
  // shift() is O(n) because it re-indexes every element; an index pointer is O(1).
  const queue: { id: string; gen: number }[] = roots.map((id) => ({
    id,
    gen: 0,
  }));
  let head = 0;
  while (head < queue.length) {
    const { id, gen } = queue[head++];

    if (generationMap.has(id) && generationMap.get(id)! >= gen) continue;
    generationMap.set(id, gen);

    const indi = data.individuals.get(id);
    if (!indi) continue;

    for (const famId of indi.familyAsSpouse) {
      const fam = data.families.get(famId);
      if (!fam) continue;

      const spouseId =
        fam.husbandId === id ? fam.wifeId : fam.husbandId;
      if (spouseId) {
        queue.push({ id: spouseId, gen });
      }

      for (const childId of fam.childrenIds) {
        queue.push({ id: childId, gen: gen + 1 });
      }
    }
  }

  // Handle anyone not reached by BFS (disconnected tree fragments)
  for (const [id] of data.individuals) {
    if (!generationMap.has(id)) {
      generationMap.set(id, 0);
    }
  }

  // Step 2: Group individuals by generation for horizontal positioning
  const generations = new Map<number, string[]>();
  for (const [id, gen] of generationMap) {
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(id);
  }

  // Flip the Y axis: latest generation at the top, oldest at the bottom.
  const maxGen = Math.max(...generationMap.values(), 0);
  const genToY = (gen: number) => (maxGen - gen) * (NODE_HEIGHT + V_GAP);

  // Step 3: Create person nodes with positions
  for (const [gen, ids] of generations) {
    const totalWidth = ids.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalWidth / 2;

    ids.forEach((id, i) => {
      const indi = data.individuals.get(id)!;
      const node: Node<PersonNodeData> = {
        id,
        type: PERSON_NODE_TYPE,
        position: {
          x: startX + i * (NODE_WIDTH + H_GAP),
          y: genToY(gen),
        },
        data: {
          label: indi.name || "Unknown",
          sex: indi.sex,
          birthDate: indi.birthDate,
          deathDate: indi.deathDate,
        },
      };
      nodes.push(node);
    });
  }

  // Build a lookup map for O(1) node access by ID.
  // Without this, finding parent nodes for junction positioning would be
  // O(nodes * families) — a linear scan per parent per family.
  const nodeById = new Map<string, Node>(nodes.map((n) => [n.id, n]));

  // Step 4: Create family junction nodes and edges
  for (const [famId, fam] of data.families) {
    const parentIds = [fam.husbandId, fam.wifeId].filter(Boolean) as string[];
    if (parentIds.length === 0) continue;

    const parentGen = Math.max(
      ...parentIds.map((id) => generationMap.get(id) ?? 0)
    );

    const parentNodes = parentIds
      .map((id) => nodeById.get(id))
      .filter(Boolean);
    const avgX =
      parentNodes.length > 0
        ? parentNodes.reduce((sum, n) => sum + n!.position.x, 0) /
          parentNodes.length
        : 0;

    const junctionNode: Node = {
      id: famId,
      type: "default",
      position: {
        x: avgX + NODE_WIDTH / 2 - FAMILY_NODE_SIZE / 2,
        y: genToY(parentGen) + NODE_HEIGHT + 20,
      },
      data: { label: "" },
      style: {
        width: FAMILY_NODE_SIZE,
        height: FAMILY_NODE_SIZE,
        borderRadius: "50%",
        backgroundColor: "#666",
        border: "none",
        padding: 0,
        minWidth: 0,
        minHeight: 0,
      },
    };
    nodes.push(junctionNode);

    // Edges flow top→bottom visually (youngest→oldest).
    for (const childId of fam.childrenIds) {
      edges.push({
        id: `${childId}-${famId}`,
        source: childId,
        target: famId,
        type: "smoothstep",
      });
    }

    for (const parentId of parentIds) {
      edges.push({
        id: `${famId}-${parentId}`,
        source: famId,
        target: parentId,
        type: "smoothstep",
      });
    }
  }

  return { nodes, edges };
}
