import "server-only";

import { AwsClient } from "aws4fetch";

// Cloudflare R2 object storage (S3-compatible), the canonical store for
// property photos and brochure outputs. Files are served to browsers from
// the bucket's public custom domain (NEXT_PUBLIC_MEDIA_BASE_URL, e.g.
// https://domika-fotos.tinkuai.com) — never from *.supabase.co, which some
// client networks block.

const DEFAULT_BUCKET = "domika-fotos";

export function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

function r2Client(): { client: AwsClient; baseUrl: string } {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Faltan R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.",
    );
  }

  const bucket = process.env.R2_BUCKET || DEFAULT_BUCKET;

  return {
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    }),
    baseUrl: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  };
}

export async function r2Upload(
  path: string,
  body: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { client, baseUrl } = r2Client();
    const response = await client.fetch(`${baseUrl}/${path}`, {
      method: "PUT",
      headers: {
        "content-type": contentType,
        "content-length": String(body.byteLength),
      },
      body: new Uint8Array(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `R2 upload falló (${response.status}): ${(await response.text()).slice(0, 200)}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "R2 upload falló.",
    };
  }
}

export async function r2Delete(paths: string[]): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  try {
    const { client, baseUrl } = r2Client();
    await Promise.allSettled(
      paths.map((path) =>
        client.fetch(`${baseUrl}/${path}`, { method: "DELETE" }),
      ),
    );
  } catch (error) {
    console.error("[r2] delete failed:", error);
  }
}

export async function r2Download(
  path: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  try {
    const { client, baseUrl } = r2Client();
    const response = await client.fetch(`${baseUrl}/${path}`, {
      method: "GET",
    });

    if (!response.ok) {
      return null;
    }

    return {
      body: await response.arrayBuffer(),
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
