import { MyNotionClient } from "../client/http-client.js";
import {
  clearSavedToken,
  getConfigPath,
  readStringOption,
  resolveProfile,
  saveProfileAuth,
} from "../config/store.js";
import { runDeviceLogin } from "../auth/device-flow.js";
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
  const profile = resolveProfile(args.options);
  const token = readStringOption(args.options, "token") ?? process.env.MY_NOTION_API_TOKEN;

  if (!token) {
    const result = await runDeviceLogin(args);
    writeOutput(result, getOutputFormat(args.options, "pretty"));
    return;
  }

  const apiUrl = profile.apiUrl;
  const client = new MyNotionClient({ apiUrl, token });
  const status = await client.authStatus();
  saveProfileAuth({
    profileName: profile.name,
    apiUrl,
    webUrl: profile.webUrl,
    token,
    tokenPrefix: status.tokenPrefix,
    scopes: status.scopes,
    expiresAt: status.expiresAt,
    authMethod: "legacy-token",
  });

  writeOutput(
    {
      authenticated: status.authenticated,
      profile: profile.name,
      apiUrl,
      webUrl: profile.webUrl,
      tokenPrefix: status.tokenPrefix,
      scopes: status.scopes,
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}

async function status(args: ParsedArgs) {
  const profile = resolveProfile(args.options);
  if (!profile.token) {
    throw new Error(
      `Profile "${profile.name}" is not authenticated. Run \`my-notion auth login --profile ${profile.name}\`.`,
    );
  }

  const client = new MyNotionClient({ apiUrl: profile.apiUrl, token: profile.token });
  const status = await client.authStatus();
  const showToken = Boolean(args.options["show-token"]);

  writeOutput(
    {
      authenticated: status.authenticated,
      profile: profile.name,
      apiUrl: profile.apiUrl,
      webUrl: profile.webUrl,
      tokenPrefix: status.tokenPrefix,
      token: showToken ? profile.token : undefined,
      scopes: status.scopes,
      expiresAt: status.expiresAt,
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}

async function logout(args: ParsedArgs) {
  const result = clearSavedToken(args.options);

  writeOutput(
    {
      loggedOut: true,
      profile: result.profileName,
      apiUrl: result.profile.apiUrl,
      webUrl: result.profile.webUrl,
      hasToken: Boolean(result.profile.token),
      configPath: getConfigPath(),
    },
    getOutputFormat(args.options, "pretty"),
  );
}
