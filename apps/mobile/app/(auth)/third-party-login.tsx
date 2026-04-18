import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSSO } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React from "react";
import { Pressable } from "react-native";
import tw from "twrnc";
import { useLanguage } from "@/i18n/useLanguage";

export default function ThirdPartyLoginPage() {
  const { startSSOFlow } = useSSO();
  const router = useRouter();
  const { t } = useLanguage();

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
    <ThemedView style={tw`flex-1 p-5 gap-6 justify-center`}>
      <ThemedText type="title" style={tw`mb-2 text-center`}>
        {t("Auth.thirdPartyTitle")}
      </ThemedText>

      <ThemedText style={tw`text-center text-base mb-6`}>
        {t("Auth.thirdPartySubtitle")}
      </ThemedText>

      <Pressable
        style={({ pressed }) => tw`bg-[#4285F4] py-4 px-6 rounded-lg items-center ${pressed ? "opacity-70" : ""}`}
        onPress={handleGoogleSignIn}
      >
        <ThemedText style={tw`text-white font-semibold text-base`}>
          {t("Auth.continueWithGoogle")}
        </ThemedText>
      </Pressable>
      <Pressable
        style={({ pressed }) => tw`bg-[#333] py-4 px-6 rounded-lg items-center ${pressed ? "opacity-70" : ""}`}
        onPress={handleGitHubSignIn}
      >
        <ThemedText style={tw`text-white font-semibold text-base`}>
          {t("Auth.continueWithGithub")}
        </ThemedText>
      </Pressable>

      <ThemedView style={tw`flex-row gap-1 mt-2 items-center justify-center`}>
        <ThemedText>Or </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">{t("Auth.signInWithPassword")}</ThemedText>
        </Link>
      </ThemedView>

      <ThemedView style={tw`flex-row gap-1 mt-2 items-center justify-center`}>
        <ThemedText>{t("Auth.dontHaveAccount")}</ThemedText>
        <Link href="/sign-up">
          <ThemedText type="link">{t("Auth.signUp")}</ThemedText>
        </Link>
      </ThemedView>
    </ThemedView>
  );
}