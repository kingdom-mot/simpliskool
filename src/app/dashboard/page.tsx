import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { homeForRole, requireUser, ROLE_LABEL, SCHOOL_COOKIE } from "@/lib/auth";
import { chooseSchool } from "./actions";
import { chooseGroup } from "@/app/group/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { GROUP_ROLE_LABEL, type GroupRole } from "@/lib/group";

export default async function DashboardPage() {
  const { memberships, user } = await requireUser();
  // School groups this person looks after (proprietor, group finance, director of studies).
  const { data: groupRows } = await createAdminClient()
    .from("group_members")
    .select("group_id, role, school_groups(name)")
    .eq("user_id", user.id)
    .returns<{ group_id: string; role: GroupRole; school_groups: { name: string } | null }[]>()
    .then((r) => (r.error ? { data: [] } : r)); // before database file 0017
  const groups = groupRows ?? [];

  if (memberships.length === 0 && groups.length === 0) redirect("/onboarding");

  // One school and one role: go straight in.
  if (memberships.length === 1 && groups.length === 0) {
    const only = memberships[0];
    if ((await cookies()).get(SCHOOL_COOKIE)?.value === only.school_id) redirect(homeForRole(only.role));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-mist px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Image src="/simpliskool-logo-dark.png" alt="Simpliskool" width={200} height={45} />
        </div>
        <div className="card">
          <h1 className="text-lg font-semibold text-brand-navy">Choose where to go</h1>
          <ul className="mt-4 space-y-2">
            {groups.map((g) => (
              <li key={g.group_id}>
                <form action={chooseGroup}>
                  <input type="hidden" name="group_id" value={g.group_id} />
                  <button className="flex w-full items-center justify-between rounded-lg border-2 border-brand-navy/20 bg-brand-cloud px-4 py-3 text-left hover:border-brand-teal">
                    <span>
                      <span className="block font-medium text-slate-900">{g.school_groups?.name ?? "School group"}</span>
                      <span className="block text-xs text-slate-500">All branches · {GROUP_ROLE_LABEL[g.role]}</span>
                    </span>
                    <span className="text-brand-teal">→</span>
                  </button>
                </form>
              </li>
            ))}
            {memberships.map((m) => (
              <li key={`${m.school_id}-${m.role}`}>
                <form action={chooseSchool}>
                  <input type="hidden" name="school_id" value={m.school_id} />
                  <input type="hidden" name="role" value={m.role} />
                  <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-brand-teal">
                    <span>
                      <span className="block font-medium text-slate-900">{m.schools?.name}</span>
                      <span className="block text-xs text-slate-500">{ROLE_LABEL[m.role]}</span>
                    </span>
                    <span className="text-brand-teal">→</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Link href="/onboarding" className="mt-4 block text-center text-sm text-brand-teal hover:underline">
            Set up a new school
          </Link>
        </div>
      </div>
    </main>
  );
}
