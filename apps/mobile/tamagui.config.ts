import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: '#f7f7f5',
      backgroundHover: '#efefec',
      backgroundPress: '#e6e6e2',
      color: '#171717',
      colorHover: '#262626',
      colorPress: '#404040',
      borderColor: '#e5e5e5',
      borderColorHover: '#d4d4d4',
      borderColorPress: '#a3a3a3',
      placeholderColor: '#a3a3a3',
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      primaryPress: '#5b21b6',
      primaryForeground: '#ffffff',
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: '#0f0f10',
      backgroundHover: '#1a1a1d',
      backgroundPress: '#26262a',
      color: '#fafafa',
      colorHover: '#f5f5f5',
      colorPress: '#e5e5e5',
      borderColor: '#2a2a30',
      borderColorHover: '#3a3a40',
      borderColorPress: '#4b4b52',
      placeholderColor: '#737373',
      primary: '#8b5cf6',
      primaryHover: '#7c3aed',
      primaryPress: '#6d28d9',
      primaryForeground: '#ffffff',
    },
  },
  media: {
    ...defaultConfig.media,
  },
})

type OurConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends OurConfig {}
}