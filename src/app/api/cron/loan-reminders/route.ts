import { sendDueTodayReminders } from "@/lib/loans";

// Called once a day by Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; anything else is refused, so the
// route can't be used to send email on demand.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await sendDueTodayReminders();
  return Response.json(result);
}
