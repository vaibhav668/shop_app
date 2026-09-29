import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AlertCircle, Banknote, CreditCard, MapPinPlus, ShoppingBasket } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type CheckoutQuote, checkoutApi, type PaymentMethod } from '@/api/addresses';
import { queryKeys } from '@/api/queryClient';
import { AddressSummary } from '@/components/AddressCard';
import { QueryError } from '@/components/QueryError';
import { Button, EmptyState, Money, Skeleton, Text } from '@/components/ui';
import {
  resolveCheckoutAddress,
  useAddresses,
  useSelectedCheckoutAddressId,
} from '@/features/addresses/hooks';
import { checkoutItems } from '@/features/cart/cartMath';
import { useCart } from '@/features/cart/hooks';
import { formatPaise } from '@/lib/money';
import { colors, gutter, radius, spacing } from '@/theme/tokens';

const METHOD_COPY: Record<PaymentMethod, { title: string; detail: string; icon: typeof Banknote }> =
  {
    COD: {
      title: 'Cash on delivery',
      detail: 'Pay by cash or UPI when your order arrives',
      icon: Banknote,
    },
    ONLINE: { title: 'Pay online', detail: 'UPI, cards and net banking', icon: CreditCard },
  };

export default function CheckoutScreen() {
  const cart = useCart();
  const addresses = useAddresses();
  const chosenId = useSelectedCheckoutAddressId();
  const address = resolveCheckoutAddress(addresses.data, chosenId);
  const items = useMemo(() => checkoutItems(cart.data), [cart.data]);

  const quote = useQuery({
    queryKey: queryKeys.checkoutQuote(address?.id ?? '', items),
    queryFn: () => checkoutApi.quote(address!.id, items),
    enabled: !!address && items.length > 0,
    staleTime: 0, // prices and stock can change; always re-check on arrival
    placeholderData: keepPreviousData, // keep the screen steady while switching address
  });

  if (cart.isPending || addresses.isPending) return <CheckoutSkeleton />;
  if (cart.isError) return <QueryError error={cart.error} onRetry={cart.refetch} />;
  if (addresses.isError) return <QueryError error={addresses.error} onRetry={addresses.refetch} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBasket}
        title="Your cart is empty"
        actionLabel="Start shopping"
        onAction={() => router.dismissTo('/')}
      />
    );
  }
  if (!address) {
    return (
      <EmptyState
        icon={MapPinPlus}
        title="Where should we deliver?"
        message="Add your address to see the final bill."
        actionLabel="Add address"
        onAction={() => router.push({ pathname: '/addresses/form', params: { select: '1' } })}
      />
    );
  }

  return (
    <CheckoutBody
      addressSection={
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text variant="label" color="textSecondary">
              DELIVER TO
            </Text>
            <Pressable
              onPress={() => router.push('/addresses/pick')}
              accessibilityRole="button"
              accessibilityLabel="Change delivery address"
              hitSlop={8}
            >
              <Text variant="label" color="action">
                Change
              </Text>
            </Pressable>
          </View>
          <AddressSummary address={address} showDefault={false} />
        </View>
      }
      quote={quote.data}
      loading={quote.isPending || (quote.isFetching && quote.isPlaceholderData)}
      error={quote.isError ? quote.error : null}
      onRetry={quote.refetch}
    />
  );
}

function CheckoutBody({
  addressSection,
  quote,
  loading,
  error,
  onRetry,
}: {
  addressSection: React.ReactNode;
  quote: CheckoutQuote | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<PaymentMethod | null>(null);
  const methods = quote?.payment_methods ?? [];
  const method = picked && methods.includes(picked) ? picked : (methods[0] ?? null);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {addressSection}

        {error && !quote ? (
          <View style={styles.card}>
            <QueryError error={error} onRetry={onRetry} />
          </View>
        ) : !quote ? (
          <Skeleton height={220} radius={radius.lg} />
        ) : (
          <>
            {quote.issues.map((issue) => (
              <View key={issue.code} style={styles.issue} accessibilityRole="alert">
                <AlertCircle size={18} color={colors.danger} />
                <Text variant="label" color="danger" style={styles.flex}>
                  {issue.message}
                </Text>
                {issue.code === 'ITEMS_CHANGED' || issue.code === 'BELOW_MIN_ORDER' ? (
                  <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
                    <Text variant="label" color="action">
                      Edit cart
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            <View style={styles.card}>
              <Text variant="label" color="textSecondary">
                {quote.item_count} {quote.item_count === 1 ? 'ITEM' : 'ITEMS'}
              </Text>
              {quote.lines.map((line) => (
                <View key={line.product.id} style={styles.itemRow}>
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={styles.flex}
                    color={line.issue ? 'textTertiary' : 'text'}
                  >
                    {line.product.name}{' '}
                    <Text variant="body" color="textSecondary">
                      × {line.available_quantity}
                    </Text>
                  </Text>
                  <Money paise={line.line_total_paise} />
                </View>
              ))}
            </View>

            {methods.length > 0 ? (
              <View style={styles.card} accessibilityRole="radiogroup">
                <Text variant="label" color="textSecondary">
                  PAYMENT
                </Text>
                {methods.map((m) => {
                  const copy = METHOD_COPY[m];
                  const selected = m === method;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setPicked(m)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[styles.method, selected && styles.methodSelected]}
                    >
                      <copy.icon size={20} strokeWidth={1.75} color={colors.brand} />
                      <View style={styles.flex}>
                        <Text variant="bodyStrong">{copy.title}</Text>
                        <Text variant="caption" color="textSecondary">
                          {copy.detail}
                        </Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioOn]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.card}>
              <Text variant="heading">Bill details</Text>
              <BillRow label="Items total" paise={quote.subtotal_paise} />
              <BillRow label="Delivery fee" paise={quote.delivery_fee_paise} free />
              <View style={styles.divider} />
              <View style={styles.billRow}>
                <Text variant="bodyStrong">To pay</Text>
                <Money paise={quote.total_paise} variant="bodyStrong" />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.sm + insets.bottom }]}>
        {quote?.can_place_order ? (
          <Text variant="caption" color="textSecondary">
            Placing orders opens in the next update of the app.
          </Text>
        ) : null}
        <Button
          title={quote ? `Place order · ${formatPaise(quote.total_paise)}` : 'Place order'}
          fullWidth
          loading={loading}
          disabled
        />
      </View>
    </View>
  );
}

function BillRow({ label, paise, free = false }: { label: string; paise: number; free?: boolean }) {
  return (
    <View style={styles.billRow}>
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      {free && paise === 0 ? (
        <Text variant="label" color="action">
          FREE
        </Text>
      ) : (
        <Money paise={paise} />
      )}
    </View>
  );
}

function CheckoutSkeleton() {
  return (
    <View style={[styles.root, styles.content]} accessibilityLabel="Loading checkout">
      <Skeleton height={112} radius={radius.lg} />
      <Skeleton height={160} radius={radius.lg} />
      <Skeleton height={140} radius={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: gutter, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerTint,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  methodSelected: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.brand },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.border },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: gutter,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
