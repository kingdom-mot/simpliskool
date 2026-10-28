import { classLabel } from "@/components/admin";
import { requireSchool } from "@/lib/auth";
import { loadTerms, termLabel } from "@/lib/fees";
import { RESULTS_ADMIN, gradeOf, type ClassResults } from "@/lib/results";
import { loadScale } from "@/lib/results-load";

function csv(rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { supabase, school } = await requireSchool(RESULTS_ADMIN);
  const classId = url.searchParams.get("class") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(classId)) return new Response("Choose a class", { status: 400 });
  const { term } = await loadTerms(supabase, school.id, url.searchParams.get("term") ?? undefined);
  const { data: cls } = await supabase.from("classes").select("name, arm").eq("id", classId).eq("school_id", school.id).maybeSingle<{ name: string; arm: string }>();
  if (!term || !cls) return new Response("Not found", { status: 404 });
  const [{ data }, scale] = await Promise.all([supabase.rpc("class_results", { p_class: classId, p_term: term.id }), loadScale(supabase, school.id)]);
  const r = data as ClassResults | null;
  if (!r) return new Response("Not allowed", { status: 403 });
  const rows: (string | number | null)[][] = [["Student", "Admission no", ...r.subjects.flatMap((s) => [`${s.name} total`, `${s.name} grade`]), "Average", "Position"]];
  for (const st of r.students) {
    rows.push([
      st.name,
      st.admission_no,
      ...r.subjects.flatMap((s) => {
        const x = st.scores[s.id];
        return x ? [Number(x.total), gradeOf(Number(x.total), scale)?.grade ?? ""] : ["", ""];
      }),
      st.average,
      st.position,
    ]);
  }
  const name = `${school.slug}-${classLabel(cls.name, cls.arm)}-${termLabel(term)}-broadsheet.csv`.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return new Response(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
