import { useRef, type ChangeEvent, type DragEvent } from "react";

/**
 * A drag-and-drop file upload component.
 *
 * This component doesn't own state — it just calls onFileLoaded with the
 * result. The parent decides what to do with the data. This is the
 * "lifting state up" pattern.
 */

interface FileUploadProps {
  onFileLoaded: (content: string, fileName: string) => void;
  onFileError: (message: string) => void;
  error?: string | null;
}

export function FileUpload({
  onFileLoaded,
  onFileError,
  error,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) readFile(file, onFileLoaded, onFileError);
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) readFile(file, onFileLoaded, onFileError);

    // Permit choosing the same file again after correcting an external read
    // problem or retrying an invalid document.
    event.currentTarget.value = "";
  };

  return (
    <main
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <section
        aria-label="GEDCOM file upload"
        style={{
          width: "min(480px, calc(100vw - 32px))",
          boxSizing: "border-box",
          border: "2px dashed #aaa",
          borderRadius: 12,
          padding: "48px clamp(24px, 8vw, 64px)",
          textAlign: "center",
          color: "#666",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            color: "#213547",
            fontSize: 24,
          }}
        >
          Family Tree Viewer
        </h1>
        <p style={{ fontSize: 18, margin: 0 }}>Drop a .ged file here</p>
        <p style={{ margin: "12px 0 0", fontSize: 14 }}>or</p>
        <button
          type="button"
          aria-describedby={error ? "file-upload-error" : undefined}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 12,
            padding: "8px 20px",
            background: "#4a90d9",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Browse files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ged"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
        {error && (
          <p
            id="file-upload-error"
            role="alert"
            style={{ margin: "16px 0 0", color: "#b42318", fontSize: 14 }}
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

function readFile(
  file: File,
  onFileLoaded: (content: string, fileName: string) => void,
  onFileError: (message: string) => void
) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const text = event.target?.result;
    if (typeof text === "string") {
      onFileLoaded(text, file.name);
    } else {
      onFileError(`Could not decode "${file.name}".`);
    }
  };
  reader.onerror = () => onFileError(`Could not read "${file.name}".`);
  reader.onabort = () => onFileError(`Reading "${file.name}" was cancelled.`);
  reader.readAsText(file);
}
