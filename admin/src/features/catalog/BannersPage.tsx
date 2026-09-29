import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { type AdminBanner, adminCatalogApi, catalogKeys } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { SelectField, TextField, Toggle } from '@/components/form/Fields';
import { type ImageValue, ImageUpload } from '@/components/ImageUpload';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import form from '@/components/form/Form.module.css';
import table from '@/components/Table.module.css';

import { bannerStatus } from './bannerStatus';
import { fromLocalInput, toLocalInput } from './dates';

type Editing = { banner: AdminBanner | null } | null;

export function BannersPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const banners = useQuery({ queryKey: catalogKeys.banners, queryFn: adminCatalogApi.banners });
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.banners });
  const onError = (e: unknown) =>
    setError(e instanceof ApiError ? e.message : "That didn't work. Try again?");

  const reorder = useMutation({
    mutationFn: adminCatalogApi.reorderBanners,
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: adminCatalogApi.deleteBanner,
    onSuccess: refresh,
    onError,
  });

  const list = banners.data ?? [];
  const move = (index: number, by: -1 | 1) => {
    const ids = list.map((b) => b.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <>
      <PageHeader
        title="Banners"
        description="Offers and announcements at the top of the app's home screen, in this order."
        actions={
          <Button onClick={() => setEditing({ banner: null })}>
            <Plus size={16} aria-hidden /> Add banner
          </Button>
        }
      />
      {error ? <Alert>{error}</Alert> : null}

      {banners.isError ? (
        <EmptyState
          icon={Megaphone}
          title="Couldn't load banners"
          action={
            <Button variant="secondary" onClick={() => banners.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !banners.isPending && list.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing here yet."
          message="Add a banner for an offer, a new arrival or a festival."
          action={<Button onClick={() => setEditing({ banner: null })}>Add banner</Button>}
        />
      ) : (
        <div className={table.panel}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Banner</th>
                <th>Opens</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((b, index) => {
                const status = bannerStatus(b);
                return (
                  <tr key={b.id}>
                    <td>
                      <div className={table.nameCell}>
                        <span className={table.thumb}>
                          {b.image_url ? <img src={b.image_url} alt="" /> : <Megaphone size={18} />}
                        </span>
                        <span>
                          <span className={table.primary}>{b.title}</span>
                          {b.subtitle ? (
                            <>
                              <br />
                              <span className={table.secondary}>{b.subtitle}</span>
                            </>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className={table.secondary}>
                      {b.target_type === 'NONE' ? 'Nothing' : (b.target_label ?? 'Removed item')}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                    <td>
                      <div className={table.actions}>
                        <button
                          type="button"
                          className={table.iconButton}
                          aria-label={`Move ${b.title} up`}
                          disabled={index === 0 || reorder.isPending}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          type="button"
                          className={table.iconButton}
                          aria-label={`Move ${b.title} down`}
                          disabled={index === list.length - 1 || reorder.isPending}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          type="button"
                          className={table.iconButton}
                          aria-label={`Edit ${b.title}`}
                          onClick={() => setEditing({ banner: b })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className={table.iconButton}
                          aria-label={`Delete ${b.title}`}
                          disabled={remove.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete the "${b.title}" banner?`))
                              remove.mutate(b.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <BannerDialog
          banner={editing.banner}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}

function BannerDialog({
  banner,
  onClose,
  onSaved,
}: {
  banner: AdminBanner | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(banner?.title ?? '');
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '');
  const [image, setImage] = useState<ImageValue>(
    banner?.image_key && banner.image_url ? { key: banner.image_key, url: banner.image_url } : null,
  );
  const [targetType, setTargetType] = useState<AdminBanner['target_type']>(
    banner?.target_type ?? 'NONE',
  );
  const [targetId, setTargetId] = useState(banner?.target_id ?? '');
  const [productSearch, setProductSearch] = useState(
    banner?.target_type === 'PRODUCT' ? (banner.target_label ?? '') : '',
  );
  const [active, setActive] = useState(banner?.is_active ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.starts_at));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.ends_at));
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: adminCatalogApi.categories,
    enabled: targetType === 'CATEGORY',
  });
  const productFilters = {
    q: productSearch.trim() || undefined,
    status: 'active' as const,
    limit: 20,
  };
  const products = useQuery({
    queryKey: catalogKeys.products(productFilters),
    queryFn: () => adminCatalogApi.products(productFilters),
    enabled: targetType === 'PRODUCT',
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        target_type: targetType,
        target_id: targetType === 'NONE' ? null : targetId,
        is_active: active,
        starts_at: fromLocalInput(startsAt),
        ends_at: fromLocalInput(endsAt),
      };
      if (!banner) return adminCatalogApi.createBanner({ ...body, image_key: image?.key ?? null });
      return adminCatalogApi.updateBanner(banner.id, {
        ...body,
        image_key: image && image.key !== banner.image_key ? image.key : undefined,
        remove_image: !image && !!banner.image_key,
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't save. Try again?"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Enter a title.');
    if (targetType !== 'NONE' && !targetId) {
      return setError(
        `Choose which ${targetType === 'CATEGORY' ? 'category' : 'product'} it opens.`,
      );
    }
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return setError('The end date must be after the start date.');
    }
    setError(null);
    save.mutate();
  };

  return (
    <Modal
      title={banner ? 'Edit banner' : 'Add banner'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="banner-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="banner-form" onSubmit={submit} style={{ display: 'contents' }}>
        {error ? <Alert>{error}</Alert> : null}
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fresh vegetables, every morning"
          maxLength={60}
          hint="Short and clear. Shown in large text."
        />
        <TextField
          label="Subtitle"
          optional
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Up to 20% off this week"
          maxLength={100}
        />
        <ImageUpload value={image} onChange={setImage} label="Photo (optional)" />
        <SelectField
          label="When tapped, open"
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value as AdminBanner['target_type']);
            setTargetId('');
          }}
        >
          <option value="NONE">Nothing (announcement only)</option>
          <option value="CATEGORY">A category</option>
          <option value="PRODUCT">A product</option>
        </SelectField>
        {targetType === 'CATEGORY' ? (
          <SelectField
            label="Category"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Choose…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        {targetType === 'PRODUCT' ? (
          <>
            <TextField
              label="Find product"
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Type a name"
            />
            <SelectField
              label="Product"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Choose…</option>
              {banner?.target_type === 'PRODUCT' &&
              banner.target_id &&
              !products.data?.items.some((p) => p.id === banner.target_id) ? (
                <option value={banner.target_id}>{banner.target_label ?? 'Current product'}</option>
              ) : null}
              {products.data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.unit_label}
                </option>
              ))}
            </SelectField>
          </>
        ) : null}
        <Toggle label="Show in app" checked={active} onChange={setActive} />
        <div className={form.twoCol}>
          <TextField
            label="Starts"
            optional
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <TextField
            label="Ends"
            optional
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
