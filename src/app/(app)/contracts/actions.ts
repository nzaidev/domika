"use server";

import { revalidatePath } from "next/cache";
import type { DocumentStatus, SignatureStatus } from "@/lib/database.types";
import {
  createContractTemplate,
  deactivateContractTemplate,
  generateContract,
  setContractStatus,
} from "@/lib/domain/contracts";

export type ContractFormState = {
  error: string | null;
  generatedId: string | null;
  missing: string[];
  savedTemplate: boolean;
};

const INITIAL: Omit<ContractFormState, "error"> = {
  generatedId: null,
  missing: [],
  savedTemplate: false,
};

export async function contractStudioAction(
  _previousState: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const intent = String(formData.get("intent") ?? "generate");

  if (intent === "save_template") {
    const result = await createContractTemplate({
      name: String(formData.get("templateName") ?? ""),
      contractType: String(formData.get("contractType") ?? "reserva"),
      body: String(formData.get("templateBody") ?? ""),
    });

    if (result.ok === false) {
      return { error: result.error, ...INITIAL };
    }

    revalidatePath("/contracts");
    return { error: null, ...INITIAL, savedTemplate: true };
  }

  const result = await generateContract({
    templateId: String(formData.get("templateId") ?? ""),
    leadId: String(formData.get("leadId") ?? "") || null,
    propertyId: String(formData.get("propertyId") ?? "") || null,
  });

  if (result.ok === false) {
    return { error: result.error, ...INITIAL };
  }

  revalidatePath("/contracts");

  return {
    error: null,
    generatedId: result.contractId,
    missing: result.missing,
    savedTemplate: false,
  };
}

export async function deactivateTemplateAction(formData: FormData) {
  const templateId = String(formData.get("templateId") ?? "");

  if (templateId) {
    await deactivateContractTemplate(templateId);
    revalidatePath("/contracts");
  }
}

const DOCUMENT_STATUSES: DocumentStatus[] = [
  "draft",
  "generated",
  "sent",
  "signed",
  "void",
];
const SIGNATURE_STATUSES: SignatureStatus[] = [
  "not_required",
  "pending",
  "signed",
  "declined",
  "expired",
];

export async function contractStatusAction(formData: FormData) {
  const contractId = String(formData.get("contractId") ?? "");
  const status = String(formData.get("status") ?? "");
  const signatureStatus = String(formData.get("signatureStatus") ?? "");

  if (!contractId) {
    return;
  }

  await setContractStatus({
    contractId,
    status: DOCUMENT_STATUSES.includes(status as DocumentStatus)
      ? (status as DocumentStatus)
      : undefined,
    signatureStatus: SIGNATURE_STATUSES.includes(
      signatureStatus as SignatureStatus,
    )
      ? (signatureStatus as SignatureStatus)
      : undefined,
  });

  revalidatePath("/contracts");
}
