import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth, useSignUp } from "@clerk/expo";
import { type Href, Link, useRouter } from "expo-router";
import React from "react";
import { Pressable, TextInput } from "react-native";
import tw from "twrnc";

export default function Page() {
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
      console.error(JSON.stringify(error, null, 2));
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
      console.error("Sign-up attempt not complete:", signUp);
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
      <ThemedView style={tw`flex-1 p-5 gap-3`}>
        <ThemedText type="title" style={tw`mb-2`}>
          Verify your account
        </ThemedText>
        <TextInput
          style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
          value={code}
          placeholder="Enter your verification code"
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
            tw`bg-[#0a7ea4] py-3 px-6 rounded-lg items-center mt-2 ${pressed ? "opacity-70" : ""} ${fetchStatus === "fetching" ? "opacity-50" : ""}`,
          ]}
          onPress={handleVerify}
          disabled={fetchStatus === "fetching"}
        >
          <ThemedText style={tw`text-white font-semibold`}>Verify</ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => tw`py-3 px-6 rounded-lg items-center mt-2 ${pressed ? "opacity-70" : ""}`}
          onPress={() => signUp.verifications.sendEmailCode()}
        >
          <ThemedText style={tw`text-[#0a7ea4] font-semibold`}>
            I need a new code
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={tw`flex-1 p-5 gap-3`}>
      <ThemedText type="title" style={tw`mb-2`}>
        Sign up
      </ThemedText>

      <ThemedText style={tw`font-semibold text-sm`}>Email address</ThemedText>
      <TextInput
        style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        placeholderTextColor="#666666"
        onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
        keyboardType="email-address"
      />
      {errors.fields.emailAddress && (
        <ThemedText style={tw`text-red-600 text-xs -mt-2`}>
          {errors.fields.emailAddress.message}
        </ThemedText>
      )}
      <ThemedText style={tw`font-semibold text-sm`}>Password</ThemedText>
      <TextInput
        style={tw`border border-gray-300 rounded-lg p-3 text-base bg-white`}
        value={password}
        placeholder="Enter password"
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
          tw`bg-[#0a7ea4] py-3 px-6 rounded-lg items-center mt-2 ${pressed ? "opacity-70" : ""} ${(!emailAddress || !password || fetchStatus === "fetching") ? "opacity-50" : ""}`,
        ]}
        onPress={handleSubmit}
        disabled={!emailAddress || !password || fetchStatus === "fetching"}
      >
        <ThemedText style={tw`text-white font-semibold`}>Sign up</ThemedText>
      </Pressable>
      {errors && (
        <ThemedText style={tw`text-xs opacity-50 mt-2`}>
          {JSON.stringify(errors, null, 2)}
        </ThemedText>
      )}

      <ThemedView style={tw`flex-row gap-1 mt-3 items-center`}>
        <ThemedText>Already have an account? </ThemedText>
        <Link href="/sign-in">
          <ThemedText type="link">Sign in</ThemedText>
        </Link>
      </ThemedView>

      <ThemedView nativeID="clerk-captcha" />
    </ThemedView>
  );
}