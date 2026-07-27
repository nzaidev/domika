# Domika — Demo Walkthrough (feature batch: interests, maps, availability, sharing alerts)

This covers the seven features added in this batch, how they work, and a
click-by-click demo script.

## Prerequisites (do these first, or the demo won't work)

1. **Apply migrations** to the Supabase project (you apply migrations):
   - `202607110008_lead_tags.sql` (Etiquetas — previous batch)
   - `202607110009_interests_maps_availability.sql` (this batch: interest
     links, `properties.active`, `properties.map_url`, and the network-safe
     view now exposes `active`)
   Until applied, the new panels show empty states (no crashes), but
     linking/toggling won't persist.
2. **Two organizations** for the sharing/alerts demo (#5, #6): a second
   Clerk user (incognito) who completed onboarding with a different org.
   Share a property from Org A to Org B's agent.
3. **Email (optional, #6)**: set `RESEND_API_KEY` and `EMAIL_FROM` in the
   environment to actually send. Without them the in-app bell still fires
   and the email step logs "would send…".

---

## 1. Prospecto ↔ Propiedad interest links — how it works

**Model.** A new join table `lead_property_interests (organization_id,
lead_id, property_id)` records that a prospecto (contacto) is a potential
buyer of a property. It's **optional**, **many-to-many** (a prospecto can be
interested in several properties; a property can have several interested
prospectos), and **org-scoped** (RLS + app checks — you can only link your
own leads to your own properties).

**Both directions, one relationship.**
- On a **prospecto** (`/leads/{id}`): a "Propiedades de interés" section lists
  the linked properties and lets you add/remove.
- On a **property** (`/properties/{id}`): a "Prospectos interesados" section
  lists the linked prospectos as potential buyers, with add/remove.
Adding from either side writes the same row, so the other side reflects it
immediately. Linking also drops a "Interesado en: {property}" entry on the
prospecto's timeline for context.

**Demo:**
1. Open a prospecto → scroll the right rail to **Propiedades de interés** →
   **+ Vincular propiedad** → pick a property → **Vincular**. It appears in
   the list; the prospecto timeline gets an "Interesado en…" entry.
2. Open that **property** → **Prospectos interesados** → the same prospecto
   is listed as a potential buyer. Add another prospecto here.
3. Back on the prospecto, the second link isn't there (that was property-side)
   — but the property→prospecto link shows on the property. Remove one with
   **Quitar** and confirm it disappears from both sides.

## 2. Google Maps per property

**How it works (keyless).** The property detail shows an embedded map using
Google's `maps.google.com?q=…&output=embed` (no API key). Source priority:
pasted **Google Maps URL** → **coordinates** (lat/lng) → **address**. A "Ver
en Google Maps" button opens the full map.

**Demo:**
1. Edit a property → set the **Dirección** (e.g. `Equipetrol, Santa Cruz`)
   and/or paste a **Google Maps (URL)** → save.
2. Property detail now shows a **Ubicación / Mapa** section with the embedded
   map and a "Ver en Google Maps" link.
> Pin-drop on a JS map needs a Google Maps API key; the address/URL path is
> the simple, keyless version delivered here.

## 3. Drag-and-drop photo reordering

**Demo:** Property → **Editar ficha** → in the photo manager, **drag a photo
row onto another** to reorder. The order saves (optimistically, then
persisted) and drives the gallery order on the detail and public pages. The
↑/↓ arrows, **Hacer portada**, and delete still work.

## 4. Instagram share

Instagram has **no web link-share endpoint** (unlike Facebook/LinkedIn), so
the button copies a ready-made caption (title + URL) and opens Instagram for
you to paste into a story/post.

**Demo:** Property → **Página pública** → **Crear enlace público** → the share
row shows **WhatsApp · Facebook · LinkedIn · Instagram · Copiar enlace**.
Click **Instagram** → button shows "Texto copiado ✓" and Instagram opens.

## 5. Agent network — shares show up in activities

**How it works.** When you share a property (direct to an agent or a whole
org), every recipient gets an in-app notification ("Nueva propiedad
compartida: {title}") that appears on their 🔔 bell and `/notifications`,
linking to their **/network** (shared-with-me) view.

**Demo (needs two orgs):**
1. Org A: property detail → **Colaboración → Red de agentes** → pick Org B's
   agent → **Compartir propiedad**.
2. Org B (the recipient): the 🔔 bell shows an unread count; open
   `/notifications` → "Nueva propiedad compartida" → **Abrir** → `/network` →
   the property is under "Compartidas conmigo".

## 6. Price / status change alerts to shared-with agents

**How it works.** When a property's **price** or **status** changes,
`updateProperty` detects the diff and alerts **every agent it was shared
with**: an in-app bell notification ("Actualización: {title} · Nuevo precio:
… / Estado: Vendida") **and** an email (via Resend if configured). Agents
learn a shared property moved without you telling them.

**Demo (needs two orgs; share first as in #5):**
1. Org A: **Editar ficha** → change the **Precio** (or set **Estado →
   Vendida**) → save.
2. Org B: 🔔 bell increments → `/notifications` shows "Actualización: {title}
   · Nuevo precio: $X" (and "Estado: Vendida" if you changed status).
3. If `RESEND_API_KEY`/`EMAIL_FROM` are set, Org B's agent also gets the email;
   otherwise the server log shows "[email] would send to …".

## 7. Availability on/off toggle

**How it works.** The property header has a **Disponible / Oculta** switch
(`properties.active`). Turning it **off**: unpublishes the property from the
Domika network and its public link, and removes it from demand matching — so
it disappears from other agents' feeds and the public page (which 404s).
Turning it **on** restores availability (re-publish from Colaboración if you
want it back on the network). The property stays in your own inventory
either way.

**Demo:**
1. Publish a property to the network / create its public link (so there's
   something to hide).
2. Property header → click **Disponible** → it flips to **Oculta**; the
   public `/p/{slug}` now 404s and it's gone from the network feed.
3. Click **Oculta** → back to **Disponible**.

---

## One-shot "golden path" demo (5 minutes)

1. **Property with map + photos**: create a property, set an address, add
   several photos, **drag to reorder**, set a cover. Detail page shows the
   **map** and gallery.
2. **Link a buyer**: on the property, **Prospectos interesados → + Vincular
   prospecto**. Open that prospecto → it shows **Propiedades de interés**.
3. **Publish & share**: **Página pública → Crear enlace público** → share via
   **WhatsApp / Instagram**. Then **Red de agentes** → share to Org B.
4. **Org B sees it**: switch to the Org B window → 🔔 → /network.
5. **Change the price**: Org A edits price → Org B's 🔔 shows the alert (and
   email if configured).
6. **Hide it**: Org A flips the availability toggle to **Oculta** → the public
   link 404s and it leaves Org B's network feed.
