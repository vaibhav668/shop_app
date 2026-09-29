import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Package } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { type AdminProduct, adminCatalogApi, catalogKeys, type ProductUpdate } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { SelectField, TextArea, TextField, Toggle } from '@/components/form/Fields';
import { ImageUpload } from '@/components/ImageUpload';
import { PageHeader } from '@/components/PageHeader';
import { discountPercent, parseRupees } from '@/lib/money';

import { type Errors, type FormState, initialState, validate } from './productForm';

import styles from './ProductFormPage.module.css';

export function ProductFormPage() {
  const { id } = useParams();
  const product = useQuery({
    queryKey: catalogKeys.product(id ?? ''),
    queryFn: () => adminCatalogApi.product(id!),
    enabled: !!id,
  });

  if (!id) return <ProductForm />;
  if (product.isPending) return <FullPageSpinner />;
  if (product.isError) {
    return (
      <EmptyState
        icon={Package}
        title={
          product.error instanceof ApiError && product.error.status === 404
            ? "This product doesn't exist."
            : "Couldn't load this product."
        }
        action={<Link to="/products">Back to products</Link>}
      />
    );
  }
  // Keyed so a refetch after save re-initialises the form with server values.
  return (
    <ProductForm
      key={product.data.updated_at + product.data.stock_quantity}
      product={product.data}
    />
  );
}

