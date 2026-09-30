import { Image } from 'expo-image';
import { ShoppingBasket } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, shadow } from '@/theme/tokens';

export type Rect = { x: number; y: number; width: number; height: number };

/** Anything that can report where it is on screen (a View ref). */
type Measurable = {
  measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void;
};

type FlyToCartValue = {
  /** Fly a product picture from `from` (window coordinates) into the cart pill. */
  fly: (from: Rect, imageUri: string | null) => void;
  /** The cart pill registers itself as the landing spot; the latest mounted one wins. */
  registerTarget: (id: string, ref: RefObject<Measurable | null> | null) => void;
};

const FlyToCartContext = createContext<FlyToCartValue>({
  fly: () => {},
  registerTarget: () => {},
});

export const useFlyToCart = () => useContext(FlyToCartContext);

/** Measures a view in window coordinates; resolves null when it can't (tests, unmounted). */
export function measure(ref: RefObject<Measurable | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node?.measureInWindow) return resolve(null);
    node.measureInWindow((x, y, width, height) =>
      resolve(width > 0 ? { x, y, width, height } : null),
    );
  });
}

type Flight = { key: number; from: Rect; to: Rect; uri: string | null };

const FLIGHT_MS = 640;
const SIZE = 56;

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const targets = useRef(new Map<string, RefObject<Measurable | null>>());
  const [flights, setFlights] = useState<Flight[]>([]);
  const nextKey = useRef(0);

  const registerTarget = useCallback<FlyToCartValue['registerTarget']>((id, ref) => {
    if (ref) targets.current.set(id, ref);
    else targets.current.delete(id);
  }, []);

  const fly = useCallback<FlyToCartValue['fly']>(
    (from, uri) => {
      if (reduceMotion) return;
      const refs = [...targets.current.values()];
      const target = refs[refs.length - 1];
      // No cart pill yet (the first item): land where it is about to appear.
      const fallback: Rect = { x: width / 2 - 40, y: height - 150, width: 80, height: 40 };
      void (target ? measure(target) : Promise.resolve(null)).then((rect) => {
        const to = rect ? { ...rect, width: 60, x: rect.x + 8 } : fallback;
        const key = nextKey.current++;
        setFlights((all) => [...all.slice(-3), { key, from, to, uri }]);
      });
    },
    [reduceMotion, width, height],
  );

  const land = useCallback((key: number) => {
    setFlights((all) => all.filter((f) => f.key !== key));
  }, []);

  const value = useMemo(() => ({ fly, registerTarget }), [fly, registerTarget]);

  return (
    <FlyToCartContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
          {flights.map((f) => (
            <Flyer key={f.key} flight={f} onLanded={land} />
          ))}
        </View>
      </View>
    </FlyToCartContext.Provider>
  );
}

function Flyer({ flight, onLanded }: { flight: Flight; onLanded: (key: number) => void }) {
  const progress = useSharedValue(0);
  const { from, to } = flight;
  const fx = from.x + from.width / 2 - SIZE / 2;
  const fy = from.y + from.height / 2 - SIZE / 2;
  const tx = to.x + to.width / 2 - SIZE / 2;
  const ty = to.y + to.height / 2 - SIZE / 2;
  // How high the arc rises above the straight line.
  const lift = Math.min(160, Math.abs(ty - fy) * 0.5 + 60);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: FLIGHT_MS,
      easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
    });
    const timer = setTimeout(() => onLanded(flight.key), FLIGHT_MS + 40);
    return () => clearTimeout(timer);
  }, [progress, onLanded, flight.key]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [
        { translateX: fx + (tx - fx) * p },
        { translateY: fy + (ty - fy) * p - lift * 4 * p * (1 - p) },
        { scale: 1 - 0.6 * p },
        { rotate: `${-18 * Math.sin(p * Math.PI)}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.flyer, style]}>
      {flight.uri ? (
        <Image source={flight.uri} style={styles.image} contentFit="contain" />
      ) : (
        <ShoppingBasket size={26} strokeWidth={2} color={colors.forest} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  passThrough: { pointerEvents: 'none' },
  flyer: {
    ...shadow.md,
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  image: { width: '100%', height: '100%' },
});
