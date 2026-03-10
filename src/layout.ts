import type { Node, Edge } from "@xyflow/react";
import type { GedcomData } from "./parser/types";
import type { PersonNodeData } from "./components/PersonNode";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const H_GAP = 40; // horizontal gap between nodes
const V_GAP = 120; // vertical gap between generations
const FAMILY_NODE_SIZE = 8; // small junction dot

/**
 * Convert parsed GEDCOM data into React Flow nodes and edges.
 *
 * Layout strategy:
 * 1. Find "root" individuals (those with no parent family) — they're the top generation.
 * 2. BFS downward through families to assign each person a generation number.
 * 3. Place family junction nodes between parent and child generations.
 * 4. Space nodes horizontally within each generation.
 *
 * This is a simplified layout. A production genealogy app would use a proper
 * tree layout algorithm (like Buchheim's), but this gets us something visual quickly.
 */
export function buildFlowElements(data: GedcomData): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Step 1: Assign generations via BFS.
  // We start from individuals who have no familyAsChild (roots of the tree),
  // then walk down through families to assign increasing generation numbers.
  const generationMap = new Map<string, number>(); // individual ID → generation

  // Find roots: people who aren't children in any family
  const roots: string[] = [];
  for (const [id, indi] of data.individuals) {
    if (!indi.familyAsChild) {
      roots.push(id);
    }
  }

  // BFS to assign generations
  const queue: { id: string; gen: number }[] = roots.map((id) => ({
    id,
    gen: 0,
  }));
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;

    // If already visited at same or earlier generation, skip.
    // If visited at a later generation, update (can happen when spouses
    // are from different generations — we take the maximum).
    if (generationMap.has(id) && generationMap.get(id)! >= gen) continue;
    generationMap.set(id, gen);

    const indi = data.individuals.get(id);
    if (!indi) continue;

    // Walk through families where this person is a parent
    for (const famId of indi.familyAsSpouse) {
      const fam = data.families.get(famId);
      if (!fam) continue;

      // Ensure spouse is at the same generation
      const spouseId =
        fam.husbandId === id ? fam.wifeId : fam.husbandId;
      if (spouseId) {
        queue.push({ id: spouseId, gen });
      }

      // Children are one generation below
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

  // Find the maximum generation so we can flip the Y axis:
  // latest generation (highest number) goes at the top (y=0),
  // oldest ancestors go at the bottom.
  const maxGen = Math.max(...generationMap.values(), 0);

  // Step 3: Create person nodes with positions
  for (const [gen, ids] of generations) {
    const totalWidth = ids.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalWidth / 2;

    ids.forEach((id, i) => {
      const indi = data.individuals.get(id)!;
      const flippedGen = maxGen - gen;
      const node: Node<PersonNodeData> = {
        id,
        type: "person",
        position: {
          x: startX + i * (NODE_WIDTH + H_GAP),
          y: flippedGen * (NODE_HEIGHT + V_GAP),
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

  // Step 4: Create family junction nodes and edges
  for (const [famId, fam] of data.families) {
    // Determine the generation of the parents for vertical placement
    const parentIds = [fam.husbandId, fam.wifeId].filter(Boolean) as string[];
    if (parentIds.length === 0) continue;

    const parentGen = Math.max(
      ...parentIds.map((id) => generationMap.get(id) ?? 0)
    );
    const flippedParentGen = maxGen - parentGen;

    // Position the junction node between parent and child generations,
    // horizontally centered between the parents.
    const parentNodes = parentIds
      .map((id) => nodes.find((n) => n.id === id))
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
        y: flippedParentGen * (NODE_HEIGHT + V_GAP) + NODE_HEIGHT + 20,
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
    // Children (top) → family junction → parents (bottom).
    for (const childId of fam.childrenIds) {
      edges.push({
        id: `${childId}-${famId}`,
        source: childId,
        target: famId,
        type: "smoothstep",
      });
    }

    // Family junction → parents
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
