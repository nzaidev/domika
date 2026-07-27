"use client";

import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { CreateLeadForm } from "./CreateLeadForm";

// Collapsed by default so the board keeps the full width; the capture form
// only appears on demand, as a full-width panel above the board.
export function CreateLeadPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={styles.createLeadBar}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => setOpen(true)}
        >
          + Nuevo prospecto
        </button>
      </div>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Captura manual</span>
          <h2>Nuevo prospecto</h2>
        </div>
        <button
          className={styles.ghostButton}
          type="button"
          onClick={() => setOpen(false)}
        >
          Cerrar
        </button>
      </div>
      <CreateLeadForm />
    </section>
  );
}
