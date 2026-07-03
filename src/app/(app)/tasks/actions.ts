"use server";

import { revalidatePath } from "next/cache";
import type { TaskRow, TaskType } from "@/lib/database.types";
import { createTask, setTaskStatus } from "@/lib/domain/tasks";

export type TaskFormState = {
  error: string | null;
  createdTitle: string | null;
};

const TASK_TYPES: TaskType[] = [
  "call",
  "visit",
  "document",
  "follow_up",
  "meeting",
  "other",
];

const PRIORITIES: TaskRow["priority"][] = ["low", "medium", "high", "urgent"];

export async function createTaskAction(
  _previousState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = String(formData.get("title") ?? "");
  const rawType = String(formData.get("taskType") ?? "follow_up");
  const rawPriority = String(formData.get("priority") ?? "medium");
  const dueDate = String(formData.get("dueDate") ?? "");
  const dueTime = String(formData.get("dueTime") ?? "");

  let dueAt: string | null = null;

  if (dueDate) {
    const composed = new Date(`${dueDate}T${dueTime || "09:00"}`);
    dueAt = Number.isNaN(composed.getTime()) ? null : composed.toISOString();
  }

  const result = await createTask({
    title,
    description: String(formData.get("description") ?? ""),
    taskType: (TASK_TYPES.includes(rawType as TaskType)
      ? rawType
      : "follow_up") as TaskType,
    priority: (PRIORITIES.includes(rawPriority as TaskRow["priority"])
      ? rawPriority
      : "medium") as TaskRow["priority"],
    dueAt,
    assignedTo: String(formData.get("assignedTo") ?? "") || null,
    leadId: String(formData.get("leadId") ?? "") || null,
    propertyId: String(formData.get("propertyId") ?? "") || null,
  });

  if (result.ok === false) {
    return { error: result.error, createdTitle: null };
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");

  return { error: null, createdTitle: title.trim() };
}

export async function setTaskStatusAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (
    taskId &&
    ["todo", "in_progress", "done", "cancelled"].includes(status)
  ) {
    await setTaskStatus({
      taskId,
      status: status as TaskRow["status"],
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
  }
}
