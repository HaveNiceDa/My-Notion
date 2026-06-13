import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParsedArgs } from "../src/types.js";

const output = vi.hoisted(() => ({
  writeOutput: vi.fn(),
}));

vi.mock("../src/format/output.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/format/output.js")>();
  return {
    ...actual,
    writeOutput: output.writeOutput,
  };
});

function args(options: ParsedArgs["options"] = {}): ParsedArgs {
  return {
    positionals: ["update"],
    options,
  };
}

afterEach(() => {
  output.writeOutput.mockClear();
  vi.unstubAllGlobals();
});

describe("runUpdateCommand", () => {
  it("prints update commands without running npm installs", async () => {
    const { runUpdateCommand } = await import("../src/commands/update.js");

    await runUpdateCommand(args({ format: "json" }));

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        packageName: "@mynotion/cli",
        binary: "my-notion",
        targetTag: "latest",
        autoUpdated: false,
        requiresUserConfirmation: true,
        commands: expect.objectContaining({
          updateCli: "npm install -g @mynotion/cli@latest",
          updateSkills: "npx skills add @mynotion/cli -y -g",
          verifyCli: "my-notion update --check --format json",
          verifyConfig: "my-notion config init --check --format json",
        }),
      }),
      "json",
    );
  });

  it("checks the npm dist-tag when requested", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ version: "9.9.9" }),
      }),
    );
    const { runUpdateCommand } = await import("../src/commands/update.js");

    await runUpdateCommand(args({ check: true, format: "json" }));

    expect(fetch).toHaveBeenCalledWith(
      "https://registry.npmjs.org/@mynotion%2Fcli/latest",
      expect.objectContaining({
        headers: {
          accept: "application/json",
        },
      }),
    );
    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        latestVersion: "9.9.9",
        updateAvailable: true,
      }),
      "json",
    );
  });

  it("surfaces npm check errors without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );
    const { runUpdateCommand } = await import("../src/commands/update.js");

    await runUpdateCommand(args({ check: true, format: "json" }));

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        checkError: "npm registry returned HTTP 500",
        updateAvailable: null,
      }),
      "json",
    );
  });
});
