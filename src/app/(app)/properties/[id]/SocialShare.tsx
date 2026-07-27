"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";

// Share buttons for the public listing URL.
//
// WhatsApp / Facebook / LinkedIn use each network's web share endpoint; the
// public page's Open Graph tags give them the thumbnail + price automatically.
// Instagram has NO web endpoint that pre-fills a post, so we use the Web Share
// API to hand the actual photo + caption to the OS share sheet (on mobile the
// sheet includes Instagram → Stories/Feed with the image and details already
// attached). On desktop we fall back to copying the caption and opening the
// image so the agent can post it manually.
export function SocialShare({
  url,
  title,
  subtitle,
  imagePath,
}: {
  url: string;
  title: string;
  subtitle?: string;
  imagePath?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [igState, setIgState] = useState<"idle" | "working" | "done">("idle");

  const encodedUrl = encodeURIComponent(url);
  const caption = [title, subtitle, url].filter(Boolean).join("\n");
  const encodedText = encodeURIComponent(caption);

  async function shareToInstagram() {
    setIgState("working");

    // 1) Native share with the real image file (mobile → Instagram in sheet).
    try {
      if (imagePath && typeof navigator !== "undefined" && navigator.canShare) {
        const response = await fetch(imagePath);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], "propiedad.jpg", {
            type: blob.type || "image/jpeg",
          });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], text: caption, title });
            setIgState("idle");
            return;
          }
        }
      }
      // 2) Native share without a file (still opens the OS sheet).
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: caption, url });
        setIgState("idle");
        return;
      }
    } catch (error) {
      // User dismissed the share sheet — stop, don't fall through to copy.
      if (error instanceof Error && error.name === "AbortError") {
        setIgState("idle");
        return;
      }
    }

    // 3) Desktop fallback: copy the caption, open the photo to save, open IG.
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      // clipboard may be blocked; the opened tabs still let them post.
    }
    if (imagePath) {
      window.open(imagePath, "_blank", "noopener");
    }
    window.open("https://www.instagram.com/", "_blank", "noopener");
    setIgState("done");
    setTimeout(() => setIgState("idle"), 3500);
  }

  return (
    <div className={styles.shareRow}>
      <a
        className={styles.secondaryButton}
        href={`https://wa.me/?text=${encodedText}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      <a
        className={styles.secondaryButton}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        Facebook
      </a>
      <a
        className={styles.secondaryButton}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
      >
        LinkedIn
      </a>
      <button
        className={styles.secondaryButton}
        type="button"
        onClick={shareToInstagram}
        disabled={igState === "working"}
        title="Comparte la foto y los datos de la propiedad en Instagram"
      >
        {igState === "working"
          ? "Preparando…"
          : igState === "done"
            ? "Foto y texto listos ✓"
            : "Instagram"}
      </button>
      <button
        className={styles.secondaryButton}
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado ✓" : "Copiar enlace"}
      </button>
    </div>
  );
}
