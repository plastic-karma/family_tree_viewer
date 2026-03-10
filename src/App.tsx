import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { FileUpload } from "./components/FileUpload";
import { TreeViewer } from "./components/TreeViewer";
import { DetailPanel } from "./components/DetailPanel";
import { parseGedcom } from "./parser/gedcom";
import { buildFlowElements } from "./layout";
import type { GedcomData } from "./parser/types";

/**
 * App manages the core state:
 * - gedcom/flowData: parsed data + React Flow representation
 * - selectedId: which person's detail panel is open
 * - focusKey: triggers the "fly to node" animation in TreeViewer
 *
 * focusKey is a counter rather than just the node ID. This solves
 * a subtle problem: if you navigate to person A, then to B, then back
 * to A, the useEffect in FocusHandler wouldn't fire on the second visit
 * to A because the dependency (selectedId) would be the same value.
 * By incrementing a counter, we guarantee the effect always triggers.
 */
function App() {
  const [gedcom, setGedcom] = useState<GedcomData | null>(null);
  const [flowData, setFlowData] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  const handleFileLoaded = (content: string) => {
    const parsed = parseGedcom(content);
    setGedcom(parsed);
    const { nodes, edges } = buildFlowElements(parsed);
    setFlowData({ nodes, edges });
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
      <TreeViewer
        nodes={flowData.nodes}
        edges={flowData.edges}
        onNodeClick={(_event, node) => {
          if (node.type === "person") {
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
