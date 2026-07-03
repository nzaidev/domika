"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PropertyMediaRow } from "@/lib/database.types";
import {
  deleteMediaAction,
  moveMediaAction,
  setCoverAction,
} from "../actions";

export function PhotoManager({
  propertyId,
  media,
}: {
  propertyId: string;
  media: PropertyMediaRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  async function handleUpload(files: FileList) {
    setUploading(true);
    setErrors([]);

    const body = new FormData();
    for (const file of Array.from(files)) {
      body.append("files", file);
    }

    try {
      const response = await fetch(`/api/properties/${propertyId}/media`, {
        method: "POST",
        body,
      });
      const payload = (await response.json()) as {
        errors?: string[];
        error?: string;
      };

      const reported = payload.errors ?? (payload.error ? [payload.error] : []);
      setErrors(reported);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrors(["No se pudieron subir las fotos. Intenta de nuevo."]);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className={styles.formGrid}>
      <label className={styles.formField}>
        <span>
          Agregar fotos (JPG/PNG/WebP/HEIC, máx. 15 MB — se normalizan a WebP
          1600px)
        </span>
        <input
          ref={inputRef}
          className={styles.textInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
          multiple
          disabled={uploading}
          onChange={(event) => {
            if (event.target.files?.length) {
              void handleUpload(event.target.files);
            }
          }}
        />
      </label>

      {uploading ? <p className={styles.mutedText}>Subiendo fotos…</p> : null}
      {errors.map((error) => (
        <p className={styles.formError} key={error}>
          {error}
        </p>
      ))}

      {media.length > 0 ? (
        <div className={styles.photoList}>
          {media.map((item, index) => (
            <article className={styles.photoRow} key={item.id}>
              {item.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnails already normalized server-side
                <img
                  src={item.public_url}
                  alt={item.alt_text ?? "Foto de la propiedad"}
                  className={styles.photoThumb}
                  loading="lazy"
                />
              ) : (
                <div className={styles.photoThumb} />
              )}
              <div className={styles.photoMeta}>
                <strong>
                  {item.is_cover ? "Portada" : `Foto ${index + 1}`}
                </strong>
                <span className={styles.mutedText}>{item.alt_text}</span>
              </div>
              <div className={styles.stageEditActions}>
                {!item.is_cover ? (
                  <form action={setCoverAction}>
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <input type="hidden" name="mediaId" value={item.id} />
                    <button className={styles.secondaryButton} type="submit">
                      Hacer portada
                    </button>
                  </form>
                ) : null}
                <form action={moveMediaAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    className={styles.ghostButton}
                    type="submit"
                    disabled={index === 0}
                    aria-label="Subir foto"
                  >
                    ↑
                  </button>
                </form>
                <form action={moveMediaAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    className={styles.ghostButton}
                    type="submit"
                    disabled={index === media.length - 1}
                    aria-label="Bajar foto"
                  >
                    ↓
                  </button>
                </form>
                <form action={deleteMediaAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button className={styles.ghostButton} type="submit">
                    Eliminar
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.mutedText}>Todavía no hay fotos.</p>
      )}
    </div>
  );
}
