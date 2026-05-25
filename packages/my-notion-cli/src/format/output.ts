import type { DocumentResult, OutputFormat } from "../types.js";

export function getOutputFormat(
  options: Record<string, string | boolean>,
  fallback: OutputFormat = "json",
): OutputFormat {
  const value = options.format;
  if (
    value === "json" ||
    value === "pretty" ||
    value === "table" ||
    value === "ndjson" ||
    value === "markdown"
  ) {
    return value;
  }

  return fallback;
}

export function writeOutput(data: unknown, format: OutputFormat = "json") {
  if (format === "pretty") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (format === "ndjson") {
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      console.log(JSON.stringify(row));
    }
    return;
  }

  if (format === "table") {
    console.table(data);
    return;
  }

  if (format === "markdown") {
    const document = data as Partial<DocumentResult>;
    console.log(document.contentMarkdown ?? "");
    return;
  }

  console.log(JSON.stringify(data));
}

export function writeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
}
