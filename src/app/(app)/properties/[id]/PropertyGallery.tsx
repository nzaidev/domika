"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { ImageLightbox } from "../ImageLightbox";

export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
};

export function PropertyGallery({ images }: { images: GalleryImage[] }) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  return (
    <>
      <div className={styles.galleryGrid}>
        {images.map((image, index) => (
          <button
            className={styles.galleryButton}
            type="button"
            key={image.id}
            aria-label={`Ampliar foto ${index + 1}`}
            onClick={() => setZoomIndex(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- storage assets are pre-normalized; skip the optimizer */}
            <img
              src={image.src}
              alt={image.alt}
              className={styles.galleryImage}
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {zoomIndex !== null ? (
        <ImageLightbox
          images={images}
          index={zoomIndex}
          onClose={() => setZoomIndex(null)}
          onNavigate={setZoomIndex}
        />
      ) : null}
    </>
  );
}
