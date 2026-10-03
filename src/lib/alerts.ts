import nodemailer from "nodemailer";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function createTransport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

// Emails every active officer about a failed check and records the attempt
// on a FailureAlert row. Never throws: the check itself is already saved.
export async function sendFailureAlert(submissionId: string): Promise<void> {
  const [submission, officers] = await Promise.all([
    prisma.checkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        template: { select: { name: true } },
        apparatus: { select: { name: true } },
        equipmentItem: { select: { name: true } },
        submittedBy: { select: { name: true } },
        itemResults: {
          where: { status: "FAIL" },
          include: { checklistItem: { select: { label: true, sortOrder: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "OFFICER", isActive: true },
      select: { email: true },
    }),
  ]);
  if (!submission) return;

  const recipientEmails = officers.map((o) => o.email);
  const alert = await prisma.failureAlert.create({
    data: { submissionId, recipientEmails },
  });

  if (recipientEmails.length === 0) {
    await prisma.failureAlert.update({
      where: { id: alert.id },
      data: { status: "FAILED", attempts: 1, lastError: "No active officers to notify" },
    });
    return;
  }

  const target = submission.apparatus?.name ?? submission.equipmentItem?.name ?? submission.template.name;
  const failedLines = submission.itemResults
    .sort((a, b) => a.checklistItem.sortOrder - b.checklistItem.sortOrder)
    .map((r) => `- ${r.checklistItem.label}: ${r.note ?? "(no note)"}`);

  const appUrl = process.env.NEXTAUTH_URL ?? "";
  const text = [
    `${target} failed its check.`,
    "",
    `Checklist: ${submission.template.name}`,
    `Checked by: ${submission.submittedBy.name}`,
    `When: ${formatDateTime(submission.submittedAt)}`,
    "",
    "Failed items:",
    ...failedLines,
    ...(submission.notes ? ["", `Notes: ${submission.notes}`] : []),
    ...(appUrl ? ["", `Review: ${appUrl}/officer`] : []),
  ].join("\n");

  try {
    await createTransport().sendMail({
      from: process.env.ALERT_FROM_EMAIL,
      to: recipientEmails,
      subject: `Failed check: ${target}`,
      text,
    });
    await prisma.failureAlert.update({
      where: { id: alert.id },
      data: { status: "SENT", attempts: 1, sentAt: new Date() },
    });
  } catch (error) {
    console.error("Failure alert email could not be sent", error);
    await prisma.failureAlert.update({
      where: { id: alert.id },
      data: {
        status: "FAILED",
        attempts: 1,
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
