import { Text, type TextProps } from 'react-native';
import tw from "twrnc";

import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  const typeStyle = (() => {
    switch (type) {
      case 'title':
        return tw`text-3xl font-bold leading-8`;
      case 'defaultSemiBold':
        return tw`text-base leading-6 font-semibold`;
      case 'subtitle':
        return tw`text-xl font-bold`;
      case 'link':
        return tw`leading-7 text-base text-[#0a7ea4]`;
      default:
        return tw`text-base leading-6`;
    }
  })();

  return (
    <Text
      style={[typeStyle, { color }, style]}
      {...rest}
    />
  );
}