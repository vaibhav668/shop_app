import { type ReactNode, useId } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { artColors as a, colors as c, foil, foilStops } from '@/theme/tokens';

/**
 * Shaded produce illustrations drawn in SVG (the same art as the design board). They stand in
 * where there is no photo: the welcome screen, first-launch slides and empty states.
 */

type Ids = Record<
  | 'tomato'
  | 'orange'
  | 'leaf'
  | 'leafDeep'
  | 'bread'
  | 'milk'
  | 'foil'
  | 'carrot'
  | 'banana'
  | 'basket',
  string
>;

function useIds(): Ids {
  const base = `a${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const names = [
    'tomato',
    'orange',
    'leaf',
    'leafDeep',
    'bread',
    'milk',
    'foil',
    'carrot',
    'banana',
    'basket',
  ];
  return Object.fromEntries(names.map((n) => [n, `${base}${n}`])) as Ids;
}

const url = (id: string) => `url(#${id})`;

function ArtDefs({ ids }: { ids: Ids }) {
  return (
    <Defs>
      <RadialGradient id={ids.tomato} cx="0.35" cy="0.35" r="0.75">
        <Stop offset="0" stopColor={a.tomato} />
        <Stop offset="0.7" stopColor={c.danger} />
        <Stop offset="1" stopColor={a.tomatoDeep} />
      </RadialGradient>
      <RadialGradient id={ids.orange} cx="0.35" cy="0.35" r="0.75">
        <Stop offset="0" stopColor={c.goldBright} />
        <Stop offset="1" stopColor={c.crust} />
      </RadialGradient>
      <LinearGradient id={ids.leaf} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={a.leafBright} />
        <Stop offset="1" stopColor={c.forest} />
      </LinearGradient>
      <LinearGradient id={ids.leafDeep} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={c.brand} />
        <Stop offset="1" stopColor={c.forestDeep} />
      </LinearGradient>
      <LinearGradient id={ids.bread} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.gold} />
        <Stop offset="1" stopColor={c.crust} />
      </LinearGradient>
      <LinearGradient id={ids.milk} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={c.surface} />
        <Stop offset="0.7" stopColor={c.bg} />
        <Stop offset="1" stopColor={c.border} />
      </LinearGradient>
      <LinearGradient id={ids.foil} x1="0" y1="0" x2="1" y2="1">
        {foil.map((color, i) => (
          <Stop key={i} offset={foilStops[i]} stopColor={color} />
        ))}
      </LinearGradient>
      <LinearGradient id={ids.carrot} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={c.gold} />
        <Stop offset="1" stopColor={a.carrot} />
      </LinearGradient>
      <LinearGradient id={ids.banana} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={c.goldPale} />
        <Stop offset="1" stopColor={c.goldBright} />
      </LinearGradient>
      <LinearGradient id={ids.basket} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={c.forestMid} />
        <Stop offset="1" stopColor={c.forestDeep} />
      </LinearGradient>
    </Defs>
  );
}

/** Each shape is drawn in a 64×64 box. */
const SHAPES = {
  tomato: (g: Ids) => (
    <G>
      <Circle cx={32} cy={37} r={21} fill={url(g.tomato)} />
      <Ellipse
        cx={23}
        cy={29}
        rx={6}
        ry={4}
        fill={c.surface}
        opacity={0.35}
        transform="rotate(-25 23 29)"
      />
      <Path
        d="M32 18l4-6 1 7 7-2-5 6 7 3-9 1-5 4-5-4-9-1 7-3-5-6 7 2 1-7z"
        fill={url(g.leafDeep)}
      />
    </G>
  ),
  greens: (g: Ids) => (
    <G>
      <Path d="M32 58C18 50 12 34 20 14c10 10 14 26 12 44z" fill={url(g.leaf)} />
      <Path d="M32 58c14-8 20-24 12-44-10 10-14 26-12 44z" fill={url(g.leafDeep)} />
      <Path d="M32 58c-3-16 0-32 0-46 6 12 6 30 0 46z" fill={c.leaf} />
      <Path d="M32 56V16" stroke={c.brandTint} strokeWidth={1.2} opacity={0.7} />
    </G>
  ),
  bread: (g: Ids) => (
    <G>
      <Path
        d="M8 36c0-13 11-21 24-21s24 8 24 21v10a5 5 0 0 1-5 5H13a5 5 0 0 1-5-5z"
        fill={c.crust}
      />
      <Path
        d="M11 37c0-11 10-18 21-18s21 7 21 18v9a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z"
        fill={url(g.bread)}
      />
      <Path
        d="M22 26l-4 8M32 23v10M42 26l4 8"
        stroke={c.goldSoft}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Ellipse cx={24} cy={24} rx={7} ry={2.5} fill={c.surface} opacity={0.25} />
    </G>
  ),
  milk: (g: Ids) => (
    <G>
      <Rect x={24} y={4} width={16} height={9} rx={3} fill={url(g.leafDeep)} />
      <Path
        d="M22 15h20l4 8v31a5 5 0 0 1-5 5H23a5 5 0 0 1-5-5V23z"
        fill={url(g.milk)}
        stroke={c.border}
        strokeWidth={1.2}
      />
      <Rect x={18} y={30} width={28} height={16} fill={c.forest} />
      <Path
        d="M24 38c2.5-3 5 3 8 0s5.5 3 8 0"
        stroke={c.goldBright}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M22 17h4l-3 6h-5z" fill={c.surface} opacity={0.9} />
    </G>
  ),
  banana: (g: Ids) => (
    <G>
      <Path
        d="M12 20c4 20 20 32 40 30 4-1 5-4 2-5-16 1-28-9-34-26-2-3-9-3-8 1z"
        fill={url(g.banana)}
      />
      <Path
        d="M16 20c6 16 18 25 34 26"
        stroke={c.gold}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M11 18l3-4 3 3z" fill={c.forestMid} />
      <Path d="M52 49l3 1-1 3z" fill={c.crust} />
    </G>
  ),
  carrot: (g: Ids) => (
    <G>
      <Path
        d="M22 22c6-6 16-6 20 0 2 4-10 26-18 36-3 3-6 1-5-2 2-12-2-28 3-34z"
        fill={url(g.carrot)}
      />
      <Path
        d="M28 30h6M26 38h6M25 46h4"
        stroke={c.crust}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Path
        d="M32 20c-2-8 0-12 2-14 1 6 0 10-2 14zM34 20c4-6 9-8 12-8-3 5-7 8-12 8zM30 20c-5-4-10-5-13-4 4 4 8 5 13 4z"
        fill={url(g.leafDeep)}
      />
    </G>
  ),
  orange: (g: Ids) => (
    <G>
      <Circle cx={32} cy={36} r={20} fill={url(g.orange)} />
      <Circle cx={25} cy={29} r={4} fill={c.surface} opacity={0.35} />
      <Path d="M32 16c2-6 8-8 12-8-2 6-7 8-12 8z" fill={url(g.leafDeep)} />
    </G>
  ),
  eggs: () => (
    <G>
      <Rect
        x={6}
        y={36}
        width={52}
        height={16}
        rx={6}
        fill={c.tintSand}
        stroke={c.border}
        strokeWidth={1.5}
      />
      <Ellipse cx={18} cy={34} rx={8} ry={10} fill={a.shell} stroke={c.border} strokeWidth={1.5} />
      <Ellipse
        cx={32}
        cy={31}
        rx={8}
        ry={10}
        fill={c.surface}
        stroke={c.border}
        strokeWidth={1.5}
      />
      <Ellipse cx={46} cy={34} rx={8} ry={10} fill={a.shell} stroke={c.border} strokeWidth={1.5} />
    </G>
  ),
  coin: (g: Ids) => (
    <G>
      <Circle cx={32} cy={32} r={24} fill={url(g.foil)} />
      <Circle
        cx={32}
        cy={32}
        r={18}
        fill="none"
        stroke={c.goldDeep}
        strokeWidth={1.5}
        strokeDasharray="2 3"
      />
      <SvgText x={32} y={40} textAnchor="middle" fontWeight="800" fontSize={22} fill={c.goldDeep}>
        ₹
      </SvgText>
    </G>
  ),
  scooter: () => (
    <G>
      <Rect x={10} y={16} width={20} height={16} rx={4} fill={c.goldBright} />
      <Path d="M13 20h14" stroke={c.crust} strokeWidth={2} />
      <Path d="M8 34h28l6-12h6l-6 14 4 8H14z" fill={c.forest} />
      <Circle cx={16} cy={46} r={7} fill={c.text} />
      <Circle cx={16} cy={46} r={3} fill={c.border} />
      <Circle cx={48} cy={46} r={7} fill={c.text} />
      <Circle cx={48} cy={46} r={3} fill={c.border} />
      <Circle cx={40} cy={12} r={5} fill={c.crust} />
      <Path d="M36 18h8l2 8h-12z" fill={c.forestMid} />
    </G>
  ),
} satisfies Record<string, (g: Ids) => ReactNode>;

export type ProduceKind = keyof typeof SHAPES;

export function ProduceArt({ kind, size = 64 }: { kind: ProduceKind; size?: number }) {
  const ids = useIds();
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <ArtDefs ids={ids} />
      {SHAPES[kind](ids)}
    </Svg>
  );
}

