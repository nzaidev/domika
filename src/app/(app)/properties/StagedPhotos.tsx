"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { ImageLightbox } from "./ImageLightbox";

export const MAX_STAGED_PHOTOS = 20;

export type StagedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif";

export function StagedPhotos({
  photos,
  onChange,
  disabled,
}: {
  photos: StagedPhoto[];
  onChange: (photos: StagedPhoto[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Object URLs leak unless revoked when the component unmounts.
  useEffect(() => {
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only on unmount
  }, []);

  function addFiles(files: FileList) {
    const room = MAX_STAGED_PHOTOS - photos.length;
    const incoming = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (incoming.length > room) {
      setWarning(
        `Máximo ${MAX_STAGED_PHOTOS} fotos por propiedad; se agregaron las primeras ${room}.`,
      );
    } else {
      setWarning(null);
    }

    const accepted = incoming.slice(0, Math.max(0, room)).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    if (accepted.length > 0) {
      onChange([...photos, ...accepted]);
    }
  }

  function removePhoto(id: string) {
    const photo = photos.find((entry) => entry.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    onChange(photos.filter((entry) => entry.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) {
      return;
    }
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === targetIndex) {
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    onChange(next);
  }

  return (
    <div className={styles.formGrid}>
      <label className={styles.formField}>
        <span>
          Fotos ({photos.length}/{MAX_STAGED_PHOTOS}) — la primera es la
          portada. Se convierten a WebP (máx. 1600px) al guardar.
        </span>
        <input
          ref={inputRef}
          className={styles.textInput}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={disabled || photos.length >= MAX_STAGED_PHOTOS}
          onChange={(event) => {
            if (event.target.files?.length) {
              addFiles(event.target.files);
            }
            if (inputRef.current) {
              inputRef.current.value = "";
            }
          }}
        />
      </label>

      {warning ? <p className={styles.formError}>{warning}</p> : null}

      {photos.length > 0 ? (
        <div className={styles.stagedGrid}>
          {photos.map((photo, index) => (
            <figure
              className={styles.stagedItem}
              key={photo.id}
              draggable={!disabled}
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(index);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
                className={styles.stagedThumb}
                onClick={() => setZoomIndex(index)}
              />
              <figcaption className={styles.stagedCaption}>
                {index === 0 ? "Portada" : `#${index + 1}`}
              </figcaption>
              <div className={styles.stagedActions}>
                <button
                  className={styles.ghostButton}
                  type="button"
                  aria-label="Mover antes"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  aria-label="Mover después"
                  disabled={disabled || index === photos.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  className={styles.ghostButton}
                  type="button"
                  disabled={disabled}
                  onClick={() => removePhoto(photo.id)}
                >
                  ✕
                </button>
              </div>
            </figure>
          ))}
        </div>
      ) : null}

      {zoomIndex !== null ? (
        <ImageLightbox
          images={photos.map((photo) => ({
            src: photo.previewUrl,
            alt: photo.file.name,
          }))}
          index={zoomIndex}
          onClose={() => setZoomIndex(null)}
          onNavigate={setZoomIndex}
        />
      ) : null}
    </div>
  );
}
