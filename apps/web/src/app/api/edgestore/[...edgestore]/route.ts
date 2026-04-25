import { createEdgeStoreNextHandler } from "@edgestore/server/adapters/next/app";
import { edgeStoreRouter } from "@/src/lib/edgestore-router";

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

export type { EdgeStoreRouter } from "@/src/lib/edgestore-router";
