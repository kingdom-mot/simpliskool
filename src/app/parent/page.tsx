import { releaseDueSoon } from "@/lib/announce";
import { requireSchool } from "@/lib/auth";
import { homeworkFor } from "@/lib/homework-load";
import { LEGAL_VERSION } from "@/lib/legal";
import { ParentView, type DueItem, type ParentData } from "./ParentView";
import { PrivacyNotice } from "./PrivacyNotice";

const dueWindow = () => ({ until: Date.now() + 7 * 86400000, since: Date.now() - 86400000 });

export default async function ParentHome(props: { searchParams: Promise<{ child?: string }> }) {
  const searchParams = await props.searchParams;
  const { supabase, school, fullName, user } = await requireSchool(["parent"]);
  await releaseDueSoon();
  const [{ data }, { count: seen, error: seenError }] = await Promise.all([
    supabase.rpc("parent_dashboard", { p_school: school.id }),
    supabase.from("legal_acceptances").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("user_id", user.id).eq("document", "parent_notice").eq("version", LEGAL_VERSION),
  ]);
  const d = (data as ParentData | null) ?? null;
  const kid = d?.children.find((k) => k.id === searchParams.child) ?? d?.children[0];
  let due: DueItem[] = [];
  if (kid) {
    const { data: st } = await supabase.from("students").select("id, class_id").eq("id", kid.id).maybeSingle<{ id: string; class_id: string | null }>();
    const { until, since } = dueWindow();
    due = st
      ? (await homeworkFor(supabase, st))
          .filter((h) => Date.parse(h.due_at) <= until && (h.state !== "todo" || Date.parse(h.due_at) >= since))
          .sort((a, b) => a.due_at.localeCompare(b.due_at))
          .slice(0, 4)
          .map((h) => ({ id: h.id, title: h.title, subject: h.subject, due_at: h.due_at, state: h.state, score: h.sub?.score ?? null, max: h.max_marks }))
      : [];
  }
  const showNotice = !seenError && !seen;
  return <ParentView school={school} fullName={fullName} d={d} childId={searchParams.child} due={due} notice={showNotice ? <PrivacyNotice schoolName={school.name} /> : undefined} />;
}
