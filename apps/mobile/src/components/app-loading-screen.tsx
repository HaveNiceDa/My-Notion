import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type AppLoadingScreenProps = {
  message: string;
};

export function AppLoadingScreen({ message }: AppLoadingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#6b7280" />
        <Text style={styles.title}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  content: {
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "500",
  },
});
