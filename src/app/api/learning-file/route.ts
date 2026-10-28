import { NextResponse, type NextRequest } from "next/server";
import { BUCKET } from "@/lib/learning-files";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { HwFile } from "@/lib/teaching";

export const dynamic = "force-dynamic";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ATTACH = new RegExp(`^(${UUID})/hw/(${UUID})/attach/[\\w.-]+$`);
const WORK = new RegExp(`^(${UUID})/hw/(${UUID})/(${UUID})/[\\w.-]+$`);

/**
 * Serves one homework file after checking, with the person's own access rules,
 * that they may see the homework (worksheet) or that student's work.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("p") ?? "";
  const supabase = await createClient();
  let files: HwFile[] | null = null;
  const a = path.match(ATTACH);
  const w = path.match(WORK);
  if (a) {
    const { data } = await supabase.from("homework").select("attachments").eq("id", a[2]).eq("school_id", a[1]).maybeSingle<{ attachments: HwFile[] }>();
    files = data?.attachments ?? null;
  } else if (w) {
    const { data } = await supabase.from("homework_submissions").select("files").eq("homework_id", w[2]).eq("student_id", w[3]).eq("school_id", w[1]).maybeSingle<{ files: HwFile[] }>();
    files = data?.files ?? null;
  }
  const file = files?.find((f) => f.path === path);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: blob, error } = await createAdminClient().storage.from(BUCKET).download(path);
  if (error || !blob) return NextResponse.json({ error: "not found" }, { status: 404 });
  const inline = file.type.startsWith("image/") || file.type === "application/pdf";
  return new NextResponse(blob, {
    headers: {
      "content-type": file.type,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${file.name.replace(/"/g, "")}"`,
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
