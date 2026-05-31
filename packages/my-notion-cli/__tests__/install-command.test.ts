import { describe, expect, it, vi } from "vitest";
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
    positionals: ["install"],
    options,
  };
}

describe("runInstallCommand", () => {
  it("prints beta install commands for humans and agents", async () => {
    const { runInstallCommand } = await import("../src/commands/install.js");

    await runInstallCommand(args({ format: "json" }));

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        packageName: "@mynotion/cli",
        binary: "my-notion",
        commands: expect.objectContaining({
          installCli: "npm install -g @mynotion/cli@beta",
          installSkills: "npx skills add @mynotion/cli -y -g",
          agentLogin: "my-notion auth login --no-open",
        }),
      }),
      "json",
    );
  });

  it("checks whether bundled skills are present", async () => {
    const { runInstallCommand } = await import("../src/commands/install.js");

    await runInstallCommand(args({ check: true, format: "json" }));

    expect(output.writeOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: expect.any(Boolean),
        skillsBundled: expect.any(Boolean),
        skillsPath: expect.stringContaining("skills"),
      }),
      "json",
    );
  });
});
