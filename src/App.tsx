import { useState } from "react";
import { FileUpload } from "./components/FileUpload";
import { TreeViewer } from "./components/TreeViewer";
import { DetailPanel } from "./components/DetailPanel";
import { SearchBox } from "./components/SearchBox";
import {
  addChild,
  addSibling,
  addSpouse,
  exportGedcom,
  parseGedcom,
  removeChild,
  removeSibling,
  removeSpouse,
} from "./parser/gedcom";
import { buildFlowElements, PERSON_NODE_TYPE } from "./layout";
import type { FlowElements } from "./layout";
import type { GedcomDocument, Individual } from "./parser/types";

function App() {
  const [gedcom, setGedcom] = useState<GedcomDocument | null>(null);
  // Field edits leave the loaded graph labels unchanged. Relationship edits
  // rebuild the graph because they add nodes and change family edges.
  const [flowData, setFlowData] = useState<FlowElements | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileLoaded = (content: string, fileName: string) => {
    const parsed = parseGedcom(content);
    if (parsed.individuals.size === 0) {
      setUploadError("No individual records were found in that file.");
      return;
    }

    setGedcom(parsed);
    setFlowData(buildFlowElements(parsed));
    setSourceFileName(fileName);
    setSelectedId(null);
    setFocusKey(0);
    setUploadError(null);
  };

  const navigateTo = (personId: string) => {
    if (!gedcom?.individuals.has(personId)) return;
    setSelectedId(personId);
    setFocusKey((key) => key + 1);
  };

  const handleIndividualUpdate = (
    personId: string,
    updates: Pick<Individual, "name" | "birthDate">
  ) => {
    setGedcom((current) => {
      const individual = current?.individuals.get(personId);
      if (!current || !individual) return current;

      const individuals = new Map(current.individuals);
      individuals.set(personId, { ...individual, ...updates });
      return { ...current, individuals };
    });
  };

  const applyRelationshipUpdate = (
    updated: GedcomDocument | null
  ): boolean => {
    if (!updated) return false;
    setGedcom(updated);
    setFlowData(buildFlowElements(updated));
    return true;
  };

  const handleSiblingAdd = (
    personId: string,
    siblingId: string
  ): boolean =>
    gedcom
      ? applyRelationshipUpdate(addSibling(gedcom, personId, siblingId))
      : false;

  const handleSiblingRemove = (personId: string, siblingId: string) => {
    if (gedcom) {
      applyRelationshipUpdate(removeSibling(gedcom, personId, siblingId));
    }
  };

  const handleSpouseAdd = (
    personId: string,
    spouseId: string,
    familyId?: string
  ): boolean =>
    gedcom
      ? applyRelationshipUpdate(
          addSpouse(gedcom, personId, spouseId, familyId)
        )
      : false;

  const handleSpouseRemove = (
    personId: string,
    spouseId: string,
    familyId?: string
  ) => {
    if (gedcom) {
      applyRelationshipUpdate(
        removeSpouse(gedcom, personId, spouseId, familyId)
      );
    }
  };

  const handleChildAdd = (
    parentId: string,
    childId: string,
    familyId?: string
  ): boolean =>
    gedcom
      ? applyRelationshipUpdate(
          addChild(gedcom, parentId, childId, familyId)
        )
      : false;

  const handleChildRemove = (
    parentId: string,
    childId: string,
    familyId?: string
  ) => {
    if (gedcom) {
      applyRelationshipUpdate(
        removeChild(gedcom, parentId, childId, familyId)
      );
    }
  };

  const handleExport = () => {
    if (!gedcom) return;
    downloadGedcomFile(exportGedcom(gedcom), sourceFileName);
  };

  const openFilePicker = () => {
    setGedcom(null);
    setFlowData(null);
    setSourceFileName(null);
    setSelectedId(null);
    setFocusKey(0);
    setUploadError(null);
  };

  if (!flowData || !gedcom) {
    return (
      <FileUpload
        onFileLoaded={handleFileLoaded}
        onFileError={setUploadError}
        error={uploadError}
      />
    );
  }

  const selectedIndividual = selectedId
    ? gedcom.individuals.get(selectedId)
    : undefined;

  return (
    <>
      <SearchBox gedcom={gedcom} onSelect={navigateTo} />
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleExport}
          style={{
            ...toolbarButtonStyle,
            borderColor: "#4a90d9",
            background: "#4a90d9",
            color: "#fff",
          }}
        >
          Export GED
        </button>
        <button
          type="button"
          onClick={openFilePicker}
          style={toolbarButtonStyle}
        >
          Open another file
        </button>
      </div>
      <TreeViewer
        nodes={flowData.nodes}
        edges={flowData.edges}
        onNodeClick={(_event, node) => {
          if (node.type === PERSON_NODE_TYPE) navigateTo(node.id);
        }}
        focusNodeId={selectedId}
        focusKey={focusKey}
      />
      {selectedIndividual && (
        <DetailPanel
          key={selectedIndividual.id}
          individual={selectedIndividual}
          gedcom={gedcom}
          onClose={() => setSelectedId(null)}
          onNavigate={navigateTo}
          onUpdate={handleIndividualUpdate}
          onAddSibling={handleSiblingAdd}
          onRemoveSibling={handleSiblingRemove}
          onAddSpouse={handleSpouseAdd}
          onRemoveSpouse={handleSpouseRemove}
          onAddChild={handleChildAdd}
          onRemoveChild={handleChildRemove}
        />
      )}
    </>
  );
}

export default App;

const toolbarButtonStyle = {
  padding: "8px 12px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  color: "#213547",
  cursor: "pointer",
} as const;

function downloadGedcomFile(content: string, sourceFileName: string | null) {
  const sourceStem = sourceFileName?.replace(/\.ged$/i, "") || "family-tree";
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sourceStem}-updated.ged`;
  link.style.display = "none";
  document.body.append(link);

  try {
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
