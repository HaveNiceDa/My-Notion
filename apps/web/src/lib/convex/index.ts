import { ConvexClient } from "@notion/convex/client";

export const convex = ConvexClient.getClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!,
);
