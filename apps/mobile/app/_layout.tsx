import { ConvexProvider } from "convex/react";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { convex } from "@/lib/convex";
import { I18nProvider } from "@/i18n/I18nProvider";
import "@/i18n";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ConvexProvider client={convex}>
          <I18nProvider>
            <Stack>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(home)" options={{ headerShown: false }} />
            </Stack>
          </I18nProvider>
        </ConvexProvider>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
