"use client";

import { useEffect } from "react";
import styles from "@/components/domika/domika-app.module.css";

export type LightboxImage = {
  src: string;
  alt: string;
};

export function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const current = images[index];

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight" && index < images.length - 1) {
        onNavigate(index + 1);
      } else if (event.key === "ArrowLeft" && index > 0) {
        onNavigate(index - 1);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [index, images.length, onClose, onNavigate]);

  if (!current) {
    return null;
  }

  return (
    <div
      className={styles.lightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox shows the already-optimized asset at full size */}
      <img
        src={current.src}
        alt={current.alt}
        className={styles.lightboxImage}
        onClick={(event) => event.stopPropagation()}
      />
      <button
        className={styles.lightboxClose}
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
      >
        ×
      </button>
      {index > 0 ? (
        <button
          className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
          type="button"
          aria-label="Anterior"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(index - 1);
          }}
        >
          ‹
        </button>
      ) : null}
      {index < images.length - 1 ? (
        <button
          className={`${styles.lightboxNav} ${styles.lightboxNext}`}
          type="button"
          aria-label="Siguiente"
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(index + 1);
          }}
        >
          ›
        </button>
      ) : null}
      <span className={styles.lightboxCounter}>
        {index + 1} / {images.length}
      </span>
    </div>
  );
}
