import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { TiroDevanagariHindi_400Regular } from '@expo-google-fonts/tiro-devanagari-hindi';
import type { TextStyle } from 'react-native';

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  TiroDevanagariHindi_400Regular,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Plus Jakarta Sans: headings, prices, buttons. */
  displaySemibold: 'PlusJakartaSans_600SemiBold',
  displayBold: 'PlusJakartaSans_700Bold',
  displayHeavy: 'PlusJakartaSans_800ExtraBold',
  /** For the Devanagari name, बड़ा बाज़ार. */
  devanagari: 'TiroDevanagariHindi_400Regular',
} as const;

// Weights are carried by the font family; fontWeight is omitted so Android doesn't fake-bold.
export const textVariants = {
  hero: { fontFamily: fonts.displayHeavy, fontSize: 32, lineHeight: 36, letterSpacing: -1 },
  display: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 31, letterSpacing: -0.8 },
  title: { fontFamily: fonts.displayHeavy, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.displayHeavy, fontSize: 17, lineHeight: 23, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  button: { fontFamily: fonts.displayHeavy, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  price: { fontFamily: fonts.displayHeavy, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  priceLg: { fontFamily: fonts.displayHeavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  tag: { fontFamily: fonts.displayHeavy, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  devanagari: { fontFamily: fonts.devanagari, fontSize: 20, lineHeight: 30 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof textVariants;
