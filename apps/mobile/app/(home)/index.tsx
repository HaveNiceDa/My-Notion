import { Show, useUser, useClerk } from "@clerk/expo";
import { Link } from "expo-router";
import { Text, View, Pressable } from "react-native";
import tw from "twrnc";

export default function Page() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <View style={tw`flex-1 p-5 pt-15 gap-4`}>
      <Text style={tw`text-2xl font-bold`}>Welcome!</Text>
      <Show when="signed-out">
        <Link href="/(auth)/sign-in">
          <Text>Sign in</Text>
        </Link>
        <Link href="/(auth)/sign-up">
          <Text>Sign up</Text>
        </Link>
      </Show>
      <Show when="signed-in">
        <Text>Hello {user?.id}</Text>
        <Pressable
          style={({ pressed }) => tw`bg-[#0a7ea4] py-3 px-6 rounded-lg items-center ${pressed ? "opacity-70" : ""}`}
          onPress={() => signOut()}
        >
          <Text style={tw`text-white font-semibold`}>Sign out</Text>
        </Pressable>
      </Show>
    </View>
  );
}