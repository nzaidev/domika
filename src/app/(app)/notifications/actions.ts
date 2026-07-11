"use server";

import { revalidatePath } from "next/cache";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/domain/notifications";

export async function markReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "");

  if (notificationId) {
    await markNotificationRead(notificationId);
    revalidatePath("/notifications");
  }
}

export async function markAllReadAction() {
  await markAllNotificationsRead();
  revalidatePath("/notifications");
}
