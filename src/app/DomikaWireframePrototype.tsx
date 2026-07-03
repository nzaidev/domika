import Image from "next/image";
import Link from "next/link";
import styles from "./domika-wireframe-prototype.module.css";

// PROTOTYPE: throwaway Domika CRM wireframe. Absorb the chosen direction into
// production components once the front-end direction is validated.

type Variant = "command" | "pipeline" | "exchange";

type DomikaWireframePrototypeProps = {
  activeVariant: Variant;
};

const variantTabs: Array<{ id: Variant; label: string }> = [
  { id: "command", label: "Centro" },
  { id: "pipeline", label: "Embudo" },
  { id: "exchange", label: "Red" },
];

const stats = [
  { label: "Contactos de WhatsApp", value: "28", tone: "green" },
  { label: "Prospectos activos", value: "184", tone: "blue" },
  { label: "Propiedades publicadas", value: "42", tone: "mint" },
  { label: "Compartidas con agentes", value: "19", tone: "amber" },
];

const lifecycleStages = [
  {
    label: "Nuevo",
    count: 28,
    leads: ["Camila R.", "Jose M.", "Laura P."],
  },
  {
    label: "Calificado",
    count: 46,
    leads: ["Ana V.", "Rafael C.", "Marta L."],
  },
  {
    label: "Visita",
    count: 31,
    leads: ["Daniel S.", "Sofia N.", "Marco T."],
  },
  {
    label: "Oferta",
    count: 12,
    leads: ["Natalia G.", "Luis A."],
  },
  {
    label: "Cierre",
    count: 7,
    leads: ["Isabella F.", "Victor D."],
  },
];

const listings = [
  {
    title: "Torre Vista Real 18B",
    area: "Piantini",
    price: "$320K",
    status: "Publicado",
    image:
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=900&q=80",
  },
  {
    title: "Penthouse con vista al mar en Cap Cana",
    area: "Punta Cana",
    price: "$485K",
    status: "En promoción",
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=900&q=80",
  },
  {
    title: "Loft moderno en Naco",
    area: "Santo Domingo",
    price: "$245K",
    status: "Borrador",
    image:
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&q=80",
  },
];

const inbox = [
  {
    name: "Patricia Gomez",
    message: "Pidió una visita cerca de Naco",
    source: "WhatsApp",
    time: "2m",
  },
  {
    name: "Hector Diaz",
    message: "Compartió presupuesto y zonas preferidas",
    source: "WhatsApp",
    time: "9m",
  },
  {
    name: "Agente Laura",
    message: "Solicitó condiciones de co-broker",
    source: "Red",
    time: "21m",
  },
];

const networkListings = [
  {
    agent: "Nora Alvarez",
    firm: "Caribe Living",
    listing: "Villa en Casa de Campo",
    split: "50/50",
    match: "8 compradores",
  },
  {
    agent: "Miguel Santos",
    firm: "Distrito Homes",
    listing: "Casa familiar en Bella Vista",
    split: "60/40",
    match: "5 compradores",
  },
  {
    agent: "Elena Ruiz",
    firm: "North Coast Realty",
    listing: "Apartamento frente al mar en Bávaro",
    split: "Referido",
    match: "11 compradores",
  },
];

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? styles.brandCompact : styles.brand}>
      <Image
        src="/brand/domika-logo-light.jpeg"
        alt="Domika"
        className={styles.brandImage}
        width={1600}
        height={1033}
        priority={compact}
      />
    </div>
  );
}

function StatusDot({ tone }: { tone: string }) {
  return <span className={`${styles.statusDot} ${styles[`tone_${tone}`]}`} />;
}

