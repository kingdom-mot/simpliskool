import Link from "next/link";
import { AdminPage, classLabel, requireAdminPage } from "@/components/admin";
import { Empty } from "@/components/ui";
import { PinSheet } from "./PinSheet";

export default async function PinsPage({ searchParams }: { searchParams: { class?: string } }) {
  const ctx = await requireAdminPage();
  const { supabase, school } = ctx;
  const { data: classes } = await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).order("level_order").order("name").order("arm");
  const cls = classes?.find((c) => c.id === searchParams.class);

  let body: React.ReactNode;
  if (!cls) {
    body = (
      <section aria-labelledby="pick-h" className="flex flex-col gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-[22px]">
        <h2 id="pick-h" className="text-lg !text-c1">Choose a class</h2>
        {classes?.length ? (
          <ul className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <li key={c.id}>
                <Link className="s-btn2" href={`/admin/students/pins?class=${c.id}`}>
                  {classLabel(c.name, c.arm)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No classes yet.</Empty>
        )}
      </section>
    );
  } else {
    const [{ data: students }, { data: status }] = await Promise.all([
      supabase.from("students").select("id, first_name, last_name, signin_method").eq("class_id", cls.id).eq("status", "active").order("last_name").order("first_name"),
      supabase.rpc("class_pin_status", { p_class: cls.id }),
    ]);
    const has = new Map(((status as { student_id: string; has_pin: boolean }[] | null) ?? []).map((r) => [r.student_id, r.has_pin]));
    const list = (students ?? []).filter((s) => s.signin_method === "pin").map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`, hasPin: !!has.get(s.id) }));
    body = list.length ? (
      <PinSheet students={list} className={classLabel(cls.name, cls.arm)} schoolName={school.name} schoolCode={school.slug} loginHost={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com"} />
    ) : (
      <Empty>No students in {classLabel(cls.name, cls.arm)} sign in with a PIN.</Empty>
    );
  }

  return (
    <AdminPage ctx={ctx} active="students" crumb={[{ label: "Students", href: "/admin/students" }]} title="Print PIN slips">
      {body}
    </AdminPage>
  );
}
