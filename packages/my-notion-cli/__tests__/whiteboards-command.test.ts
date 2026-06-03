import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "../src/types.js";

const clientMethods = vi.hoisted(() => ({
  createWhiteboard: vi.fn(),
  fetchWhiteboard: vi.fn(),
  listWhiteboards: vi.fn(),
  updateWhiteboard: vi.fn(),
  exportWhiteboard: vi.fn(),
  archiveWhiteboard: vi.fn(),
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
  tempDir = mkdtempSync(join(tmpdir(), "my-notion-cli-whiteboards-"));
  vi.clearAllMocks();
  const whiteboard = {
    id: "wb_1",
    title: "Board",
    engine: "excalidraw",
    sceneJson: "{}",
    isArchived: false,
    createdAt: 1,
    updatedAt: 1,
  };
  for (const method of Object.values(clientMethods)) {
    method.mockResolvedValue(whiteboard);
  }
  clientMethods.listWhiteboards.mockResolvedValue({ whiteboards: [] });
  clientMethods.exportWhiteboard.mockResolvedValue({
    id: "wb_1",
    title: "Board",
    format: "json",
    content: "{}",
  });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("runWhiteboardsCommand", () => {
  it("creates a whiteboard from a YAML DSL file", async () => {
    const { runWhiteboardsCommand } = await import("../src/commands/whiteboards.js");
    const dslFile = join(tempDir, "board.mwb.yaml");
    writeFileSync(
      dslFile,
      "version: mwb-dsl-v1\nnodes:\n  - id: a\n    type: box\n    text: A\n",
      "utf8",
    );

    await runWhiteboardsCommand(
      args(["whiteboards", "create"], {
        title: "Board",
        "document-id": "doc_1",
        "dsl-file": dslFile,
      }),
    );

    expect(clientMethods.createWhiteboard).toHaveBeenCalledWith({
      title: "Board",
      documentId: "doc_1",
      dsl: {
        version: "mwb-dsl-v1",
        nodes: [{ id: "a", type: "box", text: "A" }],
      },
    });
  });

  it("exports a whiteboard to a file", async () => {
    const { runWhiteboardsCommand } = await import("../src/commands/whiteboards.js");
    const outputFile = join(tempDir, "board.excalidraw");

    await runWhiteboardsCommand(
      args(["whiteboards", "export"], {
        id: "wb_1",
        output: outputFile,
        format: "json",
      }),
    );

    expect(clientMethods.exportWhiteboard).toHaveBeenCalledWith({
      id: "wb_1",
      format: "json",
    });
    expect(output.writeOutput).toHaveBeenCalledWith(
      {
        id: "wb_1",
        title: "Board",
        output: outputFile,
        format: "json",
        bytes: Buffer.byteLength("{}", "utf8"),
      },
      "json",
    );
  });
});
