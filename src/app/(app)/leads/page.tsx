import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import type { LeadRow } from "@/lib/database.types";
import { getLeadsBoard, type LeadFilters } from "@/lib/domain/leads";
import { CreateLeadForm } from "./CreateLeadForm";
import { LeadsBoard } from "./LeadsBoard";

export const dynamic = "force-dynamic";

const SOURCE_OPTIONS: Array<{ value: LeadRow["source"]; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "portal", label: "Portal" },
  { value: "referral", label: "Referido" },
  { value: "listing", label: "Publicación" },
  { value: "other", label: "Otro" },
];

const BUSINESS_UNITS = [
  "general",
  "casas",
  "departamentos",
  "alquileres",
  "terrenos",
  "inversionistas",
  "premium",
];

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const filters: LeadFilters = {
    q: firstParam(params.q) || undefined,
    source:
      (SOURCE_OPTIONS.find((option) => option.value === firstParam(params.source))
        ?.value as LeadFilters["source"]) || undefined,
    assignedTo: firstParam(params.assignee) || undefined,
    businessUnit: firstParam(params.unit) || undefined,
  };

  const board = await getLeadsBoard(filters);

  if (board.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>
          Agrega los valores de `.env.example` y recarga esta ruta para ver el
          embudo de prospectos con datos reales.
        </p>
      </div>
    );
  }

  if (board.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (board.status === "profile_missing") {
    redirect("/onboarding");
  }

  const hasFilters = Boolean(
    filters.q || filters.source || filters.assignedTo || filters.businessUnit,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Prospectos"
        title="Embudo de prospectos con contactos en vivo"
        description="Gestiona cada contacto desde su entrada por WhatsApp hasta la visita, oferta y cierre."
        actions={
          <>
            <span className={styles.pill}>
              {board.totalLeads} prospecto{board.totalLeads === 1 ? "" : "s"}
            </span>
            <Link className={styles.secondaryButton} href="/leads/import">
              Importar contactos
            </Link>
          </>
        }
      />

      <form className={styles.filterBar} method="get" action="/leads">
        <input
          className={styles.textInput}
          type="search"
          name="q"
          placeholder="Buscar por nombre, teléfono o email"
          defaultValue={filters.q ?? ""}
        />
        <select
          className={styles.textInput}
          name="source"
          defaultValue={firstParam(params.source)}
        >
          <option value="">Origen: todos</option>
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className={styles.textInput}
          name="assignee"
          defaultValue={firstParam(params.assignee)}
        >
          <option value="">Agente: todos</option>
          {board.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
        <select
          className={styles.textInput}
          name="unit"
          defaultValue={firstParam(params.unit)}
        >
          <option value="">Unidad: todas</option>
          {BUSINESS_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit.charAt(0).toUpperCase() + unit.slice(1)}
            </option>
          ))}
        </select>
        <button className={styles.secondaryButton} type="submit">
          Filtrar
        </button>
        {hasFilters ? (
          <Link className={styles.ghostButton} href="/leads">
            Limpiar
          </Link>
        ) : null}
      </form>

      <div className={styles.leadsGrid}>
        <LeadsBoard stages={board.stages} />
        <aside className={styles.detailRail}>
          <div className={styles.sectionHeader}>
            <div>
              <span className={styles.eyebrow}>Captura manual</span>
              <h2>Nuevo prospecto</h2>
            </div>
          </div>
          <CreateLeadForm />
        </aside>
      </div>
    </div>
  );
}
