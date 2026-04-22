import { ConvexClient } from "@notion/convex/client";

export const convex = ConvexClient.getClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
);
