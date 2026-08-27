import { describe, expect, it } from "vitest";
import { buildFlowElements, PERSON_NODE_TYPE } from "./layout";
import type { GedcomData, Individual } from "./parser/types";

function makeIndividual(
  id: string,
  overrides: Partial<Individual> = {}
): Individual {
  return {
    id,
    name: id,
    sex: "U",
    familyAsSpouse: [],
    notes: [],
    ...overrides,
  };
}

describe("buildFlowElements", () => {
  it("only emits unique edges whose endpoints exist", () => {
    const data: GedcomData = {
      individuals: new Map([
        ["@I1@", makeIndividual("@I1@")],
        ["@I2@", makeIndividual("@I2@")],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            husbandId: "@I1@",
            wifeId: "@MISSING_PARENT@",
            childrenIds: ["@I2@", "@I2@", "@MISSING_CHILD@"],
          },
        ],
      ]),
    };

    const { nodes, edges } = buildFlowElements(data);
    const nodeIds = new Set(nodes.map((node) => node.id));

    expect(
      edges.filter(
        (edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target)
      )
    ).toEqual([]);
    expect(new Set(edges.map((edge) => edge.id)).size).toBe(edges.length);
  });

  it("derives generations from family records without reciprocal links", () => {
    const data: GedcomData = {
      individuals: new Map([
        ["@I1@", makeIndividual("@I1@")],
        ["@I2@", makeIndividual("@I2@")],
        ["@I3@", makeIndividual("@I3@")],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            husbandId: "@I1@",
            wifeId: "@I2@",
            childrenIds: ["@I3@"],
          },
        ],
      ]),
    };

    const personNodes = new Map(
      buildFlowElements(data)
        .nodes.filter((node) => node.type === PERSON_NODE_TYPE)
        .map((node) => [node.id, node])
    );
    const firstParent = personNodes.get("@I1@")!;
    const secondParent = personNodes.get("@I2@")!;
    const child = personNodes.get("@I3@")!;

    expect(firstParent.position.y).toBe(secondParent.position.y);
    expect(child.position.y).toBeLessThan(firstParent.position.y);
  });

  it("terminates when ancestry records contain a cycle", () => {
    const data: GedcomData = {
      individuals: new Map([
        [
          "@I1@",
          makeIndividual("@I1@", { familyAsSpouse: ["@F1@"] }),
        ],
        [
          "@I2@",
          makeIndividual("@I2@", {
            familyAsSpouse: ["@F2@"],
            familyAsChild: "@F1@",
          }),
        ],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            husbandId: "@I1@",
            childrenIds: ["@I2@"],
          },
        ],
        [
          "@F2@",
          {
            id: "@F2@",
            husbandId: "@I2@",
            childrenIds: ["@I1@"],
          },
        ],
      ]),
    };

    const { nodes, edges } = buildFlowElements(data);

    expect(nodes.filter((node) => node.type === PERSON_NODE_TYPE)).toHaveLength(2);
    expect(
      nodes.every(
        (node) =>
          Number.isFinite(node.position.x) && Number.isFinite(node.position.y)
      )
    ).toBe(true);
    expect(edges).toHaveLength(4);
  });
});
