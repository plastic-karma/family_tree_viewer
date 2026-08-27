import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailPanel } from "./DetailPanel";
import type { GedcomData, Individual } from "../parser/types";

describe("DetailPanel", () => {
  it("ignores a family reference that does not contain the individual", () => {
    const selected: Individual = {
      id: "@I1@",
      name: "Selected Person",
      sex: "U",
      familyAsSpouse: ["@F1@"],
      notes: [],
    };
    const data: GedcomData = {
      individuals: new Map([
        [selected.id, selected],
        [
          "@I2@",
          {
            id: "@I2@",
            name: "Unrelated One",
            sex: "U",
            familyAsSpouse: [],
            notes: [],
          },
        ],
        [
          "@I3@",
          {
            id: "@I3@",
            name: "Unrelated Two",
            sex: "U",
            familyAsSpouse: [],
            notes: [],
          },
        ],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            husbandId: "@I2@",
            wifeId: "@I3@",
            childrenIds: [],
          },
        ],
      ]),
    };

    const html = renderToStaticMarkup(
      <DetailPanel
        individual={selected}
        gedcom={data}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).not.toContain("Unrelated One");
    expect(html).not.toContain("Families");
  });

  it("shows marriage places and labels the close control", () => {
    const selected: Individual = {
      id: "@I1@",
      name: "Selected Person",
      sex: "U",
      familyAsSpouse: ["@F1@"],
      notes: [],
    };
    const spouse: Individual = {
      id: "@I2@",
      name: "Spouse Person",
      sex: "U",
      familyAsSpouse: ["@F1@"],
      notes: [],
    };
    const data: GedcomData = {
      individuals: new Map([
        [selected.id, selected],
        [spouse.id, spouse],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            husbandId: selected.id,
            wifeId: spouse.id,
            childrenIds: [],
            marriageDate: "1 JAN 2000",
            marriagePlace: "Paris, France",
          },
        ],
      ]),
    };

    const html = renderToStaticMarkup(
      <DetailPanel
        individual={selected}
        gedcom={data}
        onClose={() => undefined}
        onNavigate={() => undefined}
      />
    );

    expect(html).toContain("Paris, France");
    expect(html).toContain('aria-label="Close details"');
  });
});
