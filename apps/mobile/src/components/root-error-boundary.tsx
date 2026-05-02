import React from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Runtime Error</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error?.message}</Text>
            <Text style={styles.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "#ff6b6b",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  message: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  stack: {
    color: "#a0a0a0",
    fontSize: 12,
    fontFamily: "monospace",
  },
});
