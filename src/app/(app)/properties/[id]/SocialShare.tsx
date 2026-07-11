"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";

// Share buttons for the public listing URL. Meta apps: WhatsApp + Facebook
// (Instagram has no web share endpoint — use copy link and paste in bio/DM).
export function SocialShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
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
