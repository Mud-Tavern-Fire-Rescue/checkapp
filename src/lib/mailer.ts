import nodemailer from "nodemailer";

// Sends plain-text email one of two ways, chosen by which settings exist:
//
//   Microsoft 365 (production): MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET,
//     ALERT_FROM_EMAIL. Uses Microsoft Graph with an app registration that has
//     the Mail.Send application permission. Exchange Online is retiring
//     password-based SMTP, so this is the supported way to send from
//     truckcheck@mudtavernfire.org.
//   SMTP (local development with maildev): SMTP_HOST, SMTP_PORT,
//     ALERT_FROM_EMAIL, and optionally SMTP_USER / SMTP_PASSWORD.

const TIMEOUT_MS = 10_000; // never let email hold up saving a check

const MICROSOFT_SETTINGS = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "ALERT_FROM_EMAIL"] as const;
const SMTP_SETTINGS = ["SMTP_HOST", "SMTP_PORT", "ALERT_FROM_EMAIL"] as const;

function missing(names: readonly string[]) {
  return names.filter((name) => !process.env[name]?.trim());
}

export type MailerStatus =
  | { configured: true; method: "Microsoft 365" | "SMTP"; from: string }
  | { configured: false; missing: string[] };

export function mailerStatus(): MailerStatus {
  const from = process.env.ALERT_FROM_EMAIL?.trim() ?? "";
  const anyMicrosoft = ["MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET"].some(
    (name) => process.env[name]?.trim(),
  );
  if (anyMicrosoft) {
    const gaps = missing(MICROSOFT_SETTINGS);
    return gaps.length ? { configured: false, missing: gaps } : { configured: true, method: "Microsoft 365", from };
  }
  const gaps = missing(SMTP_SETTINGS);
  if (gaps.length === 0) return { configured: true, method: "SMTP", from };
  return { configured: false, missing: missing(MICROSOFT_SETTINGS) };
}

// "MTVFR Equipment Checks <truckcheck@mudtavernfire.org>" -> the address only.
function bareAddress(from: string) {
  return from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();
}

async function microsoftAccessToken(): Promise<string> {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_TENANT_ID!.trim())}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MS_CLIENT_ID!.trim(),
        client_secret: process.env.MS_CLIENT_SECRET!.trim(),
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(
      `Microsoft sign-in failed (${response.status}): ${body.error_description?.split("\r\n")[0] ?? "no details"}`,
    );
  }
  return body.access_token;
}

async function sendWithMicrosoft(to: string[], subject: string, text: string) {
  const token = await microsoftAccessToken();
  const sender = bareAddress(process.env.ALERT_FROM_EMAIL!);
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: "Text", content: text },
          toRecipients: to.map((address) => ({ emailAddress: { address } })),
        },
        saveToSentItems: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (response.status !== 202) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    const code = body.error?.code ? ` ${body.error.code}` : "";
    throw new Error(
      `Microsoft could not send the email (${response.status}${code}): ${body.error?.message ?? "no details"}`,
    );
  }
}

async function sendWithSmtp(to: string[], subject: string, text: string) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  await nodemailer
    .createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    })
    .sendMail({ from: process.env.ALERT_FROM_EMAIL, to, subject, text });
}

// Throws with a readable message if the email couldn't be sent.
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string[];
  subject: string;
  text: string;
}): Promise<void> {
  const status = mailerStatus();
  if (!status.configured) {
    throw new Error(`Email sending is not set up (missing ${status.missing.join(", ")})`);
  }
  if (status.method === "Microsoft 365") {
    await sendWithMicrosoft(to, subject, text);
  } else {
    await sendWithSmtp(to, subject, text);
  }
}
