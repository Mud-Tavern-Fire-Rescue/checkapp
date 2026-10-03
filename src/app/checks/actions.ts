"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth-helpers";
import { sendFailureAlert } from "@/lib/alerts";
import { prisma } from "@/lib/prisma";

export type SubmitCheckState = {
  message?: string;
  itemErrors?: Record<string, string>;
  // Echoed back so the form keeps what the user entered after an error.
  values?: Record<string, string>;
};

const itemResultSchema = z.object({
  status: z.enum(["PASS", "FAIL", "NA"]),
  note: z.string().trim().max(500),
});

export async function submitCheck(
  templateId: string,
  _prevState: SubmitCheckState,
  formData: FormData,
): Promise<SubmitCheckState> {
  const session = await requireSession();

  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) {
      values[key] = value;
    }
  }

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, isActive: true },
    include: {
      items: { where: { isActive: true }, select: { id: true } },
    },
  });
  if (!template || template.items.length === 0) {
    return { message: "This checklist is no longer available.", values };
  }

  // Validate against the template's current items, not whatever the
  // client sent, so results can't reference other checklists.
  const itemErrors: Record<string, string> = {};
  const results: { checklistItemId: string; status: "PASS" | "FAIL" | "NA"; note: string | null }[] = [];

  for (const item of template.items) {
    const parsed = itemResultSchema.safeParse({
      status: values[`status:${item.id}`],
      note: values[`note:${item.id}`] ?? "",
    });
    if (!parsed.success) {
      itemErrors[item.id] = "Choose Pass, Fail, or N/A.";
      continue;
    }
    if (parsed.data.status === "FAIL" && !parsed.data.note) {
      itemErrors[item.id] = "Describe the problem for a failed item.";
      continue;
    }
    results.push({
      checklistItemId: item.id,
      status: parsed.data.status,
      note: parsed.data.note || null,
    });
  }

  if (Object.keys(itemErrors).length > 0) {
    return {
      message: "Some items need attention before this check can be saved.",
      itemErrors,
      values,
    };
  }

  const notes = (values.notes ?? "").trim().slice(0, 2000) || null;
  const overallStatus = results.some((r) => r.status === "FAIL") ? "FAIL" : "PASS";

  const submission = await prisma.checkSubmission.create({
    data: {
      templateId: template.id,
      apparatusId: template.apparatusId,
      equipmentItemId: template.equipmentItemId,
      submittedById: session.user.id,
      overallStatus,
      notes,
      itemResults: { create: results },
    },
  });

  if (overallStatus === "FAIL") {
    // The check is already saved; an email problem is recorded on the
    // FailureAlert row rather than shown to the firefighter as a failure.
    await sendFailureAlert(submission.id);
  }

  redirect(`/checks?submitted=${overallStatus}`);
}
