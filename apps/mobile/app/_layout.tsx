import { ConvexProvider } from "convex/react";
import { Stack } from "expo-router";

import { convex } from "@/app/src/lib/convex";

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Stack>
        <Stack.Screen name="index" />
      </Stack>
    </ConvexProvider>
  );
}
