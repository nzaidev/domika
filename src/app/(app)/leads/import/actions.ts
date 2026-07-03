"use server";

import { revalidatePath } from "next/cache";
import {
  importLeads,
  previewLeadsImport,
  type ImportPreview,
  type ImportResult,
  type ImportRowInput,
} from "@/lib/domain/lead-import";

export async function previewImportAction(
  rows: ImportRowInput[],
): Promise<ImportPreview> {
  return previewLeadsImport(rows);
}

export async function importLeadsAction(
  rows: ImportRowInput[],
): Promise<ImportResult> {
  const result = await importLeads(rows);

  if (result.ok) {
    revalidatePath("/leads");
    revalidatePath("/dashboard");
  }

  return result;
}
