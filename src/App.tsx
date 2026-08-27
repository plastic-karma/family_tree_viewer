import { useState, useMemo } from "react";
import { FileUpload } from "./components/FileUpload";
import { TreeViewer } from "./components/TreeViewer";
import { DetailPanel } from "./components/DetailPanel";
import { SearchBox } from "./components/SearchBox";
import { parseGedcom } from "./parser/gedcom";
import { buildFlowElements, PERSON_NODE_TYPE } from "./layout";
import type { GedcomData } from "./parser/types";

function App() {
  const [gedcom, setGedcom] = useState<GedcomData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const flowData = useMemo(
    () => (gedcom ? buildFlowElements(gedcom) : null),
    [gedcom]
  );

  const handleFileLoaded = (content: string) => {
    const parsed = parseGedcom(content);
    if (parsed.individuals.size === 0) {
      setUploadError("No individual records were found in that file.");
      return;
    }

    setGedcom(parsed);
    setSelectedId(null);
    setFocusKey(0);
    setUploadError(null);
  };

  const navigateTo = (personId: string) => {
    if (!gedcom?.individuals.has(personId)) return;
    setSelectedId(personId);
    setFocusKey((key) => key + 1);
  };

  const openFilePicker = () => {
    setGedcom(null);
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
      <button
        type="button"
        onClick={openFilePicker}
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 9,
          padding: "8px 12px",
          border: "1px solid #ccc",
          borderRadius: 6,
          background: "#fff",
          color: "#213547",
          cursor: "pointer",
        }}
      >
        Open another file
      </button>
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
          individual={selectedIndividual}
          gedcom={gedcom}
          onClose={() => setSelectedId(null)}
          onNavigate={navigateTo}
        />
      )}
    </>
  );
}

export default App;
