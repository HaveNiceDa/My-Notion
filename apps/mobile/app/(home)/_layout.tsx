import { useAuth } from "@clerk/expo";
import { ActivityIndicator, Text, View, StyleSheet } from "react-native";
import { Redirect, Stack } from "expo-router";

export default function Layout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  text: {
    marginTop: 12,
    color: "#ffffff",
    fontSize: 14,
  },
});
