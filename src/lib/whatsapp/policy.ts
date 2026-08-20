import "server-only";

// WhatsApp Business Platform rules we enforce in-app, so an agent can't
// accidentally break Meta's terms or trigger a billable message.
//
// The rules that cost money or risk the number:
//
// 1. Customer service window — a business may only send free-form messages
//    within 24h of the customer's last inbound message. Outside it, Meta
//    requires a pre-approved TEMPLATE, which is always billable. We block
//    instead of silently falling back to a paid template.
// 2. Business-initiated conversations — messaging someone who hasn't written
//    (or whose window closed) opens a billable conversation and counts against
//    the messaging tier. Free-form is rejected by Meta outright.
// 3. Messaging tier — an unverified business can reach a limited number of
//    unique customers per rolling 24h outside the service window.
//
// Service (in-window) messages are free, so everything we do allow is $0.

export const SERVICE_WINDOW_HOURS = 24;

// Conservative default: Meta's entry tier for a business that hasn't completed
// verification. Raise via WHATSAPP_DAILY_INITIATED_LIMIT once tiered up.
export const DEFAULT_DAILY_INITIATED_LIMIT = 250;

export function dailyInitiatedLimit(): number {
  const raw = Number(process.env.WHATSAPP_DAILY_INITIATED_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_INITIATED_LIMIT;
}

export type ServiceWindow = {
  /** Free-form replies allowed right now (no charge). */
  open: boolean;
  /** When the window closes; null when it was never opened by an inbound. */
  expiresAt: string | null;
  /** Whole hours left, 0 when closed. */
  hoursLeft: number;
  /** True when the contact has never messaged us. */
  neverMessaged: boolean;
};

// The window runs 24h from the customer's most recent INBOUND message.
export function computeServiceWindow(
  lastInboundAt: string | null,
  now: Date = new Date(),
): ServiceWindow {
  if (!lastInboundAt) {
    return {
      open: false,
      expiresAt: null,
      hoursLeft: 0,
      neverMessaged: true,
    };
  }
  const expires =
    new Date(lastInboundAt).getTime() + SERVICE_WINDOW_HOURS * 3600_000;
  const msLeft = expires - now.getTime();
  return {
    open: msLeft > 0,
    expiresAt: new Date(expires).toISOString(),
    hoursLeft: msLeft > 0 ? Math.floor(msLeft / 3600_000) : 0,
    neverMessaged: false,
  };
}

// Spanish copy for a blocked send, explaining why and what to do instead.
export function windowClosedMessage(window: ServiceWindow): string {
  if (window.neverMessaged) {
    return (
      "WhatsApp no permite escribir primero sin una plantilla aprobada por " +
      "Meta (tiene costo). Pídele al contacto que te escriba, o usa otro medio."
    );
  }
  return (
    "Pasaron más de 24 h desde su último mensaje, así que WhatsApp cerró la " +
    "ventana gratuita. Para reabrirla necesitas una plantilla aprobada por " +
    "Meta (tiene costo)."
  );
}
