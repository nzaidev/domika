"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { PropertyMediaRow } from "@/lib/database.types";
import { prepareImageForUpload } from "@/lib/image-client";
import { mediaUrl } from "@/lib/media";
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
  const [uploading, setUploading] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  async function handleUpload(files: FileList) {
    setErrors([]);
    const list = Array.from(files);
    const reported: string[] = [];

    // One request per file: keeps every request small (serverless body
    // limits) and lets one bad photo fail without blocking the rest.
    for (let index = 0; index < list.length; index += 1) {
      setUploading(`Subiendo foto ${index + 1} de ${list.length}…`);
      const original = list[index];

      try {
        const prepared = await prepareImageForUpload(original);
        const body = new FormData();
        body.append("files", prepared);

        const response = await fetch(`/api/properties/${propertyId}/media`, {
          method: "POST",
          body,
        });

        if (response.status === 413) {
          reported.push(
            `${original.name}: la imagen es demasiado grande para subir.`,
          );
          continue;
        }

        let payload: { errors?: string[]; error?: string } = {};
        try {
          payload = await response.json();
        } catch {
          if (!response.ok) {
            reported.push(`${original.name}: error ${response.status} al subir.`);
            continue;
          }
        }
        reported.push(...(payload.errors ?? []));
        if (payload.error) {
          reported.push(payload.error);
        }
      } catch {
        reported.push(`${original.name}: fallo de red al subir.`);
      }
    }

    setErrors(reported);
    setUploading(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    startTransition(() => {
      router.refresh();
    });
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
          disabled={uploading !== null}
          onChange={(event) => {
            if (event.target.files?.length) {
              void handleUpload(event.target.files);
            }
          }}
        />
      </label>

      {uploading ? <p className={styles.mutedText}>{uploading}</p> : null}
      {errors.map((error) => (
        <p className={styles.formError} key={error}>
          {error}
        </p>
      ))}

      {media.length > 0 ? (
        <div className={styles.photoList}>
          {media.map((item, index) => (
            <article className={styles.photoRow} key={item.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails already normalized server-side */}
              <img
                src={mediaUrl(item.storage_path)}
                alt={item.alt_text ?? "Foto de la propiedad"}
                className={styles.photoThumb}
                loading="lazy"
              />
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
