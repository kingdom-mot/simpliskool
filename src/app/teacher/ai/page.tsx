import { PageHero } from "@/components/admin";
import { PortalShell } from "@/components/PortalShell";
import { Empty } from "@/components/ui";
import { aiReady } from "@/lib/ai";
import { aiLimit, aiUsed } from "@/lib/ai-teach";
import { requireSchool } from "@/lib/auth";
import { TEACHER_NAV } from "@/lib/nav";
import { myClassSubjects } from "@/lib/teaching";
import { Assistant } from "./Assistant";
import type { Task } from "./actions";

export const metadata = { title: "AI assistant" };

export default async function AiAssistant(props: { searchParams: Promise<{ task?: string; topic?: string }> }) {
  const sp = await props.searchParams;
  const { supabase, school, user, fullName } = await requireSchool(["teacher"]);
  const mine = await myClassSubjects(supabase, school.id, user.id);
  const ready = aiReady();
  const used = ready ? await aiUsed(supabase, user.id) : 0;
  const task: Task = sp.task === "quiz" || sp.task === "simpler" || sp.task === "homework" ? sp.task : "note";
  return (
    <PortalShell school={school} roleLabel="Teacher" fullName={fullName} groups={TEACHER_NAV} active="ai">
      <div className="flex flex-col gap-5">
        <PageHero title="AI teaching assistant" sub="Drafts you check and edit" />
        {!ready ? (
          <Empty>The AI assistant isn&apos;t switched on for your school yet. Ask the school owner to contact Simpliskool.</Empty>
        ) : !mine.length ? (
          <Empty>You don&apos;t have any subjects yet. The school admin gives teachers their subjects under Classes and subjects.</Empty>
        ) : (
          <Assistant classes={mine.map((m) => ({ id: m.id, label: m.label }))} used={used} limit={aiLimit()} start={{ task, topic: (sp.topic ?? "").slice(0, 80) }} />
        )}
      </div>
    </PortalShell>
  );
}
