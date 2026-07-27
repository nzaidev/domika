"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";

// Share buttons for the public listing URL. Meta apps: WhatsApp + Facebook +
// Instagram. Instagram has no web share endpoint for arbitrary links, so we
// copy a ready-made caption and open Instagram for the agent to paste.
export function SocialShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title} — ${url}`);

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
        onClick={async () => {
          await navigator.clipboard.writeText(`${title}\n${url}`);
          setIgCopied(true);
          setTimeout(() => setIgCopied(false), 2500);
          window.open("https://www.instagram.com/", "_blank", "noopener");
        }}
        title="Copia el texto y ábrelo en Instagram para pegarlo en tu historia o publicación"
      >
        {igCopied ? "Texto copiado ✓" : "Instagram"}
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
