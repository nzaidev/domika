import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domika/AppWidgets";
import styles from "@/components/domika/domika-app.module.css";
import {
  listProperties,
  type PropertyFilters,
} from "@/lib/domain/properties";
import {
  formatPrice,
  OPERATION_LABELS,
  PROPERTY_TYPE_OPTIONS,
  STATUS_LABELS,
} from "./labels";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const filters: PropertyFilters = {
    q: firstParam(params.q) || undefined,
    status: (Object.keys(STATUS_LABELS).includes(firstParam(params.status))
      ? firstParam(params.status)
      : undefined) as PropertyFilters["status"],
    operation: (Object.keys(OPERATION_LABELS).includes(
      firstParam(params.operation),
    )
      ? firstParam(params.operation)
      : undefined) as PropertyFilters["operation"],
    propertyType: firstParam(params.type) || undefined,
  };

  const list = await listProperties(filters);

  if (list.status === "not_configured") {
    return (
      <div className={styles.emptyState}>
        <span className={styles.eyebrow}>Configuración del backend</span>
        <h1>Clerk o Supabase todavía no están configurados</h1>
        <p>Agrega los valores de `.env.example` y recarga esta ruta.</p>
      </div>
    );
  }

  if (list.status === "unauthenticated") {
    redirect("/sign-in");
  }

  if (list.status === "profile_missing") {
    redirect("/onboarding");
  }

  const hasFilters = Boolean(
    filters.q || filters.status || filters.operation || filters.propertyType,
  );

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Propiedades"
        title="Inventario inmobiliario"
        description="Administra propiedades, fotos, estado y datos privados del propietario."
        actions={
          <>
            <span className={styles.pill}>
              {list.total} propiedad{list.total === 1 ? "" : "es"}
            </span>
            <Link className={styles.primaryButton} href="/properties/new">
              Nueva propiedad
            </Link>
          </>
        }
      />

      <form className={styles.filterBar} method="get" action="/properties">
        <input
          className={styles.textInput}
          type="search"
          name="q"
          placeholder="Buscar por título, ciudad, zona o dirección"
          defaultValue={filters.q ?? ""}
        />
        <select
          className={styles.textInput}
          name="status"
          defaultValue={firstParam(params.status)}
        >
          <option value="">Estado: todos</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={styles.textInput}
          name="operation"
          defaultValue={firstParam(params.operation)}
        >
          <option value="">Operación: todas</option>
          {Object.entries(OPERATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          className={styles.textInput}
          name="type"
          defaultValue={firstParam(params.type)}
        >
          <option value="">Tipo: todos</option>
          {PROPERTY_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button className={styles.secondaryButton} type="submit">
          Filtrar
        </button>
        {hasFilters ? (
          <Link className={styles.ghostButton} href="/properties">
            Limpiar
          </Link>
        ) : null}
      </form>

      {list.properties.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.eyebrow}>Inventario</span>
          <h1>{hasFilters ? "Sin resultados" : "Todavía no hay propiedades"}</h1>
          <p>
            {hasFilters
              ? "Prueba con otros filtros."
              : "Crea la primera propiedad para empezar a construir el inventario."}
          </p>
        </div>
      ) : (
        <section className={styles.propertyGrid} aria-label="Propiedades">
          {list.properties.map((property) => (
            <Link
              className={styles.propertyCard}
              href={`/properties/${property.id}`}
              key={property.id}
            >
              {property.coverUrl ? (
                <Image
                  src={property.coverUrl}
                  alt={property.title}
                  className={styles.propertyImage}
                  width={900}
                  height={506}
                  sizes="(max-width: 820px) 100vw, 30vw"
                />
              ) : (
                <div className={styles.propertyImagePlaceholder}>Sin fotos</div>
              )}
              <div className={styles.propertyBody}>
                <div className={styles.propertyTitleBlock}>
                  <strong>{property.title}</strong>
                  <span className={styles.propertyMeta}>
                    {[property.zone, property.city].filter(Boolean).join(", ") ||
                      OPERATION_LABELS[property.operation]}
                  </span>
                </div>
                <div className={styles.propertyFooter}>
                  <strong>
                    {formatPrice(property.price, property.currency)}
                  </strong>
                  <span className={styles.pill}>
                    {STATUS_LABELS[property.status]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
