import { router } from 'expo-router';
import { ArrowLeft, History, LayoutGrid, Search, SearchX, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductImage } from '@/components/product/ProductImage';
import { ShopProductCard } from '@/components/product/ShopProductCard';
import { ProductGridSkeleton } from '@/components/product/Skeletons';
import { CartBar } from '@/components/CartBar';
import { QueryError } from '@/components/QueryError';
import { Chip, EmptyState, IconButton, Text } from '@/components/ui';
import { useCategories, useSearchResults, useSuggestions } from '@/features/catalog/hooks';
import {
  loadRecentSearches,
  saveRecentSearches,
  withRecent,
} from '@/features/search/recentSearches';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { colors, gutter, hitSlop, radius, shadow, spacing, tintFor } from '@/theme/tokens';
import { textVariants } from '@/theme/typography';

/** The product name with the typed part marked in gold. */
function Highlighted({ text, match }: { text: string; match: string }) {
  const at = match ? text.toLowerCase().indexOf(match.toLowerCase()) : -1;
  if (at < 0) {
    return (
      <Text variant="label" numberOfLines={1}>
        {text}
      </Text>
    );
  }
  return (
    <Text variant="label" numberOfLines={1}>
      {text.slice(0, at)}
      <Text variant="label" style={styles.hit}>
        {text.slice(at, at + match.length)}
      </Text>
      {text.slice(at + match.length)}
    </Text>
  );
}

