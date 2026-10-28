import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { dispatchDue } from "@/lib/announce";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Releases scheduled announcements and sends their emails and texts.
 * Called by Vercel Cron (daily, see vercel.json) and, optionally, by Supabase
 * pg_cron every few minutes. Needs CRON_SECRET: Vercel sends it as
 * "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const out = await dispatchDue();
  return NextResponse.json({ ok: true, ...out });
}
