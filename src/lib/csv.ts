// Minimal CSV parser: quoted fields, escaped quotes, CRLF, and a UTF-8 BOM.
// Runs in the browser for the import wizard, so no Node APIs.
//
// Delimiter is auto-detected. Spanish-locale Excel exports use ";" rather
// than "," (and "Guardar como → CSV" can emit tabs), so assuming a comma
// silently collapsed every row into a single column for those users.

const DELIMITERS = [",", ";", "\t"] as const;

export function detectDelimiter(text: string): string {
  // Inspect the header line only, ignoring anything inside quotes.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = new Map<string, number>();

  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (DELIMITERS as readonly string[]).includes(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  let best = ",";
  let bestCount = 0;
  for (const delimiter of DELIMITERS) {
    const count = counts.get(delimiter) ?? 0;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

export function parseCsv(text: string, delimiter?: string): string[][] {
  // Excel writes a UTF-8 BOM; it would otherwise corrupt the first header.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const sep = delimiter ?? detectDelimiter(input);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
}
