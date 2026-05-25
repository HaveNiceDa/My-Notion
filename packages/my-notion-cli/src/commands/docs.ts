import { readFileSync } from "node:fs";
import { MyNotionClient } from "../client/http-client.js";
import {
  readStringOption,
  resolveApiUrl,
  resolveToken,
} from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

export async function runDocsCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action === "create") {
    await create(args);
    return;
  }

  if (action === "fetch") {
    await fetchDocument(args);
    return;
  }

  if (action === "search") {
    await search(args);
    return;
  }

  if (action === "list") {
    await list(args);
    return;
  }

  if (action === "update") {
    await update(args);
    return;
  }

  throw new Error(
    "Unknown docs command. Usage: my-notion docs <create|fetch|search|list|update>",
  );
}

function createClient(args: ParsedArgs) {
  return new MyNotionClient({
    apiUrl: resolveApiUrl(args.options),
    token: resolveToken(args.options),
  });
}

function readContent(options: Record<string, string | boolean>) {
  const contentFile = readStringOption(options, "content-file");
  if (contentFile) {
    return readFileSync(contentFile, "utf8");
  }

  return readStringOption(options, "content");
}

function readLimit(options: Record<string, string | boolean>) {
  const raw = readStringOption(options, "limit");
  const limit = raw ? Number(raw) : undefined;
  return limit && Number.isFinite(limit) ? limit : undefined;
}

async function create(args: ParsedArgs) {
  const title = readStringOption(args.options, "title");
  if (!title) {
    throw new Error("Missing title. Usage: my-notion docs create --title <title>");
  }

  const document = await createClient(args).createDocument({
    title,
    contentMarkdown: readContent(args.options),
  });

  writeOutput(document, getOutputFormat(args.options));
}

async function fetchDocument(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing document id. Usage: my-notion docs fetch --id <id>");
  }

  const document = await createClient(args).fetchDocument(id);
  writeOutput(document, getOutputFormat(args.options));
}

async function search(args: ParsedArgs) {
  const query = readStringOption(args.options, "query") ?? readStringOption(args.options, "q");
  const result = await createClient(args).searchDocuments({
    query,
    limit: readLimit(args.options),
  });

  writeOutput(result.documents, getOutputFormat(args.options));
}

async function list(args: ParsedArgs) {
  const result = await createClient(args).listDocuments({
    limit: readLimit(args.options),
  });

  writeOutput(result.documents, getOutputFormat(args.options));
}

async function update(args: ParsedArgs) {
  const id = readStringOption(args.options, "id") ?? args.positionals[2];
  if (!id) {
    throw new Error("Missing document id. Usage: my-notion docs update --id <id>");
  }

  const mode = args.options.mode === "append" ? "append" : "overwrite";
  const document = await createClient(args).updateDocument({
    id,
    title: readStringOption(args.options, "title"),
    contentMarkdown: readContent(args.options),
    mode,
  });

  writeOutput(document, getOutputFormat(args.options));
}
