import { LEADS, PROPERTIES } from "@/lib/data";

export const lifecycleColumns = [
  {
    key: "nuevo",
    label: "Nuevo",
    tone: "green",
    leads: LEADS.nuevo,
  },
  {
    key: "contactado",
    label: "Contactado",
    tone: "blue",
    leads: LEADS.contactado,
  },
  {
    key: "visita",
    label: "Visita",
    tone: "mint",
    leads: LEADS.visita,
  },
  {
    key: "negociacion",
    label: "Negociación",
    tone: "amber",
    leads: LEADS.negociacion,
  },
  {
    key: "cierre",
    label: "Cierre",
    tone: "coral",
    leads: LEADS.cierre,
  },
] as const;

export const whatsappInbox = [
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

export const campaignChannels = [
  {
    label: "Página pública",
    status: "Activa",
    reach: "1,240 vistas",
  },
  {
    label: "Feed de portales",
    status: "Sincronizado",
    reach: "8 portales",
  },
  {
    label: "Anuncios Meta",
    status: "En revisión",
    reach: "$650 presupuesto",
  },
  {
    label: "Difusión por WhatsApp",
    status: "Lista",
    reach: "128 contactos",
  },
];

export const networkListings = [
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
    firm: "Costa Norte Realty",
    listing: "Apartamento frente al mar en Bávaro",
    split: "Referido",
    match: "11 compradores",
  },
];

export const tasks = [
  {
    title: "Llamar a Sofía Ramírez",
    context: "Cierre Cap Cana",
    due: "10:30 · hoy",
    priority: "Alta",
  },
  {
    title: "Enviar brochure a Roberto Silva",
    context: "Villa Casa de Campo",
    due: "12:00 · hoy",
    priority: "Media",
  },
  {
    title: "Visita con Lucía Mendoza",
    context: "Penthouse Anacaona",
    due: "16:00 · hoy",
    priority: "Alta",
  },
  {
    title: "Renovar contrato de propietario",
    context: "Villa Bávaro",
    due: "Mañana",
    priority: "Baja",
  },
  {
    title: "Coordinar fotos profesionales",
    context: "Loft Naco",
    due: "Mañana",
    priority: "Media",
  },
];

export const appProperties = PROPERTIES;

