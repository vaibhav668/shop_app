import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Pattern, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type JaaliProps = {
  /** Line colour: gold on forest (default), green on light surfaces. */
  color?: string;
  opacity?: number;
  /** Size of one repeat of the lattice. */
  tile?: number;
};

/**
 * The carved lattice of a palace window screen, drawn as overlapping circles. It sits behind the
 * content of forest headers and the order-placed screen: texture that never competes with text.
 */
export function Jaali({ color = colors.goldBright, opacity = 0.22, tile = 36 }: JaaliProps) {
  const id = `j${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const h = tile / 2;
  const dot = tile / 9;
  return (
    <View style={[StyleSheet.absoluteFill, styles.passThrough]} aria-hidden>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse">
            <G fill="none" stroke={color} strokeWidth={0.9} opacity={opacity}>
              <Circle cx={0} cy={0} r={h} />
              <Circle cx={tile} cy={0} r={h} />
              <Circle cx={0} cy={tile} r={h} />
              <Circle cx={tile} cy={tile} r={h} />
              <Circle cx={h} cy={h} r={h} />
              <Circle cx={h} cy={h} r={dot} />
              <Circle cx={0} cy={0} r={dot} />
              <Circle cx={tile} cy={tile} r={dot} />
              <Circle cx={tile} cy={0} r={dot} />
              <Circle cx={0} cy={tile} r={dot} />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  passThrough: { pointerEvents: 'none' },
});
