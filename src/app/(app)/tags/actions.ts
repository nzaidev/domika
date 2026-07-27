"use server";

import { revalidatePath } from "next/cache";
import { createTag, deleteTag, updateTag } from "@/lib/domain/tags";

export type TagFormState = {
  error: string | null;
  created: boolean;
};

export async function createTagAction(
  _previousState: TagFormState,
  formData: FormData,
): Promise<TagFormState> {
  const result = await createTag({
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? "#3B82F6"),
  });

  if (result.ok === false) {
    return { error: result.error, created: false };
  }

  revalidatePath("/tags");
  revalidatePath("/leads");
  return { error: null, created: true };
}

export async function updateTagAction(formData: FormData) {
  const result = await updateTag({
    tagId: String(formData.get("tagId") ?? ""),
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? "#3B82F6"),
  });

  if (result.ok) {
    revalidatePath("/tags");
    revalidatePath("/leads");
  }
}

export async function deleteTagAction(formData: FormData) {
  const tagId = String(formData.get("tagId") ?? "");

  if (tagId) {
    await deleteTag(tagId);
    revalidatePath("/tags");
    revalidatePath("/leads");
  }
}
