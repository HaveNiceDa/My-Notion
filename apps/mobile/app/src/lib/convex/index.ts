import { initConvexClient } from "@notion/convex/client";

export const convex = initConvexClient(process.env.EXPO_PUBLIC_CONVEX_URL!);
