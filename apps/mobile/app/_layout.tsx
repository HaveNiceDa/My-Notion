import { ConvexProvider } from "convex/react";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";

import { convex } from "@/lib/convex";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ConvexProvider client={convex}>
        <Stack>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(home)" options={{ headerShown: false }} />
        </Stack>
      </ConvexProvider>
    </ClerkProvider>
  );
}

// import { ClerkProvider } from '@clerk/expo'
// import { tokenCache } from '@clerk/expo/token-cache'
// import { Slot } from 'expo-router'

// const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

// if (!publishableKey) {
//   throw new Error('Add your Clerk Publishable Key to the .env file')
// }

// export default function RootLayout() {
//   return (
//     <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
//       <Slot />
//     </ClerkProvider>
//   )
// }
