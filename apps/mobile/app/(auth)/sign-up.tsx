import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth, useSignUp } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, TextInput } from "react-native";
import { ScrollView } from "tamagui";
import tw from "twrnc";
import { useLanguage } from "@/i18n/useLanguage";

export default function Page() {
  const { t } = useLanguage();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");

  const handleSubmit = async () => {
    const { error } = await signUp.password({
      emailAddress,
      password,
    });
    if (error) {
      return;
    }

    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({
      code,
    });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
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
    }
  };

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <ThemedView style={tw`flex-1`}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={tw`flex-grow-1 px-6 py-8 justify-center`}
        >
          <ThemedView style={tw`w-full max-w-md self-center gap-3`}>
            <ThemedText type="title" style={tw`mb-2 text-center`}>
              {t("Auth.verifyYourAccount")}
            </ThemedText>
            <TextInput
              style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
              value={code}
              placeholder={t("Auth.enterCode")}
              placeholderTextColor="#666666"
              onChangeText={(code) => setCode(code)}
              keyboardType="numeric"
            />
            {errors.fields.code && (
              <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
                {errors.fields.code.message}
              </ThemedText>
            )}
            <Pressable
              style={({ pressed }) => [
                tw`bg-[#0a7ea4] py-3.5 px-6 rounded-lg items-center mt-4 ${pressed ? "opacity-70" : ""} ${fetchStatus === "fetching" ? "opacity-50" : ""}`,
              ]}
              onPress={handleVerify}
              disabled={fetchStatus === "fetching"}
            >
              <ThemedText style={tw`text-white font-semibold`}>
                {t("Auth.verify")}
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) =>
                tw`py-3 px-6 rounded-lg items-center mt-2 ${pressed ? "opacity-70" : ""}`
              }
              onPress={() => signUp.verifications.sendEmailCode()}
            >
              <ThemedText style={tw`text-[#0a7ea4] font-semibold`}>
                {t("Auth.needNewCode")}
              </ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={tw`flex-1`}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tw`flex-grow-1 px-6 py-8 justify-center`}
      >
        <ThemedView style={tw`w-full max-w-md self-center gap-3`}>
          <ThemedText type="title" style={tw`mb-1 text-center`}>
            {t("Auth.signUp")}
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
          {errors.fields.emailAddress && (
            <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
              {errors.fields.emailAddress.message}
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
          <Pressable
            style={({ pressed }) => [
              tw`bg-[#0a7ea4] py-3.5 px-6 rounded-lg items-center mt-4 ${pressed ? "opacity-70" : ""} ${!emailAddress || !password || fetchStatus === "fetching" ? "opacity-50" : ""}`,
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || fetchStatus === "fetching"}
          >
            <ThemedText style={tw`text-white font-semibold`}>
              {t("Auth.signUp")}
            </ThemedText>
          </Pressable>

          <ThemedView style={tw`flex-row gap-1 mt-5 items-center`}>
            <ThemedText>{t("Auth.alreadyHaveAccount")}</ThemedText>
            <Link href="/sign-in">
              <ThemedText type="link">{t("Auth.signIn")}</ThemedText>
            </Link>
          </ThemedView>

          <ThemedView nativeID="clerk-captcha" />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}
