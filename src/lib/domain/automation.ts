import "server-only";

import type { AutomationRuleRow, TaskType } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Executes an org's automation_rules for a trigger. Called inline from the
// mutation that fired the event (stage change, WhatsApp lead creation) —
// no queue needed at this volume; failures are swallowed so automation
// can never break the primary write.

export type AutomationContext = {
  organizationId: string;
  leadId: string;
  leadName?: string;
  toStageName?: string;
  actorProfileId?: string | null;
  assignedTo?: string | null;
};

type CreateTaskAction = {
  type: "create_task";
  delay_days?: number;
  task_type?: string;
  title?: string;
};

const TASK_TYPES: TaskType[] = [
  "call",
  "visit",
  "document",
  "follow_up",
  "meeting",
  "other",
];

function ruleMatches(
  rule: AutomationRuleRow,
  context: AutomationContext,
): boolean {
  const conditions = (rule.conditions ?? {}) as Record<string, unknown>;
  const toStage = conditions.to_stage;

  if (typeof toStage === "string" && toStage.trim() !== "") {
    return (
      (context.toStageName ?? "").toLowerCase() === toStage.trim().toLowerCase()
    );
  }

  return true;
}

export async function runAutomationRules(
  trigger: AutomationRuleRow["trigger"],
  context: AutomationContext,
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("trigger", trigger)
      .eq("active", true);

    for (const rule of rules ?? []) {
      if (!ruleMatches(rule, context)) {
        continue;
      }

      const actions = Array.isArray(rule.actions)
        ? (rule.actions as unknown[])
        : [];

      for (const rawAction of actions) {
        const action = rawAction as CreateTaskAction;

        if (action?.type !== "create_task") {
          continue;
        }

        // One open auto-task per (rule, lead): repeat triggers (e.g. a lead
        // bounced between stages) must not pile up duplicates.
        const { data: existing } = await supabase
          .from("tasks")
          .select("id")
          .eq("organization_id", context.organizationId)
          .eq("lead_id", context.leadId)
          .eq("auto_generated", true)
          .in("status", ["todo", "in_progress"])
          .eq("metadata->>automation_rule_id", rule.id)
          .limit(1)
          .maybeSingle();

        if (existing) {
          continue;
        }

        const delayDays = Number(action.delay_days ?? 1);
        const dueAt = new Date(
          Date.now() + (Number.isFinite(delayDays) ? delayDays : 1) * 24 * 60 * 60 * 1000,
        ).toISOString();
        const taskType = TASK_TYPES.includes(action.task_type as TaskType)
          ? (action.task_type as TaskType)
          : "follow_up";

        await supabase.from("tasks").insert({
          organization_id: context.organizationId,
          lead_id: context.leadId,
          assigned_to: context.assignedTo ?? context.actorProfileId ?? null,
          created_by: context.actorProfileId ?? null,
          task_type: taskType,
          title:
            action.title?.trim() ||
            `${rule.name}${context.leadName ? ` — ${context.leadName}` : ""}`,
          priority: "medium",
          status: "todo",
          due_at: dueAt,
          reminder_channels: ["in_app"],
          auto_generated: true,
          metadata: { automation_rule_id: rule.id, trigger },
        });
      }
    }
  } catch (error) {
    console.error("[automation] rule execution failed:", error);
  }
}
