/**
 * Development-only gallery of every UI primitive, used to review the design system on a device.
 * Sample data here is fixture data for this screen only; real screens always read from the API.
 */
import { Redirect } from 'expo-router';
import { Plus, Search, ShoppingBasket } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  Money,
  OfflineBanner,
  QuantityStepper,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { colors, gutter, radius, spacing } from '@/theme/tokens';
import { type TextVariant, textVariants } from '@/theme/typography';

const SAMPLE_PRODUCTS: ProductCardData[] = [
  {
    id: 'milk',
    name: 'Toned Milk',
    unit_label: '500 ml',
    price_paise: 2800,
    mrp_paise: 2800,
    discount_percent: 0,
    image_url: null,
    is_available: true,
    stock_hint: 'IN_STOCK',
    max_per_order: 5,
  },
  {
    id: 'bread',
    name: 'Whole Wheat Bread, Freshly Baked',
    unit_label: '400 g',
    price_paise: 4500,
    mrp_paise: 5000,
    discount_percent: 10,
    image_url: null,
    is_available: true,
    stock_hint: 'LOW',
    max_per_order: 5,
  },
  {
    id: 'eggs',
    name: 'Farm Eggs',
    unit_label: '6 pcs',
    price_paise: 5450,
    mrp_paise: 6000,
    discount_percent: 9,
    image_url: null,
    is_available: true,
    stock_hint: 'IN_STOCK',
    max_per_order: 5,
  },
  {
    id: 'paneer',
    name: 'Fresh Paneer',
    unit_label: '200 g',
    price_paise: 9000,
    mrp_paise: 9500,
    discount_percent: 5,
    image_url: null,
    is_available: false,
    stock_hint: 'OUT',
    max_per_order: 5,
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

export default function UiKitScreen() {
  const [qty, setQty] = useState<Record<string, number>>({ eggs: 2 });
  const [chip, setChip] = useState('All');
  const [stepper, setStepper] = useState(1);
  const [offline, setOffline] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  const change = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  return (
    <View style={styles.root}>
      <OfflineBanner visible={offline} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Colours">
          <View style={styles.swatches}>
            {Object.entries(colors).map(([name, value]) => (
              <View key={name} style={styles.swatch}>
                <View style={[styles.swatchColor, { backgroundColor: value }]} />
                <Text variant="micro" color="textSecondary" numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="Typography">
          {(Object.keys(textVariants) as TextVariant[]).map((v) => (
            <Text key={v} variant={v}>
              {v} · Fresh groceries
            </Text>
          ))}
          <View style={styles.row}>
            <Money paise={4550} variant="bodyStrong" />
            <Money paise={5000} variant="caption" color="textTertiary" strike />
          </View>
        </Section>

        <Section title="Buttons">
          <View style={styles.stack}>
            <Button title="Place order" fullWidth />
            <Button title="Add address" variant="secondary" icon={Plus} />
            <Button title="See all" variant="ghost" />
            <Button title="Cancel order" variant="danger" />
            <View style={styles.row}>
              <Button title="Loading" loading />
              <Button title="Disabled" disabled />
              <Button title="Small" size="sm" />
            </View>
            <View style={styles.row}>
              <IconButton icon={Search} accessibilityLabel="Search" />
              <IconButton icon={ShoppingBasket} accessibilityLabel="Cart" outlined />
            </View>
          </View>
        </Section>

        <Section title="Inputs">
          <View style={styles.stack}>
            <Input label="House / flat" placeholder="e.g. B-204, Green Park" />
            <Input label="Pincode" keyboardType="number-pad" hint="We deliver within 5 km" />
            <Input label="Phone" value="98765" error="Enter a 10-digit mobile number" />
          </View>
        </Section>

        <Section title="Chips & badges">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['All', 'Dairy', 'Fruits & Vegetables', 'Snacks', 'Bakery'].map((c) => (
              <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
            ))}
          </ScrollView>
          <View style={[styles.row, { marginTop: spacing.sm, flexWrap: 'wrap' }]}>
            <Badge label="12% OFF" tone="offer" />
            <Badge label="Pending" tone="warning" />
            <Badge label="Preparing" tone="success" />
            <Badge label="Delivered" tone="successSolid" />
            <Badge label="Cancelled" tone="danger" />
            <Badge label="COD" />
          </View>
        </Section>

        <Section title="Quantity stepper">
          <View style={styles.row}>
            <QuantityStepper
              value={stepper}
              max={5}
              onIncrement={() => setStepper((v) => v + 1)}
              onDecrement={() => setStepper((v) => Math.max(1, v - 1))}
            />
            <QuantityStepper
              size="md"
              value={stepper}
              max={5}
              onIncrement={() => setStepper((v) => v + 1)}
              onDecrement={() => setStepper((v) => Math.max(1, v - 1))}
            />
            <Text variant="caption" color="textSecondary">
              Max 5 per order
            </Text>
          </View>
        </Section>

        <Section title="Product cards">
          <View style={styles.grid}>
            {SAMPLE_PRODUCTS.map((p) => (
              <View key={p.id} style={styles.gridItem}>
                <ProductCard
                  product={p}
                  cart={{
                    quantity: qty[p.id] ?? 0,
                    onAdd: () => change(p.id, 1),
                    onIncrement: () => change(p.id, 1),
                    onDecrement: () => change(p.id, -1),
                  }}
                />
              </View>
            ))}
          </View>
        </Section>

        <Section title="Skeletons">
          <View style={styles.row}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Skeleton height={140} radius={radius.lg} />
              <Skeleton height={14} width="80%" />
              <Skeleton height={12} width="40%" />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Skeleton height={140} radius={radius.lg} />
              <Skeleton height={14} width="70%" />
              <Skeleton height={12} width="35%" />
            </View>
          </View>
        </Section>

        <Section title="States">
          <View style={styles.panel}>
            <EmptyState
              icon={ShoppingBasket}
              title="Your cart is waiting for something good."
              actionLabel="Start shopping"
              onAction={() => {}}
            />
          </View>
          <View style={styles.panel}>
            <ErrorState onRetry={() => {}} />
          </View>
          <View style={styles.panel}>
            <ErrorState kind="offline" onRetry={() => {}} />
          </View>
          <Button
            title={offline ? 'Hide offline banner' : 'Show offline banner'}
            variant="secondary"
            onPress={() => setOffline((o) => !o)}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: gutter, paddingBottom: spacing.xxxl },
  section: { marginBottom: spacing.xxl },
  stack: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 72, gap: 4 },
  swatchColor: {
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '48%' },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
});
