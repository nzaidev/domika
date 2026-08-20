"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import {
  removeFromPipelineAction,
  restoreToPipelineAction,
} from "../actions";

// Moves a record between "prospecto" (on the board) and "contacto" (off it).
// Nothing is deleted either way — the same lead keeps its history and tags.
export function PipelineMembership({
  leadId,
  inPipeline,
}: {
  leadId: string;
  inPipeline: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = inPipeline
        ? await removeFromPipelineAction(leadId)
        : await restoreToPipelineAction(leadId);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={run}
        disabled={pending}
        title={
          inPipeline
            ? "Sacarlo del embudo y dejarlo como contacto"
            : "Volver a agregarlo al embudo"
        }
      >
        {pending
          ? "Guardando…"
          : inPipeline
            ? "Quitar del embudo"
            : "Mover al embudo"}
      </button>
      {error ? <p className={styles.formError}>{error}</p> : null}
    </>
  );
}
