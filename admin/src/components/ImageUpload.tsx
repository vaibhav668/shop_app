import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { adminCatalogApi } from '@/api/catalog';
import { ApiError } from '@/api/client';

import styles from './ImageUpload.module.css';

export type ImageValue = { key: string; url: string } | null;

/** Uploads immediately on pick; the parent saves only the returned key with the record. */
export function ImageUpload({
  value,
  onChange,
  label = 'Photo',
  square = false,
}: {
  value: ImageValue;
  onChange: (value: ImageValue) => void;
  label?: string;
  /** Product and category photos: the server trims them and centres them on a white square. */
  square?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await adminCatalogApi.uploadImage(file, { square });
      onChange({ key: uploaded.key, url: uploaded.url });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
      if (camera.current) camera.current.value = '';
    }
  };

  return (
    <div className={styles.wrap}>
      <span className={styles.label} id={`${id}-label`}>
        {label}
      </span>
      <div className={styles.row}>
        <div className={styles.preview} aria-busy={uploading || undefined}>
          {value ? (
            <img src={value.url} alt="" />
          ) : (
            <ImagePlus size={28} strokeWidth={1.5} aria-hidden />
          )}
          {uploading ? <span className={styles.overlay}>Uploading…</span> : null}
        </div>
        <div className={styles.actions}>
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.file}
            aria-labelledby={`${id}-label`}
            onChange={(e) => void pick(e.target.files?.[0])}
            disabled={uploading}
          />
          <label htmlFor={id} className={styles.choose} aria-disabled={uploading || undefined}>
            {value ? 'Change photo' : 'Upload photo'}
          </label>
          {/* On a phone this opens the camera straight away. */}
          <input
            ref={camera}
            id={`${id}-camera`}
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.file}
            onChange={(e) => void pick(e.target.files?.[0])}
            disabled={uploading}
          />
          <label
            htmlFor={`${id}-camera`}
            className={styles.choose}
            aria-disabled={uploading || undefined}
          >
            <Camera size={14} aria-hidden /> Take photo
          </label>
          {value ? (
            <button type="button" className={styles.remove} onClick={() => onChange(null)}>
              <Trash2 size={14} aria-hidden /> Remove
            </button>
          ) : null}
          <span className={styles.hint}>
            {square
              ? 'JPEG, PNG or WebP, up to 5 MB. Shoot the product on a plain surface; it is trimmed and centred on white.'
              : 'JPEG, PNG or WebP, up to 5 MB.'}
          </span>
          {error ? (
            <span className={styles.error} role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
