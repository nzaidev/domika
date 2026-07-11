// One-time migration: copy every object in the supabase `property-media`
// bucket to the R2 bucket, preserving paths, and rewrite property_media
// public_url values to the R2 public domain.
//
// Usage: node scripts/migrate-media-to-r2.mjs
// Reads .env.local for SUPABASE_* and R2_* credentials.

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [
      line.slice(0, line.indexOf("=")).trim(),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
);

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
]) {
  if (!env[key]) {
    console.error(`Falta ${key} en .env.local`);
    process.exit(1);
  }
}

const bucket = env.R2_BUCKET || "domika-fotos";
const mediaBase = (
  env.NEXT_PUBLIC_MEDIA_BASE_URL || "https://domika-fotos.tinkuai.com"
).replace(/\/+$/, "");

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
const r2 = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const r2Base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}`;

async function listAllPaths(prefix = "") {
  const paths = [];
  const { data: entries, error } = await supabase.storage
    .from("property-media")
    .list(prefix, { limit: 1000 });

  if (error) {
    throw new Error(`list(${prefix}): ${error.message}`);
  }

  for (const entry of entries ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      paths.push(full); // file
    } else {
      paths.push(...(await listAllPaths(full))); // folder
    }
  }

  return paths;
}

const paths = await listAllPaths();
console.log(`${paths.length} objetos en supabase property-media`);

let copied = 0;
let failed = 0;

for (const path of paths) {
  const { data: file, error } = await supabase.storage
    .from("property-media")
    .download(path);

  if (error || !file) {
    console.error(`  descarga falló: ${path} — ${error?.message}`);
    failed += 1;
    continue;
  }

  const body = new Uint8Array(await file.arrayBuffer());
  const response = await r2.fetch(`${r2Base}/${path}`, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "content-length": String(body.byteLength),
    },
    body,
  });

  if (!response.ok) {
    console.error(`  R2 PUT falló (${response.status}): ${path}`);
    failed += 1;
    continue;
  }

  copied += 1;
  console.log(`  ✓ ${path} (${body.byteLength} bytes)`);
}

// Rewrite public_url columns to the R2 domain.
const { data: rows } = await supabase
  .from("property_media")
  .select("id, storage_path");

for (const row of rows ?? []) {
  await supabase
    .from("property_media")
    .update({ public_url: `${mediaBase}/${row.storage_path}` })
    .eq("id", row.id);
}

console.log(
  `\nListo: ${copied} copiados, ${failed} fallidos, ${rows?.length ?? 0} URLs reescritas.`,
);
console.log(`Verifica una URL: ${mediaBase}/${paths[0] ?? "<path>"}`);
