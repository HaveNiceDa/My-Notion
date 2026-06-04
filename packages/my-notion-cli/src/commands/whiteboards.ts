import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { MyNotionClient } from "../client/http-client.js";
import {
  readStringOption,
  resolveApiUrl,
  resolveToken,
} from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

export async function runWhiteboardsCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action === "create") return create(args);
  if (action === "fetch") return fetchWhiteboard(args);
  if (action === "list") return list(args);
  if (action === "update") return update(args);
  if (action === "export") return exportWhiteboard(args);
  if (action === "archive") return archive(args);

  throw new Error(
    "Unknown whiteboards command. Usage: my-notion whiteboards <create|fetch|list|update|export|archive>",
  );
}

function createClient(args: ParsedArgs) {
  return new MyNotionClient({
    apiUrl: resolveApiUrl(args.options),
    token: resolveToken(args.options),
  });
}

function readLimit(options: Record<string, string | boolean>) {
  const raw = readStringOption(options, "limit");
  const limit = raw ? Number(raw) : undefined;
  return limit && Number.isFinite(limit) ? limit : undefined;
}

function readDsl(options: Record<string, string | boolean>) {
  const dslFile = readStringOption(options, "dsl-file");
  if (!dslFile) return undefined;
  const raw = readFileSync(dslFile, "utf8");
  const parsed = dslFile.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Whiteboard DSL file must contain an object.");
  }
  return parsed;
}

type WhiteboardPackageFile = {
  path: string;
  content: string;
};

function writePackage(output: string, content: string) {
  const parsed = JSON.parse(content) as { files?: WhiteboardPackageFile[] };
  if (!Array.isArray(parsed.files)) {
    throw new Error("Invalid whiteboard package export.");
  }
  mkdirSync(output, { recursive: true });
  for (const file of parsed.files) {
    if (!file.path || file.path.includes("..") || file.path.startsWith("/")) {
      throw new Error(`Invalid package file path: ${file.path}`);
    }
    writeFileSync(join(output, file.path), file.content, "utf8");
  }
}

async function create(args: ParsedArgs) {
  const title = readStringOption(args.options, "title");
  if (!title) {
    throw new Error("Missing title. Usage: my-notion whiteboards create --title <title> [--dsl-file board.mwb.yaml]");
  }
  const whiteboard = await createClient(args).createWhiteboard({
    title,
    documentId: readStringOption(args.options, "document-id") ?? readStringOption(args.options, "documentId"),
    dsl: readDsl(args.options),
  });
  writeOutput(whiteboard, getOutputFormat(args.options));
}

async function fetchWhiteboard(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing whiteboard id. Usage: my-notion whiteboards fetch --id <whiteboardId>");
  }
  const whiteboard = await createClient(args).fetchWhiteboard(id);
  writeOutput(whiteboard, getOutputFormat(args.options));
}

async function list(args: ParsedArgs) {
  const result = await createClient(args).listWhiteboards({
    documentId: readStringOption(args.options, "document-id") ?? readStringOption(args.options, "documentId"),
    limit: readLimit(args.options),
  });
  writeOutput(result.whiteboards, getOutputFormat(args.options));
}

async function update(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing whiteboard id. Usage: my-notion whiteboards update --id <whiteboardId> [--dsl-file board.mwb.yaml]");
  }
  const whiteboard = await createClient(args).updateWhiteboard({
    id,
    title: readStringOption(args.options, "title"),
    dsl: readDsl(args.options),
  });
  writeOutput(whiteboard, getOutputFormat(args.options));
}

async function exportWhiteboard(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing whiteboard id. Usage: my-notion whiteboards export --id <whiteboardId> [--format json|svg|package] [--output file-or-dir]");
  }
  const rawFormat = readStringOption(args.options, "format");
  const format = rawFormat === "svg" || rawFormat === "package" ? rawFormat : "json";
  const exported = await createClient(args).exportWhiteboard({ id, format });
  const output = readStringOption(args.options, "output");
  if (output) {
    if (format === "package") {
      writePackage(output, exported.content);
    } else {
      writeFileSync(output, exported.content, "utf8");
    }
    writeOutput(
      {
        id: exported.id,
        title: exported.title,
        output,
        format,
        bytes: Buffer.byteLength(exported.content, "utf8"),
      },
      "json",
    );
    return;
  }
  console.log(exported.content);
}

async function archive(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing whiteboard id. Usage: my-notion whiteboards archive --id <whiteboardId>");
  }
  const whiteboard = await createClient(args).archiveWhiteboard(id);
  writeOutput(whiteboard, getOutputFormat(args.options));
}
