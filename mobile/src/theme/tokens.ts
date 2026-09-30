/**
 * "Emerald Royal" design tokens: forest emerald and gold on warm cream. The ONLY file in
 * mobile/src allowed to contain hex colours (enforced by scripts/check-palette.mjs).
 * Spec: docs/UI_SYSTEM.md.
 */
export const colors = {
  // Greens
  brand: '#16A34A', // icons, active states, completed timeline
  action: '#14532D', // forest: filled buttons, green text (10:1 on white)
  actionPressed: '#052E16',
  forest: '#14532D',
  forestDeep: '#052E16',
  forestMid: '#166534',
  leaf: '#86EFAC',
  brandTint: '#DCFCE7',

  // Gold
  gold: '#F59E0B',
  goldBright: '#FBBF24', // text and icons on forest
  goldPale: '#FDE68A',
  goldSoft: '#FEF3C7',
  goldDeep: '#92400E', // text on gold tints
  crust: '#B45309',

  // Neutrals
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F5F4',
  text: '#171717',
  textSecondary: '#737373',
  textTertiary: '#A3A3A3',
  onAction: '#FFFFFF',
  onForestMuted: 'rgba(255, 255, 255, 0.75)',
  glass: 'rgba(255, 255, 255, 0.12)',
  border: '#E7E5E4',
  borderStrong: '#D6D3D1',

  // Soft tints behind product art, one per category family
  tintMint: '#E3F7E8',
  tintSage: '#E8EFE2',
  tintButter: '#FEF6D8',
  tintPeach: '#FFEEDC',
  tintSand: '#F3EDE2',
  tintLime: '#EEF7D6',

  // Legacy names, kept so older screens keep working
  offer: '#F59E0B',
  offerTint: '#FEF3C7',
  offerText: '#92400E',

  danger: '#DC2626',
  dangerTint: '#FEE2E2',

  scrim: 'rgba(23, 23, 23, 0.4)',
} as const;

/** Extra colours used only inside the produce illustrations (components/art). */
export const artColors = {
  tomato: '#EF4444',
  tomatoDeep: '#991B1B',
  carrot: '#F97316',
  leafBright: '#4ADE80',
  shell: '#FDF6E7',
} as const;

/** Foil: the gold gradient used on ribbons, the brand mark, the seal and savings banners. */
export const foil = ['#FDE68A', '#F59E0B', '#B45309', '#FBBF24', '#FEF3C7'] as const;
export const foilStops = [0, 0.38, 0.55, 0.72, 1] as const;

/** Header gradient: forest to deep forest. */
export const forestGradient = ['#14532D', '#052E16'] as const;

export const tints = [
  colors.tintMint,
  colors.tintSage,
  colors.tintButter,
  colors.tintPeach,
  colors.tintSand,
  colors.tintLime,
] as const;

/** A stable tint for any id, so a product keeps its colour between screens. */
export function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return tints[Math.abs(h) % tints.length];
}

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
  sm: 8, // badges, small thumbs
  md: 14, // buttons, inputs, steppers
  lg: 20, // cards, tiles
  xl: 24, // banners, hero cards
  xxl: 28, // sheets, the header's bottom corners
  full: 999,
} as const;

// Shadows are tinted with deep forest, never grey-black, so they read as warm depth.
const shadowColor = '#052E16';

export const shadow = {
  sm: {
    shadowColor,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  /** Things that float over content: the cart pill, the tab bar, sheets, toasts. */
  float: {
    shadowColor,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

/** @deprecated use shadow.float */
export const floatShadow = shadow.float;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const motion = {
  fast: 120,
  base: 180,
  slow: 250,
  slower: 400,
} as const;

/** Spring presets for Reanimated's withSpring. */
export const springs = {
  /** Presses: quick and firm. */
  press: { damping: 18, stiffness: 320, mass: 0.6 },
  /** Layout changes such as the tab pill growing. */
  layout: { damping: 20, stiffness: 220, mass: 0.8 },
  /** A playful bounce for the cart pill and the seal. */
  bouncy: { damping: 9, stiffness: 260, mass: 0.6 },
} as const;

export type ColorName = keyof typeof colors;
