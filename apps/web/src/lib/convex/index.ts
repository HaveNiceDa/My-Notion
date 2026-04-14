import { initConvexClient } from "@notion/convex/client";

export const convex = initConvexClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
