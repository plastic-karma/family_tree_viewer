// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { GedcomData } from "../parser/types";
import { SearchBox } from "./SearchBox";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const gedcom: GedcomData = {
  individuals: new Map([
    [
      "@I1@",
      {
        id: "@I1@",
        name: "Alice Archer",
        sex: "F",
        familyAsSpouse: [],
        notes: [],
      },
    ],
    [
      "@I2@",
      {
        id: "@I2@",
        name: "Alan Archer",
        sex: "M",
        familyAsSpouse: [],
        notes: [],
      },
    ],
  ]),
  families: new Map(),
};

describe("SearchBox", () => {
  it("moves through results with arrow keys and selects with Enter", async () => {
    const selectedIds: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <SearchBox
            gedcom={gedcom}
            onSelect={(id) => selectedIds.push(id)}
          />
        );
      });

      const input = container.querySelector("input");
      if (!(input instanceof HTMLInputElement)) {
        throw new Error("Search input did not render");
      }

      input.focus();
      await act(async () => {
        setInputValue(input, "al");
      });

      expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);

      await press(input, "ArrowDown");
      expect(activeOption(input)?.textContent).toBe("Alice Archer");

      await press(input, "ArrowDown");
      expect(activeOption(input)?.textContent).toBe("Alan Archer");

      await press(input, "ArrowUp");
      expect(activeOption(input)?.textContent).toBe("Alice Archer");

      await press(input, "ArrowUp");
      expect(activeOption(input)?.textContent).toBe("Alan Archer");

      await press(input, "Enter");
      expect(selectedIds).toEqual(["@I2@"]);
      expect(input.value).toBe("");
      expect(input.getAttribute("aria-expanded")).toBe("false");
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

async function press(input: HTMLInputElement, key: string) {
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

function activeOption(input: HTMLInputElement) {
  const activeId = input.getAttribute("aria-activedescendant");
  return activeId ? document.getElementById(activeId) : null;
}
