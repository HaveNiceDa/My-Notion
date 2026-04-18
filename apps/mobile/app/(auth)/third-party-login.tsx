import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSSO } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function ThirdPartyLoginPage() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const redirectUrl = Linking.createURL("/(auth)/third-party-login");

  const handleGoogleSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.push("/" as Href);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_github",
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.push("/" as Href);
      }
    } catch (error) {
      console.error("GitHub sign-in error:", error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Sign in
      </ThemedText>

      <ThemedText style={styles.subtitle}>
        Continue with your preferred account
      </ThemedText>

      <View style={styles.socialButtons}>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            styles.googleButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGoogleSignIn}
        >
          <ThemedText style={styles.socialButtonText}>
            Continue with Google
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            styles.githubButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleGitHubSignIn}
        >
          <ThemedText style={styles.socialButtonText}>
            Continue with GitHub
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.linkContainer}>
        <ThemedText>Or </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">sign in with password</ThemedText>
        </Link>
      </View>

      <View style={styles.linkContainer}>
        <ThemedText>Don&apos;t have an account? </ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">Sign up</ThemedText>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 24,
    justifyContent: "center",
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 24,
  },
  socialButtons: {
    gap: 16,
  },
  socialButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  googleButton: {
    backgroundColor: "#4285F4",
  },
  githubButton: {
    backgroundColor: "#333",
  },
  socialButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  linkContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
