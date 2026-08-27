// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetailPanel } from "./DetailPanel";
import type { GedcomData, Individual } from "../parser/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
        onUpdate={() => undefined}
        onAddSibling={() => true}
        onRemoveSibling={() => undefined}
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
        onUpdate={() => undefined}
        onAddSibling={() => true}
        onRemoveSibling={() => undefined}
      />
    );

    expect(html).toContain("Paris, France");
    expect(html).toContain('aria-label="Close details"');
  });

  it("submits updated name and birth date values", async () => {
    const selected: Individual = {
      id: "@I1@",
      name: "Selected Person",
      sex: "U",
      birthDate: "1 JAN 1900",
      familyAsSpouse: [],
      notes: [],
    };
    const data: GedcomData = {
      individuals: new Map([[selected.id, selected]]),
      families: new Map(),
    };
    const updates: Array<{
      personId: string;
      values: Pick<Individual, "name" | "birthDate">;
    }> = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <DetailPanel
            individual={selected}
            gedcom={data}
            onClose={() => undefined}
            onNavigate={() => undefined}
            onUpdate={(personId, values) =>
              updates.push({ personId, values })
            }
            onAddSibling={() => true}
            onRemoveSibling={() => undefined}
          />
        );
      });

      await clickButton(container, "Edit");
      const nameInput = container.querySelector('input[name="name"]');
      const birthDateInput = container.querySelector(
        'input[name="birthDate"]'
      );
      if (
        !(nameInput instanceof HTMLInputElement) ||
        !(birthDateInput instanceof HTMLInputElement)
      ) {
        throw new Error("Edit fields did not render");
      }

      await act(async () => {
        setInputValue(nameInput, " Updated Person ");
        setInputValue(birthDateInput, "");
      });
      await clickButton(container, "Save");

      expect(updates).toEqual([
        {
          personId: "@I1@",
          values: { name: "Updated Person", birthDate: undefined },
        },
      ]);
      expect(container.textContent).toContain("Selected Person");
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });

  it("searches existing people for sibling additions and removes links", async () => {
    const selected: Individual = {
      id: "@I1@",
      name: "Selected Person",
      sex: "U",
      familyAsSpouse: [],
      familyAsChild: "@F1@",
      notes: [],
    };
    const sibling: Individual = {
      id: "@I2@",
      name: "Existing Sibling",
      sex: "U",
      familyAsSpouse: [],
      familyAsChild: "@F1@",
      notes: [],
    };
    const candidate: Individual = {
      id: "@I3@",
      name: "Available Person",
      sex: "U",
      familyAsSpouse: [],
      notes: [],
    };
    const data: GedcomData = {
      individuals: new Map([
        [selected.id, selected],
        [sibling.id, sibling],
        [candidate.id, candidate],
      ]),
      families: new Map([
        [
          "@F1@",
          {
            id: "@F1@",
            childrenIds: [selected.id, sibling.id],
          },
        ],
      ]),
    };
    const additions: Array<{ personId: string; siblingId: string }> = [];
    const removals: Array<{ personId: string; siblingId: string }> = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <DetailPanel
            individual={selected}
            gedcom={data}
            onClose={() => undefined}
            onNavigate={() => undefined}
            onUpdate={() => undefined}
            onAddSibling={(personId, siblingId) => {
              additions.push({ personId, siblingId });
              return true;
            }}
            onRemoveSibling={(personId, siblingId) =>
              removals.push({ personId, siblingId })
            }
          />
        );
      });

      await clickButton(container, "Add sibling");
      const dialog = container.querySelector('[role="dialog"]');
      const searchInput = container.querySelector(
        'input[name="siblingSearch"]'
      );
      if (
        !(dialog instanceof HTMLElement) ||
        !(searchInput instanceof HTMLInputElement)
      ) {
        throw new Error("Sibling search dialog did not render");
      }
      expect(dialog.textContent).toContain("Add existing sibling");
      expect(container.querySelector('input[name="siblingName"]')).toBeNull();

      await act(async () => setInputValue(searchInput, "Available"));
      await clickButton(dialog, "Available Person");
      await clickButton(container, "Remove");

      expect(additions).toEqual([
        { personId: "@I1@", siblingId: "@I3@" },
      ]);
      expect(removals).toEqual([
        { personId: "@I1@", siblingId: "@I2@" },
      ]);
    } finally {
      await act(async () => root.unmount());
      container.remove();
    }
  });
});

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  if (!valueSetter) throw new Error("Input value setter is unavailable");

  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!button) throw new Error(`Could not find "${label}" button`);

  await act(async () => button.click());
}
