import { createAnimations } from "@tamagui/animations-react-native";
import { defaultConfig } from "@tamagui/config/v5";
import { createTamagui } from "tamagui";

const animations = createAnimations({
  fast: {
    damping: 22,
    mass: 1,
    stiffness: 320,
  },
  medium: {
    damping: 18,
    mass: 0.95,
    stiffness: 180,
  },
  slow: {
    damping: 20,
    mass: 1.05,
    stiffness: 110,
  },
  bouncy: {
    damping: 12,
    mass: 0.9,
    stiffness: 140,
  },
  lazy: {
    damping: 19,
    mass: 1,
    stiffness: 90,
  },
  quick: {
    damping: 24,
    mass: 1,
    stiffness: 360,
  },
});

export const config = createTamagui({
  ...defaultConfig,
  animations,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: "#ffffff",
      backgroundHover: "#f5f5f5",
      backgroundPress: "#e5e5e5",
      color: "#171717",
      colorHover: "#262626",
      colorPress: "#404040",
      borderColor: "#e5e5e5",
      borderColorHover: "#d4d4d4",
      borderColorPress: "#a3a3a3",
      placeholderColor: "#a3a3a3",
      primary: "#3b82f6",
      primaryHover: "#2563eb",
      primaryPress: "#1d4ed8",
      primaryForeground: "#ffffff",
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: "#17181d",
      backgroundHover: "#20222a",
      backgroundPress: "#2a2d36",
      color: "#f3f4f6",
      colorHover: "#fbfcfd",
      colorPress: "#ffffff",
      borderColor: "#323644",
      borderColorHover: "#414759",
      borderColorPress: "#50586f",
      placeholderColor: "#9ca3af",
      primary: "#60a5fa",
      primaryHover: "#93c5fd",
      primaryPress: "#3b82f6",
      primaryForeground: "#ffffff",
    },
  },
  media: {
    ...defaultConfig.media,
  },
});

type OurConfig = typeof config;

declare module "tamagui" {
  interface TamaguiCustomConfig extends OurConfig {}
}
