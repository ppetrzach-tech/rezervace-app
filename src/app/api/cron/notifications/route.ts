import { NextRequest, NextResponse } from "next/server";
import { processNotifications } from "@/lib/notification-engine";

/**
 * Endpoint pro spouštění notifikačního engine.
 *
 * Doporučené spouštění:
 *  - Externí cron (cron-job.org — zdarma, každých 15 min) — pro plnou funkčnost
 *  - Nebo Vercel cron 1× denně — funguje, ale 2h-před-SMS nebude přesné
 *
 * Volá se s headerem: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const queryToken = new URL(req.url).searchParams.get("token");
    if (auth !== `Bearer ${secret}` && queryToken !== secret) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }
  }

  const result = await processNotifications();
  return NextResponse.json(result);
}
