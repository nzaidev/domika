// Phone normalization to E.164. Bolivia-first: bare local numbers get the
// +591 country code; numbers that already carry a country code are kept.

export const DEFAULT_COUNTRY_CODE = "+591";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }

  let value = raw.trim().replace(/[\s\-().]/g, "");

  if (!value) {
    return null;
  }

  // "00" international dialing prefix → "+".
  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }

  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  // Country code without "+" (e.g. WhatsApp wa_id "59170000001"). Bolivian
  // local numbers are 8 digits, so anything longer starting with 591 is a
  // full international number.
  if (digits.startsWith("591") && digits.length > 8) {
    return `+${digits}`;
  }

  return `${DEFAULT_COUNTRY_CODE}${digits}`;
}