export default function SearchScreen() {
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  // The submitted query drives the results grid; `text` drives suggestions while typing.
  const [submitted, setSubmitted] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [recent, setRecent] = useState<string[]>([]);
  const typed = useDebouncedValue(text.trim(), 200);

  useEffect(() => {
    void loadRecentSearches().then(setRecent);
  }, []);

  const suggestions = useSuggestions(submitted ? '' : typed);
  const results = useSearchResults(submitted, categoryId);
  const categories = useCategories();

  const submit = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    Keyboard.dismiss();
    setText(clean);
    setSubmitted(clean);
    setCategoryId(undefined);
    const next = withRecent(recent, clean);
    setRecent(next);
    void saveRecentSearches(next);
  };

  const clearRecent = () => {
    setRecent([]);
    void saveRecentSearches([]);
  };

  const items = useMemo(() => results.data?.pages.flatMap((p) => p.items) ?? [], [results.data]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon={ArrowLeft} accessibilityLabel="Back" onPress={() => router.back()} />
        <View style={styles.inputWrap}>
          <Search size={18} strokeWidth={2.2} color={colors.forest} />
          <TextInput
            ref={input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (submitted) setSubmitted('');
            }}
            onSubmitEditing={() => submit(text)}
            placeholder="Search for milk, atta, dal…"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.forest}
            cursorColor={colors.forest}
            returnKeyType="search"
            autoFocus
            autoCorrect={false}
            accessibilityLabel="Search"
            style={styles.input}
          />
          {text ? (
            <Pressable
              onPress={() => {
                setText('');
                setSubmitted('');
                input.current?.focus();
              }}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <View style={styles.clear}>
                <X size={14} strokeWidth={2.6} color={colors.textSecondary} />
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>

      {submitted ? (
        <>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              <Chip label="All" selected={!categoryId} onPress={() => setCategoryId(undefined)} />
              {categories.data?.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </ScrollView>
          </View>
          {results.isError ? (
            <QueryError error={results.error} onRetry={() => results.refetch()} />
          ) : results.isPending ? (
            <View style={styles.pad}>
              <ProductGridSkeleton />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                if (results.hasNextPage && !results.isFetchingNextPage) results.fetchNextPage();
              }}
              ListEmptyComponent={
                <EmptyState
                  icon={SearchX}
                  title={`No results for “${submitted}”`}
                  message={categoryId ? 'Try “All” categories.' : 'Try a simpler word.'}
                />
              }
              ListFooterComponent={
                results.isFetchingNextPage ? (
                  <ActivityIndicator color={colors.brand} style={styles.footer} />
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.cell}>
                  <ShopProductCard product={item} />
                </View>
              )}
            />
          )}
        </>
      ) : typed ? (
        <FlatList
          data={suggestions.data ?? []}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.suggestions}
          ListHeaderComponent={
            <Pressable
              onPress={() => submit(text)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row2, pressed && styles.pressed]}
            >
              <View style={styles.seeAll}>
                <Search size={16} strokeWidth={2.4} color={colors.goldBright} />
              </View>
              <Text variant="label" color="action">
                See all results for “{text.trim()}”
              </Text>
            </Pressable>
          }
          ListEmptyComponent={
            suggestions.isError ? (
              <QueryError error={suggestions.error} onRetry={() => suggestions.refetch()} />
            ) : suggestions.isFetching ? null : (
              <EmptyState
                icon={SearchX}
                title={`No results for “${typed}”`}
                message="Try a simpler word."
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                const next = withRecent(recent, text);
                setRecent(next);
                void saveRecentSearches(next);
                router.push({ pathname: '/product/[id]', params: { id: item.id } });
              }}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.unit_label}`}
              style={({ pressed }) => [styles.row2, pressed && styles.pressed]}
            >
              <View style={[styles.thumb, { backgroundColor: tintFor(item.id) }]}>
                <ProductImage uri={item.image_url} name={item.name} iconSize={20} />
              </View>
              <View style={styles.flex}>
                <Highlighted text={item.name} match={typed} />
                <Text variant="caption" color="textSecondary">
                  {item.unit_label}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.recent} keyboardShouldPersistTaps="handled">
          {recent.length > 0 ? (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <Text variant="heading">Recent</Text>
                <Pressable onPress={clearRecent} hitSlop={hitSlop} accessibilityRole="button">
                  <Text variant="label" color="action">
                    Clear
                  </Text>
                </Pressable>
              </View>
              <View style={styles.pills}>
                {recent.map((term) => (
                  <Pressable
                    key={term}
                    onPress={() => submit(term)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                  >
                    <History size={14} strokeWidth={2} color={colors.textSecondary} />
                    <Text variant="label">{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {categories.data && categories.data.length > 0 ? (
            <View style={styles.group}>
              <Text variant="heading">Browse aisles</Text>
              <View style={styles.pills}>
                {categories.data.slice(0, 12).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.pill,
                      styles.aisle,
                      { backgroundColor: tintFor(c.id) },
                      pressed && styles.aislePressed,
                    ]}
                  >
                    <LayoutGrid size={14} strokeWidth={2} color={colors.forest} />
                    <Text variant="label">{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <Text variant="caption" color="textSecondary" align="center" style={styles.hint}>
            Tip: search by local names too, like “doodh” or “aloo”.
          </Text>
        </ScrollView>
      )}
      <CartBar safeBottom />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  inputWrap: {
    ...shadow.sm,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 50,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: radius.lg - 4,
    borderWidth: 2,
    borderColor: colors.forest,
    backgroundColor: colors.surface,
  },
  clear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  hit: { backgroundColor: colors.goldPale, color: colors.text },
  seeAll: {
    width: 40,
    height: 40,
    borderRadius: radius.md - 2,
    backgroundColor: colors.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { ...textVariants.body, flex: 1, color: colors.text, paddingVertical: 0 },
  chips: { paddingHorizontal: gutter, paddingVertical: spacing.xs },
  pad: { paddingHorizontal: gutter },
  list: { paddingHorizontal: gutter, paddingBottom: spacing.xxxl, gap: spacing.sm },
  row: { gap: spacing.sm },
  cell: { flex: 1 / 2 },
  footer: { paddingVertical: spacing.lg },
  suggestions: { paddingBottom: spacing.xxxl },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: gutter,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  thumb: {
    width: 40,
    height: 40,
    padding: 5,
    borderRadius: radius.md - 2,
  },
  recent: { paddingVertical: spacing.sm, paddingHorizontal: gutter, gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    ...shadow.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  aisle: { shadowOpacity: 0, elevation: 0 },
  aislePressed: { opacity: 0.75 },
  hint: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
});