/** A woven forest basket piled with produce, with a gold-foil rim. */
export function BasketArt({ size = 180 }: { size?: number }) {
  const ids = useIds();
  const place = (kind: ProduceKind, x: number, y: number, s: number) => (
    <G transform={`translate(${x} ${y}) scale(${s})`}>{SHAPES[kind](ids)}</G>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <ArtDefs ids={ids} />
      {place('greens', 16, 4, 0.64)}
      {place('bread', 50, -2, 0.62)}
      {place('carrot', 68, 16, 0.56)}
      {place('banana', 4, 28, 0.52)}
      {place('tomato', 36, 26, 0.52)}
      {place('orange', 62, 30, 0.48)}
      <Path d="M8 58h104l-10 50a8 8 0 0 1-8 6H26a8 8 0 0 1-8-6z" fill={url(ids.basket)} />
      <Path d="M14 70h92M17 84h86M21 98h78" stroke={c.forestMid} strokeWidth={4} />
      <Path
        d="M34 60l4 52M60 60v52M86 60l-4 52"
        stroke={c.forestDeep}
        strokeWidth={3}
        opacity={0.5}
      />
      <Rect x={4} y={52} width={112} height={12} rx={6} fill={url(ids.foil)} />
      <Path
        d="M40 52c0-26 40-26 40 0"
        stroke={c.crust}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The gold seal stamped on a placed order (a foil star with a forest centre). */
export function SealArt({ size = 140, children }: { size?: number; children?: ReactNode }) {
  const ids = useIds();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <ArtDefs ids={ids} />
      <Polygon
        fill={url(ids.foil)}
        points="50,2 58,11 70,6 74,18 87,18 85,30 96,37 88,46 94,57 83,63 84,76 71,77 66,89 55,84 45,94 38,84 26,88 22,76 9,74 12,62 3,54 11,45 5,33 17,28 17,15 30,17 36,6 46,12"
      />
      <Circle cx={50} cy={50} r={32} fill={c.forestDeep} />
      <Circle
        cx={50}
        cy={50}
        r={32}
        fill="none"
        stroke={c.goldBright}
        strokeWidth={1.5}
        strokeDasharray="2 3"
      />
      {children}
    </Svg>
  );
}
