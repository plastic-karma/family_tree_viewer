// @vitest-environment happy-dom

import { act, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/TreeViewer", () => ({
  TreeViewer: ({
    nodes,
    onNodeClick,
  }: {
    nodes: Array<{
      id: string;
      type?: string;
      data: { label?: unknown };
    }>;
    onNodeClick?: (
      event: ReactMouseEvent<Element>,
      node: { id: string; type?: string }
    ) => void;
  }) => (
    <div data-testid="tree">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {String(node.data.label ?? "")}
        </button>
      ))}
    </div>
  ),
}));

import App from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("App editing and relationship changes", () => {
  it("updates fields and sibling relationships in the graph and export", async () => {
    const source = `0 HEAD
1 SOUR ExistingApp
0 @I1@ INDI
1 NAME John /Doe/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
1 _CUSTOM keep me
0 @I2@ INDI
1 NAME Existing /Candidate/
1 SEX F
1 _CUSTOM keep candidate data
0 TRLR`;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let exportedBlob: Blob | undefined;
    let exportedName: string | undefined;
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    const originalFileReader = globalThis.FileReader;
    class ImmediateFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;

      readAsText() {
        this.onload?.({ target: { result: source } });
      }
    }

    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: ImmediateFileReader,
    });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        exportedBlob = blob;
        return "blob:gedcom-export";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    HTMLAnchorElement.prototype.click = function () {
      exportedName = this.download;
    };

    try {
      await act(async () => root.render(<App />));
      const fileInput = container.querySelector('input[type="file"]');
      if (!(fileInput instanceof HTMLInputElement)) {
        throw new Error("File input did not render");
      }

      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [new File([source], "relatives.ged", { type: "text/plain" })],
      });
      await act(async () => {
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await vi.waitFor(() => {
          if (!container.querySelector('[data-testid="tree"]')) {
            throw new Error("Tree has not rendered yet");
          }
        });
      });

      const tree = container.querySelector('[data-testid="tree"]');
      if (!(tree instanceof HTMLElement)) {
        throw new Error("Tree did not render after upload");
      }
      await clickButton(tree, "John Doe");
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
        setInputValue(nameInput, "Jane Doe");
        setInputValue(birthDateInput, "2 FEB 2001");
      });
      await clickButton(container, "Save");

      expect(container.textContent).toContain("Jane Doe");
      expect(container.textContent).toContain("2 FEB 2001");
      expect(tree.textContent).toContain("John Doe");
      expect(tree.textContent).not.toContain("Jane Doe");

      await clickButton(container, "Export GED");
      expect(exportedName).toBe("relatives-updated.ged");
      expect(exportedBlob).toBeDefined();
      const exportedText = await exportedBlob?.text();
      expect(exportedText).toContain("1 NAME Jane Doe");
      expect(exportedText).toContain("2 DATE 2 FEB 2001");
      expect(exportedText).toContain("1 _CUSTOM keep me");

      await clickButton(container, "Add sibling");
      const siblingSearchInput = container.querySelector(
        'input[name="siblingSearch"]'
      );
      const siblingDialog = container.querySelector('[role="dialog"]');
      if (
        !(siblingSearchInput instanceof HTMLInputElement) ||
        !(siblingDialog instanceof HTMLElement)
      ) {
        throw new Error("Sibling search dialog did not render");
      }

      await act(async () => {
        setInputValue(siblingSearchInput, "Existing");
      });
      await clickButton(siblingDialog, "Existing Candidate");

      const detailPanel = container.querySelector('[role="complementary"]');
      if (!(detailPanel instanceof HTMLElement)) {
        throw new Error("Detail panel did not remain open");
      }
      expect(detailPanel.textContent).toContain("Existing Candidate");
      expect(tree.textContent).toContain("Existing Candidate");
      expect(tree.textContent).toContain("Jane Doe");

      await clickButton(detailPanel, "Remove");
      expect(detailPanel.textContent).not.toContain("Existing Candidate");
      expect(tree.textContent).toContain("Existing Candidate");

      await clickButton(container, "Export GED");
      const relationshipExport = await exportedBlob?.text();
      expect(relationshipExport).toContain("0 @I2@ INDI");
      expect(relationshipExport).toContain("1 NAME Existing /Candidate/");
      expect(relationshipExport).toContain("1 _CUSTOM keep candidate data");
      expect(relationshipExport).not.toContain("1 CHIL @I2@");
      expect(relationshipExport?.match(/0 @I\d+@ INDI/g)).toHaveLength(2);
    } finally {
      await act(async () => root.unmount());
      container.remove();
      HTMLAnchorElement.prototype.click = originalAnchorClick;
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl,
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl,
      });
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalFileReader,
      });
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

async function clickButton(container: Element, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!button) throw new Error(`Could not find "${label}" button`);

  await act(async () => button.click());
}
