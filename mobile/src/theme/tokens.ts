/**
 * "Fresh Market" design tokens. The ONLY file in mobile/src allowed to contain hex colours
 * (enforced by scripts/check-palette.mjs). Spec: docs/UI_SYSTEM.md.
 */
export const colors = {
  brand: '#16A34A', // icons, active states, completed timeline, large surfaces
  action: '#15803D', // filled buttons, green text (AA on white)
  actionPressed: '#166534',
  brandTint: '#DCFCE7',

  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F4',

  text: '#171717',
  textSecondary: '#737373',
  textTertiary: '#A3A3A3',
  onAction: '#FFFFFF',

  border: '#E7E5E4',
  borderStrong: '#D6D3D1',

  offer: '#F59E0B', // fill only, with dark text
  offerTint: '#FEF3C7',
  offerText: '#92400E',

  danger: '#DC2626',
  dangerTint: '#FEE2E2',

  scrim: 'rgba(23, 23, 23, 0.4)',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Screen side gutter. */
export const gutter = spacing.md;

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

/** The single floating elevation (cart bar, sheets, toasts). Everything else uses borders. */
export const floatShadow = {
  shadowColor: colors.text,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const motion = {
  fast: 120,
  base: 180,
  slow: 250,
} as const;

export type ColorName = keyof typeof colors;
