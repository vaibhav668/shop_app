import { useId } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { foil, foilStops, forestGradient } from '@/theme/tokens';

export type GradientProps = {
  colors: readonly string[];
  /** Offsets from 0 to 1, one per colour. Evenly spaced when left out. */
  stops?: readonly number[];
  /** Angle in degrees: 90 runs top to bottom, 0 left to right. */
  angle?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

/** A gradient fill that sits behind its parent's content (absolute, ignores touches). */
export function Gradient({ colors, stops, angle = 90, borderRadius = 0, style }: GradientProps) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough, style]} aria-hidden>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
            {colors.map((c, i) => (
              <Stop
                key={i}
                offset={stops?.[i] ?? (colors.length === 1 ? 0 : i / (colors.length - 1))}
                stopColor={c}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" rx={borderRadius} ry={borderRadius} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** The gold foil: ribbons, the brand mark, the savings banner. */
export function Foil({ borderRadius = 0 }: { borderRadius?: number }) {
  return <Gradient colors={foil} stops={foilStops} angle={25} borderRadius={borderRadius} />;
}

/** The forest header and hero cards. */
export function ForestFill({ borderRadius = 0 }: { borderRadius?: number }) {
  return <Gradient colors={forestGradient} angle={70} borderRadius={borderRadius} />;
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
});
