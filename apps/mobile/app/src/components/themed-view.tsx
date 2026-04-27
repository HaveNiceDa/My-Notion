import { View, type ViewProps } from "tamagui";
import { StyleSheet, type ViewStyle } from "react-native";

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');
  const mergedStyle = StyleSheet.flatten([{ backgroundColor }, style] as unknown as ViewStyle[]);

  return <View style={mergedStyle} {...otherProps} />;
}
