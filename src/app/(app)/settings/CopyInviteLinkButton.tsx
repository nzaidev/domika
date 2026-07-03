"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";

export function CopyInviteLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={styles.secondaryButton}
      type="button"
      onClick={async () => {
        const link = `${window.location.origin}/invite/${token}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Enlace copiado ✓" : "Copiar enlace de invitación"}
    </button>
  );
}
