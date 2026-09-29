import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { type AdminCategory, adminCatalogApi, catalogKeys } from '@/api/catalog';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { TextField, Toggle } from '@/components/form/Fields';
import { type ImageValue, ImageUpload } from '@/components/ImageUpload';
import { Modal } from '@/components/Modal';
import { PageHeader } from '@/components/PageHeader';
import table from '@/components/Table.module.css';

type Editing = { mode: 'create' } | { mode: 'edit'; category: AdminCategory } | null;

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const categories = useQuery({
    queryKey: catalogKeys.categories,
    queryFn: adminCatalogApi.categories,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKeys.categories });
  const onError = (e: unknown) =>
    setActionError(e instanceof ApiError ? e.message : 'That didn’t work. Try again?');

  const reorder = useMutation({
    mutationFn: adminCatalogApi.reorderCategories,
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: adminCatalogApi.deleteCategory,
    onSuccess: refresh,
    onError,
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminCatalogApi.updateCategory(id, { is_active: active }),
    onSuccess: refresh,
    onError,
  });

  const move = (index: number, by: -1 | 1) => {
    const list = categories.data ?? [];
    const ids = list.map((c) => c.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    reorder.mutate(ids);
  };

  const list = categories.data ?? [];

  return (
    <>
      <PageHeader
        title="Categories"
        description="Customers browse the shop by these, in this order."
        actions={
          <Button onClick={() => setEditing({ mode: 'create' })}>
            <Plus size={16} aria-hidden /> Add category
          </Button>
        }
      />

      {actionError ? <Alert>{actionError}</Alert> : null}

      {categories.isError ? (
        <EmptyState
          icon={LayoutGrid}
          title="Couldn't load categories"
          action={
            <Button variant="secondary" onClick={() => categories.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !categories.isPending && list.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="Nothing here yet."
          message="Add your first category, like Dairy or Fruits & Vegetables."
          action={<Button onClick={() => setEditing({ mode: 'create' })}>Add category</Button>}
        />
      ) : (
        <div className={table.panel}>
          <table className={table.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th className={table.num}>Products</th>
                <th>Shown in app</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {categories.isPending
                ? Array.from({ length: 4 }, (_, i) => (
                    <tr key={i} className={table.loadingRow}>
                      <td colSpan={4}>
                        <span className={table.skeleton} style={{ width: '40%' }} />
                      </td>
                    </tr>
                  ))
                : list.map((c, index) => (
                    <tr key={c.id}>
                      <td>
                        <div className={table.nameCell}>
                          <span className={table.thumb}>
                            {c.image_url ? (
                              <img src={c.image_url} alt="" />
                            ) : (
                              <LayoutGrid size={18} />
                            )}
                          </span>
                          <span className={table.primary}>{c.name}</span>
                        </div>
                      </td>
                      <td className={table.num}>{c.product_count}</td>
                      <td>
                        <Toggle
                          label={c.is_active ? 'Shown' : 'Hidden'}
                          description={c.is_active ? undefined : 'Its products are hidden too'}
                          checked={c.is_active}
                          onChange={(active) => toggle.mutate({ id: c.id, active })}
                        />
                      </td>
                      <td>
                        <div className={table.actions}>
                          <button
                            type="button"
                            className={table.iconButton}
                            aria-label={`Move ${c.name} up`}
                            disabled={index === 0 || reorder.isPending}
                            onClick={() => move(index, -1)}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            className={table.iconButton}
                            aria-label={`Move ${c.name} down`}
                            disabled={index === list.length - 1 || reorder.isPending}
                            onClick={() => move(index, 1)}
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            type="button"
                            className={table.iconButton}
                            aria-label={`Edit ${c.name}`}
                            onClick={() => setEditing({ mode: 'edit', category: c })}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className={table.iconButton}
                            aria-label={`Delete ${c.name}`}
                            title={
                              c.product_count > 0
                                ? 'Only empty categories can be deleted. Hide it instead.'
                                : undefined
                            }
                            disabled={c.product_count > 0 || remove.isPending}
                            onClick={() => {
                              if (window.confirm(`Delete "${c.name}"?`)) remove.mutate(c.id);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <CategoryDialog
          category={editing.mode === 'edit' ? editing.category : null}
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

function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category: AdminCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [active, setActive] = useState(category?.is_active ?? true);
  const [image, setImage] = useState<ImageValue>(
    category?.image_key && category.image_url
      ? { key: category.image_key, url: category.image_url }
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      category
        ? adminCatalogApi.updateCategory(category.id, {
            name: name.trim(),
            is_active: active,
            image_key: image?.key !== category.image_key ? (image?.key ?? null) : undefined,
            remove_image: !image && !!category.image_key,
          })
        : adminCatalogApi.createCategory({
            name: name.trim(),
            is_active: active,
            image_key: image?.key ?? null,
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Couldn’t save. Try again?'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    save.mutate();
  };

  return (
    <Modal
      title={category ? 'Edit category' : 'Add category'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} style={{ display: 'contents' }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Dairy & Eggs"
          maxLength={120}
          error={error}
        />
        <ImageUpload value={image} onChange={setImage} />
        <Toggle
          label="Show in app"
          description="Hidden categories are kept but customers can't see them."
          checked={active}
          onChange={setActive}
        />
      </form>
    </Modal>
  );
}
