import { Platform, useWindowDimensions } from 'react-native';

/** On a laptop browser the app sits in a centred column this wide, like a phone. */
export const MAX_APP_WIDTH = 480;

export const isWebFramed = Platform.OS === 'web';

/** The width the app actually lays out in: the screen on phones, the column on the web. */
export function useAppWidth(): number {
  const { width } = useWindowDimensions();
  return isWebFramed ? Math.min(width, MAX_APP_WIDTH) : width;
}
