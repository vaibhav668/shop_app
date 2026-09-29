import type { AdminProduct } from '@/api/catalog';
import type { ImageValue } from '@/components/ImageUpload';
import { paiseToInput, parseRupees } from '@/lib/money';

export type FormState = {
  name: string;
  categoryId: string;
  unitLabel: string;
  price: string;
  mrp: string;
  stock: string;
  description: string;
  keywords: string;
  maxPerOrder: string;
  lowStockThreshold: string;
  isActive: boolean;
  isFeatured: boolean;
  image: ImageValue;
};

export type Errors = Partial<Record<keyof FormState, string>>;

export function initialState(product?: AdminProduct): FormState {
  return {
    name: product?.name ?? '',
    categoryId: product?.category_id ?? '',
    unitLabel: product?.unit_label ?? '',
    price: product ? paiseToInput(product.price_paise) : '',
    mrp: product ? paiseToInput(product.mrp_paise) : '',
    stock: String(product?.stock_quantity ?? 0),
    description: product?.description ?? '',
    keywords: product?.search_keywords ?? '',
    maxPerOrder: product?.max_per_order ? String(product.max_per_order) : '',
    lowStockThreshold:
      product?.low_stock_threshold != null ? String(product.low_stock_threshold) : '',
    isActive: product?.is_active ?? true,
    isFeatured: product?.is_featured ?? false,
    image:
      product?.image_key && product.image_url
        ? { key: product.image_key, url: product.image_url }
        : null,
  };
}

const wholeNumber = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : null);

export function validate(form: FormState): Errors {
  const errors: Errors = {};
  if (!form.name.trim()) errors.name = 'Enter the product name.';
  if (!form.categoryId) errors.categoryId = 'Choose a category.';
  if (!form.unitLabel.trim()) errors.unitLabel = 'Enter the pack size, e.g. 500 g.';
  const price = parseRupees(form.price);
  const mrp = parseRupees(form.mrp);
  if (price === null || price <= 0) errors.price = 'Enter a price like 45 or 45.50.';
  if (mrp === null || mrp <= 0) errors.mrp = 'Enter the MRP printed on the pack.';
  else if (price !== null && mrp < price) errors.mrp = "MRP can't be lower than the selling price.";
  const stock = wholeNumber(form.stock);
  if (stock === null || stock > 100_000) errors.stock = 'Enter a whole number, 0 or more.';
  if (form.maxPerOrder) {
    const n = wholeNumber(form.maxPerOrder);
    if (n === null || n < 1 || n > 50) errors.maxPerOrder = 'Between 1 and 50, or leave empty.';
  }
  if (form.lowStockThreshold && wholeNumber(form.lowStockThreshold) === null) {
    errors.lowStockThreshold = 'A whole number, or leave empty for the shop default.';
  }
  return errors;
}
