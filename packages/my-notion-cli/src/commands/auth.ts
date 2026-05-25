import { MyNotionClient } from "../client/http-client.js";
import {
  clearSavedToken,
  getConfigPath,
  loadConfig,
  readStringOption,
  resolveApiUrl,
  resolveToken,
  saveConfig,
} from "../config/store.js";
import { getOutputFormat, writeOutput } from "../format/output.js";
import type { ParsedArgs } from "../types.js";

export async function runAuthCommand(args: ParsedArgs) {
  const action = args.positionals[1];

  if (action === "login") {
    await login(args);
    return;
  }

  if (action === "status") {
    await status(args);
    return;
  }

  if (action === "logout") {
    await logout(args);
    return;
  }

  throw new Error("Unknown auth command. Usage: my-notion auth <login|status|logout>");
}

async function login(args: ParsedArgs) {
  const apiUrl = resolveApiUrl(args.options);
  const token = resolveToken(args.options);
  const client = new MyNotionClient({ apiUrl, token });
  const status = await client.authStatus();
  const nextConfig = {
    ...loadConfig(),
    apiUrl,
    token,
  };

  saveConfig(nextConfig);

  writeOutput(
    {
      authenticated: status.authenticated,
      apiUrl,
      tokenPrefix: status.tokenPrefix,
      scopes: status.scopes,
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}

async function status(args: ParsedArgs) {
  const apiUrl = resolveApiUrl(args.options);
  const token = resolveToken(args.options);
  const client = new MyNotionClient({ apiUrl, token });
  const status = await client.authStatus();
  const showToken = Boolean(args.options["show-token"]);

  writeOutput(
    {
      authenticated: status.authenticated,
      apiUrl,
      tokenPrefix: status.tokenPrefix,
      token: showToken ? readStringOption(args.options, "token") ?? loadConfig().token : undefined,
      scopes: status.scopes,
      expiresAt: status.expiresAt,
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}

async function logout(args: ParsedArgs) {
  const nextConfig = clearSavedToken();

  writeOutput(
    {
      loggedOut: true,
      apiUrl: nextConfig.apiUrl,
      hasToken: Boolean(nextConfig.token),
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}
