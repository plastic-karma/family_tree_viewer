import type { Node, Edge } from "@xyflow/react";
import type { GedcomData } from "./parser/types";
import type { PersonNodeData } from "./components/PersonNode";

export const PERSON_NODE_TYPE = "person";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 80;
const H_GAP = 40; // horizontal gap between nodes
const V_GAP = 120; // vertical gap between generations
const FAMILY_NODE_SIZE = 8; // small junction dot

function assignGenerations(data: GedcomData): Map<string, number> {
  // Spouses belong to the same generation. Collapse them into groups before
  // applying parent-to-child generation constraints.
  const groupParent = new Map<string, string>();
  for (const id of data.individuals.keys()) groupParent.set(id, id);

  const findGroup = (id: string): string => {
    let root = id;
    while (groupParent.get(root) !== root) {
      root = groupParent.get(root)!;
    }

    let current = id;
    while (current !== root) {
      const parent = groupParent.get(current)!;
      groupParent.set(current, root);
      current = parent;
    }
    return root;
  };

  for (const family of data.families.values()) {
    if (
      family.husbandId &&
      family.wifeId &&
      data.individuals.has(family.husbandId) &&
      data.individuals.has(family.wifeId)
    ) {
      const husbandGroup = findGroup(family.husbandId);
      const wifeGroup = findGroup(family.wifeId);
      if (husbandGroup !== wifeGroup) {
        groupParent.set(wifeGroup, husbandGroup);
      }
    }
  }

  const groupByPerson = new Map<string, string>();
  const childrenByGroup = new Map<string, Set<string>>();
  const indegreeByGroup = new Map<string, number>();
  for (const id of data.individuals.keys()) {
    const group = findGroup(id);
    groupByPerson.set(id, group);
    if (!childrenByGroup.has(group)) {
      childrenByGroup.set(group, new Set());
      indegreeByGroup.set(group, 0);
    }
  }

  for (const family of data.families.values()) {
    const parentGroup =
      (family.husbandId && groupByPerson.get(family.husbandId)) ||
      (family.wifeId && groupByPerson.get(family.wifeId));
    if (!parentGroup) continue;

    const childGroups = childrenByGroup.get(parentGroup)!;
    for (const childId of family.childrenIds) {
      const childGroup = groupByPerson.get(childId);
      if (
        !childGroup ||
        childGroup === parentGroup ||
        childGroups.has(childGroup)
      ) {
        continue;
      }

      childGroups.add(childGroup);
      indegreeByGroup.set(
        childGroup,
        (indegreeByGroup.get(childGroup) ?? 0) + 1
      );
    }
  }

  const generationByGroup = new Map<string, number>();
  const pendingGroups = new Set<string>();
  const queue: string[] = [];
  for (const [group, indegree] of indegreeByGroup) {
    generationByGroup.set(group, 0);
    pendingGroups.add(group);
    if (indegree === 0) queue.push(group);
  }

  let head = 0;
  while (pendingGroups.size > 0) {
    if (head === queue.length) {
      // Corrupt GEDCOM files can contain ancestry cycles. Break each cycle at
      // a deterministic insertion-order node rather than looping forever.
      const cycleRoot = pendingGroups.values().next().value;
      if (cycleRoot === undefined) break;
      queue.push(cycleRoot);
    }

    const group = queue[head++];
    if (!pendingGroups.delete(group)) continue;

    const childGeneration = (generationByGroup.get(group) ?? 0) + 1;
    for (const childGroup of childrenByGroup.get(group) ?? []) {
      if (!pendingGroups.has(childGroup)) continue;

      if (childGeneration > (generationByGroup.get(childGroup) ?? 0)) {
        generationByGroup.set(childGroup, childGeneration);
      }

      const remainingIndegree = (indegreeByGroup.get(childGroup) ?? 0) - 1;
      indegreeByGroup.set(childGroup, remainingIndegree);
      if (remainingIndegree === 0) queue.push(childGroup);
    }
  }

  const generationByPerson = new Map<string, number>();
  for (const [id, group] of groupByPerson) {
    generationByPerson.set(id, generationByGroup.get(group) ?? 0);
  }
  return generationByPerson;
}

export function buildFlowElements(data: GedcomData): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const generationMap = assignGenerations(data);

  const generations = new Map<number, string[]>();
  let maxGeneration = 0;
  for (const [id, generation] of generationMap) {
    const ids = generations.get(generation);
    if (ids) {
      ids.push(id);
    } else {
      generations.set(generation, [id]);
    }
    if (generation > maxGeneration) maxGeneration = generation;
  }

  const generationToY = (generation: number) =>
    (maxGeneration - generation) * (NODE_HEIGHT + V_GAP);

  for (const [generation, ids] of generations) {
    const totalWidth = ids.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalWidth / 2;

    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const individual = data.individuals.get(id)!;
      const node: Node<PersonNodeData> = {
        id,
        type: PERSON_NODE_TYPE,
        position: {
          x: startX + index * (NODE_WIDTH + H_GAP),
          y: generationToY(generation),
        },
        data: {
          label: individual.name || "Unknown",
          sex: individual.sex,
          birthDate: individual.birthDate,
          deathDate: individual.deathDate,
        },
      };
      nodes.push(node);
    }
  }

  const nodeById = new Map<string, Node>(nodes.map((node) => [node.id, node]));

  for (const [familyId, family] of data.families) {
    const parentIds: string[] = [];
    if (family.husbandId && nodeById.has(family.husbandId)) {
      parentIds.push(family.husbandId);
    }
    if (
      family.wifeId &&
      family.wifeId !== family.husbandId &&
      nodeById.has(family.wifeId)
    ) {
      parentIds.push(family.wifeId);
    }
    if (parentIds.length === 0) continue;

    let parentX = 0;
    for (const parentId of parentIds) {
      parentX += nodeById.get(parentId)!.position.x;
    }

    const junctionId = `family:${familyId}`;
    const parentGeneration = generationMap.get(parentIds[0]) ?? 0;
    const junctionNode: Node = {
      id: junctionId,
      type: "default",
      position: {
        x: parentX / parentIds.length + NODE_WIDTH / 2 - FAMILY_NODE_SIZE / 2,
        y: generationToY(parentGeneration) + NODE_HEIGHT + 20,
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

    const linkedChildren = new Set<string>();
    for (const childId of family.childrenIds) {
      if (!nodeById.has(childId) || linkedChildren.has(childId)) continue;
      linkedChildren.add(childId);
      edges.push({
        id: `child:${familyId}:${childId}`,
        source: childId,
        target: junctionId,
        type: "smoothstep",
      });
    }

    for (const parentId of parentIds) {
      edges.push({
        id: `parent:${familyId}:${parentId}`,
        source: junctionId,
        target: parentId,
        type: "smoothstep",
      });
    }
  }

  return { nodes, edges };
}
