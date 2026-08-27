// @vitest-environment happy-dom

import { act, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/TreeViewer", () => ({
  TreeViewer: ({
    nodes,
    edges,
    onNodeClick,
  }: {
    nodes: Array<{
      id: string;
      type?: string;
      data: { label?: unknown };
    }>;
    edges: Array<{ id: string }>;
    onNodeClick?: (
      event: ReactMouseEvent<Element>,
      node: { id: string; type?: string }
    ) => void;
  }) => (
    <div data-testid="tree">
      {nodes.map((node) => (
        <button
          key={node.id}
          data-node-id={node.id}
          type="button"
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {String(node.data.label ?? "")}
        </button>
      ))}
      {edges.map((edge) => (
        <span key={edge.id} data-testid="tree-edge">
          {edge.id}
        </span>
      ))}
    </div>
  ),
}));

import App from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("App editing and relationship changes", () => {
  it("updates fields and family relationships in the graph and export", async () => {
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
0 @I3@ INDI
1 NAME Existing /Partner/
1 SEX F
1 _CUSTOM keep partner data
0 @I4@ INDI
1 NAME Existing /Child/
1 _CUSTOM keep child data
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
      expect(tree.textContent).not.toContain("Existing Candidate");

      await clickButton(container, "Export GED");
      const relationshipExport = await exportedBlob?.text();
      expect(relationshipExport).toContain("0 @I2@ INDI");
      expect(relationshipExport).toContain("1 NAME Existing /Candidate/");
      expect(relationshipExport).toContain("1 _CUSTOM keep candidate data");
      expect(relationshipExport).not.toContain("1 CHIL @I2@");
      expect(relationshipExport?.match(/0 @I\d+@ INDI/g)).toHaveLength(4);

      await clickButton(detailPanel, "Add spouse");
      const spouseSearchInput = container.querySelector(
        'input[name="spouseSearch"]'
      );
      const spouseDialog = container.querySelector('[role="dialog"]');
      if (
        !(spouseSearchInput instanceof HTMLInputElement) ||
        !(spouseDialog instanceof HTMLElement)
      ) {
        throw new Error("Spouse search dialog did not render");
      }
      await act(async () => {
        setInputValue(spouseSearchInput, "Existing Partner");
      });
      await clickButton(spouseDialog, "Existing Partner");
      expect(detailPanel.textContent).toContain("Existing Partner");
      expect(tree.textContent).toContain("parent:@F2@:@I3@");

      await clickButton(detailPanel, "Add child");
      const childSearchInput = container.querySelector(
        'input[name="childSearch"]'
      );
      const childDialog = container.querySelector('[role="dialog"]');
      if (
        !(childSearchInput instanceof HTMLInputElement) ||
        !(childDialog instanceof HTMLElement)
      ) {
        throw new Error("Child search dialog did not render");
      }
      await act(async () => {
        setInputValue(childSearchInput, "Existing Child");
      });
      await clickButton(childDialog, "Existing Child");
      expect(detailPanel.textContent).toContain("Existing Child");
      expect(tree.textContent).not.toContain("child:@F2@:@I4@");

      await clickButton(container, "Export GED");
      const additionsExport = await exportedBlob?.text();
      expect(additionsExport).toContain("1 WIFE @I3@");
      expect(additionsExport).toContain("1 CHIL @I4@");
      expect(additionsExport).toContain("1 _CUSTOM keep partner data");
      expect(additionsExport).toContain("1 _CUSTOM keep child data");

      await clickAriaButton(
        detailPanel,
        "Remove Existing Child as child"
      );
      await clickAriaButton(
        detailPanel,
        "Remove Existing Partner as spouse"
      );
      expect(tree.textContent).not.toContain("child:@F2@:@I4@");
      expect(tree.textContent).not.toContain("parent:@F2@:@I3@");

      await clickButton(container, "Export GED");
      const removalsExport = await exportedBlob?.text();
      expect(removalsExport).not.toContain("1 WIFE @I3@");
      expect(removalsExport).not.toContain("1 CHIL @I4@");
      expect(removalsExport).toContain("0 @I3@ INDI");
      expect(removalsExport).toContain("0 @I4@ INDI");
      expect(removalsExport?.match(/0 @I\d+@ INDI/g)).toHaveLength(4);
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

  it("shows only direct family after search or tree selection", async () => {
    const source = `0 @I1@ INDI
1 NAME Alex /Focus/
0 @I2@ INDI
1 NAME Parent /One/
0 @I3@ INDI
1 NAME Parent /Two/
0 @I4@ INDI
1 NAME Sam /Sibling/
0 @I5@ INDI
1 NAME Taylor /Spouse/
0 @I6@ INDI
1 NAME Casey /Child/
0 @I7@ INDI
1 NAME Unrelated /Person/
0 @I8@ INDI
1 NAME Sibling /Spouse/
0 @I9@ INDI
1 NAME Morgan /Ancestor/
0 @I10@ INDI
1 NAME Jordan /Aunt/
0 @F1@ FAM
1 HUSB @I2@
1 WIFE @I3@
1 CHIL @I1@
1 CHIL @I4@
0 @F2@ FAM
1 HUSB @I1@
1 WIFE @I5@
1 CHIL @I6@
0 @F3@ FAM
1 HUSB @I9@
1 CHIL @I2@
1 CHIL @I10@
0 @F4@ FAM
1 HUSB @I4@
1 WIFE @I8@
0 TRLR`;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
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

    try {
      await act(async () => root.render(<App />));
      const fileInput = container.querySelector('input[type="file"]');
      if (!(fileInput instanceof HTMLInputElement)) {
        throw new Error("File input did not render");
      }

      Object.defineProperty(fileInput, "files", {
        configurable: true,
        value: [new File([source], "direct-family.ged")],
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
      const searchInput = container.querySelector(
        'input[aria-label="Search people by name"]'
      );
      if (
        !(tree instanceof HTMLElement) ||
        !(searchInput instanceof HTMLInputElement)
      ) {
        throw new Error("Tree or search input did not render");
      }

      await act(async () => setInputValue(searchInput, "Alex"));
      const searchResults = container.querySelector('[role="listbox"]');
      if (!(searchResults instanceof HTMLElement)) {
        throw new Error("Search results did not render");
      }
      await clickButton(searchResults, "Alex Focus");

      expect(getTreeNodeIds(tree)).toEqual([
        "@I1@",
        "@I2@",
        "@I3@",
        "@I4@",
        "@I5@",
        "family:@F1@",
        "family:@F2@",
      ]);
      expect(getTreeEdgeIds(tree)).toEqual([
        "child:@F1@:@I1@",
        "child:@F1@:@I4@",
        "parent:@F1@:@I2@",
        "parent:@F1@:@I3@",
        "parent:@F2@:@I1@",
        "parent:@F2@:@I5@",
      ]);

      await clickAriaButton(container, "Close details");
      expect(getTreeNodeIds(tree)).toContain("@I6@");
      expect(getTreeNodeIds(tree)).toContain("@I7@");
      expect(getTreeNodeIds(tree)).toContain("@I8@");

      await clickButton(tree, "Parent One");
      expect(getTreeNodeIds(tree)).toEqual([
        "@I10@",
        "@I2@",
        "@I3@",
        "@I9@",
        "family:@F1@",
        "family:@F3@",
      ]);
      expect(getTreeNodeIds(tree)).not.toContain("@I1@");
      expect(getTreeNodeIds(tree)).not.toContain("@I4@");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalFileReader,
      });
    }
  });
});

function getTreeNodeIds(tree: Element): string[] {
  return Array.from(
    tree.querySelectorAll<HTMLElement>("[data-node-id]"),
    (node) => node.dataset.nodeId!
  ).sort();
}

function getTreeEdgeIds(tree: Element): string[] {
  return Array.from(
    tree.querySelectorAll<HTMLElement>('[data-testid="tree-edge"]'),
    (edge) => edge.textContent ?? ""
  ).sort();
}

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

async function clickAriaButton(container: Element, label: string) {
  const button = container.querySelector(`button[aria-label="${label}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Could not find "${label}" button`);
  }

  await act(async () => button.click());
}
