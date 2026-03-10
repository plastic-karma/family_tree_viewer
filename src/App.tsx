import { useState } from "react";
import type { Node, Edge } from "@xyflow/react";
import { FileUpload } from "./components/FileUpload";
import { TreeViewer } from "./components/TreeViewer";
import { DetailPanel } from "./components/DetailPanel";
import { parseGedcom } from "./parser/gedcom";
import { buildFlowElements } from "./layout";
import type { GedcomData } from "./parser/types";

/**
 * App manages three pieces of state:
 * 1. gedcom: the parsed GEDCOM data (null before file upload)
 * 2. flowData: the React Flow nodes/edges derived from gedcom
 * 3. selectedId: which person node is currently selected (null = none)
 *
 * Previously we only stored flowData, but now we need gedcom too so the
 * DetailPanel can look up full individual details and resolve family
 * references. This is a common pattern: as features grow, you often need
 * to "promote" derived state back to source data.
 */
function App() {
  const [gedcom, setGedcom] = useState<GedcomData | null>(null);
  const [flowData, setFlowData] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleFileLoaded = (content: string) => {
    const parsed = parseGedcom(content);
    setGedcom(parsed);
    const { nodes, edges } = buildFlowElements(parsed);
    setFlowData({ nodes, edges });
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
          // Family junction nodes have type "default", not "person".
          // We only want to open the detail panel for person nodes.
          if (node.type === "person") {
            setSelectedId(node.id);
          }
        }}
      />
      {selectedIndividual && (
        <DetailPanel
          individual={selectedIndividual}
          gedcom={gedcom}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

export default App;
