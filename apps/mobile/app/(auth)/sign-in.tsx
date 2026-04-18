import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSignIn } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

  // Step 1: Create the sign-in
  const handleSubmit = async () => {
    setCustomError(null);
    const { error } = await signIn.password({
      emailAddress,
      password,
    });
    if (error) {
      // Check for specific error: 400 with code strategy_for_user_invalid
      if ((error as any)?.errors?.[0]?.code === "strategy_for_user_invalid") {
        setCustomError(t("Auth.strategyForUserInvalid"));
      }
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          // Handle session tasks
          // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }

          // If no session tasks, navigate the signed-in user to the home page
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url as Href);
          }
        },
      });
    } else if (signIn.status === "needs_second_factor") {
      // See https://clerk.com/docs/guides/development/custom-flows/authentication/multi-factor-authentication
      await signIn.mfa.sendPhoneCode();
    } else if (signIn.status === "needs_client_trust") {
      // For other second factor strategies,
      // see https://clerk.com/docs/guides/development/custom-flows/authentication/client-trust
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );

      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode();
      }
    } else {
      // Check why the sign-in is not complete
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

  // Step 2: Handle the MFA verification
  const handleMFAVerification = async () => {
    if (useBackupCode) {
      await signIn.mfa.verifyBackupCode({ code });
    } else {
      await signIn.mfa.verifyPhoneCode({ code });
      // If you're using the authenticator app strategy, use the following method instead:
      // await signIn.mfa.verifyTOTP({ code })
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          // Handle pending session tasks
          // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }
          // If no session tasks, navigate the signed-in user to the home page
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

  // Step 2 UI: Display the MFA verification form
  if (signIn.status === "needs_second_factor") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          {t("Auth.verifyYourAccount")}
        </ThemedText>
        <ThemedText style={styles.label}>{t("Auth.enterCode")}</ThemedText>
        <TextInput
          style={styles.input}
          value={code}
          placeholder={t("Auth.enterCode")}
          placeholderTextColor="#666666"
          onChangeText={(code) => setCode(code)}
          keyboardType="numeric"
        />
        {errors.fields.code && (
          <ThemedText style={styles.error}>
            {errors.fields.code.message}
          </ThemedText>
        )}
        <Pressable
          style={styles.backupRow}
          onPress={() => setUseBackupCode((v) => !v)}
        >
          <View
            style={[styles.checkbox, useBackupCode && styles.checkboxChecked]}
          >
            {useBackupCode && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <ThemedText style={styles.backupLabel}>{t("Auth.useBackupCode")}</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            fetchStatus === "fetching" && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleMFAVerification}
          disabled={fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>{t("Auth.verify")}</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => signIn.mfa.sendPhoneCode()}
        >
          <ThemedText style={styles.buttonText}>{t("Auth.needNewCode")}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code });

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ session, decorateUrl }) => {
          // Handle session tasks
          // See https://clerk.com/docs/guides/development/custom-flows/authentication/session-tasks
          if (session?.currentTask) {
            console.log(session?.currentTask);
            return;
          }

          // If no session tasks, navigate the signed-in user to the home page
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url as Href);
          }
        },
      });
    } else {
      // Check why the sign-in is not complete
      console.error("Sign-in attempt not complete:", signIn);
    }
  };

  if (signIn.status === "needs_client_trust") {
    return (
      <ThemedView style={styles.container}>
        <ThemedText
          type="title"
          style={[styles.title, { fontSize: 24, fontWeight: "bold" }]}
        >
          {t("Auth.verifyYourAccount")}
        </ThemedText>
        <TextInput
          style={styles.input}
          value={code}
          placeholder={t("Auth.enterCode")}
          placeholderTextColor="#666666"
          onChangeText={(code) => setCode(code)}
          keyboardType="numeric"
        />
        {errors.fields.code && (
          <ThemedText style={styles.error}>
            {errors.fields.code.message}
          </ThemedText>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            fetchStatus === "fetching" && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          <ThemedText style={styles.buttonText}>{t("Auth.verify")}</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <ThemedText style={styles.secondaryButtonText}>
            {t("Auth.needNewCode")}
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => signIn.reset()}
        >
          <ThemedText style={styles.secondaryButtonText}>{t("Auth.startOver")}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.form}>
          <ThemedText type="title" style={styles.title}>
            {t("Auth.signIn")}
          </ThemedText>

          <ThemedText style={styles.label}>{t("Auth.emailAddress")}</ThemedText>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={emailAddress}
            placeholder={t("Auth.enterEmail")}
            placeholderTextColor="#666666"
            onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
            keyboardType="email-address"
          />
          {errors.fields.identifier && (
            <ThemedText style={styles.error}>
              {errors.fields.identifier.message}
            </ThemedText>
          )}
          <ThemedText style={styles.label}>{t("Auth.password")}</ThemedText>
          <TextInput
            style={styles.input}
            value={password}
            placeholder={t("Auth.enterPassword")}
            placeholderTextColor="#666666"
            secureTextEntry={true}
            onChangeText={(password) => setPassword(password)}
          />
          {errors.fields.password && (
            <ThemedText style={styles.error}>
              {errors.fields.password.message}
            </ThemedText>
          )}

          {customError && (
            <ThemedText style={styles.error}>{customError}</ThemedText>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!emailAddress || !password || fetchStatus === "fetching") &&
                styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || fetchStatus === "fetching"}
          >
            <ThemedText style={styles.buttonText}>{t("Auth.continue")}</ThemedText>
          </Pressable>

          <View style={styles.footerRow}>
            <View style={styles.footerSignUp}>
              <ThemedText>{t("Auth.dontHaveAccount")}</ThemedText>
              <Link href="/sign-up">
                <ThemedText type="link">{t("Auth.signUp")}</ThemedText>
              </Link>
            </View>
            <View style={styles.footerThirdParty}>
              <Link href="/third-party-login">
                <ThemedText type="link">{t("Auth.thirdPartyLogin")}</ThemedText>
              </Link>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    gap: 12,
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  title: {
    marginBottom: 4,
    textAlign: "center",
  },
  label: {
    fontWeight: "600",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  secondaryButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
  linkContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    gap: 12,
    flexWrap: "wrap",
  },
  footerSignUp: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  footerThirdParty: {
    flexShrink: 0,
    alignSelf: "flex-end",
  },
  backupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#687076",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#0a7ea4",
    borderColor: "#0a7ea4",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 13,
    fontWeight: "bold",
    textAlign: "center",
    transform: [{ translateY: 1.5 }],
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  backupLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: "#d32f2f",
    fontSize: 12,
    marginTop: -8,
  },
  socialContainer: {
    marginTop: 16,
    marginBottom: 16,
  },
  socialText: {
    textAlign: "center",
    marginBottom: 12,
    fontSize: 14,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  socialButton: {
    flex: 1,
    paddingVertical: 12,
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
  },
});
