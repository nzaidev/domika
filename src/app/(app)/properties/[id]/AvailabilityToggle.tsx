"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/domika/domika-app.module.css";
import { setPropertyActiveAction } from "../actions";

// On/off switch controlling whether the property is available/visible.
// When off, it's unpublished from the network + public link and hidden
// from matching (enforced server-side).
export function AvailabilityToggle({
  propertyId,
  active,
}: {
  propertyId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      await setPropertyActiveAction(propertyId, next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={styles.availabilityToggle}
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Disponible — click para ocultar" : "Oculta — click para activar"}
    >
      <span
        className={`${styles.toggleTrack} ${on ? styles.toggleOn : ""}`}
        aria-hidden
      >
        <span className={styles.toggleKnob} />
      </span>
      {on ? "Disponible" : "Oculta"}
    </button>
  );
}
