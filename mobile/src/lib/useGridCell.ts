import { useWindowDimensions } from 'react-native';

import { gutter, spacing } from '@/theme/tokens';

/**
 * An exact cell width for an N-column grid inside the screen gutters, so the last card of an
 * odd row is the same size as the others (flex fractions made it wider).
 */
export function useGridCell(columns: number, gap: number = spacing.sm) {
  const { width } = useWindowDimensions();
  const inner = width - gutter * 2;
  return { width: Math.floor((inner - gap * (columns - 1)) / columns) };
}
