import { useCallback, type DragEvent } from "react";

/**
 * A drag-and-drop file upload component.
 *
 * Key React concepts demonstrated:
 * - useCallback: memoizes the event handler so it doesn't get recreated on every
 *   render. This matters when passing callbacks as props to child components
 *   (prevents unnecessary re-renders), though here it's a minor optimization.
 * - Controlled vs uncontrolled: this component doesn't own state — it just calls
 *   onFileLoaded with the result. The parent decides what to do with the data.
 *   This is the "lifting state up" pattern.
 */

interface FileUploadProps {
  onFileLoaded: (content: string) => void;
}

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        readFile(file, onFileLoaded);
      }
    },
    [onFileLoaded]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        readFile(file, onFileLoaded);
      }
    },
    [onFileLoaded]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 16,
      }}
    >
      <div
        style={{
          border: "2px dashed #aaa",
          borderRadius: 12,
          padding: "48px 64px",
          textAlign: "center",
          color: "#666",
        }}
      >
        <p style={{ fontSize: 18, margin: 0 }}>
          Drop a .ged file here
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 14 }}>or</p>
        <label
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "8px 20px",
            background: "#4a90d9",
            color: "#fff",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Browse files
          <input
            type="file"
            accept=".ged"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
        </label>
      </div>
    </div>
  );
}

function readFile(file: File, callback: (content: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === "string") {
      callback(text);
    }
  };
  reader.readAsText(file);
}
