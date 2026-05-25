import { MyNotionClient } from "../client/http-client.js";
import { resolveApiUrl, resolveToken } from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

export async function runTokensCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action === "revoke-current") {
    await revokeCurrent(args);
    return;
  }

  throw new Error(
    "Unknown tokens command. Usage: my-notion tokens <revoke-current>",
  );
}

function createClient(args: ParsedArgs) {
  return new MyNotionClient({
    apiUrl: resolveApiUrl(args.options),
    token: resolveToken(args.options),
  });
}

async function revokeCurrent(args: ParsedArgs) {
  const result = await createClient(args).revokeCurrentToken();
  writeOutput(result.token, getOutputFormat(args.options));
}
