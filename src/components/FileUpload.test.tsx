import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileUpload } from "./FileUpload";

describe("FileUpload", () => {
  it("announces file and validation errors", () => {
    const html = renderToStaticMarkup(
      <FileUpload
        onFileLoaded={() => undefined}
        onFileError={() => undefined}
        error="No individual records were found."
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("No individual records were found.");
  });
});