function PrototypeSwitcher({ activeVariant }: DomikaWireframePrototypeProps) {
  const activeLabel =
    variantTabs.find((variant) => variant.id === activeVariant)?.label ??
    activeVariant;

  return (
    <nav className={styles.switcher} aria-label="Variantes del boceto">
      <div className={styles.switcherState}>
        <span>Prototipo</span>
        <strong>{activeLabel}</strong>
      </div>
      <div className={styles.switcherTabs}>
        {variantTabs.map((variant) => (
          <Link
            className={
              activeVariant === variant.id
                ? `${styles.switcherLink} ${styles.switcherLinkActive}`
                : styles.switcherLink
            }
            href={`/?variant=${variant.id}`}
            key={variant.id}
          >
            {variant.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function TopRail() {
  return (
    <header className={styles.topRail}>
      <BrandMark compact />
      <div className={styles.searchBox}>
        <span>Buscar prospectos, propiedades y agentes</span>
      </div>
      <div className={styles.topActions}>
        <button className={styles.secondaryButton}>Importar</button>
        <button className={styles.primaryButton}>Nueva propiedad</button>
      </div>
    </header>
  );
}

function Sidebar() {
  const items = [
    { label: "Resumen", href: "/dashboard" },
    { label: "Prospectos", href: "/leads", badge: "28" },
    { label: "Propiedades", href: "/properties" },
    { label: "Promoción", href: "/listings" },
    { label: "Red de agentes", href: "/network" },
    { label: "Tareas", href: "/tasks" },
    { label: "Ajustes", href: "/settings" },
  ];

  return (
    <aside className={styles.sidebar}>
      <BrandMark />
      <div className={styles.navStack}>
        {items.map((item, index) => (
          <Link
            className={
              index === 0
                ? `${styles.navItem} ${styles.navItemActive}`
                : styles.navItem
            }
            href={item.href}
            key={item.href}
          >
            <span>{item.label}</span>
            {item.badge ? <strong>{item.badge}</strong> : null}
          </Link>
        ))}
      </div>
      <div className={styles.sidebarFoot}>
        <span>Domika Inmobiliaria</span>
        <strong>Espacio de propietario</strong>
      </div>
    </aside>
  );
}

function StatGrid() {
  return (
    <section className={styles.statGrid} aria-label="Resumen del CRM">
      {stats.map((stat) => (
        <article className={styles.stat} key={stat.label}>
          <StatusDot tone={stat.tone} />
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
        </article>
      ))}
    </section>
  );
}

function LifecycleBoard({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? styles.lifecycleCompact : styles.lifecycle}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.kicker}>Ciclo de vida del prospecto</span>
          <h2>Del contacto de WhatsApp al cierre</h2>
        </div>
        <button className={styles.secondaryButton}>Reglas</button>
      </div>
      <div className={styles.stageGrid}>
        {lifecycleStages.map((stage) => (
          <article className={styles.stage} key={stage.label}>
            <div className={styles.stageHead}>
              <strong>{stage.label}</strong>
              <span>{stage.count}</span>
            </div>
            <div className={styles.leadStack}>
              {stage.leads.map((lead, index) => (
                <div className={styles.leadCard} key={lead}>
                  <span>{lead}</span>
                  <small>
                    {index === 0 ? "WhatsApp" : "Propiedad compatible"}
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

function ListingStrip() {
  return (
    <section className={styles.listingStrip}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.kicker}>Propiedades</span>
          <h2>Publicar, promocionar y compartir</h2>
        </div>
        <button className={styles.primaryButton}>Publicar</button>
      </div>
      <div className={styles.listingGrid}>
        {listings.map((listing) => (
          <article className={styles.listingCard} key={listing.title}>
            <Image
              src={listing.image}
              alt={`Vista previa de la propiedad ${listing.title}`}
              className={styles.listingImage}
              width={900}
              height={506}
              sizes="(max-width: 820px) 100vw, 30vw"
            />
            <div className={styles.listingBody}>
              <div>
                <strong>{listing.title}</strong>
                <span>{listing.area}</span>
              </div>
              <div className={styles.listingMeta}>
                <span>{listing.price}</span>
                <mark>{listing.status}</mark>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InboxPanel() {
  return (
    <section className={styles.inboxPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.kicker}>Captura de contactos</span>
          <h2>Bandeja de WhatsApp</h2>
        </div>
        <span className={styles.livePill}>En vivo</span>
      </div>
      <div className={styles.inboxList}>
        {inbox.map((item) => (
          <article className={styles.messageRow} key={item.name}>
            <div className={styles.avatar}>{item.name.slice(0, 1)}</div>
            <div>
              <strong>{item.name}</strong>
              <span>{item.message}</span>
            </div>
            <time>{item.time}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function PromotionPanel() {
  return (
    <section className={styles.promotionPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <span className={styles.kicker}>Promoción</span>
          <h2>Canales de campaña</h2>
        </div>
      </div>
      <div className={styles.channelGrid}>
        {[
          "Página pública",
          "Feed de portales",
          "Anuncios Meta",
          "Difusión por WhatsApp",
        ].map((channel, index) => (
            <label className={styles.channel} key={channel}>
              <input type="checkbox" defaultChecked={index < 3} readOnly />
              <span>{channel}</span>
            </label>
          ))}
      </div>
      <div className={styles.budgetLine}>
        <span>Presupuesto de promoción</span>
        <input type="range" min="100" max="1000" defaultValue="650" readOnly />
        <strong>$650</strong>
      </div>
    </section>
  );
}

function CommandVariant() {
  return (
    <div className={styles.commandShell}>
      <Sidebar />
      <main className={styles.commandMain}>
        <TopRail />
        <div className={styles.commandContent}>
          <div className={styles.heroBand}>
            <div>
              <span className={styles.kicker}>Hoy</span>
              <h1>Centro de control inmobiliario</h1>
            </div>
            <div className={styles.heroActions}>
              <button className={styles.secondaryButton}>
                Compartir propiedad
              </button>
              <button className={styles.primaryButton}>Capturar contacto</button>
            </div>
          </div>
          <StatGrid />
          <div className={styles.commandGrid}>
            <LifecycleBoard />
            <div className={styles.sideStack}>
              <InboxPanel />
              <PromotionPanel />
            </div>
          </div>
          <ListingStrip />
        </div>
      </main>
    </div>
  );
}

function PipelineVariant() {
  return (
    <main className={styles.pipelineShell}>
      <TopRail />
      <div className={styles.pipelineHeader}>
        <div>
          <span className={styles.kicker}>Espacio de trabajo</span>
          <h1>Embudo de prospectos con contactos en vivo</h1>
        </div>
        <div className={styles.segmented}>
          <button className={styles.segmentedActive}>Compradores</button>
          <button>Inquilinos</button>
          <button>Propietarios</button>
        </div>
      </div>
      <div className={styles.pipelineGrid}>
        <InboxPanel />
        <LifecycleBoard compact />
        <aside className={styles.detailRail}>
          <div className={styles.detailHeader}>
            <span className={styles.avatarLarge}>P</span>
            <div>
              <h2>Patricia Gomez</h2>
              <span>Compradora · $300K-$360K · Naco</span>
            </div>
          </div>
          <div className={styles.detailFields}>
            {[
              "Presupuesto confirmado",
              "Hipoteca preaprobada",
              "Visita agendada",
            ].map((field, index) => (
                <label key={field}>
                  <input type="checkbox" defaultChecked={index < 2} readOnly />
                  <span>{field}</span>
                </label>
              ))}
          </div>
          <div className={styles.matchBox}>
            <span className={styles.kicker}>Mejor coincidencia</span>
            <strong>Torre Vista Real 18B</strong>
            <p>3 habitaciones · Piantini · Propiedad publicada</p>
            <button className={styles.primaryButton}>Enviar por WhatsApp</button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ExchangeVariant() {
  return (
    <main className={styles.exchangeShell}>
      <header className={styles.exchangeHeader}>
        <BrandMark compact />
        <nav className={styles.exchangeNav}>
          <span>Inventario</span>
          <span>Solicitudes</span>
          <span>Comisiones</span>
          <span>Equipos</span>
        </nav>
        <button className={styles.primaryButton}>Compartir inventario</button>
      </header>
      <section className={styles.exchangeHero}>
        <div>
          <span className={styles.kicker}>Intercambio de agentes</span>
          <h1>Propiedades compartidas y compradores compatibles</h1>
        </div>
        <div className={styles.exchangeMetrics}>
          <strong>73</strong>
          <span>propiedades en la red</span>
        </div>
      </section>
      <section className={styles.exchangeGrid}>
        <div className={styles.marketMap}>
          {["Piantini", "Naco", "Cap Cana", "Bávaro", "Bella Vista"].map(
            (zone, index) => (
              <div
                className={`${styles.mapZone} ${styles[`mapZone_${index}`]}`}
                key={zone}
              >
                <strong>{zone}</strong>
                <span>{index + 4} coincidencias</span>
              </div>
            ),
          )}
        </div>
        <div className={styles.exchangeList}>
          {networkListings.map((item) => (
            <article className={styles.exchangeCard} key={item.listing}>
              <div>
                <span className={styles.kicker}>{item.firm}</span>
                <h2>{item.listing}</h2>
              </div>
              <dl>
                <div>
                  <dt>Agente</dt>
                  <dd>{item.agent}</dd>
                </div>
                <div>
                  <dt>Comisión</dt>
                  <dd>{item.split}</dd>
                </div>
                <div>
                  <dt>Compradores compatibles</dt>
                  <dd>{item.match}</dd>
                </div>
              </dl>
              <button className={styles.secondaryButton}>
                Abrir sala compartida
              </button>
            </article>
          ))}
        </div>
        <aside className={styles.sharePanel}>
          <span className={styles.kicker}>Configuración compartida</span>
          <h2>Penthouse con vista al mar en Cap Cana</h2>
          {[
            "Ocultar datos del propietario",
            "Requerir acuerdo de comisión",
            "Permitir notas de agentes",
          ].map((option, index) => (
            <label key={option}>
              <input type="checkbox" defaultChecked={index !== 2} readOnly />
              <span>{option}</span>
            </label>
          ))}
          <button className={styles.primaryButton}>Publicar en la red</button>
        </aside>
      </section>
    </main>
  );
}

export function DomikaWireframePrototype({
  activeVariant,
}: DomikaWireframePrototypeProps) {
  return (
    <div className={styles.prototypeRoot}>
      {activeVariant === "command" ? <CommandVariant /> : null}
      {activeVariant === "pipeline" ? <PipelineVariant /> : null}
      {activeVariant === "exchange" ? <ExchangeVariant /> : null}
      <PrototypeSwitcher activeVariant={activeVariant} />
    </div>
  );
}
