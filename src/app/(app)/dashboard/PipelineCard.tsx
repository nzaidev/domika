"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/domika/domika-app.module.css";
import { formatPrice } from "@/app/(app)/properties/labels";

export type PipelineStage = {
  id: string;
  name: string;
  count: number;
  value: number;
  firstLead: string | null;
};

// Stage palette — status colors only, matched by stage name.
function stageColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("nuevo")) return "var(--app-green)";
  if (n.includes("contact")) return "var(--app-blue)";
  if (n.includes("visita") || n.includes("cita")) return "var(--app-purple)";
  if (n.includes("negoci") || n.includes("propuesta") || n.includes("reserva"))
    return "var(--app-orange)";
  if (n.includes("cierre") || n.includes("cerr") || n.includes("gan"))
    return "var(--app-amber)";
  if (n.includes("perdid") || n.includes("descart")) return "var(--app-slate)";
  return "var(--app-green)";
}

function AreaChart() {
  // Decorative inventory trend (no time-series data source yet).
  const values = [30, 44, 39, 58, 54, 70, 66, 84, 92, 104];
  const width = 320;
  const height = 120;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - v] as const);
  const line = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      className={styles.areaChart}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Tendencia del inventario"
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e9f6e" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0e9f6e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaFill)" />
      <path
        d={line}
        fill="none"
        stroke="#0e9f6e"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StageTiles({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className={styles.stageTileRow}>
      {stages.map((stage) => (
        <Link
          className={styles.stageTile}
          href="/leads"
          key={stage.id}
          title={stage.name}
        >
          <div className={styles.stageTileName}>{stage.name}</div>
          <div className={styles.stageTileCount}>{stage.count}</div>
          <span className={styles.stageTileName2}>
            {stage.firstLead ?? "Sin prospectos"}
          </span>
          <div
            className={styles.stageBar}
            style={{ background: stageColor(stage.name) }}
          />
        </Link>
      ))}
    </div>
  );
}

function FunnelView({
  stages,
  currency,
}: {
  stages: PipelineStage[];
  currency: string;
}) {
  const counts = stages.map((s) => s.count);
  const maxCount = Math.max(...counts, 1);
  const totalLeads = counts.reduce((sum, c) => sum + c, 0);
  const totalValue = stages.reduce((sum, s) => sum + s.value, 0);
  const firstCount = stages[0]?.count ?? 0;
  const lastCount = stages[stages.length - 1]?.count ?? 0;
  const conversion = firstCount > 0 ? (lastCount / firstCount) * 100 : 0;

  if (totalLeads === 0) {
    return (
      <p className={styles.mutedText}>
        Aún no hay prospectos en el embudo. Captura contactos para ver el flujo.
      </p>
    );
  }

  return (
    <div className={styles.funnel}>
      <div className={styles.funnelHead}>
        <span />
        <span className={styles.funnelHeadCell}>Clientes</span>
        <span className={styles.funnelHeadCell}>Valor estimado</span>
        <span className={styles.funnelHeadCell}>% del total</span>
      </div>

      {stages.map((stage) => {
        const widthPct = 28 + 72 * (stage.count / maxCount);
        const sharePct = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
        const color = stageColor(stage.name);
        return (
          <div className={styles.funnelRow} key={stage.id}>
            <div className={styles.funnelBandCell}>
              <div
                className={styles.funnelBand}
                style={{ width: `${widthPct}%`, background: color }}
                title={`${stage.name}: ${stage.count}`}
              >
                <span className={styles.funnelBandLabel}>{stage.name}</span>
              </div>
            </div>
            <span className={styles.funnelCount}>{stage.count}</span>
            <span className={styles.funnelValue}>
              {formatPrice(stage.value, currency)}
            </span>
            <span className={styles.funnelPct}>
              <span className={styles.funnelBarTrack}>
                <span
                  className={styles.funnelBarFill}
                  style={{ width: `${sharePct}%`, background: color }}
                />
              </span>
              <span className={styles.funnelPctLabel}>
                {Math.round(sharePct)}%
              </span>
            </span>
          </div>
        );
      })}

      <div className={styles.funnelTotals}>
        <div>
          <span className={styles.funnelTotalLabel}>Conversión total</span>
          <div className={styles.funnelConversion}>
            {conversion.toFixed(1)}%
          </div>
        </div>
        <div className={styles.funnelTotalRight}>
          <span className={styles.funnelTotalLabel}>
            Valor total del pipeline
          </span>
          <div className={styles.funnelPipelineValue}>
            {formatPrice(totalValue, currency)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PipelineCard({
  stages,
  currency,
  inventoryValue,
}: {
  stages: PipelineStage[];
  currency: string;
  inventoryValue: number;
}) {
  const [view, setView] = useState<"stages" | "funnel">("stages");

  return (
    <section className={`${styles.panel} ${styles.pipelineCard}`}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Pipeline</span>
          <h2>Flujo de ventas</h2>
        </div>
        <div className={styles.pipelineToggle} role="tablist" aria-label="Vista del pipeline">
          <button
            type="button"
            role="tab"
            aria-selected={view === "stages"}
            className={
              view === "stages"
                ? `${styles.pipelineToggleBtn} ${styles.pipelineToggleActive}`
                : styles.pipelineToggleBtn
            }
            onClick={() => setView("stages")}
          >
            Etapas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "funnel"}
            className={
              view === "funnel"
                ? `${styles.pipelineToggleBtn} ${styles.pipelineToggleActive}`
                : styles.pipelineToggleBtn
            }
            onClick={() => setView("funnel")}
          >
            Embudo
          </button>
        </div>
      </div>

      {view === "stages" ? (
        <>
          <StageTiles stages={stages} />
          <div>
            <span className={styles.eyebrow}>Valor de inventario</span>
            <div className={styles.inventoryValue}>
              {formatPrice(inventoryValue, currency)}
            </div>
          </div>
          <AreaChart />
        </>
      ) : (
        <FunnelView stages={stages} currency={currency} />
      )}

      <div className={styles.pipelineFoot}>
        <Link className={styles.secondaryButton} href="/leads">
          Ver pipeline
        </Link>
      </div>
    </section>
  );
}
