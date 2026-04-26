import { serve } from "@hono/node-server";
import app, { port } from "./index";
import { initSentry } from "./sentry";

initSentry();

console.log(`[AI Service] Starting on port ${port}...`);
serve({
  fetch: app.fetch,
  port,
});
