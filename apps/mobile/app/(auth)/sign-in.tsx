import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, TextInput } from "react-native";
import { ScrollView } from "tamagui";
import tw from "twrnc";
import { useLanguage } from "@/i18n/useLanguage";

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const { t } = useLanguage();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [customError, setCustomError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setCustomError(null);
    const { error } = await signIn.password({
      emailAddress,
      password,
    });
    if (error) {
      if ((error as { errors?: Array<{ code: string }> })?.errors?.[0]?.code === "strategy_for_user_invalid") {
        setCustomError(t("Auth.strategyForUserInvalid"));
      }
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url as Href);
          }
        },
      });
    } else if (signIn.status === "needs_second_factor") {
      // 跳过二次验证，直接返回首页
      signIn.reset();
      router.push("/");
    } else if (signIn.status === "needs_client_trust") {
      // 跳过客户端信任验证，直接返回首页
      signIn.reset();
      router.push("/");
    } else {
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

  return (
    <ThemedView style={tw`flex-1`}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`flex-grow-1 px-6 py-8 justify-center`}
      >
        <ThemedView style={tw`w-full max-w-md self-center gap-3`}>
          <ThemedText type="title" style={tw`mb-1 text-center`}>
            {t("Auth.signIn")}
          </ThemedText>

          <ThemedText style={tw`font-semibold text-sm`}>
            {t("Auth.emailAddress")}
          </ThemedText>
          <TextInput
            style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
            autoCapitalize="none"
            value={emailAddress}
            placeholder={t("Auth.enterEmail")}
            placeholderTextColor="#666666"
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
            keyboardType="email-address"
          />
          {errors.fields.identifier && (
            <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
              {errors.fields.identifier.message}
            </ThemedText>
          )}
          <ThemedText style={tw`font-semibold text-sm`}>
            {t("Auth.password")}
          </ThemedText>
          <TextInput
            style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
            value={password}
            placeholder={t("Auth.enterPassword")}
            placeholderTextColor="#666666"
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
          />
          {errors.fields.password && (
            <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
              {errors.fields.password.message}
            </ThemedText>
          )}

          {customError && (
            <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
              {customError}
            </ThemedText>
          )}

          <Pressable
            style={({ pressed }) => [
              tw`bg-[#0a7ea4] py-3.5 px-6 rounded-lg items-center mt-4 ${pressed ? "opacity-70" : ""} ${!emailAddress || !password || fetchStatus === "fetching" ? "opacity-50" : ""}`,
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || fetchStatus === "fetching"}
          >
            <ThemedText style={tw`text-white font-semibold`}>
              {t("Auth.continue")}
            </ThemedText>
          </Pressable>

          <ThemedView
            style={tw`flex-row justify-between items-center mt-5 gap-3 flex-wrap`}
          >
            <ThemedView
              style={tw`flex-row flex-wrap items-center flex-1 min-w-0`}
            >
              <ThemedText>{t("Auth.dontHaveAccount")}</ThemedText>
              <Link href="/sign-up">
                <ThemedText type="link">{t("Auth.signUp")}</ThemedText>
              </Link>
            </ThemedView>
            <Link href="/third-party-login">
              <ThemedText type="link">{t("Auth.thirdPartyLogin")}</ThemedText>
            </Link>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
