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

  // flowData is derived from gedcom — useMemo ensures it stays in sync
  // and avoids recomputing on unrelated state changes (selectedId, focusKey).
  const flowData = useMemo(
    () => (gedcom ? buildFlowElements(gedcom) : null),
    [gedcom]
  );

  const handleFileLoaded = (content: string) => {
    setGedcom(parseGedcom(content));
  };

  const navigateTo = (personId: string) => {
    setSelectedId(personId);
    setFocusKey((k) => k + 1);
  };

  if (!flowData || !gedcom) {
    return <FileUpload onFileLoaded={handleFileLoaded} />;
  }

  const selectedIndividual = selectedId
    ? gedcom.individuals.get(selectedId)
    : undefined;

  return (
    <>
      <SearchBox gedcom={gedcom} onSelect={navigateTo} />
      <TreeViewer
        nodes={flowData.nodes}
        edges={flowData.edges}
        onNodeClick={(_event, node) => {
          if (node.type === PERSON_NODE_TYPE) {
            navigateTo(node.id);
          }
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