function ProductForm({ product }: { product?: AdminProduct }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(product));
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const categories = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: adminCatalogApi.categories,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: catalogKeys.allProducts }),
      queryClient.invalidateQueries({ queryKey: catalogKeys.categories }),
      product && queryClient.invalidateQueries({ queryKey: catalogKeys.product(product.id) }),
    ]);

  const save = useMutation({
    mutationFn: async () => {
      const common = {
        category_id: form.categoryId,
        name: form.name.trim(),
        unit_label: form.unitLabel.trim(),
        price_paise: parseRupees(form.price)!,
        mrp_paise: parseRupees(form.mrp)!,
        description: form.description.trim() || null,
        search_keywords: form.keywords.trim() || null,
        max_per_order: form.maxPerOrder ? Number(form.maxPerOrder) : null,
        low_stock_threshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : null,
        is_active: form.isActive,
        is_featured: form.isFeatured,
      };
      if (!product) {
        return adminCatalogApi.createProduct({
          ...common,
          stock_quantity: Number(form.stock),
          image_key: form.image?.key ?? null,
        });
      }
      const update: ProductUpdate = { ...common };
      if (form.image?.key !== product.image_key) {
        if (form.image) update.image_key = form.image.key;
        else update.remove_image = true;
      }
      await adminCatalogApi.updateProduct(product.id, update);
      const newStock = Number(form.stock);
      if (newStock !== product.stock_quantity) {
        // Sends what the form was opened with, so a sale in between is caught, not overwritten.
        await adminCatalogApi.setStock(product.id, newStock, product.stock_quantity);
      }
      return adminCatalogApi.product(product.id);
    },
    onSuccess: async () => {
      await invalidate();
      navigate('/products');
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.code === 'STOCK_CONFLICT') {
        setServerError(
          `Other changes were saved, but stock changed to ${String(e.details.current)} while you ` +
            'were editing (probably an order). Check the count and save again.',
        );
        await invalidate();
        return;
      }
      setServerError(e instanceof ApiError ? e.message : "Couldn't save. Try again?");
    },
  });

  const archive = useMutation({
    mutationFn: () =>
      product!.archived_at
        ? adminCatalogApi.restoreProduct(product!.id)
        : adminCatalogApi.archiveProduct(product!.id),
    onSuccess: async () => {
      await invalidate();
      navigate('/products');
    },
    onError: (e) =>
      setServerError(e instanceof ApiError ? e.message : "Couldn't update. Try again?"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length === 0) save.mutate();
  };

  const price = parseRupees(form.price);
  const mrp = parseRupees(form.mrp);
  const discount = price && mrp ? discountPercent(price, mrp) : 0;

  return (
    <form onSubmit={submit} noValidate>
      <Link to="/products" className={styles.back}>
        <ArrowLeft size={16} aria-hidden /> Products
      </Link>
      <PageHeader
        title={product ? product.name : 'Add product'}
        actions={
          <>
            {product ? (
              <Button
                variant={product.archived_at ? 'secondary' : 'danger'}
                loading={archive.isPending}
                onClick={() => {
                  if (
                    product.archived_at ||
                    window.confirm(`Archive "${product.name}"? Customers won't see it.`)
                  ) {
                    archive.mutate();
                  }
                }}
              >
                {product.archived_at ? (
                  <>
                    <ArchiveRestore size={16} aria-hidden /> Restore
                  </>
                ) : (
                  <>
                    <Archive size={16} aria-hidden /> Archive
                  </>
                )}
              </Button>
            ) : null}
            <Button type="submit" loading={save.isPending}>
              {product ? 'Save changes' : 'Add product'}
            </Button>
          </>
        }
      />

      {product?.archived_at ? (
        <Alert tone="warning">This product is archived. Customers can't see it.</Alert>
      ) : null}
      {serverError ? <Alert>{serverError}</Alert> : null}
      {Object.keys(errors).length > 0 ? <Alert>Fix the highlighted fields.</Alert> : null}

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Basics</h2>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Toned Milk"
              maxLength={120}
              error={errors.name}
            />
            <div className={styles.twoCol}>
              <SelectField
                label="Category"
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                error={errors.categoryId}
              >
                <option value="">Choose…</option>
                {categories.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_active ? '' : ' (hidden)'}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Pack size"
                value={form.unitLabel}
                onChange={(e) => set('unitLabel', e.target.value)}
                placeholder="500 g, 1 L, 6 pcs"
                maxLength={40}
                error={errors.unitLabel}
              />
            </div>
            <TextArea
              label="Description"
              optional
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={2000}
            />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Price</h2>
            <div className={styles.twoCol}>
              <TextField
                label="Selling price"
                prefix="₹"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="45"
                error={errors.price}
              />
              <TextField
                label="MRP"
                prefix="₹"
                inputMode="decimal"
                value={form.mrp}
                onChange={(e) => set('mrp', e.target.value)}
                placeholder="50"
                error={errors.mrp}
                hint={
                  discount > 0
                    ? `Customers see ${discount}% OFF`
                    : 'Same as price means no discount shown'
                }
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Stock</h2>
            <div className={styles.twoCol}>
              <TextField
                label={product ? 'Units in stock' : 'Opening stock'}
                inputMode="numeric"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                error={errors.stock}
                hint={
                  product
                    ? `Currently ${product.stock_quantity}. Change it to set a new count.`
                    : 'How many you have ready to sell now.'
                }
              />
              <TextField
                label="Low-stock alert at"
                optional
                inputMode="numeric"
                value={form.lowStockThreshold}
                onChange={(e) => set('lowStockThreshold', e.target.value)}
                error={errors.lowStockThreshold}
                hint="Leave empty to use the shop default."
              />
            </div>
            <TextField
              label="Max per order"
              optional
              inputMode="numeric"
              value={form.maxPerOrder}
              onChange={(e) => set('maxPerOrder', e.target.value)}
              error={errors.maxPerOrder}
              hint="Limit how many one customer can buy, e.g. for offers."
            />
          </section>
        </div>

        <aside className={styles.side}>
          <section className={styles.card}>
            <ImageUpload value={form.image} onChange={(v) => set('image', v)} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Visibility</h2>
            <Toggle
              label="Show in app"
              description="Hidden products stay in your list but customers can't see them."
              checked={form.isActive}
              onChange={(v) => set('isActive', v)}
            />
            <Toggle
              label="Featured"
              description="Shown in the Fresh picks section on the home screen."
              checked={form.isFeatured}
              onChange={(v) => set('isFeatured', v)}
            />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Search</h2>
            <TextField
              label="Other names"
              optional
              value={form.keywords}
              onChange={(e) => set('keywords', e.target.value)}
              placeholder="doodh, milk"
              hint="Helps customers find it by local names."
            />
          </section>

          {product ? (
            <p className={styles.meta}>
              {product.stock_quantity === 0 ? <Badge tone="danger">Out of stock</Badge> : null}
              {product.is_low_stock && product.stock_quantity > 0 ? (
                <Badge tone="warning">Low stock</Badge>
              ) : null}
            </p>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
