import { router } from 'expo-router';

import type { ProductCard as ProductCardData } from '@/api/catalog';
import { ProductCard } from '@/components/product/ProductCard';
import { useCartControls } from '@/features/cart/hooks';

/** A product card wired to the cart and to its detail screen — what every list uses. */
export function ShopProductCard({ product }: { product: ProductCardData }) {
  const cart = useCartControls(product);
  return (
    <ProductCard
      product={product}
      cart={cart}
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
    />
  );
}
