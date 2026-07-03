"use client";

import Image from "next/image";
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
            <Image
              src={image.src}
              alt={image.alt}
              className={styles.galleryImage}
              width={800}
              height={450}
              sizes="(max-width: 820px) 100vw, 45vw"
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
