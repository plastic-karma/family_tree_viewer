import { useState, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { FileUpload } from "./components/FileUpload";
import { TreeViewer } from "./components/TreeViewer";
import { parseGedcom } from "./parser/gedcom";
import { buildFlowElements } from "./layout";

/**
 * App manages two states:
 * 1. Before file upload: show the FileUpload component
 * 2. After file upload: parse the GEDCOM data and show the TreeViewer
 *
 * We store the computed nodes/edges (not the raw GEDCOM text) because
 * that's what we actually need for rendering. Storing derived data as state
 * is fine when the derivation is expensive and the source data isn't needed
 * elsewhere. If we later need the raw data too (e.g., for a search feature),
 * we'd store the GedcomData and derive nodes/edges with useMemo instead.
 */
function App() {
  const [flowData, setFlowData] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);

  const handleFileLoaded = useCallback((content: string) => {
    const gedcom = parseGedcom(content);
    const { nodes, edges } = buildFlowElements(gedcom);
    setFlowData({ nodes, edges });
  }, []);

  if (!flowData) {
    return <FileUpload onFileLoaded={handleFileLoaded} />;
  }

  return <TreeViewer nodes={flowData.nodes} edges={flowData.edges} />;
}

export default App;
