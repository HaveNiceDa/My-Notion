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
      background: '#17181d',
      backgroundHover: '#20222a',
      backgroundPress: '#2a2d36',
      color: '#f3f4f6',
      colorHover: '#fbfcfd',
      colorPress: '#ffffff',
      borderColor: '#323644',
      borderColorHover: '#414759',
      borderColorPress: '#50586f',
      placeholderColor: '#9ca3af',
      primary: '#a78bfa',
      primaryHover: '#c4b5fd',
      primaryPress: '#8b5cf6',
      primaryForeground: '#ffffff',
    },
    light_blue: {
      ...defaultConfig.themes.light,
      background: '#f4f8fb',
      backgroundHover: '#e8f0f6',
      backgroundPress: '#d9e6f1',
      color: '#102033',
      colorHover: '#0c1726',
      colorPress: '#08111c',
      borderColor: '#d6e0ea',
      borderColorHover: '#c3d3e2',
      borderColorPress: '#a8bfd4',
      placeholderColor: '#7b8aa0',
      primary: '#0f766e',
      primaryHover: '#115e59',
      primaryPress: '#134e4a',
      primaryForeground: '#ffffff',
    },
    dark_blue: {
      ...defaultConfig.themes.dark,
      background: '#13202b',
      backgroundHover: '#1a2b37',
      backgroundPress: '#243744',
      color: '#eaf4ff',
      colorHover: '#f5f9ff',
      colorPress: '#ffffff',
      borderColor: '#314658',
      borderColorHover: '#3e5b71',
      borderColorPress: '#517290',
      placeholderColor: '#95abc0',
      primary: '#38bdf8',
      primaryHover: '#67d4ff',
      primaryPress: '#0ea5e9',
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
