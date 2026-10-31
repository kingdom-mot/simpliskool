import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { resetDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rebuilds the demo schools with fresh data. Vercel Cron calls it at midnight Lagos time (see vercel.json). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await resetDemo()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
