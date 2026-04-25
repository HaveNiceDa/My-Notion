import { serve } from "@hono/node-server";
import app, { port } from "./index";

console.log(`[AI Service] Starting on port ${port}...`);
serve({
  fetch: app.fetch,
  port,
});
