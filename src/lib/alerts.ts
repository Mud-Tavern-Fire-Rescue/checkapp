import { formatDateTime } from "@/lib/format";
import { mailerStatus, sendEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";

export async function loadFailedSubmission(submissionId: string) {
  return prisma.checkSubmission.findUnique({
    where: { id: submissionId },
    include: {
      template: { select: { name: true } },
      apparatus: { select: { name: true } },
      equipmentItem: { select: { name: true } },
      submittedBy: { select: { name: true } },
      itemResults: {
        where: { status: "FAIL" },
        include: { checklistItem: { select: { label: true, section: true, sortOrder: true } } },
      },
    },
  });
}

// The alert's subject and body, kept separate from sending so it can be
// previewed and tested.
export function buildFailureAlertEmail(
  submission: NonNullable<Awaited<ReturnType<typeof loadFailedSubmission>>>,
) {
  const target =
    submission.apparatus?.name ?? submission.equipmentItem?.name ?? submission.template.name;
  const failed = [...submission.itemResults].sort(
    (a, b) => a.checklistItem.sortOrder - b.checklistItem.sortOrder,
  );
  const failedLines = failed.map((r) => {
    const { section, label } = r.checklistItem;
    return `- ${section ? `${section}: ` : ""}${label}\n    Note: ${r.note ?? "(none)"}`;
  });

  const appUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const count = `${failed.length} item${failed.length === 1 ? "" : "s"}`;
  const subject = `FAILED: ${submission.template.name} (${count})`;
  const text = [
    `${target} failed its check: ${count} failed.`,
    "",
    `Checklist: ${submission.template.name}`,
    `Checked by: ${submission.submittedBy.name}`,
    `When: ${formatDateTime(submission.submittedAt)}`,
    "",
    "Failed items:",
    ...failedLines,
    ...(submission.notes ? ["", `Overall notes: ${submission.notes}`] : []),
    ...(appUrl ? ["", `See the full results: ${appUrl}/officer/checks/${submission.id}`] : []),
    "",
    "Sent automatically by MTVFR Equipment Checks to all active officers.",
  ].join("\n");

  return { subject, text };
}

// Emails every active officer about a failed check and records the attempt
// on a FailureAlert row. Never throws: the check itself is already saved.
export async function sendFailureAlert(submissionId: string): Promise<void> {
  const [submission, officers] = await Promise.all([
    loadFailedSubmission(submissionId),
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

  const settings = mailerStatus();
  const skipReason =
    recipientEmails.length === 0
      ? "No active officers to notify"
      : !settings.configured
        ? `Email sending is not set up (missing ${settings.missing.join(", ")})`
        : null;
  if (skipReason) {
    await prisma.failureAlert.update({
      where: { id: alert.id },
      data: { status: "FAILED", attempts: 1, lastError: skipReason },
    });
    return;
  }

  try {
    const { subject, text } = buildFailureAlertEmail(submission);
    await sendEmail({ to: recipientEmails, subject, text });
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

// Sends a short test message so officers can confirm the email settings
// work without failing a real check. Returns an error message, or null.
export async function sendTestEmail(to: string): Promise<string | null> {
  try {
    await sendEmail({
      to: [to],
      subject: "Test: MTVFR Equipment Checks alerts",
      text: [
        "This is a test from MTVFR Equipment Checks.",
        "",
        "If you received it, failed-check alerts will reach the officers.",
      ].join("\n"),
    });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
