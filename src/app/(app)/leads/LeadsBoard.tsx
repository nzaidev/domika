"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadRow } from "@/lib/database.types";
import type { BoardLead, LeadsBoardStage } from "@/lib/domain/leads";
import { moveLeadAction } from "./actions";

const SOURCE_LABELS: Record<LeadRow["source"], string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  portal: "Portal",
  referral: "Referido",
  listing: "Publicación",
  other: "Otro",
};

const DRAG_MIME = "application/x-domika-lead";

function leadSubtitle(lead: LeadRow) {
  const parts = [SOURCE_LABELS[lead.source]];
  if (lead.desired_zone) {
    parts.push(lead.desired_zone);
  }
  if (lead.phone) {
    parts.push(lead.phone);
  }
  return parts.join(" · ");
}

// Presupuesto shown on the card: a single figure, or a min–max range.
function formatBudget(lead: LeadRow): string | null {
  const { budget_min: min, budget_max: max } = lead;
  if (min == null && max == null) {
    return null;
  }
  const fmt = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
  if (min != null && max != null && min !== max) {
    return `${fmt(min)} – ${fmt(max)}`;
  }
  return fmt((max ?? min) as number);
}

type Move = { leadId: string; toStageId: string };

function applyMove(stages: LeadsBoardStage[], move: Move): LeadsBoardStage[] {
  let moved: BoardLead | null = null;

  const without = stages.map((stage) => {
    const lead = stage.leads.find((entry) => entry.id === move.leadId);
    if (lead) {
      moved = lead;
      return {
        ...stage,
        leads: stage.leads.filter((entry) => entry.id !== move.leadId),
      };
    }
    return stage;
  });

  if (!moved) {
    return stages;
  }

  return without.map((stage) =>
    stage.id === move.toStageId
      ? { ...stage, leads: [moved as BoardLead, ...stage.leads] }
      : stage,
  );
}

export function LeadsBoard({
  stages,
  highlightStageId = null,
}: {
  stages: LeadsBoardStage[];
  highlightStageId?: string | null;
}) {
  const [optimisticStages, addMove] = useOptimistic(stages, applyMove);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleDrop(stageId: string, event: React.DragEvent) {
    event.preventDefault();
    setDropTarget(null);

    const leadId = event.dataTransfer.getData(DRAG_MIME);

    if (!leadId) {
      return;
    }

    const fromStage = optimisticStages.find((stage) =>
      stage.leads.some((lead) => lead.id === leadId),
    );

    if (fromStage?.id === stageId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      addMove({ leadId, toStageId: stageId });
      const result = await moveLeadAction(leadId, stageId);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <section className={styles.lifecycle}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Ciclo de vida del prospecto</span>
          <h2>Del contacto de WhatsApp al cierre</h2>
        </div>
        <span className={styles.pill}>Arrastra para mover de etapa</span>
      </div>
      {error ? <p className={styles.formError}>{error}</p> : null}
      <div className={styles.stageGrid}>
        {optimisticStages.map((stage) => (
          <article
            className={`${styles.stage} ${
              dropTarget === stage.id ? styles.stageDropActive : ""
            } ${highlightStageId === stage.id ? styles.stageFiltered : ""}`}
            key={stage.id}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(DRAG_MIME)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(stage.id);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropTarget((current) =>
                  current === stage.id ? null : current,
                );
              }
            }}
            onDrop={(event) => handleDrop(stage.id, event)}
          >
            <div className={styles.stageHead}>
              <strong>{stage.name}</strong>
              <span>{stage.leads.length}</span>
            </div>
            <div className={styles.leadStack}>
              {stage.leads.map((lead) => (
                <Link
                  className={styles.leadCard}
                  href={`/leads/${lead.id}`}
                  key={lead.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_MIME, lead.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <strong>{lead.full_name}</strong>
                  <small>{leadSubtitle(lead)}</small>
                  {formatBudget(lead) ? (
                    <span className={styles.leadBudget}>
                      <span className={styles.leadBudgetLabel}>Presupuesto</span>
                      <strong>{formatBudget(lead)}</strong>
                    </span>
                  ) : null}
                  {lead.tags?.length ? (
                    <span className={styles.tagList}>
                      {lead.tags.map((tag) => (
                        <span
                          className={styles.tagChipSmall}
                          style={{ background: tag.color }}
                          key={tag.id}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </Link>
              ))}
              {stage.leads.length === 0 ? (
                <p className={styles.mutedText}>Sin prospectos</p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
