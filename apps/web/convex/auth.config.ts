import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://whole-badger-19.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
