import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import tw from "twrnc";
import { useLanguage } from "@/i18n/useLanguage";

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const { t } = useLanguage();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [useBackupCode, setUseBackupCode] = React.useState(false);
  const [customError, setCustomError] = React.useState<string | null>(null);

  const handleSubmit = async () => {
    setCustomError(null);
    const { error } = await signIn.password({
      emailAddress,
      password,
    });
    if (error) {
      if ((error as any)?.errors?.[0]?.code === "strategy_for_user_invalid") {
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
      await signIn.mfa.sendPhoneCode();
    } else if (signIn.status === "needs_client_trust") {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
      }
    } else {
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

  const handleMFAVerification = async () => {
    if (useBackupCode) {
      await signIn.mfa.verifyBackupCode({ code });
    } else {
      await signIn.mfa.verifyPhoneCode({ code });
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
    }
  };

  if (signIn.status === "needs_second_factor") {
    return (
      <ThemedView style={tw`flex-1 p-5 gap-3`}>
        <ThemedText type="title" style={tw`mb-1 text-center`}>
          {t("Auth.verifyYourAccount")}
        </ThemedText>
        <ThemedText style={tw`font-semibold text-sm`}>
          {t("Auth.enterCode")}
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
          style={tw`flex-row items-center gap-2 mt-1`}
          onPress={() => setUseBackupCode((v) => !v)}
        >
          <Pressable
            style={tw`w-6 h-6 border-2 border-gray-500 rounded items-center justify-center ${useBackupCode ? "bg-[#0a7ea4] border-[#0a7ea4]" : ""}`}
          >
            {useBackupCode && (
              <Text style={tw`text-white text-xs font-bold text-center`}>
                ✓
              </Text>
            )}
          </Pressable>
          <ThemedText style={tw`text-sm leading-5`}>
            {t("Auth.useBackupCode")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            tw`bg-[#0a7ea4] py-3.5 px-6 rounded-lg items-center mt-4 ${pressed ? "opacity-70" : ""} ${fetchStatus === "fetching" ? "opacity-50" : ""}`,
          ]}
          onPress={handleMFAVerification}
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
          onPress={() => signIn.mfa.sendPhoneCode()}
        >
          <ThemedText style={tw`text-[#0a7ea4] font-semibold`}>
            {t("Auth.needNewCode")}
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });

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
    } else {
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <ThemedView style={tw`flex-1 p-5 gap-3`}>
        <ThemedText type="title" style={tw`text-2xl font-bold text-center`}>
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
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <ThemedText style={tw`text-[#0a7ea4] font-semibold`}>
            {t("Auth.needNewCode")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) =>
            tw`py-3 px-6 rounded-lg items-center mt-2 ${pressed ? "opacity-70" : ""}`
          }
          onPress={() => signIn.reset()}
        >
          <ThemedText style={tw`text-[#0a7ea4] font-semibold`}>
            {t("Auth.startOver")}
          </ThemedText>
        </Pressable>
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
