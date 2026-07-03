import Image from "next/image";
import type { Lead, Property } from "@/lib/types";
import styles from "./domika-app.module.css";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  );
}

export function MetricGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string | number; tone: string }>;
}) {
  return (
    <section className={styles.metricGrid} aria-label="Indicadores del CRM">
      {metrics.map((metric) => (
        <article className={styles.metricCard} key={metric.label}>
          <span className={`${styles.statusDot} ${styles[`tone_${metric.tone}`]}`} />
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}

export function LifecycleBoard({
  columns,
  compact = false,
}: {
  columns: ReadonlyArray<{ label: string; tone: string; leads: Lead[] }>;
  compact?: boolean;
}) {
  return (
    <section className={styles.lifecycle}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Ciclo de vida del prospecto</span>
          <h2>Del contacto de WhatsApp al cierre</h2>
        </div>
        <span className={styles.pill}>{compact ? "Vista diaria" : "Embudo activo"}</span>
      </div>
      <div className={styles.stageGrid}>
        {columns.map((stage) => (
          <article className={styles.stage} key={stage.label}>
            <div className={styles.stageHead}>
              <strong>{stage.label}</strong>
              <span>{stage.leads.length}</span>
            </div>
            <div className={styles.leadStack}>
              {stage.leads.map((lead, index) => (
                <div className={styles.leadCard} key={lead.id}>
                  <strong>{lead.name}</strong>
                  <small>
                    {index === 0 ? "WhatsApp" : `${lead.type} · ${lead.zone}`}
                  </small>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WhatsAppInbox({
  messages,
}: {
  messages: Array<{ name: string; message: string; time: string }>;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Captura de contactos</span>
          <h2>Bandeja de WhatsApp</h2>
        </div>
        <span className={styles.pill}>En vivo</span>
      </div>
      <div className={styles.messageList}>
        {messages.map((message) => (
          <article className={styles.messageRow} key={message.name}>
            <div className={styles.avatar}>{message.name.slice(0, 1)}</div>
            <div>
              <strong>{message.name}</strong>
              <span>{message.message}</span>
            </div>
            <time className={styles.mutedText}>{message.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PropertyGrid({
  properties,
  limit,
}: {
  properties: Property[];
  limit?: number;
}) {
  const visibleProperties =
    typeof limit === "number" ? properties.slice(0, limit) : properties;

  return (
    <section className={styles.propertyGrid} aria-label="Propiedades">
      {visibleProperties.map((property) => (
        <article className={styles.propertyCard} key={property.id}>
          <Image
            src={property.photo}
            alt={`Vista previa de la propiedad ${property.title}`}
            className={styles.propertyImage}
            width={900}
            height={506}
            sizes="(max-width: 820px) 100vw, 30vw"
          />
          <div className={styles.propertyBody}>
            <div className={styles.propertyTitleBlock}>
              <strong>{property.title}</strong>
              <span className={styles.propertyMeta}>{property.loc}</span>
            </div>
            <div className={styles.propertyFooter}>
              <strong>{property.price}</strong>
              <span className={styles.pill}>
                {property.status === "active" ? "Publicado" : "Borrador"}
              </span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

export function CampaignChannels({
  channels,
}: {
  channels: Array<{ label: string; status: string; reach: string }>;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Promoción</span>
          <h2>Canales de campaña</h2>
        </div>
      </div>
      <div className={styles.channelList}>
        {channels.map((channel) => (
          <article className={styles.channelRow} key={channel.label}>
            <strong>{channel.label}</strong>
            <span>{channel.status} · {channel.reach}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

const meshAgents = [
  {
    name: "Nora Alvarez",
    firm: "Caribe Living",
    focus: "Compradores lujo",
  },
  {
    name: "Miguel Santos",
    firm: "Distrito Homes",
    focus: "Familias urbanas",
  },
  {
    name: "Elena Ruiz",
    firm: "Costa Norte Realty",
    focus: "Playa e inversión",
  },
  {
    name: "Carlos Medina",
    firm: "Metro Brokers",
    focus: "Rentas corporativas",
  },
  {
    name: "Laura Peña",
    firm: "Naco Select",
    focus: "Primer hogar",
  },
  {
    name: "Sonia Vega",
    firm: "Vista Capital",
    focus: "Referidos activos",
  },
];

export function AgentMeshNetwork() {
  return (
    <section className={styles.meshPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.eyebrow}>Mapa de relación</span>
          <h2>Cuenta conectada con agentes colaboradores</h2>
        </div>
        <span className={styles.pill}>12 conexiones</span>
      </div>

      <div className={styles.meshCanvas} aria-label="Red visual de agentes">
        {meshAgents.map((agent, index) => (
          <span
            aria-hidden="true"
            className={`${styles.meshLine} ${styles[`meshLine_${index}`]}`}
            key={`line-${agent.name}`}
          />
        ))}
        <span
          aria-hidden="true"
          className={`${styles.meshPeerLine} ${styles.meshPeerLine_0}`}
        />
        <span
          aria-hidden="true"
          className={`${styles.meshPeerLine} ${styles.meshPeerLine_1}`}
        />
        <span
          aria-hidden="true"
          className={`${styles.meshPeerLine} ${styles.meshPeerLine_2}`}
        />

        <div className={`${styles.meshNode} ${styles.meshAccountNode}`}>
          <span>Domika</span>
          <strong>Tu cuenta</strong>
          <small>Inventario activo</small>
        </div>

        {meshAgents.map((agent, index) => (
          <article
            className={`${styles.meshNode} ${styles[`meshNode_${index}`]}`}
            key={agent.name}
          >
            <strong>{agent.name}</strong>
            <span>{agent.firm}</span>
            <small>{agent.focus}</small>
          </article>
        ))}
      </div>

      <div className={styles.meshLegend}>
        <span>Compartir inventario</span>
        <span>Solicitudes de co-broker</span>
        <span>Compradores compatibles</span>
      </div>
    </section>
  );
}

export function AgentExchange({
  listings,
}: {
  listings: Array<{
    agent: string;
    firm: string;
    listing: string;
    split: string;
    match: string;
  }>;
}) {
  return (
    <div className={styles.exchangeList}>
      {listings.map((listing) => (
        <article className={styles.exchangeCard} key={listing.listing}>
          <div>
            <span className={styles.eyebrow}>{listing.firm}</span>
            <h2>{listing.listing}</h2>
          </div>
          <dl className={styles.definitionGrid}>
            <div>
              <dt>Agente</dt>
              <dd>{listing.agent}</dd>
            </div>
            <div>
              <dt>Comisión</dt>
              <dd>{listing.split}</dd>
            </div>
            <div>
              <dt>Compatibles</dt>
              <dd>{listing.match}</dd>
            </div>
          </dl>
          <button className={styles.secondaryButton}>Abrir sala compartida</button>
        </article>
      ))}
    </div>
  );
}

export function TaskList({
  items,
}: {
  items: Array<{ title: string; context: string; due: string; priority: string }>;
}) {
  return (
    <div className={styles.taskList}>
      {items.map((task) => (
        <article className={styles.taskCard} key={`${task.title}-${task.due}`}>
          <span
            className={`${styles.priority} ${
              task.priority === "Alta"
                ? styles.priorityAlta
                : task.priority === "Media"
                  ? styles.priorityMedia
                  : styles.priorityBaja
            }`}
          />
          <div>
            <strong>{task.title}</strong>
            <div className={styles.mutedText}>{task.context}</div>
          </div>
          <span className={styles.pill}>{task.priority}</span>
          <time className={styles.mutedText}>{task.due}</time>
        </article>
      ))}
    </div>
  );
}

export { styles as domikaAppStyles };
