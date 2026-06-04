import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "../src/types.js";

const clientMethods = vi.hoisted(() => ({
  createDocument: vi.fn(),
  fetchDocument: vi.fn(),
  searchDocuments: vi.fn(),
  listDocuments: vi.fn(),
  updateDocument: vi.fn(),
  archiveDocument: vi.fn(),
}));

const output = vi.hoisted(() => ({
  writeOutput: vi.fn(),
}));

vi.mock("../src/client/http-client.js", () => ({
  MyNotionClient: vi.fn(function MyNotionClient() {
    return clientMethods;
  }),
}));

vi.mock("../src/format/output.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/format/output.js")>();
  return {
    ...actual,
    writeOutput: output.writeOutput,
  };
});

function args(positionals: string[], options: ParsedArgs["options"] = {}): ParsedArgs {
  return {
    positionals,
    options: {
      "api-url": "https://example.convex.site",
      token: "mnt_test",
      format: "json",
      ...options,
    },
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "my-notion-cli-docs-"));
  vi.clearAllMocks();
  for (const method of Object.values(clientMethods)) {
    method.mockResolvedValue({ id: "doc_1", title: "Doc" });
  }
  clientMethods.searchDocuments.mockResolvedValue({ documents: [] });
  clientMethods.listDocuments.mockResolvedValue({ documents: [] });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("runDocsCommand", () => {
  it("creates a document from a content file", async () => {
    const { runDocsCommand } = await import("../src/commands/docs.js");
    const contentFile = join(tempDir, "draft.md");
    writeFileSync(contentFile, "# Draft", "utf8");

    await runDocsCommand(
      args(["docs", "create"], {
        title: "Draft",
        "content-file": contentFile,
      }),
    );

    expect(clientMethods.createDocument).toHaveBeenCalledWith({
      title: "Draft",
      contentMarkdown: "# Draft",
    });
    expect(output.writeOutput).toHaveBeenCalledWith(
      { id: "doc_1", title: "Doc" },
      "json",
    );
  });

  it("uses append by default and overwrite only when explicitly requested", async () => {
    const { runDocsCommand } = await import("../src/commands/docs.js");

    await runDocsCommand(
      args(["docs", "update"], {
        id: "doc_1",
        content: "Append me",
      }),
    );
    await runDocsCommand(
      args(["docs", "update"], {
        id: "doc_2",
        content: "Replace me",
        mode: "overwrite",
      }),
    );

    expect(clientMethods.updateDocument).toHaveBeenNthCalledWith(1, {
      id: "doc_1",
      title: undefined,
      contentMarkdown: "Append me",
      mode: "append",
    });
    expect(clientMethods.updateDocument).toHaveBeenNthCalledWith(2, {
      id: "doc_2",
      title: undefined,
      contentMarkdown: "Replace me",
      mode: "overwrite",
    });
  });

  it("searches and lists with parsed numeric limits", async () => {
    const { runDocsCommand } = await import("../src/commands/docs.js");

    await runDocsCommand(args(["docs", "search"], { query: "weekly", limit: "10" }));
    await runDocsCommand(args(["docs", "list"], { limit: "20" }));

    expect(clientMethods.searchDocuments).toHaveBeenCalledWith({
      query: "weekly",
      limit: 10,
    });
    expect(clientMethods.listDocuments).toHaveBeenCalledWith({
      limit: 20,
    });
  });

  it("exports markdown to a file and writes a JSON summary by default", async () => {
    const { runDocsCommand } = await import("../src/commands/docs.js");
    const outputFile = join(tempDir, "exported.md");
    clientMethods.fetchDocument.mockResolvedValueOnce({
      id: "doc_1",
      title: "Doc",
      contentMarkdown: "# Exported",
    });

    await runDocsCommand(
      args(["docs", "export"], {
        id: "doc_1",
        output: outputFile,
        format: "markdown",
      }),
    );

    expect(clientMethods.fetchDocument).toHaveBeenCalledWith("doc_1");
    expect(output.writeOutput).toHaveBeenCalledWith(
      {
        id: "doc_1",
        title: "Doc",
        output: outputFile,
        format: "markdown",
        bytes: Buffer.byteLength("# Exported", "utf8"),
      },
      "json",
    );
  });

  it("throws actionable errors for missing required arguments", async () => {
    const { runDocsCommand } = await import("../src/commands/docs.js");

    await expect(runDocsCommand(args(["docs", "create"]))).rejects.toThrow(
      "Missing title",
    );
    await expect(runDocsCommand(args(["docs", "fetch"]))).rejects.toThrow(
      "Missing document id",
    );
    await expect(runDocsCommand(args(["docs", "import"]))).rejects.toThrow(
      "Missing title or file",
    );
  });
});
